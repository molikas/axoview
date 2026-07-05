# Tactical — Google Drive Storage (Phase 3A + 3B)

> **Read first:**
> - [ADR 0035 — Google Identity & Drive Authorization](../adr/0035-google-identity-and-drive-authorization.md)
> - [ADR 0036 — Google Drive Storage Provider](../adr/0036-google-drive-storage-provider.md)
> - [ADR 0009 — Deployment Topology](../adr/0009-deployment-topology.md) (§4 env-var contract, §5 CSP parity)
> - [ADR 0010 — Session Backend Contract](../adr/0010-session-backend-contract.md) (share = session-only)
> - [docs/workflow.md](../workflow.md) — session cadence baseline
>
> **Status:** Not started · **Owner:** molikas · **Last updated:** 2026-07-05
>
> This is a **short-lived working doc.** Delete it after the work merges; ADRs are the durable record. PLAN.md gets a one-line entry referencing the ADRs once shipped — see "Wrap-up" below.

## Session startup checklist

1. Read this file fully.
2. Read each linked ADR.
3. Skim `PLAN.md` Phase Status Dashboard **for context only** — do not modify it during this work.
4. Use `TodoWrite` to track sub-tasks below.
5. Mark `[x]` as work completes.
6. On completion, follow the "Wrap-up" section to update PLAN.md with a single line.

## Goal

A signed-in user can store diagrams in their own Google Drive: sign in from the toolbar, pick (or accept) a root folder once, and get the full file-explorer experience (create/rename/move/delete/autosave) backed by Drive — including on the storage-less Cloudflare deployment. Local mode additionally gains a per-diagram "Save to Drive" copy action. **Not** goals: offline write queue, Drive-native share links, bulk migration, external diagram registry (explicitly dropped by owner 2026-07-05).

## Scope

### In scope
- `authStore` + `AuthProvider` + toolbar sign-in/avatar/session-expired UI (ADR 0035).
- `GoogleDriveProvider` implementing the full current `StorageProvider` interface (ADR 0036 §1).
- Root-folder discovery + first-connect dialog (default `axoview-diagrams` / custom via Google Picker) (ADR 0036 §2).
- `remoteStorageActive` flag swap in `AppStorageContext` / `DiagramLifecycleProvider` (ADR 0036 §5).
- `StorageProviderPicker` (Local | Google Drive) + provider persistence + boot reconnect (ADR 0036 §6, ADR 0035 §3).
- "Save to Drive" context-menu action on diagram nodes in Local mode (ADR 0036 §6).
- Share affordance hidden in Drive mode (ADR 0036 §4).
- CSP `img-src` googleusercontent addition (`_headers` + `nginx.conf` parity).
- cf-access JWT signature-verify tests (catalogued workstream that folds into 3A).
- Privacy-policy ship gate (catalogued workstream: "before Phase 3B Drive ships").

### Out of scope
- Offline IndexedDB write queue (deferred — needs a forcing function).
- Drive-native public sharing / permissions API.
- Bulk local→Drive migration dialog (replaced by per-diagram "Save to Drive").
- Phase 4A External Diagram Registry (owner dropped 2026-07-05).
- Destructive "Move to Drive" variant (TODO in ADR 0036 §6 — copy-only in v1).
- Thumbnails uploaded to Drive.

## Locked decisions (from design discussion 2026-07-05)

| # | Decision |
|---|---|
| 1 | Offline write queue **deferred**; v1 is online-only — failed saves keep the dirty flag + sticky Retry notification. |
| 2 | No bulk migration dialog; instead a **"Save to Drive"** right-click action per diagram (non-destructive copy) when Drive is connected + authorized. |
| 3 | Sharing is **hidden in Drive mode**; ADR 0010's session-only share contract stands. |
| 4 | Delete in Drive mode = **Drive trash** (`trashed:true`), recoverable via drive.google.com; confirmation copy says so. |
| 5 | Root folder: default **`axoview-diagrams`**, first-connect dialog offers default vs. custom folder (Google Picker); choice remembered via `appProperties.axoviewRoot` marker in Drive itself + localStorage cache. |
| 6 | Google Cloud project `axoview`; client ID `485371025824-2ullp84i3nda2dgceirg9q87fvm36kl8.apps.googleusercontent.com` (public identifier); authorized origins: `https://axoview.pages.dev`, `https://integration.axoview.pages.dev`, `http://localhost:3000`. |
| 7 | Scopes exactly `openid profile email https://www.googleapis.com/auth/drive.file`; GIS token model, in-memory token only (ADR 0035). |

## Sub-tasks

### A. Auth foundation (ADR 0035) — one session
- [ ] `npm i @react-oauth/google` (axoview-app)
- [ ] `stores/authStore.ts` — state machine, `getValidToken()`, no persist middleware
- [ ] `providers/AuthProvider.tsx` — `GoogleOAuthProvider` wrapper, mounted above `AppStorageContext`; boot reconnect attempt (silent `prompt:''`) when `axoview-active-provider === 'google-drive'`
- [ ] `useRuntimeConfig.ts` — `PUBLIC_GOOGLE_CLIENT_ID` build-time fallback in `DEFAULT_CONFIG`
- [ ] AppToolbar: sign-in button / spinner / avatar+menu / session-expired chip / popup-blocked tooltip
- [ ] userinfo fetch (name/email/avatar) post sign-in
- [ ] Unit tests `stores/__tests__/authStore.test.ts` (per ADR 0035 acceptance list, incl. localStorage spy)
- [ ] cf-access JWT signature-verify tests (worker: RS256 happy + invalid-signature) — catalogued fold-in

