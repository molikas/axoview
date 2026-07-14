# Google API Integration — Architecture & Review Request

> **Purpose:** a self-contained brief on how Axoview uses Google's APIs (Identity,
> Drive REST v3, Picker) for storage + diagram sharing, written for an external
> review (Gemini). It states the architecture, the call-level decisions, the UI
> integration, and an honest list of known limitations — then asks for research
> on better alternatives with a pros/cons summary.
>
> **Product context:** Axoview is a browser-based isometric-diagram editor (React
> + TypeScript). It has no first-party backend requirement — a user can sign in
> with Google and use their **own Google Drive** as the storage backend, and
> share a diagram for **read-only preview** the way draw.io does. Everything runs
> client-side; there is no server that holds Google tokens.
>
> **Date:** 2026-07-14 · **Relevant ADRs:** 0035 (identity/auth), 0036 (Drive
> storage provider), 0042 (native sharing + read-only preview).

---

## 1. Google surfaces in use

| Surface | Library / endpoint | Used for |
|---|---|---|
| **Google Identity Services (GIS)** | `accounts.google.com/gsi` implicit token flow | Sign-in; obtaining a `drive.file` access token in the browser |
| **Drive REST v3 — files** | `https://www.googleapis.com/drive/v3/files` | CRUD of diagram JSON files the app creates; `alt=media` reads |
| **Drive REST v3 — permissions** | `.../files/{id}/permissions` (list/create/delete) | The custom "Manage access" sharing UI (new, 2026-07-14) |
| **Google Picker** | `gapi.load('picker')` (`apis.google.com` → `docs.google.com`) | One-time per-file access grant on the read-only display route |
| ~~Drive Share widget~~ | ~~`gapi.load('drive-share')` / `ShareClient`~~ | **Removed 2026-07-14** — deprecated, see §5 |

**Single OAuth scope: `https://www.googleapis.com/auth/drive.file`.** This is the
per-file scope: the app can only see/act on files it created (or that a user
explicitly hands it via the Picker). We deliberately avoid `drive`,
`drive.readonly`, and `drive.install` — no Google verification/CASA review for
v1, and the smallest possible blast radius.

---

## 2. Auth architecture (ADR 0035)

- **Implicit token flow via GIS**, entirely client-side. `authStore.getValidToken()`
  is the *only* path any code uses to obtain a token; the token is held in memory
  (Zustand store), **never persisted** to localStorage/cookies.
- Tokens are ~1h. A background **silent re-auth** refreshes them; when the silent
  popup is blocked, we arm a **one-shot gesture retry** (the next user click
  re-attempts) rather than nagging.
- A server-side `401` (token rejected despite passing the local expiry check)
  calls `authStore.markExpired()`, which flips state to `SESSION_EXPIRED` and
  nulls the token so nothing re-hands a dead token in a retry loop.
- There is **no backend token exchange / refresh-token custody** — this is a
  pure SPA. That is a deliberate trust simplification (no server holds Google
  credentials) and a known limitation (no offline/long-lived access; see §7).

---

## 3. Sharing architecture (ADR 0042)

"Sharing" a Drive diagram is deliberately **outside** the storage-provider
interface (`StorageProvider.shareDiagram`, which is a publish-a-snapshot contract
for the optional first-party backend). Drive sharing is instead a thin module,
[`driveSharing.ts`], with two concerns: **(a)** a deterministic preview URL and
**(b)** ACL management over the Drive REST permissions API.

### 3a. The preview link
`drivePreviewUrl(fileId)` → `${origin}${APP_BASENAME}/display/drive/<fileId>`
(+`?resourceKey=` iff present). The link is **live** (render-at-open), not a
snapshot. App-created files have no `resourceKey`.

### 3b. Custom "Manage access" (new — the pivot this review is really about)
A custom in-app dialog (`DriveShareManageDialog`) over Drive REST v3 permissions:

```
listPermissions(fileId)                      GET  .../permissions   (paginated, drained)
setAnyoneWithLink(fileId, true)              POST .../permissions   {role:'reader', type:'anyone'}
setAnyoneWithLink(fileId, false)             DELETE each type:'anyone' permission
addPersonPermission(fileId, email, role)     POST .../permissions?sendNotificationEmail=true
                                                  {role:'reader'|'writer', type:'user', emailAddress}
removePermission(fileId, permissionId)       DELETE .../permissions/{permissionId}
```

