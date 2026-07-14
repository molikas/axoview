# Tactical — Drive-Native Sharing & Read-Only Preview

> **Read first:**
> - [ADR 0042 — Drive-Native Diagram Sharing & Read-Only Preview](../adr/0042-drive-native-sharing-and-readonly-preview.md) (the decision this implements)
> - [ADR 0036 — Google Drive Storage Provider](../adr/0036-google-drive-storage-provider.md) (§4 superseded by 0042; §1–§3/§5/§7 constraints stand)
> - [ADR 0035 — Google Identity & Drive Authorization](../adr/0035-google-identity-and-drive-authorization.md) (token custody rules — `getValidToken()` only)
> - [ADR 0037 — Storage Places Model](../adr/0037-storage-places-model.md) (place semantics the share popover keys off)
> - [docs/drive-native-sharing-investigation.md](../drive-native-sharing-investigation.md) (evidence record + full citation trail; delete together with this file at wrap)
> - [docs/workflow.md](../workflow.md) (session cadence baseline)
>
> **Status:** Implemented on `integration` + adversarial code-review-fix pass landed (401→markExpired, 403 rate-limit taxonomy, permissions pagination drain, gapi.load timeout/onerror, picked-file identity check, DriveSetupGate auth-loss/readonly ordering, share-popover async-race + ACL staleness guards, view-mode label-hover blackhole fix); **2026-07-14 PIVOTS: (1) ShareClient DROPPED → custom in-app Drive-REST permissions UI (commit `0475798`); (2) anonymous read moved SERVER-SIDE to a `/api/public/drive/:id` read proxy — the API key is now a SECRET, `/api/config` exposes only a `drivePublicPreview` boolean (ADR 0042 §8 / ADR 0043 #3, commit `12c1b77`)** — pending owner prototype gates (A) + two-account manual verification · **Owner:** molikas · **Last updated:** 2026-07-14
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

A Drive-place diagram can be shared through Google Drive's own access control
and previewed read-only by the recipient at
`/app/display/drive/<fileId>` — anonymously when the file is "anyone with the
link", via a one-time Picker grant otherwise. No server storage, no new OAuth
scope. **Not** goals: editing shared diagrams, Drive "Open with" registration,
snapshot semantics for Drive links, Drive→session transfer.

## Scope

### In scope
- `GOOGLE_API_KEY` config rail (worker + Express + `PUBLIC_` dev fallback) and Google Cloud console key setup.
- `/display/drive/:driveFileId` route + load ladder (key read → token read → Picker gate).
- Drive branch of the share popover (copy preview link · native ShareClient dialog · drive.google.com fallback · access summary).
- CSP `frame-src` additions (`_headers` + nginx ×2).
- Unit + e2e coverage, i18n (13 locales), docs sync.

### Out of scope
- Drive UI "Open with" / Workspace Marketplace listing (ADR 0042 §6 — deferred).
- In-app `permissions.create` write surface (pending the ADR §1 TODO — owner call).
- Editing via a granted file, even with writer permission (readonly only).
- Offline queue, worker code-flow, and the other Drive deferrals in known_issues.

## Locked decisions (from ADR 0042 / investigation, 2026-07-13)

| # | Decision |
|---|---|
| 1 | Grant mechanism = Google Picker with `setFileIds([fileId])`; Open-with deferred. |
| 2 | Anonymous preview = API-key read of public files. **SUPERSEDED 2026-07-14 (ADR 0042 §8): the read is a SERVER proxy `GET /api/public/drive/:id` — the key is a secret, `/api/config` exposes only `drivePublicPreview`, no referrer restriction; `drivePublicPreview:false` degrades gracefully.** |
| 3 | ~~Specific-user granting = native ShareClient dialog + drive.google.com fallback.~~ **SUPERSEDED 2026-07-14 (ADR 0042 decision-3 addendum, commit `0475798`): custom in-app UI over Drive REST v3 `permissions` (anyone-with-link toggle + add/remove people); ShareClient dropped.** |
| 4 | Drive sharing stays OUTSIDE `StorageProvider.shareDiagram` (publish-snapshot contract doesn't fit). |
| 5 | Drive links are LIVE (render-at-open); `/display/p/<uuid>` snapshot links coexist unchanged for session/server places. |
| 6 | Scope stays `drive.file` only — do NOT add `drive.readonly`/`drive.install` in this slice. |
| 7 | New route must extend `isReadonlyUrl` and must NOT set `isPublicShareUrl` (LocalModeShareError stays share-uuid-scoped). |

## Sub-tasks

### A. Prototype gates + deploy config (owner-only; ADR acceptance P1/P2) — read-proxy form (ADR 0042 §8)
- [ ] Create the API key in project `axoview`: **API-restricted to the Google Drive API**, **Application restrictions = None** (it is called SERVER-SIDE by the read proxy → no HTTP-referrer allowlist). Do NOT bind a service account.
- [ ] Set it as a **secret**, never `[vars]`: `wrangler pages secret put GOOGLE_API_KEY` (or CF dashboard → Pages → axoview → Variables and Secrets → Secret, under **BOTH** Production and Preview). **Redeploy** — Pages binds secrets only on a NEW deployment.
- [ ] P1: `curl <deploy>/api/config` shows `drivePublicPreview: true`; then an "anyone with the link" file opens at `/app/display/drive/<id>` in incognito → 200, no sign-in (the read now goes through `/api/public/drive/:id`, not a browser `key=` fetch).
- [ ] P2 (Option B, dormant): needs `GOOGLE_PROJECT_NUMBER` (plain `[vars]`, project NUMBER not the client-id prefix) **and a SEPARATE referrer-restricted browser Picker key** (the server key is server-only). Two-account Picker run — B picks a PRIVATE shared file via `setFileIds`, then `alt=media` with B's `drive.file` token succeeds + survives a token refresh + reload.
- [ ] Record results here; if P1 or P2 fails, STOP and re-open ADR 0042 (status stays Proposed). (ShareClient smoke retired — ShareClient was dropped, decision #3.)

### B. Config rail + CSP
- [x] Worker `/api/config`: exposes `drivePublicPreview` (`!!GOOGLE_API_KEY` — the raw key stays SERVER-SIDE for the read proxy, ADR 0042 §8) + `googleProjectNumber` from `GOOGLE_PROJECT_NUMBER` (+ app.spec tests). The project number is its own config value — do NOT derive it from the client-id prefix (ADR 0042 §5; wrong value = silent Picker-grant no-op).
- [x] Express `/api/config`: emits `drivePublicPreview: false` — Docker/Express has NO read proxy (ADR 0042 §8; anonymous preview is Cloudflare-only) — plus `googleProjectNumber`; drops the raw `googleApiKey` (+ routes.config.spec test).
- [x] `useRuntimeConfig` parsing + `DEFAULT_CONFIG` `PUBLIC_GOOGLE_API_KEY` / `PUBLIC_GOOGLE_PROJECT_NUMBER` fallbacks (ADR 0035 §4 pattern). ⚠️ Gotcha found live: every `PUBLIC_*` read needs a matching `define` entry in `rsbuild.config.ts` — an unlisted var ships a literal `process` to the browser and breaks boot with a ReferenceError.
- [x] CSP: `frame-src` += docs.google.com + drive.google.com in `_headers` and both `nginx.conf` blocks; verify at P2 whether Picker needs extra `connect-src`.
- [x] Wrangler var + deployment.md / README env-var tables.

### C. Display route + load ladder
- [x] Route `/display/drive/:driveFileId` in App.tsx; extend `isReadonlyUrl` OR in DiagramLifecycleProvider; the owner-readonly loader effect was made **self-keyed** (`if (!readonlyDiagramId || !storage) return`) — a structurally deeper form of the ADR 0042 §2 co-fire guard (each loader keys on its own route param; a fourth route needs zero new guards). LocalModeShareError confirmed untriggered (e2e).
- [x] `services/drive/drivePublicRead.ts`: key read (+ optional `X-Goog-Drive-Resource-Keys`), token read, typed failure reasons (+ 403 body classification: rate-limit → transient, scope-missing routed to re-consent; 401 arms the auth-store expiry).
- [x] Loader effect (template = public-snapshot effect): validate → `loadPacksForDiagram` → readonly `SavedDiagram`; cancel-on-navigate guard; hydration tail extracted into ONE shared helper used by all three readonly loaders.
- [x] `DriveDisplayGate` screen: signed-out (sign-in card reuse) / grant-needed (Picker launch) / terminal-failure states; transient failures get an inline Retry; auto-retry is one-shot guarded.
- [x] Picker wiring: `gapi.load('picker')` (config-object form with onerror/timeout), `setAppId(<project number>)`, `setOAuthToken`, `setDeveloperKey`, `DocsView.setFileIds` (comma-separated string signature); retry read after pick, picked-doc identity checked.

### D. Share popover — Drive branch
- [x] Remove the `{!driveActive && …}` hide + rewrite the ADR-0036-§4 comment block (AppToolbar).
- [x] `services/drive/driveSharing.ts`: preview-URL builder (shared with shareUrl.ts), `permissions.list` access summary (**pages drained** — a `type:'anyone'` entry can sit past page 1), ShareClient launcher + fallback (`webViewLink` prefetched once per popover open).
- [x] Popover UI: copy-link (live-semantics copy text) · manage-access · access summary (staleness-guarded; failure shows an inline error, not eternal "Checking…"). A null `googleApiKey` hides ONLY the anonymous-link hint and the gate screen's Picker rung (ADR 0042 §5).
- [x] ADR §1 TODO resolved 2026-07-13: v1 = native-dialog-only (dated note in the ADR); the anyone-toggle stays a v1.1 option.

### E. Tests, i18n, docs
- [x] Unit: ladder order + null-key skip; resourceKey propagation; config parsing ×2; URL builder; permissions-summary mapping (incl. multi-page).
- [x] e2e: `drive-display.spec.ts` mirroring the readonly-share coverage in `share.spec.ts` (J13/J14) + `share-error.spec.ts`, with mocked `/api/public/drive` proxy (rung 1) + `www.googleapis.com` (token rung) fetches (public-file render; gate screen; resourceKey-on-proxy-URL assertion). 3/3 green (realigned for the read proxy, verified locally 2026-07-14).
- [x] i18n keys ×13 locales (popover, gate screen, errors); retired key `toolbar.share.disabled.needsServerStorage` removed.
- [x] Stale share copy sweep: `docs/features.md` + README + session-branch share tooltip.
- [x] `/notes` sync: known_issues (Picker entry narrowed to "file-tree browsing" — ADR 0042 lands the Picker for the display-route grant) + testing.md (drive-display.spec.ts row). architecture.md N/A — it has no routing/display-route section (delegates the route list to technical-review).

## Wrap-up

When all sub-tasks are complete and the smoke checklist passes:

1. Add a single line under `PLAN.md` Phase 3B section:
   ```
   - Drive-native sharing + readonly preview shipped — see docs/adr/0042 (supersedes 0036 §4) and (this file's git history).
   ```
2. Delete this file AND `docs/drive-native-sharing-investigation.md`; **in the same commit**, rewrite ADR 0042's "full evidence record" link into a git-pinned note (path + the deleting commit's parent hash) so the Accepted ADR never carries a dead link. The ADR is the durable record.
3. Flip ADR 0042 → Accepted; update the `drive-native-sharing` memory pointer.

## Notes for Claude

- **Token custody:** every Drive call via `authStore.getValidToken()` — never a raw token read (ADR 0035 rule 2). The key-read rung is the ONLY unauthenticated call.
- **The Picker grant silently no-ops if `setAppId` is wrong** — it's the Cloud project NUMBER, not the client id; symptom = pick "succeeds" but `files.get` 404s.
- **Do not route the new loader through `GoogleDriveProvider`** — the recipient may have no root folder, no manifest, no place; the display route is provider-less by design (mirrors the public-snapshot loader).
- Watch the Drive API quota-billing change announced for "later in 2026" before shipping the public key (limits page).
- All Picker/ShareClient work needs a real browser + two real Google accounts; jsdom proves nothing here. Owner verifies via screenshots (established pattern).
- Cross-package change class (app + worker + backend): build all three; e2e only runs on PRs — don't cycle e2e-blind (memory: e2e-local-loop-gotchas).
