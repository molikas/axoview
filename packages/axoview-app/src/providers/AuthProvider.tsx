import { useEffect, useRef, useState } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { useAppStorage } from './AppStorageContext';
import { useAuthStore } from '../stores/authStore';

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
        if (opts?.prompt === '') login({ prompt: '' });
        else login();
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
  useEffect(() => {
    if (!scriptReady || reconnectAttemptedRef.current) return;
    reconnectAttemptedRef.current = true;
    void useAuthStore.getState().attemptSilentReconnect();
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