All authorized under `drive.file` (the signed-in user owns the file). All hit
`www.googleapis.com` (already in our CSP `connect-src`). After every mutation the
UI re-reads `listPermissions` — it never trusts optimistic local state.

### 3c. The read-only display route + load ladder (`/app/display/drive/:fileId`)
Recipient side. Provider-less by design (the recipient may have no Drive root,
manifest, or place). `readDriveDisplayFile` walks a 3-rung ladder:

1. **Anonymous key read** — `files.get?alt=media&key=<PUBLIC_API_KEY>`. Succeeds
   for "anyone with the link" files with no sign-in. Skipped when no key is
   configured (graceful degradation).
2. **Token read** — the owner, or a recipient who already holds a per-file grant,
   reads with their own `drive.file` token.
3. **Picker grant** — if the above fail with 404/403 (drive.file hides ungranted
   files), the gate offers the **Google Picker** (`DocsView.setFileIds([fileId])`
   pre-navigates to the exact file). The pick registers a durable ACL grant; the
   token read is retried.

Failure taxonomy is explicit: `needs-signin` (401 → also arms `markExpired`),
`needs-grant` (403/404 pre-grant), `not-found` (403/404 post-grant, terminal),
`transient` (429/5xx/network → retry button). A 403 body is classified so a
rate-limit becomes `transient` rather than a spurious `needs-grant`.

---

## 4. Config & CSP

- **`GOOGLE_API_KEY`** (public, referrer- + API-restricted) powers the anonymous
  rung; **`GOOGLE_PROJECT_NUMBER`** (the Cloud project *number*, not the client-id
  prefix) is the Picker `setAppId`. Both arrive via `/api/config` at runtime, with
  a `PUBLIC_*` build-time dev fallback. A null key degrades gracefully.
- **CSP** (tight by default): `script-src ... apis.google.com`; `connect-src ...
  www.googleapis.com content.googleapis.com`; `img-src ... ssl.gstatic.com`;
  `frame-src accounts.google.com docs.google.com drive.google.com`. The custom
  permissions UI needs **no** new CSP (it uses `www.googleapis.com`); the
  `ssl.gstatic.com` / `content.googleapis.com` additions are for the Picker.

---

## 5. The key call-level decision: why we dropped `ShareClient`

The original design (ADR 0042 decision 3) used Google's legacy **client-side
share widget** `gapi.drive.share.ShareClient` for "Manage access", with a
`drive.google.com` new-tab fallback. Live testing on the deployed site showed it
is a **dead end**:

- Google is **deprecating** the client-side share widget — the loaded flow now
  goes through a `fedcm_migration_mod` path that **timed out** with
  `TypeError: Cannot read properties of undefined (reading 'contentDocument')`.
- It demands a **broad CSP surface** (`img-src ssl.gstatic.com`, `connect-src
  drive.google.com` + `play.google.com`) that fights a tight CSP; its spinner and
  dialog chrome are blocked otherwise.
- It breaks whenever **third-party cookies** are blocked (increasingly the default).
- `showSettingsDialog()` is **fire-and-forget** — it returns synchronously, so the
  mandated fallback could not even fire on the *async* timeout; the user just saw
  a spinner then a Google "not available" error with no recourse.

**Decision:** replace it with a **custom in-app UI over the Drive REST v3
permissions API** (§3b). Rationale: keeps users in-app (better UX than a
new-tab redirect), needs no `drive.file`-incompatible scope, needs no extra CSP,
has no third-party-cookie dependency, and gives us full control over error
handling and copy. This is Google's own recommended migration path away from the
legacy widget.

---

## 6. UI integration

- **Share popover** (toolbar): copy the live preview link + a one-line access
  summary ("Anyone with the link can view" / "Only people with access") derived
  from `permissions.list`, with a monotonic request-id guard so a diagram switch
  can't paint a stale summary, plus an on-window-focus refresh.
- **Manage access dialog**: *General access* (Restricted ↔ Anyone-with-link) +
  *People with access* (list, remove) + *Add people* (email + Viewer/Editor).
  Changes apply immediately, each with an inline error; the list re-reads after
  every mutation.
