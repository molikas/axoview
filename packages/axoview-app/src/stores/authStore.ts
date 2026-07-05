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

export type AuthStatus =
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATING'
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
  user: null,
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
    set({ status: 'AUTHENTICATING' });
    return new Promise<void>((resolve) => {
      // signIn always resolves — both success and denial settle the waiter.
      set((s) => ({ _waiters: [...s._waiters, { resolve, reject: resolve }] }));
      _requestToken();
    });
  },

  signOut: () => {
    const { accessToken, _revoke, _waiters } = get();
    if (accessToken && _revoke) _revoke(accessToken);
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
    // initiated is in flight (AUTHENTICATING or REFRESHING).
    const s = get().status;
    if (s !== 'AUTHENTICATING' && s !== 'REFRESHING') return;
    const expiresAt = Date.now() + (resp.expires_in ?? 3600) * 1000;
    const waiters = get()._waiters;
    set({
      status: 'AUTHENTICATED',
      accessToken: resp.access_token,
      expiresAt,
      _waiters: []
    });
    waiters.forEach((w) => w.resolve());
    if (!get().user) void fetchUserInfo(resp.access_token);
  },

  _onError: (reason) => {
    const s = get().status;
    // Ignore a late error after the request was abandoned (see _onToken).
    if (s !== 'AUTHENTICATING' && s !== 'REFRESHING') return;
    const wasRefresh = s === 'REFRESHING';
    const waiters = get()._waiters;
    set({ _waiters: [] });
    if (wasRefresh) {
      set({ status: 'SESSION_EXPIRED', accessToken: null, expiresAt: null });
      pushExpiredNotice(() => void get().signIn());
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

/** Fetch name/email/avatar once per session. Non-fatal on failure. */
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
    useAuthStore.getState()._setUser({
      name: data.name || data.email || 'Google account',
      email: data.email || '',
      avatarUrl: data.picture || ''
    });
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
