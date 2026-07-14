# ADR 0042 — Drive-Native Diagram Sharing & Read-Only Preview

**Status:** Proposed
**Date:** 2026-07-13
**Supersedes:** [ADR 0036 §4](0036-google-drive-storage-provider.md) (sharing hidden in Drive mode)
**Superseded by:** none

## Context

[ADR 0036 §4](0036-google-drive-storage-provider.md) hid the share affordance in
Drive mode because public share links were a session-backend contract
([ADR 0010](0010-session-backend-contract.md)) and Drive-native links were "a
different trust model and, if ever wanted, a future ADR". The owner now wants
exactly that: share a Drive-stored diagram with another Google user for
read-only preview, **without Axoview running a storage server** — the way
draw.io does it. A server-snapshot variant (Option A) was explicitly rejected.

The full evidence record is
[docs/drive-native-sharing-investigation.md](../drive-native-sharing-investigation.md)
(2026-07-13; four research passes + code verification). The load-bearing facts:

- `drive.file` (the app's only Drive scope, [ADR 0035](0035-google-identity-and-drive-authorization.md))
  hides files from an app until a Google-sanctioned per-file grant. The
  **Google Picker** is the officially recommended grant mechanism; the grant is
  durable (recorded on the file's ACL), works for shared-with-me files, and
  `DocsView.setFileIds()` (2025) pre-navigates the Picker to a known file for
  ~one-click consent.
- Public ("anyone with the link") files are readable with **just an API key,
  no OAuth** — officially sanctioned for public Workspace files and
  CORS-verified from arbitrary origins (live probe 2026-07-13).
- Google's native **sharing dialog** (`gapi` `drive-share` / `ShareClient`) is
  current (docs updated 2026-04) and is what draw.io embeds, with a mandatory
  fallback to drive.google.com because the dialog needs third-party cookies +
  a signed-in browser session.
- The render side is mostly built: `EXPLORABLE_READONLY`, the
  `/display/*` route family, and the public-snapshot loader
  ([DiagramLifecycleProvider.tsx:462-513](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L462-L513))
  are the exact template.

## Decision

**Sharing a Drive-place diagram delegates access control to Google Drive's own
ACL. Axoview adds no server state, no snapshot, and no new OAuth scope — it
adds a share surface in Drive mode and a Drive-file display route that closes
the recipient-read gap with the Picker grant.**

### 1. Share affordance returns in Drive mode

The AppToolbar share button (currently hidden by `{!driveActive && …}`,
[AppToolbar.tsx:336](../../packages/axoview-app/src/components/AppToolbar.tsx#L336))
renders for Drive-place diagrams and opens a Drive-specific share popover:

- **Copy preview link** — `${origin}${APP_BASENAME}/display/drive/<fileId>`
  (plus `?resourceKey=<rk>` iff the file's `resourceKey` metadata is non-null;
  expected absent on app-created files).
- **Manage access** — opens Google's native sharing dialog:
  `gapi.load('drive-share')` → `new gapi.drive.share.ShareClient()` with
  `setOAuthToken(<current drive.file token>)` + `setItemIds([fileId])`. On
  failure (third-party cookies blocked / no matching browser session — the
  draw.io-documented failure mode), fall back to opening the file's
  `webViewLink` in a new tab so the user shares natively in drive.google.com.
  Use the API-returned `webViewLink`, never a hand-built `file/d/{id}/view`.
- **Access summary** — a one-line state ("Only people with access" / "Anyone
  with the link can view") derived from `permissions.list` (authorized under
  `drive.file` on app-created files), so the owner can see whether the copied
  link will work anonymously.

Session-place diagrams keep the existing behavior unchanged (button disabled
without server storage; `/display/p/<uuid>` snapshot links).

> TODO (owner): also offer an in-app **"Anyone with the link" toggle** via
> `permissions.create`/`delete` `{type:'anyone', role:'reader'}` (confirmed
> authorized under `drive.file`), or keep all permission *changes* in Google's
> dialog for v1? Native-dialog-only is less code and the cleaner trust story;
> the toggle is one API call and makes anonymous publishing one click.
>
> **2026-07-13:** v1 shipped **native-dialog-only** (the owner's
> implement-the-plan directive did not opt into the toggle; the ADR's stated
> lean applied). The toggle remains a v1.1 option — the popover's access
> summary already reads the ACL, so the write affordance is an incremental
> addition.

**2026-07-14 — decision 3 REVISED (ShareClient dropped; custom in-app UI adopted).**
Live testing on `integration.axoview.pages.dev` showed the legacy
`gapi.drive.share.ShareClient` is a dead end: Google is deprecating the
client-side share widget (observed as a `fedcm_migration_mod` flow that timed
out with `Cannot read properties of undefined (reading 'contentDocument')`), it
demands a broad CSP surface (`img-src ssl.gstatic.com`, `connect-src
drive.google.com` + `play.google.com`), and it breaks whenever third-party
cookies are blocked — exactly the fragility this ADR anticipated, but worse (the
`showSettingsDialog()` call is fire-and-forget, so the mandated fallback could
not even fire on the async timeout). **"Manage access" is now a custom in-app
dialog over the Drive REST v3 `permissions` collection** —
`permissions.list` / `create` / `delete`, all authorized under `drive.file` for
app-created files and all hitting `www.googleapis.com` (already allowed by
`connect-src`). This resolves the TODO above: v1 now **includes** the
anyone-with-link toggle (`permissions.create {type:'anyone', role:'reader'}`)
*and* add/remove people by email (`{type:'user', role:'reader'|'writer'}`), in
our own UI — no Google widget, no `drive.google.com` redirect. The `drive-share`
gapi module is removed; the **Picker is unaffected** (rung 3 of §2 still loads
`gapi.load('picker')` from `docs.google.com`, and the CSP gains `img-src
ssl.gstatic.com` + `connect-src content.googleapis.com` for it). See
[`driveSharing.ts`](../../packages/axoview-app/src/services/drive/driveSharing.ts)
and [`DriveShareManageDialog.tsx`](../../packages/axoview-app/src/components/DriveShareManageDialog.tsx).

### 2. New read-only display route `/display/drive/:driveFileId`

Added beside the existing forms in [App.tsx:95-101](../../packages/axoview-app/src/App.tsx#L95-L101)
(React Router ranks the static `drive` segment above `:readonlyDiagramId` — no
collision). The route joins `isReadonlyUrl`
([DiagramLifecycleProvider.tsx:202](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L202)),
inheriting autosave-off and the `EXPLORABLE_READONLY` editor mode. It must NOT
set `isPublicShareUrl`, so the `LocalModeShareError` gating
([App.tsx:323](../../packages/axoview-app/src/App.tsx#L323)) cannot misfire.
**Required mutual-exclusion guard:** the existing owner-readonly loader effect
([DiagramLifecycleProvider.tsx:518-575](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L518-L575))
is guarded only by `isPublicShareUrl`/`isReadonlyUrl`, so once `isReadonlyUrl`
is extended it would co-fire on `/display/drive/*` — calling
`storage.listDiagrams()` and `storage.loadDiagram(undefined)`, and racing
`ReadonlyLoadErrorDialog` over the gate screen. It MUST gain a
`driveFileId` early-return (mirroring its existing `if (isPublicShareUrl)
return` line) in the same change that adds the route.

**Load resolution ladder** (new effect mirroring the public-snapshot loader):

1. **Key read (anonymous):** if `googleApiKey` is configured, try
   `GET https://www.googleapis.com/drive/v3/files/{id}?alt=media&key=…`
   (+ `X-Goog-Drive-Resource-Keys` header iff the link carried a resourceKey).
   Succeeds for "anyone with the link" files — no sign-in, works for
   signed-out recipients. This is the anonymous-preview path (B2).
2. **Token read:** on failure, if the user is signed in with Drive scope, try
   the same read with `authStore.getValidToken()`. Succeeds for the owner and
   for recipients who already hold the per-file grant.
3. **Grant gate:** on `403 appNotAuthorizedToFile`/`404`, render a gate screen:
   "This diagram lives in its owner's Google Drive" with (a) sign-in (if
   signed out; reuses the empty-state sign-in card pattern) and (b) **"Open
   with Google Drive access"** — launches the Picker with
   `setAppId(<project number>)`, `setOAuthToken`, `setDeveloperKey`, and
   `DocsView.setFileIds([driveFileId])` so the recipient lands directly on the
   consent step for that file. Pick → grant registers → retry step 2 → render.
4. **Terminal failure** (no access, user declined, file deleted): the gate
   screen shows the existing readonly-load-failed treatment.

Loaded content goes through the same validation + icon-pack pipeline as the
public-snapshot path (`isPersistedDiagramBlob`, `loadPacksForDiagram`;
user-authored HTML stays guarded by [ADR 0029](0029-sanitize-user-authored-html.md)).

### 3. Link semantics — live document, coexisting with snapshot links

A Drive preview link renders the file **as it is at open time** — recipients
see future edits (draw.io semantics). This is the opposite of
`/display/p/<uuid>`, which serves a snapshot frozen at share time. Both
coexist, scoped by place: session/server diagrams keep snapshot links
(ADR 0010 unchanged); Drive diagrams get live links. Popover copy must say
"view the latest version" so the difference is explicit, and revoking access
is Drive's job (remove the permission), not an app unshare.

This narrows ADR 0036 §5's standing rule "share links (§4) … stay on
`serverStorageAvailable`": only **snapshot** share links and the
`/display/p/<uuid>` route remain session-backend contracts; the share
*affordance* is now place-scoped per §1 (a dated amendment note in 0036 §5
records this).

### 4. Drive sharing lives OUTSIDE the StorageProvider interface

`StorageProvider.shareDiagram` ([types.ts:98](../../packages/axoview-app/src/services/storage/types.ts#L98))
models publish-a-snapshot (`{uuid, url, sharedAt}`) — a server contract Drive
sharing does not fit (no uuid; "sharing" is a Drive ACL change + a
deterministic URL). `GoogleDriveProvider` continues to omit
`shareDiagram`/`unshareDiagram`; the new surface is a Drive-place service
(`driveSharing`: ShareClient launch, `permissions.list` summary, preview-URL
builder) consumed by the share popover. The StorageManager "does not support
sharing" throw stays as-is for non-sharing providers.

### 5. API key on the existing config rail

Two new optional config values on the existing rail (worker
[app.ts:41](../../packages/axoview-worker/src/app.ts#L41) + Express
[routes.js:68](../../packages/axoview-backend/src/routes.js#L68) parity, plus
`PUBLIC_`-prefixed build-time dev fallbacks — the exact `googleClientId`
pattern from [ADR 0035 §4](0035-google-identity-and-drive-authorization.md)):

- `GOOGLE_API_KEY` → `/api/config` field `googleApiKey`;
- `GOOGLE_PROJECT_NUMBER` → `/api/config` field `googleProjectNumber` — the
  Cloud project number the Picker's `setAppId` requires. It is deliberately
  its own config value, NOT derived from the numeric prefix of the client id
  (an undocumented format), because a wrong/missing value fails **silently**
  (the pick "succeeds" but the grant never registers).
The key is created referrer-restricted (app origins + localhost) and
API-restricted (Google Drive API + Google Picker API; both enabled on project
`axoview`). It is a public identifier by design; the residual risk is quota
exhaustion of the preview feature, not data exposure. `googleApiKey: null` ⇒
the key-read rung and the Picker are unavailable: anonymous preview degrades
to the sign-in ladder, and the share popover omits the anonymous-link hint.

### 6. Drive "Open with" registration is deferred

The Marketplace path (draw.io's primary grant flow) is documented in the
investigation record and deliberately NOT in v1: it adds the `drive.install`
scope, a Drive UI integration config, and a public Workspace Marketplace
listing with Google review and a **permanent** visibility choice. The Picker
ladder (with `setFileIds`) covers the recipient flow without any of it, in the
same Cloud project, and Open-with can be layered on later without reworking
this ADR's surfaces. Revisit only if right-click-in-Drive / suggested-app
discovery becomes a demand.

### 7. CSP addition

`frame-src` gains `https://docs.google.com https://drive.google.com` (the
Picker iframe is served from docs.google.com; the sharing dialog from
drive/docs origins) in [`_headers`](../../packages/axoview-app/public/_headers)
**and** both `nginx.conf` blocks (canonical-set parity, ADR 0009 §5).
`script-src apis.google.com` and `connect-src www.googleapis.com` are already
allowed (ADR 0035); verify at prototype time whether the Picker needs any
additional `connect-src` googleapis subdomain.

### 8. 2026-07-14 — read rung 1 moved server-side (read proxy; activates [ADR 0043](0043-deferred-backend-for-google-api-hardening.md) #3)

Refines §2 rung 1 and §5. The two-account P1/P2 gate showed the anonymous read as designed (client-side `key=` fetch) carries an ongoing tax: the API key must be shipped to the browser and guarded by a fragile HTTP-referrer allowlist (apex + `*.pages.dev` + every preview host), and every viewer hits Drive directly (no cache → the exact quota/abuse surface ADR 0042 §5 and ADR 0043 #3 flagged). Since configuring the key was required for the gate *anyway*, the deferral of ADR 0043 #3 stopped paying off — the incremental cost of doing it right was one route on the worker that already serves `/api/config`. So rung 1 is now a **server-side read proxy**:

- **`GET /api/public/drive/:fileId`** ([app.ts](../../packages/axoview-worker/src/app.ts)) reads `files/{id}?alt=media` with a **server-held** `env.GOOGLE_API_KEY`, forwards `?resourceKey=` as the Drive header, and returns the JSON with `Cache-Control: public, max-age=60`. An API key can only ever read **publicly-shared** files, so this exposes no private data; it is a public route (`isPublicRoute` in [auth.ts](../../packages/axoview-worker/src/auth.ts)), needs no viewer auth, and a `fileId`-format check + 10 MB cap keep it from being a general-purpose proxy.
- **The key is never shipped to the browser.** `/api/config` no longer returns `googleApiKey`; it returns **`drivePublicPreview: boolean`** (`!!GOOGLE_API_KEY`) so the client's read ladder knows whether to try the proxy rung. [`drivePublicRead.ts`](../../packages/axoview-app/src/services/drive/drivePublicRead.ts) rung 1 now fetches the proxy (gated on `drivePublicPreview`, skipped `afterGrant`); rung 2 (token read, direct to Google) is unchanged.
- **Benefits:** edge-cached (quota/abuse hedge — the substance of ADR 0043 #3), no referrer allowlist, viewer never authenticates for a public link, resilient to client-side Google/COOP changes.
- **Config consequence (supersedes §5's "public referrer-restricted key"):** `GOOGLE_API_KEY` is now a **server secret** (`wrangler pages secret put`), API-restricted to the Drive API — no referrer restriction needed. `GOOGLE_PROJECT_NUMBER` stays on `/api/config` (Picker `setAppId`). The **Picker still needs a key client-side** (§2 rung 3, `setDeveloperKey`), so the Option-B private-grant path is **dormant** until a *separate* browser Picker key is added; under Option A (public "anyone with the link" sharing) it isn't needed. This is a clean deferral, not a regression — the Picker was already dormant (project number unset).

Revised acceptance criteria: P1 is now "anonymous read of an anyone-with-link file succeeds through `/api/public/drive/:id` with **no key in the browser**"; the unit tests assert the ladder hits the proxy (not Google) on rung 1, `drivePublicPreview` gating, and that `/api/config` never emits the raw key. Design record for the proxy lives here (it is rung 1 of this ladder); ADR 0043's addendum records the trigger activation.

## Consequences

**Positive:**
- Diagram data never leaves the user's Drive; access control is Google's ACL
  with Google's own UI — the correct trust model, near-zero permission code.
- Anonymous preview with zero server storage — the Drive-native analogue of
  the rejected server-snapshot option, on both deploy targets.
- No new OAuth scope, no Google review for v1 (`drive.file` stays the only
  scope; the API key is not a scope).
- The Picker infrastructure incidentally unlocks the catalogued
  [known_issues.md](../../known_issues.md) gap ("No Google Picker integration"
  — Drive files created outside the app are invisible) as a cheap follow-up.

**Negative / risks:**
- Private-share recipients pay one-time friction: sign in + Picker consent
  (mitigated by `setFileIds` deep-targeting). Not anonymous by design.
- ShareClient depends on third-party cookies + a live Google browser session —
  the drive.google.com fallback is mandatory, not optional polish.
- A public API key is a quota-exhaustion surface; Google has announced quota
  overage billing "later in 2026" (watch item before shipping the key).
- Drive's own share-notification email links recipients to Drive's raw-JSON
  viewer, not to Axoview — the owner-copied preview link is the primary
  artifact; Open-with (deferred) is the eventual fix.
- Live-link semantics may surprise users expecting snapshots; popover copy
  carries the disclosure.

## Implementation notes (non-binding)

- New: `services/drive/driveSharing.ts` (ShareClient loader, permissions
  summary, preview-URL builder), `services/drive/drivePublicRead.ts` (key/token
  read ladder), `components/DriveDisplayGate.tsx` (gate screen),
  `components/DriveSharePopover` branch inside the existing share popover home
  (state/handler [AppToolbar.tsx:72-128](../../packages/axoview-app/src/components/AppToolbar.tsx#L72-L128),
  popover JSX [:400-463](../../packages/axoview-app/src/components/AppToolbar.tsx#L400-L463)).
- Loader effect: third effect in DiagramLifecycleProvider beside the
  public-snapshot one; extend `isReadonlyUrl`'s OR with the new param.
- Picker: `gapi.load('picker')` from the already-allowed
  `apis.google.com/js/api.js`; `setAppId` takes the Cloud project **number**
  (same project as the OAuth client — the grant silently fails otherwise);
  `setOrigin` unnecessary (not iframed).
- i18n: new keys across all 13 locales (gate screen, popover, errors).
- e2e: mirror the readonly-share coverage in
  `packages/axoview-e2e/tests/share.spec.ts` (J13/J14) + `share-error.spec.ts`
  with mocked googleapis fetches.

## Acceptance criteria

- **Prototype gates (before any productization):**
  - **P1:** browser `fetch` of a real "anyone with link" Drive file via
    `files.get?alt=media&key=` succeeds from `localhost:3000` with a real
    referrer-restricted key (confirms the one unverified B2 assumption).
  - **P2:** account B (viewer on a file shared by account A) completes the
    Picker `setFileIds` flow and the subsequent `alt=media` read under B's
    `drive.file` token succeeds.
- **Unit tests:** load-ladder ordering (key → token → gate; null-key skips
  rung 1); resourceKey propagation (present vs absent); `/api/config`
  `googleApiKey` null/present parsing (worker + Express); preview-URL builder
  (basename + resourceKey query); permissions summary mapping.
- **Manual verification (two real Google accounts, integration deploy):**
  owner shares via the native dialog; recipient's preview link walks
  sign-in → Picker consent → readonly render; "anyone with link" file renders
  in an incognito window with no sign-in; ShareClient-blocked browser falls
  back to drive.google.com; share button visible for Drive diagrams, session
  behavior unchanged; `/display/drive/*` never shows the LocalModeShareError
  dialog; no CSP violations in console.