- **Display gate** (recipient): needs-signin / needs-grant (Picker) / transient
  (retry) / failed states, styled as the app's own empty-canvas surface.

---

## 7. Known limitations (honest list)

1. **No offline/long-lived access.** Pure client-side implicit tokens (~1h, in
   memory). No refresh token, no server custody → Drive writes require a live
   connection and a fresh token; there is no offline write queue (edits fail after
   a retry/backoff run). *This is a deliberate trust trade-off, but it caps the
   product's resilience.*
2. **`drive.file` visibility gap.** The app sees only files it created. A diagram
   JSON placed in Drive by other means never appears in the file tree; the Picker
   grant we use is scoped to the read-only display route, not a general
   "browse-and-add existing Drive file" flow.
3. **Public API key = a quota-exhaustion surface.** The anonymous key-read rung
   uses a public, referrer-restricted API key. Google announced Drive API
   quota-overage billing "later in 2026"; the key is a (bounded, referrer-gated)
   attack surface worth watching.
4. **Notification email points at raw JSON.** `addPersonPermission` with
   `sendNotificationEmail=true` sends Google's standard email, which links to the
   **Drive file** (raw diagram JSON) — not our nice `/display/drive/...` viewer.
   The owner must separately copy our preview link. There is no way to customize
   Google's notification target.
5. **`resourceKey` handling is minimal.** We propagate a `resourceKey` query
   param when present but don't exercise the full resource-key security-update
   matrix (app-created files don't carry them, so this is largely untested in the
   wild).
6. **Root-folder deletion mid-session is undetected.** The Drive provider caches
   the discovered root-folder id and doesn't revalidate; trashing it in Drive's UI
   while the app is open isn't noticed until a full reload.
7. **Picker/ShareClient fragility is browser-config-dependent.** The Picker (still
   used for the display-route grant) is itself third-party-cookie- and
   popup-sensitive; we have not yet stress-tested it across cookie-blocked / COOP
   configurations (the P2 prototype gate).
8. **No conflict detection.** Concurrent edits to the same Drive file from two
   sessions last-writer-wins; there's no revision/ETag conflict guard.

---

## 8. Areas I (the implementer) flag for deeper scrutiny

- **Is a pure-client implicit-token SPA the right long-term auth posture**, or
  should we add a minimal token-broker backend (auth-code + PKCE + refresh token
  server-side) to unlock offline queues, background sync, and longer sessions —
  at the cost of the "no server holds your Google credentials" story?
- **Is `drive.file` + Picker the right sharing primitive**, or would an
  app-owned Drive (service account / shared drive) or a first-party snapshot
  store give a better sharing UX (custom email, no raw-JSON links) without the
  per-file visibility gap?
- **The anonymous public-key read** — is there a safer pattern for
  "anyone-with-link" anonymous preview than a public API key (e.g. a tiny signed
  proxy endpoint), and is the quota/abuse exposure acceptable?
- **Picker longevity** — given Google's client-widget deprecation trend, how
  durable is `gapi.load('picker')`? Is there a REST/embed alternative for the
  per-file grant, or should the display-route grant use a different mechanism?

---

## 9. Request to the reviewer (Gemini)

Please research and return a **pros/cons summary** for the following, grounded in
current (2026) Google API guidance:

1. **Auth posture:** client-side implicit tokens (current) vs. auth-code + PKCE
   with a minimal backend token broker (refresh tokens) — for a browser-first
   diagram app that wants optional offline/background sync. Trade-offs on
   security, complexity, verification burden, and UX.
2. **Sharing primitive:** `drive.file` + Picker + REST permissions (current) vs.
   alternatives (full `drive` scope; an app-owned Shared Drive / service account;
   a first-party publish-snapshot store) — specifically for read-only preview
   sharing with a clean recipient experience (no raw-JSON links, custom
   notifications, no per-file visibility gap).
3. **Anonymous preview reads:** public referrer-restricted API key
   (`files.get?alt=media&key=`) vs. a signed short-lived proxy vs. published
   web-content links — on abuse/quota exposure, CORS, and simplicity.
4. **Picker durability & alternatives:** given the deprecation of the legacy
   client-side share widget, how stable is the Google Picker, and are there
   modern alternatives for a one-time per-file access grant?

