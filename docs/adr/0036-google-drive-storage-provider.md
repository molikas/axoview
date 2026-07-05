# ADR 0036 — Google Drive Storage Provider

**Status:** Proposed
**Date:** 2026-07-05
**Supersedes:** none
**Superseded by:** none

## Context

Phase 3B (PLAN.md) makes Google Drive the persistent-storage path for the storage-less Cloudflare deployment ([ADR 0009 decision 1](0009-deployment-topology.md)). The plumbing anticipates it: the [`StorageProvider`](../../packages/axoview-app/src/services/storage/types.ts#L65) id union already includes `'google-drive'`, the [`StorageManager`](../../packages/axoview-app/src/services/storage/StorageManager.ts) registry delegates to any registered provider, and [`FileExplorer`](../../packages/axoview-app/src/components/fileExplorer/FileExplorer.tsx#L89) already renders the `google-drive` header label.

Three drifts since the PLAN 3B spec was written (all reconciled below):

1. The `GoogleDriveProvider.ts` stub from Phase 2A **no longer exists** (removed in the v1.1 dead-code wave) — the provider is written fresh.
2. The `StorageProvider` interface **grew**: `restoreDiagram`, `renameDiagram`, `shareDiagram`/`unshareDiagram` (optional) are not in the PLAN's Drive-API mapping table.
3. Phase 2B-R **removed the in-app trash UX** (hard delete + confirmation only), yet Drive has a native trash — the PLAN's `appProperties.deletedAt` soft-delete design is orphaned.

Owner decisions locked 2026-07-05 (design discussion): defer the offline write queue; per-diagram "Save to Drive" context action instead of a bulk migration dialog; hide sharing in Drive mode; delete = Drive trash; default folder `axoview-diagrams` with a first-connect custom-folder option. Auth is [ADR 0035](0035-google-identity-and-drive-authorization.md)'s concern.

## Decision

### 1. Provider shape and Drive API mapping

`GoogleDriveProvider` implements the full current `StorageProvider` interface against Drive API v3. Diagrams are JSON files (`application/json`); every file/folder the app creates carries `appProperties: { axoview: 'true' }` and all list queries filter on it plus `trashed = false`.

| StorageProvider method | Drive API v3 call |
|---|---|
| `listDiagrams(folderId)` | `GET files?q='{folderId}' in parents and mimeType='application/json' and appProperties has {key='axoview' and value='true'} and trashed=false` |
| `loadDiagram(id)` | `GET files/{id}?alt=media` |
| `saveDiagram(id, data)` | `PATCH upload/files/{id}?uploadType=media` |
| `createDiagram(data, folderId)` | `POST upload/files?uploadType=multipart` (metadata + content) |
| `deleteDiagram(id)` | `PATCH files/{id}` `{ trashed: true }` — **Drive trash, not hard delete** (§3) |
| `restoreDiagram(id)` | `PATCH files/{id}` `{ trashed: false }` |
| `renameDiagram(id, name)` | `PATCH files/{id}` `{ name }` |
| `listFolders(parentId)` | `GET files?q=mimeType='application/vnd.google-apps.folder' and '{parentId}' in parents and trashed=false` |
| `createFolder(name, parentId)` | `POST files` (folder mimeType + appProperties marker) |
| `deleteFolder(id, recursive)` | `PATCH files/{id}` `{ trashed: true }` (trashing a folder trashes descendants) |
| `renameFolder(id, name)` | `PATCH files/{id}` `{ name }` |
| `moveItem(id, type, targetFolderId)` | `PATCH files/{id}?addParents={target}&removeParents={current}` |
| `getTreeManifest()` / `saveTreeManifest(m)` | `axoview-manifest.json` in the root folder (create-on-first-write, then media PATCH) |
| `shareDiagram` / `unshareDiagram` | **not implemented** (§4) |

Every call obtains its token via `authStore.getValidToken()` (ADR 0035 rule 2) — never a raw token read. A `null` token throws before any network call.

### 2. Root folder — default `axoview-diagrams`, first-connect choice, remembered in Drive itself

All Axoview content lives under one root folder. Discovery and choice:

1. **Discovery:** on provider activation, query for a folder with `appProperties has {key='axoviewRoot' and value='true'}` and `trashed=false`. Found → it is the root (choice travels across browsers/devices, because `drive.file` visibility follows the app + account, not the device).
2. **First connect (no marker found):** a one-time dialog offers:
   - **Default** — create `axoview-diagrams` in My Drive root, stamp the marker.
   - **Choose a folder…** — open the Google Picker in folder-select mode; picking a folder grants the app access to it under `drive.file` and the marker is stamped onto it.
3. The resolved folder ID is cached in `localStorage['axoview-drive-root']` as a boot accelerator only; the Drive-side marker is authoritative (cache miss or stale ID → re-run discovery).

If the user later deletes/trashes the root folder in Drive, the provider's next `isAvailable()`/list call detects the 404, clears the cache, and re-runs the first-connect dialog.

### 3. Delete = Drive trash

In-app delete keeps the 2B-R contract (confirmation dialog, no in-app trash section) but maps to `trashed: true`: the item disappears from the app and is recoverable for ~30 days via drive.google.com. The Drive-mode confirmation copy says "Move to Google Drive trash". `restoreDiagram` exists on the interface and is implemented (untrash), but no v1 UI calls it.

### 4. Sharing is hidden in Drive mode

[ADR 0010](0010-session-backend-contract.md) locks public share links to the session backend; the worker 503s share routes. `GoogleDriveProvider` does **not** implement `shareDiagram`/`unshareDiagram`, and the share affordance (AppToolbar share button + related dialogs) is hidden when the active provider is `google-drive` — otherwise it would dead-end on [StorageManager's "does not support sharing" throw](../../packages/axoview-app/src/services/storage/StorageManager.ts#L125). Drive-native public links (permissions API + `webViewLink`) are a different trust model and, if ever wanted, a future ADR.

### 5. The app's mode model gains `remoteStorageActive`

The app currently branches on a **binary** `serverStorageAvailable` (autosave vs. session-dirty flag, file explorer, empty-state card, unsaved-changes guard — ~20 branches in [DiagramLifecycleProvider](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx)). Drive mode must behave like "remote storage" in all of them without pretending to be the session backend:

- `AppStorageContext` exposes `remoteStorageActive = serverStorageAvailable || activeProviderId === 'google-drive'`.
- All storage-behavior branches (autosave, explorer, blank-diagram card, navigation guards) switch to `remoteStorageActive`.
- Surfaces that are **session-backend contracts** — share links (§4), the `/display/p/<uuid>` public route (ADR 0009 §3) — stay on `serverStorageAvailable`.

This is the single largest integration surface of the feature; treating it as one deliberate flag swap (not 20 ad-hoc edits) is the decision.

### 6. Provider switching, persistence of choice, and "Save to Drive"

- **Picker:** a new `StorageProviderPicker` control (AppToolbar, next to the auth avatar) offers **Local | Google Drive** — the PLAN 3A "Local | Drive | S3" text is stale; S3 was dropped 2026-04-29. Drive is disabled with a "Sign in to use Google Drive" tooltip until authenticated, and absent entirely when `googleClientId` is null.
- **Persistence:** the active provider id is stored in `localStorage['axoview-active-provider']`. Boot restores Drive only after ADR 0035's reconnect flow yields a token; until then the app runs Local.
- **"Save to Drive" context action:** in Local mode with an authenticated Google session, the file-tree context menu ([ContextMenuItems.tsx](../../packages/axoview-app/src/components/fileExplorer/ContextMenuItems.tsx)) gains **"Save to Drive"** on diagram nodes — a non-destructive copy of that diagram into the Drive root folder (name-collision handled with the existing `copySuffix` convention). This replaces the PLAN's bulk "Migrate local diagrams?" dialog.

> TODO: is a destructive "Move to Drive" variant (copy + delete local) also wanted, or does copy-only cover the workflow? V1 ships copy-only.

### 7. Errors, retries — online-only v1

- Transient errors (5xx, network timeout): exponential backoff, 3 attempts (500 ms / 1 s / 2 s), then a sticky error notification with a **Retry** action. The diagram's dirty flag survives, so nothing is silently lost.
- `401`: token invalidated → `authStore` transitions to `SESSION_EXPIRED` (ADR 0035 state machine); the failed operation surfaces the persistent "Sign in again" notification.
- `403 userRateLimitExceeded / rateLimitExceeded`: treated as transient (backoff), surfaced as a *warning* toast, not an error.
- **The offline IndexedDB write queue from the PLAN 3B spec is deferred** (owner decision 2026-07-05) — it gets a catalogued entry with a real forcing function (field reports of lost edits), not a v1 implementation.

## Consequences

**Positive:**
- The Cloudflare deployment gains real persistence with zero server-side storage and zero new worker routes — exactly the extension path ADR 0009 reserved.
- Choice-of-folder lives in the user's own Drive (marker), so it follows the account across devices without us persisting server-side state.
- Drive trash gives delete a recovery path the app itself dropped in 2B-R, at zero UI cost.

**Negative / risks:**
- `drive.file` means the app cannot see pre-existing Drive content except folders the user explicitly picks — correct privacy posture, but users may expect to "open" arbitrary Drive files; the first-connect dialog copy must set that expectation.
- Online-only v1: a save during an outage is a visible failure + retained dirty state, not a queued write.
- The Google Picker adds a second Google script (`apis.google.com/js/api.js` — already CSP-allowed) and its own API-key-less picker config quirks; scoped to the custom-folder path only.
- Manifest writes (`axoview-manifest.json`) are last-writer-wins across concurrent sessions on the same account — same posture as the session backend today (ADR 0010 single-tenant assumption).

## Implementation notes (non-binding)

- File: `services/storage/providers/GoogleDriveProvider.ts`; registered in `AppStorageContext` when `googleClientId` is present. Fresh implementation — do not resurrect the deleted Phase 2A stub from git history.
- Use `fields=` query params to keep list payloads lean (`files(id,name,modifiedTime,parents,appProperties)`); map `modifiedTime` → `DiagramMeta.lastModified`.
- Unit tests follow the jest `fetch`-mock pattern established by [`LocalStorageProvider.test.ts`](../../packages/axoview-app/src/services/storage/__tests__/LocalStorageProvider.test.ts) (MSW rejected in Phase 2A — ESM/Jest-CJS conflict; PLAN 3B's "use MSW" instruction is superseded by that precedent).
- Thumbnails: `DiagramMeta.thumbnail` stays client-generated; do not upload thumbnails to Drive in v1 (payload cost, no cross-device consumer).

## Acceptance criteria

- **Unit test:** full provider suite with mocked `fetch` — list/load/save/create mapping; rename/move/trash/untrash; root-folder discovery (marker found / not found / stale cache); 401 → SESSION_EXPIRED; 503 ×2 then success (backoff); 503 ×3 → error notification with Retry; token obtained via `getValidToken()` only.
- **Manual verification (localhost + integration deploy):** first connect shows the folder dialog → default path creates `axoview-diagrams` in My Drive; create diagram → save → reload → reconnect → diagram loads from Drive; rename/move/delete reflect in drive.google.com (delete lands in Drive trash); "Save to Drive" copies a local diagram into the root folder; share button absent in Drive mode; switching back to Local restores local content untouched.
- **Gate before ship (PLAN.md catalogued workstream):** privacy disclosure/policy published and linked from the OAuth consent screen — Drive does not ship to production without it.
