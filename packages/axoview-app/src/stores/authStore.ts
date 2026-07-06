import { create } from 'zustand';
import { notificationStore } from './notificationStore';

// ADR 0035 — Google Identity & Drive Authorization (token model).
//
// Browser-side GIS token flow: an implicit-grant access token (~1h), held in
// memory ONLY. There is NO refresh token and NO client secret. "Refresh" means
// silently re-invoking the GIS token client (prompt: ''), which succeeds only
// while the browser session allows it — otherwise the user re-consents.
//
// The store never persists the token (no zustand persist middleware): the unit
// suite spies on localStorage.setItem to enforce this.
//
// 2026-07-06 amendment (storage-ux-unification): the user's PROFILE (name /
// email / avatar URL — never the token) persists in localStorage as a
// "remember me" hint. On boot, a present hint triggers one silent token
// attempt (RECONNECTING); failure degrades quietly to a signed-out avatar
// with a reconnect affordance — no toast, no popup.

export type AuthStatus =
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATING'
  | 'RECONNECTING'
  | 'AUTHENTICATED'
  | 'REFRESHING'
  | 'SESSION_EXPIRED';

export interface AuthUser {
  name: string;
  email: string;
  avatarUrl: string;
}

/** Subset of the GIS token response we consume. */
export interface TokenResponse {
  access_token: string;
  expires_in?: number;
}

type TokenRequest = (opts?: { prompt?: string }) => void;
type TokenRevoke = (token: string) => void;

interface Waiter {
  resolve: () => void;
  reject: () => void;
}

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  accessToken: string | null;
  expiresAt: number | null; // epoch ms

  // Bridge to the GIS token client, registered by AuthProvider. Null until the
  // provider mounts (or when no client id is configured) — every entry point
  // guards on it so pre-bridge calls are safe no-ops.
  _requestToken: TokenRequest | null;
  _revoke: TokenRevoke | null;
  _waiters: Waiter[];

  _setBridge: (bridge: { requestToken: TokenRequest; revoke: TokenRevoke }) => void;

  /** Interactive sign-in. Always resolves (never throws). */
  signIn: () => Promise<void>;
  signOut: () => void;
  /**
   * Boot-time silent reconnect: fires one prompt:'' token request when a
   * profile hint exists. Quiet on failure (no toast, no state-machine noise) —
   * the avatar's reconnect affordance is the recovery path. No-op unless a
   * hint is present and the store is UNAUTHENTICATED.
   */
  attemptSilentReconnect: () => Promise<void>;
  /**
   * The ONLY way any module obtains the access token. Returns the current token
   * if healthy (>5min to expiry), attempts a silent refresh if near expiry, or
   * null when unauthenticated / refresh failed.
   */
  getValidToken: () => Promise<string | null>;
  /** Force SESSION_EXPIRED (e.g. a Drive 401 despite a not-yet-expired token). */
  markExpired: () => void;

  // Called by AuthProvider's GIS callbacks — not for external use.
  _onToken: (resp: TokenResponse) => void;
  _onError: (reason?: unknown) => void;
  _setUser: (user: AuthUser | null) => void;
}

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

// Profile hint — identity only, NEVER credentials. Presence means "this
// browser signed in before"; it drives the boot reconnect + avatar rendering.
const PROFILE_HINT_KEY = 'axoview-google-profile';