For each, a short **recommendation** with the single biggest risk called out
would be ideal.

---

## 10. Review outcome (2026-07-14) + prioritized roadmap

An external review (Gemini) returned. Verdict: the V1 choices are "smart,
pragmatic" for a client-side SPA, and dropping `ShareClient` for a custom REST UI
was the right call. Its four recommendations, each with the single biggest risk
it flags, plus our disposition:

| # | Reviewer recommendation | Biggest risk called out | Cost | Disposition |
|---|---|---|---|---|
| 1 | **Migrate auth → auth-code + PKCE with a minimal token broker** (serverless fn) | Relying on the implicit grant (`response_type=token`) that OAuth 2.1 deprecates; no refresh → no offline/background sync | High (adds a backend; reverses ADR 0035's "no server holds credentials") | **Roadmap — owner decision.** Biggest strategic item. See nuance below. |
| 2 | **Keep `drive.file` + Picker now; roadmap a first-party publish-snapshot store** | Jarring recipient UX — Google notification emails link to the raw JSON file, not our viewer | High (DB + storage backend) | **Roadmap** ([ADR 0043](adr/0043-deferred-backend-for-google-api-hardening.md) #2). **Interim mitigation shipped:** `addPersonPermission` now attaches an `emailMessage` pointing at our `/display/drive` viewer + the Manage-access dialog surfaces the copyable preview link. Build the snapshot publisher when the raw-JSON email UX becomes a validated blocker. |
| 3 | **Replace the public anonymous-read key with a signed short-lived proxy** | The 2026 Drive API quota-overage billing — a viral diagram could exhaust quota / bill the Cloud account | Medium (a small proxy backend + cache/rate-limit) | **Roadmap** ([ADR 0043](adr/0043-deferred-backend-for-google-api-hardening.md) #3) — the cheapest backend win; pairs with #1 on the existing `axoview-worker`. Interim: key stays referrer+API-restricted (P1 gate) and quota is a watch item. |
| 4 | **Keep the Picker; build aggressive failure fallbacks + clear cookie/popup instructions** | 3rd-party-cookie phase-out silently breaking the Picker for many users | Low (copy + gate states) | **Code half done** ([ADR 0043](adr/0043-deferred-backend-for-google-api-hardening.md) #4): the gate has needs-grant / transient-retry / picker-error / grant-unavailable states, and `pickerError` now names the cookie/pop-up cause. Finalize the copy at the **P2** gate (Picker exercised with two real accounts). |

**Accuracy nuance on #1:** we use Google Identity Services' **token client**
(`initTokenClient`), Google's *currently-supported* browser library — not a raw
deprecated endpoint. But it *is* the implicit grant under the hood
(`response_type=token`), which is why sessions are ~1h with no refresh token.
Gemini's direction (auth-code + PKCE + a broker for refresh/offline) is correct;
the "dead flow" framing overstates a mechanism Google still ships for exactly
this in-browser short-lived-token use case.

**Recommended sequencing (all backend-gated, hence owner's call on whether/when
Axoview grows a lightweight backend):**
1. If/when a backend is introduced, do **#1 (PKCE broker)** and **#3 (read proxy)**
   together in the same small serverless surface — they share infrastructure and
   between them close the two "biggest risk" items (deprecated auth + quota abuse).
2. **#2 (snapshot store)** is a larger, product-driven follow-up; defer until the
   raw-JSON-email recipient friction is validated as a real blocker.
3. **#4** is the only non-backend item; fold the cookie/popup copy into the P2
   Picker verification pass.

The through-line the reviewer names — "architectural gravity will pull you toward
a lightweight backend" — is the honest summary: the current serverless posture is
a deliberate, correct V1 trade-off, and the next maturity step is a *small* backend
for auth + quota protection, not a return to a full first-party stack.

> **Durable record:** the deferral decision above and the concrete **activation
> triggers** for each backend item now live in
> [ADR 0043 — Deferred Backend for Google-API Hardening](adr/0043-deferred-backend-for-google-api-hardening.md)
> (Accepted, 2026-07-14). This review-request doc is short-lived and dies at the
> drive-native-sharing tactical wrap; ADR 0043 is where the triggers persist. The
> two no-backend mitigations it lists (§1) shipped alongside it.
