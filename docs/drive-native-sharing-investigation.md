# Diagram Sharing over Google Drive — Investigation (pre-ADR)

**Status:** COMPLETE (2026-07-13) — all open questions resolved; decisions live in
[ADR 0042](adr/0042-drive-native-sharing-and-readonly-preview.md) (supersedes
[ADR 0036 §4](adr/0036-google-drive-storage-provider.md)). This file is the
evidence record behind that ADR; delete it when the tactical wraps.
**Owner preference: Option B (Drive-native), not Option A (server snapshot).**

## Goal

Let a user whose diagrams live in their own Google Drive (`drive.file` scope,
[places model / ADR 0037](adr/0037-storage-places-model.md)) share a diagram
with **another Google user for read-only preview** — without Axoview running a
storage server. Today this is impossible: the Share button is hidden in Drive
mode.

## Current state (verified)

- **Share is hidden in Drive mode** — `{!driveActive && …}` wraps the button
  ([AppToolbar.tsx:336](../packages/axoview-app/src/components/AppToolbar.tsx#L336));
  also `disabled` without server storage ([:343](../packages/axoview-app/src/components/AppToolbar.tsx#L343)).
- **`GoogleDriveProvider` omits `shareDiagram`/`unshareDiagram` on purpose**
  ([GoogleDriveProvider.ts:500](../packages/axoview-app/src/services/storage/providers/GoogleDriveProvider.ts#L500), ADR 0036 §4).
- **Existing share = Option A** (server-side public snapshot): `POST /api/diagrams/:id/share`
  → `public/<uuid>` → anonymous `/app/display/p/<uuid>`
  ([routes.js:356](../packages/axoview-backend/src/routes.js#L356)). Requires a
  server backend, gated on `serverStorageAvailable`. Rejected by owner.
- **Scope locked to `drive.file`** ([AuthProvider.tsx:10](../packages/axoview-app/src/providers/AuthProvider.tsx#L10)).
  No Google Picker, no Drive permissions API, no `webViewLink`, no Drive "Open
  with" app registration anywhere in the tree.
- **Auth = client-side GIS implicit flow**, in-memory ~1h token, no server, no
  refresh token ([ADR 0035](adr/0035-google-identity-and-drive-authorization.md)).
- **Renderer is ready:** the app already has an `EXPLORABLE_READONLY` mode and a
  stable public app URL — half of Option B is already built.

## The core obstacle

Drive stores raw diagram JSON, **not a rendered diagram**. Two sub-problems:

1. **Grant a specific user access** — easy; delegate to Google Drive's own Share
   dialog (this is what draw.io does; almost no app code).
2. **Let the recipient's Axoview READ the shared file under `drive.file`** — the
   hard part. `drive.file` only exposes files the app *created* or that the user
   *opened with the app*. A file shared to the recipient is invisible until a
   Google-sanctioned per-file grant happens.

## Reference: how draw.io does it (Option B in the wild — verified from source 2026-07-13)

- **No server snapshot** — data stays in Drive (their privacy brand).
- **To a user:** the native Drive sharing dialog embedded in-app —
  `DriveClient.prototype.showPermissions` (`DriveClient.js:2577` in
  `jgraph/drawio@dev`) does `new gapi.drive.share.ShareClient(appId)` →
  `setOAuthToken` → `setItemIds([id])` → `showSettingsDialog()`, with a
  `MutationObserver` fallback that detects Google's "sharing is unavailable"
  dialog (third-party-cookie failures) and opens `drive.google.com/open?id=…`
  so the user shares natively. draw.io does **not** call `permissions.create`
  in its share flow. Scopes: `drive.file` + `drive.install` + profile
  (`DriveClient.js:70`).
- **Recipient read:** the recipient opens the file from drive.google.com via
  **"Open with → diagrams.net"** once — that action is the per-file
  `drive.file` grant. Until then, the API returns a permissions error.
- **Anonymous:** set the Drive file to **"Anyone with the link"**, then
  `File → Publish → Link` renders it in draw.io's own viewer/lightbox.
- **Enablers Axoview lacks:** draw.io is a **registered Google Drive app**
  (Marketplace listing `671128082532`, 23M+ installs, scopes as above) and is
  its own renderer at a stable URL.

## Option B — how it would work for Axoview

Split by use case. The **granting** side is Google's native Share dialog in both;
the **read/render** side is the work.

### B1 — Share with a specific Google user (private, matches the ask)

Close the recipient-read gap with ONE of two Google-sanctioned mechanisms:

- **Mechanism 1 — Google Picker** (recipient-side, smaller surface). Recipient
  opens Axoview → Picker → selects the file shared to them → the Picker grant
  extends `drive.file` to that file → Axoview reads + renders read-only. This is
  the already-deferred item in [known_issues.md:71](../known_issues.md#L71).
  Needs the picker gapi script + a Google API key (referrer-restricted).
- **Mechanism 2 — Drive "Open with" app registration** (draw.io's primary path,
  bigger infra). Register Axoview in Google Cloud Console: Drive UI Integration,
  a mimetype/extension association + "Open with Axoview" action, a Workspace
  Marketplace listing, OAuth app verification. Drive then launches Axoview with
  `?state={"ids":[fileId],"action":"open","userId":…}`; Axoview parses `state`,
  loads that file id (grant implicit via open-with), renders. Gives the seamless
  right-click UX but requires Google review.

**Recipient must be signed in and grant `drive.file`** in both — this is *not*
anonymous.

### B2 — Anonymous "anyone with the link" preview (simpler cousin)

Set the Drive file public via native Share, then a Drive-file-id read-only route
(e.g. `/app/display/drive/<fileId>`) reads the file **media with just an API key,
no OAuth** (`GET /drive/v3/files/{id}?alt=media&key=…` works on public files) and
renders it. **This is the closest Drive-native analogue to Option A's anonymous
link — no server, data in Drive.** Confirmed feasible — see resolved question #2.

### Render side (mostly built)

Reuse `EXPLORABLE_READONLY` + a new Drive-file-id display route; disable autosave;
no diagram-list fetch. Mirrors the existing `/display/p/<uuid>` load path
([DiagramLifecycleProvider](../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx)),
swapping the snapshot fetch for a Drive read.

## Resolved questions (2026-07-13 — four parallel research passes + code verification)

### 1. Picker vs Open-with → **Picker for v1; Open-with deferred**

- The Picker grant is the **officially recommended** pattern for `drive.file`
  apps: the scope definition itself covers files "the user shares with an app
  while using the Google Picker API"
  ([api-specific-auth](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)).
  The grant registers as an app authorization **on the file's ACL** (the
  `appNotAuthorizedToFile` error doc names Picker/Open-with as the resolutions;
  `files.isAppAuthorized` exposes it) — i.e. **durable per user+app**, not per
  token ([handle-errors](https://developers.google.com/workspace/drive/api/guides/handle-errors)).
- Requirements: `setAppId(<Cloud project NUMBER>)` (same project as the OAuth
  client — mandatory for the grant to register; the #1 community failure mode is
  omitting it), `setOAuthToken(<drive.file token>)`, `setDeveloperKey(<API key>)`
  (treat as required; restrict to referrers + "Google Picker API"), and the
  already-CSP-allowed `apis.google.com/js/api.js` + `gapi.load('picker')`
  ([sample](https://developers.google.com/workspace/drive/picker/guides/sample),
  [web-picker](https://developers.google.com/workspace/drive/picker/guides/web-picker)).
- Shared-with-me files are pickable: `DocsView.setOwnedByMe(false)` / plain
  `ViewId.DOCS`
  ([DocsView reference](https://developers.google.com/workspace/drive/picker/reference/picker.docsview)).
- **Game-changer for the share-link UX:** `DocsView.setFileIds(fileIds)`
  (rolled out 2025-01-20) pre-navigates the Picker **directly to the named
  file(s) for consent** — so a preview link carrying the fileId can drive a
  ~one-click grant on the recipient side
  ([announcement](https://workspaceupdates.googleblog.com/2024/11/new-file-picker-method-for-pre-selecting-google-drive-files.html)).
- Open-with costs by contrast: the `drive.install` scope (non-sensitive), the
  Drive UI integration config, a **Workspace Marketplace listing** whose
  visibility choice (Public/Private/Unlisted) is **permanent**, Google review
  ("typically several days") for Public — the only tier consumers can install
  from — and a per-user install/connect model
  ([enable-sdk](https://developers.google.com/workspace/drive/api/guides/enable-sdk),
  [about-app-review](https://developers.google.com/workspace/marketplace/about-app-review)).
  Whether the Drive UI integration works with **no** listing at all is
  undocumented (flagged; would need an empirical test). Nothing in the Picker
  path blocks adding Open-with later in the same Cloud project.

### 2. Does B2 work? → **YES (officially sanctioned; one trivial prototype left)**

- Official sanction, verbatim from the
  [Workspace auth overview](https://developers.google.com/workspace/guides/auth-overview):
  API key = credential for public data, and "Public Google Workspace files
  shared using the 'Anyone on the Internet with this link' setting can also be
  accessed this way."
- CORS **live-probed 2026-07-13**: `GET /drive/v3/files/{id}?alt=media&key=…`
  echoes arbitrary `Origin` values in `Access-Control-Allow-Origin`, and
  preflight allows the `X-Goog-Drive-Resource-Keys` header — the endpoint is
  browser-fetchable from our origins.
- Corroboration: curl-based key-only downloads of public files documented and
  active through late 2025
  ([tanaikech gist](https://gist.github.com/tanaikech/f0f2d122e05bf5f971611258c22c110f));
  Google staff confirmation that a key alone suffices for public files
  ([discuss.google.dev](https://discuss.google.dev/t/how-i-can-download-public-file-from-google-drive-without-autentication/172612)).
- Caveats: (a) **resource keys** — a 2021 retroactive update for *legacy*
  link-shared files; app-created files are expected to have `resourceKey`
  absent, but the safe pattern is to read `fields=resourceKey` at share time
  and propagate it (URL param on our link → `X-Goog-Drive-Resource-Keys`
  header on the read) only when non-null
  ([resource-keys](https://developers.google.com/workspace/drive/api/guides/resource-keys));
  (b) abuse-flagged files 403 for anonymous readers (irrelevant to diagram
  JSON); (c) the [limits page](https://developers.google.com/workspace/drive/api/guides/limits)
  says exceeding quota "is planned to incur charges … later in 2026" — a watch
  item before shipping a public key.
- Remaining verification: a ~15-minute browser prototype with a real key + a
  real "anyone with link" file (no end-to-end browser demo was found in the
  wild; every component is individually confirmed). Gate P1 in the tactical.

### 3. API key handling → **one referrer-restricted key on the existing config rail**

- One key, dual-restricted: HTTP referrers (our origins + localhost) AND API
  restriction to **Google Drive API + Google Picker API**
  ([api-keys docs](https://docs.cloud.google.com/docs/authentication/api-keys)).
- Residual risk of a public key = **project quota exhaustion only** (the key
  reaches only already-public data); Drive API is free today (see the 2026
  billing watch item above). Default quota ~1M units/min/project.
- Deploy surface mirrors the client-id rail exactly: `GOOGLE_API_KEY` env →
  `/api/config` `googleApiKey` ([worker app.ts:41](../packages/axoview-worker/src/app.ts#L41),
  [Express routes.js:68](../packages/axoview-backend/src/routes.js#L68)) +
  `PUBLIC_GOOGLE_API_KEY` build-time dev fallback (ADR 0035 §4 pattern).
  `googleApiKey: null` = anonymous preview + Picker unavailable, surfaces hide.

### 4. OAuth/verification impact → **zero for v1**

- Scope set unchanged: `drive.file` only (non-sensitive/recommended tier — no
  verification mandate, no CASA;
  [verification requirements](https://support.google.com/cloud/answer/13463073)).
  The Picker consumes the existing token; the API key is not a scope.
- Google review enters only with Open-with (Marketplace listing) — deferred.

### 5. In-app share vs native dialog → **native ShareClient dialog + fallback (draw.io-proven)**

- The sharing-dialog widget is alive and currently documented (page updated
  2026-04-23): `gapi.load('drive-share')` → `ShareClient` → `setOAuthToken` /
  `setItemIds` / `showSettingsDialog()`
  ([share-button guide](https://developers.google.com/drive/api/guides/share-button)).
  Hard requirement quoted from the doc: third-party cookies enabled + the user
  signed in to the matching Google account **in the browser** — hence draw.io's
  mandatory fallback (open the file in drive.google.com) which we mirror.
- The in-app alternative is fully authorized if ever wanted:
  `permissions.create`/`list`/`delete` all list `drive.file` in their scopes
  ([permissions.create](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/create)),
  including `{type:'anyone', role:'reader'}` and `{type:'user', role:'reader',
  emailAddress}` (notification email default-on) on app-created files. Kept as
  a v1.1 option (in-app "anyone with link" toggle) — see the ADR TODO.
- Recipient-without-grant at drive.google.com gets the "You need access" /
  Request-access page; use the file's returned `webViewLink` rather than
  hand-building `file/d/{id}/view` (URL shape undocumented).

### 6. Places-model + routing interaction → **verified safe, with ONE required guard**

- Route table ([App.tsx:95-101](../packages/axoview-app/src/App.tsx#L95-L101)):
  `/display/drive/:driveFileId` slots beside `/display/p/:shareUuid` and
  `/display/:readonlyDiagramId`; React Router v6 ranks static segments above
  params — no collision.
- `showLocalModeShareError = isPublicShareUrl && !serverStorageAvailable`
  ([App.tsx:323](../packages/axoview-app/src/App.tsx#L323)) keys on
  `isPublicShareUrl = !!shareUuid`
  ([DiagramLifecycleProvider.tsx:195](../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L195))
  — the Drive route introduces its own param and can never trip it.
- `isReadonlyUrl` ([DiagramLifecycleProvider.tsx:202-204](../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L202-L204))
  is the single switch for autosave-off ([:311](../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L311))
  and `EXPLORABLE_READONLY` ([App.tsx:351](../packages/axoview-app/src/App.tsx#L351)) —
  extending its OR with the new param inherits the whole readonly surface.
  ⚠️ **The one non-free part** (2026-07-13 verify pass): the owner-readonly
  loader effect ([:518-575](../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L518-L575))
  has no own-param guard — once `isReadonlyUrl` is extended it co-fires on the
  Drive route (`loadDiagram(undefined)` → spurious ReadonlyLoadErrorDialog).
  It must gain a `driveFileId` early-return (ADR 0042 §2).
- Loader template: the public-snapshot effect
  ([DiagramLifecycleProvider.tsx:462-513](../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L462-L513))
  already does validate → `loadPacksForDiagram` → readonly `SavedDiagram`; the
  Drive loader swaps the fetch target.
- **Interface ripple:** `StorageProvider.shareDiagram`
  ([types.ts:98](../packages/axoview-app/src/services/storage/types.ts#L98))
  returns `{uuid, url, sharedAt}` — a publish-snapshot contract Drive sharing
  does not fit (no uuid; the "share" is a Drive ACL change). Decision in the
  ADR: Drive sharing lives **outside** the provider interface.
- **CSP:** `connect-src https://www.googleapis.com` + `script-src
  https://apis.google.com` already allowed; `frame-src` must gain
  `https://docs.google.com https://drive.google.com` (Picker iframe is served
  from docs.google.com) in [`_headers`](../packages/axoview-app/public/_headers)
  and twice in [`nginx.conf`](../nginx.conf) (parity rule ADR 0009 §5).

## Outcome

**ADR 0042** (supersedes ADR 0036 §4) locks: share button returns in Drive mode
(native ShareClient dialog + drive.google.com fallback + copy-preview-link);
new `/display/drive/:driveFileId` readonly route with a key-read → token-read →
Picker-grant resolution ladder; `GOOGLE_API_KEY` config rail; Open-with
deferred. Implementation checklist: `docs/tactical/drive-native-sharing.md`
(prototype gates P1/P2 first).

## Sources

- draw.io: [Google Drive integration](https://www.drawio.com/docs/integrations/google/google-drive-diagrams/),
  [Share diagrams](https://www.drawio.com/docs/manual/collaboration/share-diagrams/),
  [Share via Google public links](https://www.drawio.com/docs/integrations/google/share-diagrams-via-google/),
  source `jgraph/drawio@dev` (`DriveClient.js`, `App.js`),
  [Marketplace listing](https://workspace.google.com/marketplace/app/drawio/671128082532)
- Google (key pages; full citation trail in the 2026-07-13 research passes):
  [api-specific-auth](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) ·
  [auth-overview](https://developers.google.com/workspace/guides/auth-overview) ·
  [picker web guide](https://developers.google.com/workspace/drive/picker/guides/web-picker) ·
  [picker sample](https://developers.google.com/workspace/drive/picker/guides/sample) ·
  [setFileIds announcement](https://workspaceupdates.googleblog.com/2024/11/new-file-picker-method-for-pre-selecting-google-drive-files.html) ·
  [handle-errors](https://developers.google.com/workspace/drive/api/guides/handle-errors) ·
  [share-button (ShareClient)](https://developers.google.com/drive/api/guides/share-button) ·
  [permissions.create](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/create) ·
  [resource-keys](https://developers.google.com/workspace/drive/api/guides/resource-keys) ·
  [limits](https://developers.google.com/workspace/drive/api/guides/limits) ·
  [enable-sdk (Drive UI)](https://developers.google.com/workspace/drive/api/guides/enable-sdk) ·
  [integrate-open](https://developers.google.com/workspace/drive/api/guides/integrate-open) ·
  [about-app-review](https://developers.google.com/workspace/marketplace/about-app-review) ·
  [drive-picker-element (CSP)](https://github.com/googleworkspace/drive-picker-element)
- Internal: ADR 0035, ADR 0036 §4, ADR 0037, [known_issues.md](../known_issues.md) (Picker deferral)