function loadProfileHint(): AuthUser | null {
  try {
    const raw = localStorage.getItem(PROFILE_HINT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const p = parsed as Partial<AuthUser>;
    if (typeof p.name !== 'string') return null;
    return {
      name: p.name,
      email: typeof p.email === 'string' ? p.email : '',
      avatarUrl: typeof p.avatarUrl === 'string' ? p.avatarUrl : ''
    };
  } catch {
    return null;
  }
}

function saveProfileHint(user: AuthUser): void {
  try {
    localStorage.setItem(PROFILE_HINT_KEY, JSON.stringify(user));
  } catch {
    /* hint is an accelerator only */
  }
}

function clearProfileHint(): void {
  try {
    localStorage.removeItem(PROFILE_HINT_KEY);
  } catch {
    /* ignore */
  }
}

// Toast copy stays literal here: this store is imported by non-React modules
// and unit suites where the i18n singleton (http-backend init) must not load.
// Catalogued i18n debt — see the storage-ux-unification tactical doc.
function pushExpiredNotice(signIn: () => void): void {
  notificationStore.push({
    severity: 'warning',
    persistent: true,
    message:
      'Your Google session expired. Sign in again to keep saving to Google Drive.',
    action: { label: 'Sign in again', onClick: signIn }
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'UNAUTHENTICATED',
  // Remember-me: pre-populate identity from the hint so the avatar renders
  // (in its needs-reconnect state) from the first paint after a reload.
  user: loadProfileHint(),
  accessToken: null,
  expiresAt: null,
  _requestToken: null,
  _revoke: null,
  _waiters: [],

  _setBridge: ({ requestToken, revoke }) => {
    set({ _requestToken: requestToken, _revoke: revoke });
  },

  signIn: () => {
    const { _requestToken } = get();
    if (!_requestToken) return Promise.resolve();
    // A silent boot reconnect may still be in flight — the interactive request
    // supersedes it; both settle from the same waiter list.
    set({ status: 'AUTHENTICATING' });
    return new Promise<void>((resolve) => {
      // signIn always resolves — both success and denial settle the waiter.
      set((s) => ({ _waiters: [...s._waiters, { resolve, reject: resolve }] }));
      _requestToken();
    });
  },

  attemptSilentReconnect: () => {
    const s = get();
    if (!s._requestToken || !s.user) return Promise.resolve();
    if (s.status !== 'UNAUTHENTICATED') return Promise.resolve();
    set({ status: 'RECONNECTING' });
    return new Promise<void>((resolve) => {
      set((st) => ({ _waiters: [...st._waiters, { resolve, reject: resolve }] }));
      s._requestToken!({ prompt: '' });
    });
  },

  signOut: () => {
    const { accessToken, _revoke, _waiters } = get();
    if (accessToken && _revoke) _revoke(accessToken);
    clearProfileHint();
    set({
      status: 'UNAUTHENTICATED',
      user: null,
      accessToken: null,
      expiresAt: null,
      _waiters: []
    });
    // Settle any in-flight signIn/getValidToken promise so its awaiter (e.g. a
    // Drive request mid-refresh) doesn't hang forever on the discarded waiter.
    _waiters.forEach((w) => w.reject());
  },

  getValidToken: () => {
    const s = get();
    if (s.status === 'UNAUTHENTICATED' || s.status === 'SESSION_EXPIRED') {
      return Promise.resolve(null);
    }
    if (
      s.accessToken &&
      s.expiresAt &&
      s.expiresAt - Date.now() > REFRESH_MARGIN_MS
    ) {
      return Promise.resolve(s.accessToken);
    }
    // A request is already in flight (boot reconnect, interactive sign-in, or
    // another caller's refresh) — piggyback on it instead of firing a second
    // GIS request that would race the first.
    if (
      s.status === 'AUTHENTICATING' ||
      s.status === 'RECONNECTING' ||
      s.status === 'REFRESHING'
    ) {
      return new Promise<string | null>((resolve) => {
        set((st) => ({
          _waiters: [
            ...st._waiters,
            { resolve: () => resolve(get().accessToken ?? null), reject: () => resolve(null) }
          ]
        }));
      });
    }
    // Near expiry (or no token yet) — attempt a silent refresh.
    if (!s._requestToken) return Promise.resolve(s.accessToken ?? null);
    set({ status: 'REFRESHING' });
    return new Promise<string | null>((resolve) => {
      set((st) => ({
        _waiters: [
          ...st._waiters,
          { resolve: () => resolve(get().accessToken ?? null), reject: () => resolve(null) }
        ]
      }));
      s._requestToken!({ prompt: '' });
    });
  },

  markExpired: () => {
    if (get().status === 'SESSION_EXPIRED') return;
    const waiters = get()._waiters;
    set({ status: 'SESSION_EXPIRED', accessToken: null, expiresAt: null, _waiters: [] });
    // Settle in-flight waiters (a concurrent refresh) so nothing hangs.
    waiters.forEach((w) => w.reject());
    pushExpiredNotice(() => void get().signIn());
  },

  _onToken: (resp) => {
    // Ignore a grant that arrives after the request was abandoned (signOut /
    // markExpired reset the status) — otherwise a late token would resurrect a
    // signed-out or expired session. A real grant only lands while a request we
    // initiated is in flight (AUTHENTICATING, RECONNECTING or REFRESHING).
    const s = get().status;
    if (s !== 'AUTHENTICATING' && s !== 'RECONNECTING' && s !== 'REFRESHING') return;
    const freshGrant = s === 'AUTHENTICATING' || s === 'RECONNECTING';
    const expiresAt = Date.now() + (resp.expires_in ?? 3600) * 1000;
    const waiters = get()._waiters;
    set({
      status: 'AUTHENTICATED',
      accessToken: resp.access_token,
      expiresAt,
      _waiters: []
    });
    waiters.forEach((w) => w.resolve());
    // Fresh grants re-fetch the profile (the popup may have picked a different
    // account than the hint); mid-session refreshes keep the live profile.
    if (freshGrant || !get().user) void fetchUserInfo(resp.access_token);
  },

  _onError: (reason) => {
    const s = get().status;
    // Ignore a late error after the request was abandoned (see _onToken).
    if (s !== 'AUTHENTICATING' && s !== 'RECONNECTING' && s !== 'REFRESHING') return;
    const waiters = get()._waiters;
    set({ _waiters: [] });
    if (s === 'REFRESHING') {
      set({ status: 'SESSION_EXPIRED', accessToken: null, expiresAt: null });
      pushExpiredNotice(() => void get().signIn());
      waiters.forEach((w) => w.reject());
    } else if (s === 'RECONNECTING') {
      // Boot reconnect failed (cookie blocking, signed out of Google, popup
      // suppressed without a gesture). Expected — degrade QUIETLY: the avatar
      // shows the reconnect affordance; no toast, no popup.
      set({ status: 'UNAUTHENTICATED', accessToken: null, expiresAt: null });
      waiters.forEach((w) => w.reject());
    } else {
      set({ status: 'UNAUTHENTICATED' });
      notificationStore.push({ severity: 'info', message: 'Sign-in cancelled' });
      waiters.forEach((w) => w.reject());
    }
    void reason;
  },

  _setUser: (user) => set({ user })
}));

/** Fetch name/email/avatar once per grant. Non-fatal on failure. */
async function fetchUserInfo(token: string): Promise<void> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      name?: string;
      email?: string;
      picture?: string;
    };
    const user: AuthUser = {
      name: data.name || data.email || 'Google account',
      email: data.email || '',
      avatarUrl: data.picture || ''
    };
    useAuthStore.getState()._setUser(user);
    // Remember-me: persist identity (never the token) so the next reload can
    // render the avatar immediately and attempt the silent reconnect.
    saveProfileHint(user);
  } catch {
    // Avatar/name just won't populate — the token is still valid.
  }
}

/**
 * Imperative accessor for non-React modules (mirrors notificationStore). The
 * Drive provider reads the token exclusively through this.
 */
export const authStore = {
  getState: () => useAuthStore.getState(),
  signIn: () => useAuthStore.getState().signIn(),
  signOut: () => useAuthStore.getState().signOut(),
  getValidToken: () => useAuthStore.getState().getValidToken(),
  markExpired: () => useAuthStore.getState().markExpired()
};
