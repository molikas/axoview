# ADR 0035 — Google Identity & Drive Authorization (Token Model)

**Status:** Accepted (2026-07-06 — shipped on `integration` with the storage-ux-unification amendments below)
**Date:** 2026-07-05
**Supersedes:** none
**Superseded by:** none

## Context

Phase 3A (PLAN.md) gates the Google Drive storage provider ([ADR 0036](0036-google-drive-storage-provider.md)) on a working browser-side Google sign-in. The deployment rails for it were pre-built during productization and are already live:

- The worker's [`/api/config`](../../packages/axoview-worker/src/app.ts#L38) already returns `googleClientId` (from the `GOOGLE_CLIENT_ID` env var, per [ADR 0009 §4](0009-deployment-topology.md)) and `driveScopes: ['https://www.googleapis.com/auth/drive.file']`.
- The frontend [`RuntimeConfig`](../../packages/axoview-app/src/hooks/useRuntimeConfig.ts) already parses both fields; `googleClientId: null` is the documented "Drive unavailable — hide the UI" signal.
- The CSP in [`_headers`](../../packages/axoview-app/public/_headers) already allows `script-src`/`frame-src https://accounts.google.com`, `script-src https://apis.google.com`, and `connect-src https://www.googleapis.com https://oauth2.googleapis.com`.

The Google Cloud project is provisioned (project `axoview`, OAuth client ID `485371025824-2ullp84i3nda2dgceirg9q87fvm36kl8.apps.googleusercontent.com`) with authorized JavaScript origins `https://axoview.app` (canonical production domain since 2026-07-07 — `www.axoview.app` 301-redirects to it), `https://axoview.pages.dev` and `https://integration.axoview.pages.dev` (Cloudflare Pages defaults), and `http://localhost:3000` (dev). The client ID is a public identifier, not a secret — origin restriction is the security boundary.

What does **not** exist: any auth state, sign-in UI, or token plumbing in the app. The PLAN 3A spec predates two realities this ADR must reconcile: (a) the S3 provider was dropped 2026-04-29, so the PLAN's "Local | Drive | S3" picker text is stale; (b) the browser-only Google Identity Services (GIS) token model has **no refresh tokens**, so the PLAN's background-`REFRESHING` state needs an honest restatement.

## Decision

### 1. Flow: GIS token model via `@react-oauth/google`, no backend exchange

Sign-in uses the GIS **token client** (implicit grant → short-lived access token, ~1 h) through `@react-oauth/google`. There is no authorization-code exchange and no server-side token custody — the worker stays storage-less per [ADR 0009](0009-deployment-topology.md). Scopes requested, exactly: `openid profile email https://www.googleapis.com/auth/drive.file`. Identity (name/email/avatar) comes from one `GET https://www.googleapis.com/oauth2/v3/userinfo` call per session (already covered by `connect-src`).

### 2. Token custody

```typescript
// stores/authStore.ts (Zustand, NOT persisted)
type AuthStatus =
  | 'UNAUTHENTICATED' | 'AUTHENTICATING' | 'AUTHENTICATED'
  | 'REFRESHING' | 'SESSION_EXPIRED'

interface AuthStore {
  status: AuthStatus
  user: { name: string; email: string; avatarUrl: string } | null
  accessToken: string | null    // in-memory ONLY
  expiresAt: number | null      // epoch ms
  signIn(): Promise<void>
  signOut(): void
  getValidToken(): Promise<string | null>
}
```

Hard rules:
1. `authStore` never uses `zustand/middleware/persist` — the token never touches `localStorage`/`sessionStorage`/IndexedDB.
2. `getValidToken()` is the **only** way any module obtains the token (it re-requests when < 5 min to expiry); no direct `accessToken` reads outside the store.
3. On sign-out: null the token, revoke via `google.accounts.oauth2.revoke`, and switch the active storage provider back to `local` (ADR 0036 §6).

> **Amendment (2026-07-06, storage-ux-unification):** a **profile hint** — `{name, email, avatarUrl}`, *identity only, never a credential* — persists in `localStorage['axoview-google-profile']` (written on userinfo fetch, cleared on sign-out). It pre-populates the avatar on reload and arms the boot reconnect (§3 amendment). Rule 1 is unchanged and still test-enforced: no token-bearing value ever reaches storage. `getValidToken()` additionally **piggybacks** on any in-flight request (AUTHENTICATING / RECONNECTING / REFRESHING) instead of firing a second GIS request.