### B. Drive provider, fully mocked (ADR 0036 §1–3, §7) — one session
- [ ] `services/storage/providers/GoogleDriveProvider.ts` — all `StorageProvider` methods per the ADR mapping table (incl. `renameDiagram`, `restoreDiagram`, `moveItem` parent swap)
- [ ] Root-folder discovery (marker query) + create-default path + stale-cache recovery
- [ ] Backoff/retry wrapper (3×: 500ms/1s/2s) + error mapping (401 → SESSION_EXPIRED, 403 rate → warning, 3× fail → sticky Retry notification)
- [ ] Tree manifest file read/write (`axoview-manifest.json`)
- [ ] Unit tests `services/storage/__tests__/GoogleDriveProvider.test.ts` — jest fetch-mock pattern (NOT MSW), per ADR 0036 acceptance list

### C. App integration (ADR 0036 §4–6) — one session
- [ ] `remoteStorageActive` in `AppStorageContext`; sweep `DiagramLifecycleProvider` / `App.tsx` branches — storage-behavior branches move to it, share/public-route branches stay on `serverStorageAvailable` (grep every `serverStorageAvailable` use and classify)
- [ ] Register `GoogleDriveProvider` in `AppStorageContext` when `googleClientId` present; `StorageManager.setActiveProvider` switch flow (flush/guard unsaved work before switching)
- [ ] `StorageProviderPicker` in AppToolbar (Local | Google Drive; Drive gated by auth; absent when no client ID)
- [ ] Provider persistence (`axoview-active-provider`) + explorer auto-open on Drive activation
- [ ] First-connect root-folder dialog (default vs. Google Picker custom); Picker loaded lazily only for the custom path
- [ ] "Save to Drive" in `ContextMenuItems.tsx` (diagram nodes, Local mode + authenticated; `copySuffix` on name collision)
- [ ] Hide share affordance when active provider is `google-drive`
- [ ] i18n: new strings into `en-US.json` (+ existing-locale fallback pattern)

### D. Deploy, compliance, verification — one session
- [ ] Set `GOOGLE_CLIENT_ID` in **both** wrangler.toml files (root = deploy-authoritative, worker copy = local dev — ADR 0009 §5 drift rule) and document in `docs/deployment.md` env tables
- [ ] CSP: `img-src` + `https://*.googleusercontent.com` in `_headers` **and** `nginx.conf`
- [ ] Privacy policy page + link it in the Google OAuth consent screen (**ship gate**)
- [ ] Manual test matrix: localhost:3000 (dev) + integration.axoview.pages.dev — full ADR 0036 manual list (first-connect, save/reload/reconnect, rename/move/trash verified in drive.google.com, Save to Drive, share hidden, switch back to Local)
- [ ] `npm run build` + full unit suites green; e2e impact check (PR-time only — see notes)

## Wrap-up

When all sub-tasks are complete and the smoke checklist passes:

1. Add a single line under the PLAN.md Phase 3A and 3B sections:
   ```
   - Google Drive storage shipped — see docs/adr/0035-0036 and (this file's git history).
   ```
2. Delete this file. The ADRs are the durable record; this checklist's job is done.
3. Update the memory pointers: retire the Drive-scaffold note in the session memory if one exists; flip ADR 0035/0036 Status to Accepted.

## Notes for Claude

- **Token rule is absolute:** any patch that writes the access token to localStorage/sessionStorage/IndexedDB is wrong, even for tests — the unit suite spies on `localStorage.setItem` to enforce it.
- **`serverStorageAvailable` sweep is the risk center.** Classify every branch before editing; share links and `/display/p/*` stay session-only (ADR 0009 §3, ADR 0010). A blind rename breaks the Local-mode share-error dialog contract.
- **MSW is a trap here:** Phase 2A already tried and dropped it (ESM vs Jest CJS). Follow `LocalStorageProvider.test.ts`'s jest `fetch`-mock pattern even though PLAN 3B says MSW.
- **e2e runs on PRs only, never on integration pushes** — the manual matrix in D is the real gate; don't assume CI covered UI flows.
- **Playwright/dev-server gotchas:** webServer serves the lib DIST and reuses a stale :3000 server — rebuild the lib and kill the server when iterating on lib sources (not expected here; this feature is app-package-only).
- **Dual wrangler.toml drift:** every `[vars]` change lands in BOTH the repo-root file (deploy) and `packages/axoview-worker/wrangler.toml` (local dev), per ADR 0009 §5.
- **Origin restriction bites silently:** GIS errors like `idpiframe_initialization_failed`/`redirect_uri_mismatch` on a non-authorized origin (e.g. a `*.pages.dev` preview URL that isn't `integration.`) are configuration, not code — check the origin list first.
- **The rsbuild env prefix is `PUBLIC_`** — a bare `GOOGLE_CLIENT_ID` env var never reaches client code.
- **Build after every section** (`npm run build` in axoview-app); the app type gate (`tsc --noEmit`) needs lib declarations, so build the lib first if it complains.
