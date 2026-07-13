# Tactical — Drive-Native Sharing & Read-Only Preview

> **Read first:**
> - [ADR 0042 — Drive-Native Diagram Sharing & Read-Only Preview](../adr/0042-drive-native-sharing-and-readonly-preview.md) (the decision this implements)
> - [ADR 0036 — Google Drive Storage Provider](../adr/0036-google-drive-storage-provider.md) (§4 superseded by 0042; §1–§3/§5/§7 constraints stand)
> - [ADR 0035 — Google Identity & Drive Authorization](../adr/0035-google-identity-and-drive-authorization.md) (token custody rules — `getValidToken()` only)
> - [ADR 0037 — Storage Places Model](../adr/0037-storage-places-model.md) (place semantics the share popover keys off)
> - [docs/drive-native-sharing-investigation.md](../drive-native-sharing-investigation.md) (evidence record + full citation trail; delete together with this file at wrap)
> - [docs/workflow.md](../workflow.md) (session cadence baseline)
>
> **Status:** Not started · **Owner:** molikas · **Last updated:** 2026-07-13
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
| 2 | Anonymous preview = API-key read of public files; key referrer- + API-restricted; `googleApiKey: null` degrades gracefully. |
| 3 | Specific-user granting = native ShareClient dialog with mandatory drive.google.com (`webViewLink`) fallback. |
| 4 | Drive sharing stays OUTSIDE `StorageProvider.shareDiagram` (publish-snapshot contract doesn't fit). |
| 5 | Drive links are LIVE (render-at-open); `/display/p/<uuid>` snapshot links coexist unchanged for session/server places. |
| 6 | Scope stays `drive.file` only — do NOT add `drive.readonly`/`drive.install` in this slice. |
| 7 | New route must extend `isReadonlyUrl` and must NOT set `isPublicShareUrl` (LocalModeShareError stays share-uuid-scoped). |

## Sub-tasks

### A. Prototype gates (do FIRST — cheap kill-switches; ADR acceptance criteria P1/P2)
- [ ] Create the API key in project `axoview` (referrers: axoview.app, axoview.pages.dev **apex** AND *.axoview.pages.dev — Google's `*.` wildcard does NOT match the apex, and the apex is a kept live fallback origin; localhost:3000; APIs: Drive + Picker; enable Google Picker API). Note the Cloud project NUMBER for `GOOGLE_PROJECT_NUMBER` (B).
- [ ] P1: browser `fetch` of a real "anyone with link" file via `files.get?alt=media&key=` from localhost — confirm 200 + JSON body + CORS.
- [ ] P2: two-account Picker run — account B (viewer) picks the shared file via `setFileIds`, then `alt=media` with B's `drive.file` token succeeds; confirm the grant survives a token refresh + reload.
- [ ] ShareClient smoke: dialog opens for an app-created file in Chrome; observe the failure mode with third-party cookies blocked (fallback trigger).
- [ ] Record results here; if P1 or P2 fails, STOP and re-open ADR 0042 (status stays Proposed).

### B. Config rail + CSP
- [ ] Worker `/api/config`: `googleApiKey` from `GOOGLE_API_KEY` + `googleProjectNumber` from `GOOGLE_PROJECT_NUMBER` (+ app.spec tests). The project number is its own config value — do NOT derive it from the client-id prefix (ADR 0042 §5; wrong value = silent Picker-grant no-op).
- [ ] Express `/api/config` parity (+ routes.config.spec test).
- [ ] `useRuntimeConfig` parsing + `DEFAULT_CONFIG` `PUBLIC_GOOGLE_API_KEY` / `PUBLIC_GOOGLE_PROJECT_NUMBER` fallbacks (ADR 0035 §4 pattern).
- [ ] CSP: `frame-src` += docs.google.com + drive.google.com in `_headers` and both `nginx.conf` blocks; verify at P2 whether Picker needs extra `connect-src`.
- [ ] Wrangler var + deployment.md / README env-var tables.

### C. Display route + load ladder
- [ ] Route `/display/drive/:driveFileId` in App.tsx; extend `isReadonlyUrl` OR in DiagramLifecycleProvider; **in the same change, guard the existing owner-readonly loader effect (`:518-575`) with a `driveFileId` early-return** (mirroring its `if (isPublicShareUrl) return`) — without it that effect co-fires on the Drive route, calls `loadDiagram(undefined)`, and races ReadonlyLoadErrorDialog over the gate screen (ADR 0042 §2). Confirm LocalModeShareError untriggered.
- [ ] `services/drive/drivePublicRead.ts`: key read (+ optional `X-Goog-Drive-Resource-Keys`), token read, typed failure reasons.
- [ ] Loader effect (template = public-snapshot effect): validate → `loadPacksForDiagram` → readonly `SavedDiagram`; cancel-on-navigate guard like the readonly loader.
- [ ] `DriveDisplayGate` screen: signed-out (sign-in card reuse) / grant-needed (Picker launch) / terminal-failure states.
- [ ] Picker wiring: `gapi.load('picker')`, `setAppId(<project number>)`, `setOAuthToken`, `setDeveloperKey`, `DocsView.setFileIds`; retry read after pick.

### D. Share popover — Drive branch
- [ ] Remove the `{!driveActive && …}` hide + rewrite the ADR-0036-§4 comment block (AppToolbar).
- [ ] `services/drive/driveSharing.ts`: preview-URL builder (basename + optional resourceKey), `permissions.list` access summary, ShareClient launcher + fallback (`webViewLink` from `files.get fields=webViewLink,resourceKey`).
- [ ] Popover UI: copy-link (live-semantics copy text) · manage-access · access summary. A null `googleApiKey` hides ONLY the anonymous-link hint and the gate screen's Picker rung (ADR 0042 §5) — the popover, copy-link, ShareClient, and access summary need no API key and always render for Drive diagrams.
- [ ] Resolve the ADR §1 TODO with the owner (in-app anyone-toggle: yes/no) before polishing this section.

### E. Tests, i18n, docs
- [ ] Unit: ladder order + null-key skip; resourceKey propagation; config parsing ×2; URL builder; permissions-summary mapping.
- [ ] e2e: `drive-display.spec.ts` mirroring the readonly-share coverage in `share.spec.ts` (J13/J14) + `share-error.spec.ts`, with mocked `www.googleapis.com` fetches (public-file render; gate screen on 404).
- [ ] i18n keys ×13 locales (popover, gate screen, errors).
- [ ] Stale share copy sweep: `docs/features.md` + README "sharing requires server storage / self-host" claims, and the session-branch share-button tooltip copy — all now wrong or misleading once Drive diagrams share serverlessly.
- [ ] `/notes` sync: known_issues (Picker entry gains "infra landed via ADR 0042; 'Add from Drive' now cheap" note or a fix), architecture.md, testing.md.

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