> **Amendment (2026-07-06, granular consent — shipped in `41fe523`, documented here 2026-07-07):** Google's consent screen lets a user sign in while leaving the Drive checkbox unchecked, so the granted scopes can be less than the requested ones. The store therefore tracks **`driveScopeGranted: boolean | null`**, derived from the token response's `scope` list (`null` = no token yet; a scope-less response — older GIS shapes, tests — is treated as granted rather than false-alarmed). Identity works either way, but Drive UI gates on this flag instead of letting every Drive call 403. Covered by `authStore.test.ts` (see [testing.md](../guidelines/testing.md)).

> **Amendment (2026-07-07, PR-59 review — superseded-request error absorption):** an interactive `signIn()` may overlap an in-flight silent request (boot reconnect or refresh), and GIS provides no request correlation on its callbacks. Without a guard, the superseded silent request's LATE error would be taken for the popup's own cancellation — resetting `AUTHENTICATING`, rejecting the waiters, and discarding the grant the user is about to complete. `signIn()` now flags the overlap (`_absorbStaleError`) and `_onError` absorbs exactly one error while `AUTHENTICATING`; the next error (or the grant) settles the state machine normally.

### 3. State machine — honest refresh semantics

The GIS token model cannot mint tokens in the background from a refresh token. "Refresh" means **re-invoking the token client with `prompt: ''`**, which succeeds silently only when the browser session and third-party-cookie posture allow it; otherwise Google opens the consent popup, which browsers block without a user gesture.

```
UNAUTHENTICATED  →(signIn, user gesture)→  AUTHENTICATING
AUTHENTICATING   →(success)→               AUTHENTICATED
AUTHENTICATING   →(denied/closed)→         UNAUTHENTICATED  + info toast "Sign-in cancelled"
AUTHENTICATED    →(getValidToken <5min)→   REFRESHING (prompt:'' attempt)
REFRESHING       →(silent success)→        AUTHENTICATED
REFRESHING       →(blocked/failed)→        SESSION_EXPIRED  + persistent warning w/ "Sign in again" action
SESSION_EXPIRED  →(signIn, user gesture)→  AUTHENTICATING
AUTHENTICATED    →(signOut)→               UNAUTHENTICATED  + storage → local
```

**Boot reconnect:** the token does not survive a reload. If `localStorage['axoview-active-provider'] === 'google-drive'` (ADR 0036 §6), boot attempts one silent `prompt: ''` acquisition; on failure the app stays in Local mode and shows a dismissible "Reconnect to Google Drive" chip in the toolbar — never a blocking dialog, never an unprompted popup.

> **Amendment (2026-07-06, storage-ux-unification):** as shipped, this paragraph's trigger never fired (the provider choice was not persisted). The reconnect is now armed by the **profile hint** (§2 amendment) instead: a new `RECONNECTING` state runs one silent `prompt:''` attempt per page load, once the GIS script reports loaded. Success → `AUTHENTICATED` with no popup and no clicks; failure → **quiet** degradation to `UNAUTHENTICATED` (no toast — the avatar's amber dot is the affordance; the "Reconnect" chip is retired). Silent requests carry the persisted email as **`login_hint`** — a hint-less `prompt:''` fails with "interaction required" in multi-account browsers.
>
> **Amendment 2 (2026-07-06 live-test, owner pick):** the boot attempt is **popup-blocked in default browsers** — GIS mints tokens through a self-closing popup, and a boot-time call carries no user activation (confirmed: `GSI_LOGGER Failed to open popup window`). When the boot attempt fails for a remembered user, AuthBridge arms a **one-shot gesture retry**: the next pointer/key gesture anywhere re-runs the silent attempt inside user activation, so the popup opens and self-closes in a blink and the session restores. This is a deliberate, narrow exception to the "no unprompted popup" rule — it fires at most once per page load, only for users whose remembered session is being restored. The definitive no-popup fix — **authorization-code flow with the refresh token in an HttpOnly cookie via the worker** (client secret as a wrangler secret, two worker routes + Express parity, SPA off the implicit flow; worker stays storage-less) — is catalogued in [known_issues.md](../../known_issues.md) ("Boot silent reconnect needs a popup") — the tactical doc that first catalogued it is retired.

### 4. Client ID delivery

