import { useEffect, useRef, useState } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { useAppStorage } from './AppStorageContext';
import { useAuthStore } from '../stores/authStore';
import { authDebug } from '../utils/authDebug';

// ADR 0035 — scopes requested exactly. drive.file is non-sensitive (no Google
// security assessment); openid/profile/email populate the avatar + name.
const DRIVE_SCOPE =
  'openid profile email https://www.googleapis.com/auth/drive.file';

interface RevocableOAuth2 {
  google?: { accounts?: { oauth2?: { revoke?: (token: string, done?: () => void) => void } } };
}

function AuthBridge({
  scriptReady,
  children
}: {
  scriptReady: boolean;
  children: React.ReactNode;
}) {
  const setBridge = useAuthStore((s) => s._setBridge);
  const reconnectAttemptedRef = useRef(false);
  const gestureCleanupRef = useRef<(() => void) | null>(null);

  // GIS token client (implicit flow). The returned `login` triggers the flow;
  // calling it with { prompt: '' } attempts a silent (re)acquisition.
  const login = useGoogleLogin({
    flow: 'implicit',
    scope: DRIVE_SCOPE,
    onSuccess: (resp) => useAuthStore.getState()._onToken(resp),
    onError: (err) => useAuthStore.getState()._onError(err),
    // Popup closed / blocked / failed to open — routed to the same handler so
    // the store leaves AUTHENTICATING and the user can retry.
    onNonOAuthError: (err) => useAuthStore.getState()._onError(err)
  });

  useEffect(() => {
    setBridge({
      requestToken: (opts) => {
        // Silent attempts carry the login_hint (persisted account email) so a
        // multi-account browser doesn't need the chooser — chooser = failure
        // for a prompt:'' request.
        if (opts?.prompt === '') {
          login({ prompt: '', ...(opts.hint ? { hint: opts.hint } : {}) });
        } else {
          login();
        }
      },
      revoke: (token) => {
        const g = (window as unknown as RevocableOAuth2).google;
        g?.accounts?.oauth2?.revoke?.(token);
      }
    });
  }, [login, setBridge]);

  // Remember-me boot reconnect: one silent prompt:'' attempt per page load,
  // fired only once the GIS script has actually loaded (a premature call would
  // error out and burn the attempt). No-op inside the store when no profile
  // hint is present.
  //
  // Popup-blocker fallback (owner pick 2026-07-06, ADR 0035 §3 amendment):
  // GIS mints tokens through a self-closing popup, and browsers block popups
  // that carry no user activation — so the BOOT attempt fails in a default
  // browser ("Failed to open popup window", confirmed in live test). When it
  // does, arm ONE retry on the next gesture anywhere: a click carries popup
  // permission, so the popup opens and self-closes in a blink and the session
  // restores. One-shot per page load, remembered users only. The definitive
  // no-popup fix (worker auth-code flow + HttpOnly refresh-token cookie) is
  // catalogued as a pre-master slice.
  useEffect(() => {
    if (!scriptReady || reconnectAttemptedRef.current) return;
    reconnectAttemptedRef.current = true;
    void useAuthStore
      .getState()
      .attemptSilentReconnect()
      .then(() => {
        const s = useAuthStore.getState();
        if (s.status !== 'UNAUTHENTICATED' || !s.user) return; // restored, or no hint
        const retry = () => {
          gestureCleanupRef.current?.();
          gestureCleanupRef.current = null;
          const st = useAuthStore.getState();
          if (st.status === 'UNAUTHENTICATED' && st.user) {
            authDebug('[auth] silent reconnect: gesture retry');
            void st.attemptSilentReconnect();
          }
        };
        const cleanup = () => {
          window.removeEventListener('pointerdown', retry, true);
          window.removeEventListener('keydown', retry, true);
        };
        gestureCleanupRef.current = cleanup;
        // Capture phase so a click that stops propagation still arms us.
        window.addEventListener('pointerdown', retry, true);
        window.addEventListener('keydown', retry, true);
        authDebug('[auth] silent reconnect: armed one-shot gesture retry');
      });
    return () => {
      gestureCleanupRef.current?.();
      gestureCleanupRef.current = null;
    };
  }, [scriptReady]);

  return <>{children}</>;
}

/**
 * Wraps the app in the GIS provider once a client id is known. Mounted inside
 * AppStorageProvider so it can read the id from runtime config; the client id
 * may also come from the build-time PUBLIC_ fallback (local dev). When no id is
 * configured, renders children unwrapped — every Google surface hides itself.
 *
 * Note: authStore is a standalone zustand store (not React context), so the
 * toolbar can read/drive auth regardless of where this provider sits in the
 * tree; only AuthBridge's useGoogleLogin needs the GoogleOAuthProvider ancestor.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { runtimeConfig } = useAppStorage();
  const [scriptReady, setScriptReady] = useState(false);
  const clientId =
    runtimeConfig?.googleClientId ||
    process.env.PUBLIC_GOOGLE_CLIENT_ID ||
    null;

  if (!clientId) return <>{children}</>;

  return (
    <GoogleOAuthProvider
      clientId={clientId}
      onScriptLoadSuccess={() => setScriptReady(true)}
    >
      <AuthBridge scriptReady={scriptReady}>{children}</AuthBridge>
    </GoogleOAuthProvider>
  );
}