Primary: `/api/config` (`GOOGLE_CLIENT_ID` env var — wrangler var on Cloudflare, Express env on self-host, per ADR 0009 §4). **Addition for pure-local dev:** `DEFAULT_CONFIG.googleClientId` falls back to the rsbuild build-time constant `PUBLIC_GOOGLE_CLIENT_ID` (else `null`), because a `npm run dev` boot with no backend fails the `/api/config` probe and would otherwise never see a client ID even though `http://localhost:3000` is an authorized origin. `googleClientId === null` keeps every Google surface hidden — unchanged contract.

### 5. UI contract (AppToolbar, top-right)

- Unauthenticated + client ID present: "Sign in with Google" button.
- Authenticating: button shows a `CircularProgress`.
- Authenticated: MUI `Avatar` (photo) + name; menu with account email + "Sign out".
- Session expired: amber chip — click restarts sign-in.
- Popup blocked: caught in `signIn()`, tooltip near the button explains and asks the user to click again (a direct-gesture invocation is the fallback; no redirect flow in v1).

> **Amendment (2026-07-06, storage-ux-unification — supersedes the list above):** the account home is **one avatar-anchored control** (Lucid/VS Code pattern), `AuthControl`:
> - signed out (never): person icon → menu with the Google-branded sign-in item + hint caption;
> - reconnecting (boot): dimmed avatar + spinner ring, non-interactive;
> - needs reconnect (silent failure) / session expired: avatar + **amber dot** → "Sign in again" (the standalone chip is gone);
> - signed in: avatar → name/email header · "Move session diagrams to Drive…" (when any exist) · "Open Drive folder" · "Sign out".
>
> The standalone toolbar button is retired; the branded button renders inside the menu and on the empty-state sign-in card. Sign-out first closes any Drive-side diagram (flushing while the token is valid), then revokes.

### 6. CSP addition

Avatar photos are served from `https://*.googleusercontent.com`, which the current `img-src 'self' data: blob:` blocks. Add `https://*.googleusercontent.com` to `img-src` in [`_headers`](../../packages/axoview-app/public/_headers) **and** mirror in `nginx.conf` (canonical-set parity rule, ADR 0009 §5). No other CSP change is needed — script/frame/connect entries were pre-authorized.

## Consequences

**Positive:**
- No backend, no secrets, no token storage — the whole surface is client-side and origin-restricted.
- The config rail, CSP, and provider-label surfaces were pre-built; this ADR only adds the auth layer itself.
- `drive.file` is a non-restricted scope: no Google security assessment is required for verification.

**Negative / risks:**
- Access tokens live ~1 h; under strict third-party-cookie blocking the silent re-request fails and the user re-consents via popup roughly hourly during long sessions. Mitigated by `getValidToken()` refreshing eagerly (<5 min window) while a session is healthy.
- No true background refresh and no cross-reload persistence — the "Reconnect" chip is a deliberate UX cost, not a bug.
- One Google account at a time; switching accounts = sign out + sign in.

## Implementation notes (non-binding)

- Library: `@react-oauth/google` (wraps GIS; `useGoogleLogin({ flow: 'implicit' })`). `AuthProvider.tsx` wraps `<GoogleOAuthProvider clientId={...}>` and mounts above `AppStorageContext` in `App.tsx`.
- rsbuild exposes `PUBLIC_`-prefixed env vars to client code — hence `PUBLIC_GOOGLE_CLIENT_ID` in §4.
- Unit tests follow the established jest `fetch`-mock pattern (MSW was rejected in Phase 2A — ESM conflict with the Jest CJS config).
- The catalogued **cf-access JWT signature-verify tests** workstream (PLAN.md, "folds into Phase 3A auth work") ships inside this ADR's implementation window — it touches the worker auth middleware, not this token model.

## Acceptance criteria

- **Unit test:** `authStore.test.ts` — initial state; signIn success/denial paths; `getValidToken()` valid / near-expiry-refresh / unauthenticated-null; signOut nulls token + status; token never written to localStorage (spy on `localStorage.setItem`); SESSION_EXPIRED pushes the persistent notification.
- **Manual verification:** sign-in popup completes on `http://localhost:3000`; avatar + name render (CSP clean — no console violations); DevTools → Application shows no token in any storage; reload with Drive active shows the Reconnect chip; sign-out returns storage to Local.
- **Manual verification (deploy):** same flow green on `https://integration.axoview.pages.dev` with `GOOGLE_CLIENT_ID` set as a wrangler var.
