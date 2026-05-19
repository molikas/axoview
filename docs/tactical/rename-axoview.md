# Tactical — Rename FossFLOW → Axoview

> **Read first:**
> - [docs/architecture.md](../architecture.md) — current package layout (lib + app + backend + worker + e2e)
> - [docs/adr/0001-project-zip-format.md](../adr/0001-project-zip-format.md) — project ZIP manifest format; backwards compat depends on it
> - [packages/fossflow-lib/src/index.ts](../../packages/fossflow-lib/src/index.ts) — current public API surface (`Isoflow`, `IsoflowProps`, `IsoflowRef`, `useIsoflow`)
> - [packages/fossflow-app/src/services/project/projectZip.ts](../../packages/fossflow-app/src/services/project/projectZip.ts) — `PROJECT_FORMAT` constant; importer rejection logic
> - [packages/fossflow-lib/src/components/SettingsDialog/AboutTab.tsx](../../packages/fossflow-lib/src/components/SettingsDialog/AboutTab.tsx) — attribution surface (must credit Isoflow + FossFLOW)
>
> **Status:** Approved — ready for implementation · **Owner:** Igor · **Last updated:** 2026-05-19
>
> This is a **short-lived working doc.** Delete after the work merges and the test list at the bottom is fully green. Durable record = the `rename/axoview` commit log + a one-line POST entry in `PLAN.md`.

## Session startup checklist

1. Read this file fully.
2. Read [docs/adr/0001-project-zip-format.md](../adr/0001-project-zip-format.md) — Phase 8 backwards compat depends on it.
3. Confirm working tree is clean on `integration`.
4. Confirm `git remote -v` shows `https://github.com/molikas/axoview.git` (already done 2026-05-19).
5. Create `git tag pre-rename-v2026.5.21` for rollback anchor.
6. `git checkout -b rename/axoview`.
7. Use `TodoWrite` to track sub-tasks; mark `[x]` in this doc as phases complete.
8. On completion, follow the "Wrap-up" section.

## Goal

Rebrand the project from `FossFLOW` to `Axoview` across code, infrastructure, docs, and external services — without breaking:

- **Existing user data in localStorage** (Phase 8 migration shim).
- **Existing FossFLOW-exported `.zip` project bundles** (Phase 8 importer accepts both manifest formats).
- **External lib consumers** of the published `fossflow` npm package (Phase 10 deprecate-not-unpublish).
- **Upstream attribution** to Isoflow and FossFLOW — both lineage credits are preserved in the renamed product (see Decision #12).

**Out of scope:** new features, logo/visual identity redesign.

---

## Decisions

| # | Decision |
|---|---|
| 1 | **Casing:** `axoview` for identifiers/paths, `Axoview` for display + React component + types. No `AxoView` camelcase. |
| 2 | **npm names:** unscoped — `axoview` (lib), `axoview-app`, `axoview-backend`, `axoview-worker`, `@axoview/e2e` (scoped to mirror current `@fossflow/e2e`). |
| 3 | **Public API rename:** `Isoflow` → `Axoview`, `IsoflowProps` → `AxoviewProps`, `IsoflowRef` → `AxoviewRef`, `useIsoflow` → `useAxoview`. |
| 4 | **Project ZIP format:** new exports write `format: 'axoview-project'`. Importer **accepts both** `'axoview-project'` AND `'fossflow-project'`. Filenames change to `axoview-project-*.zip` / `axoview-folder-*.zip` for new exports; old filenames remain importable (filename is not validated, only manifest content). |
| 5 | **localStorage migration shim:** on app boot, if any `fossflow_*` key exists and no `axoview_*` key exists, copy values across and delete originals. Runs exactly once per browser profile, gated by a sentinel key. |
| 6 | **Debug global:** `window.__axoview__` is canonical. `window.__fossflow__` retained as alias for 2 releases with a deprecation warning on first access, then removed. |
| 7 | **Old `fossflow` npm package:** `npm deprecate` with pointer to `axoview`. **Do not unpublish** — would break any external consumer locked to a version. |
| 8 | **Docker image:** `molikas/axoview:latest` replaces `stnsmith/fossflow:latest` in compose files. Old image stays on Docker Hub indefinitely; document migration in [docs/deployment.md](../deployment.md). |
| 9 | **Cloudflare Pages:** rename via dashboard if supported; otherwise new project + DNS cutover (planned maintenance window). |
| 10 | **External meta (Skills + memory):** `.claude/commands/*.md` updated on this branch. User-level memory under `~/.claude/projects/c--myTemp-FossFLOW/memory/` updated by hand; orphan dir deleted only after the working directory is renamed in Phase 10. |
| 11 | **Commit strategy:** one commit per phase on `rename/axoview`. Keeps `git bisect` useful and reverts cheap. |
| 12 | **Attribution preservation (locked).** Both upstream lineages must remain visible in the renamed product: (a) **Isoflow** — the `@isoflow/isopacks` npm dependency is **NOT** renamed and stays as a direct dep; the icon-pack source must be credited in the in-app About tab and in README. (b) **FossFLOW** — the immediate fork ancestor (`stan-smith/FossFLOW`) is credited in README intro + LICENSE + About tab as "forked from FossFLOW, which was forked from Isoflow." Any future contributor-facing doc preserves this chain. |

---

## Table of Contents

1. [Phase 0 — Pre-flight](#phase-0--pre-flight)
2. [Phase 1 — Branch + safety net](#phase-1--branch--safety-net)
3. [Phase 2 — Mechanical text replace](#phase-2--mechanical-text-replace)
4. [Phase 3 — Lib public API rename](#phase-3--lib-public-api-rename)
5. [Phase 4 — Folder renames](#phase-4--folder-renames)
6. [Phase 5 — package.json cascade](#phase-5--packagejson-cascade)
7. [Phase 6 — Infrastructure](#phase-6--infrastructure)
8. [Phase 7 — Public assets + docs + attribution](#phase-7--public-assets--docs--attribution)
9. [Phase 8 — Migration shims (localStorage + ZIP importer)](#phase-8--migration-shims-localstorage--zip-importer)
10. [Phase 9 — Skills + memory cleanup](#phase-9--skills--memory-cleanup)
11. [Phase 10 — External services](#phase-10--external-services)
12. [Test list](#test-list)
13. [Wrap-up](#wrap-up)

---

## Phase 0 — Pre-flight

- [ ] Confirm `npm view axoview` returns 404 (last confirmed 2026-05-19).
- [ ] Confirm domain registration plan: pick TLD (`axoview.app` or `axoview.dev` recommended — `.com` likely taken by Axometrics SEO competitor).
- [ ] Confirm `git remote -v` points at `github.com/molikas/axoview.git` (done 2026-05-19).
- [ ] Snapshot a real exported FossFLOW project ZIP from production and stash at `test-fixtures/fossflow-legacy-export.zip` — used by Phase 8 importer test.
- [ ] **Attribution baseline:** snapshot current README intro (line 1) and `AboutTab.tsx` — these strings are the source of truth for the Isoflow + FossFLOW lineage and must survive the rename intact (modified only for product name).

## Phase 1 — Branch + safety net

- [ ] `git tag pre-rename-v2026.5.21`
- [ ] `git checkout -b rename/axoview`
- [ ] Push tag + branch to origin.
- [ ] Commit: `chore(rename): pre-rename safety tag`.

## Phase 2 — Mechanical text replace

Three passes, in order, scoped to tracked files (avoids touching `node_modules`, `dist`, etc.). PowerShell-safe:

```powershell
$patterns = @(
  @{ from='FOSSFLOW'; to='AXOVIEW' },
  @{ from='FossFLOW'; to='Axoview' },
  @{ from='FossFlow'; to='Axoview' },
  @{ from='fossflow'; to='axoview' }
)
foreach ($p in $patterns) {
  git ls-files | ForEach-Object {
    $content = Get-Content $_ -Raw
    if ($null -ne $content -and $content -cmatch $p.from) {
      ($content -creplace $p.from, $p.to) | Set-Content $_ -NoNewline -Encoding utf8
    }
  }
}
```

- [ ] Run pass 1–4. Skip `Isoflow` (mixed case) — Phase 3 handles that surgically.
- [ ] `git status` — confirm scope; spot-check 5–10 diffs.
- [ ] **Excluded from rename (verify these stay intact):**
  - `docs/upstream-changelog.md` — verbatim upstream history; do not mass-edit, prepend a note instead.
  - `node_modules/` — untracked anyway.
  - `package-lock.json` dependency name `@isoflow/isopacks` (Decision #12).
  - LICENSE attribution lines mentioning FossFLOW / Isoflow as prior authors.
  - Any string that reads "**forked from** FossFLOW" or "**originally** FossFLOW" in README or About tab — these are historical claims, not branding.
- [ ] Commit: `chore(rename): mechanical replace FossFLOW → Axoview (excluding lineage attribution)`.

## Phase 3 — Lib public API rename

Surface: 8 files identified by grep on capital-I `Isoflow`. Rename pipeline:

- [ ] `git mv packages/fossflow-lib/src/Isoflow.tsx packages/fossflow-lib/src/Axoview.tsx` *(do this **before** Phase 4 folder rename so the cascade is two-step instead of one tangled diff)*
- [ ] `git mv packages/fossflow-lib/src/types/isoflowProps.ts packages/fossflow-lib/src/types/axoviewProps.ts`
- [ ] Symbol rename across lib (`Isoflow` → `Axoview`, `IsoflowProps` → `AxoviewProps`, `IsoflowRef` → `AxoviewRef`, `useIsoflow` → `useAxoview`). Files affected:
  - `packages/fossflow-lib/src/index.ts` (exports)
  - `packages/fossflow-lib/src/Axoview.tsx`
  - `packages/fossflow-lib/src/types/axoviewProps.ts`
  - `packages/fossflow-lib/src/types/index.ts`
  - `packages/fossflow-lib/src/components/ExportImageDialog/ExportImageDialog.tsx`
  - `packages/fossflow-lib/src/examples/*/` (3 files)
  - `packages/fossflow-lib/docs/pages/docs/*.mdx` (3 files: quickstart, isopacks, api)
- [ ] **Do NOT rename** any `@isoflow/isopacks` import — that's the external icon-pack dependency (Decision #12). The string `@isoflow/isopacks` must remain unchanged in every file that imports it.
- [ ] Check importers in `packages/fossflow-app/` for any `Isoflow` usage; replace.
- [ ] Run `npm run build:lib` — must compile clean.
- [ ] Commit: `refactor(lib): rename public API Isoflow → Axoview (preserves @isoflow/isopacks dep)`.

## Phase 4 — Folder renames

- [ ] `git mv packages/fossflow-app packages/axoview-app`
- [ ] `git mv packages/fossflow-lib packages/axoview-lib`
- [ ] `git mv packages/fossflow-backend packages/axoview-backend`
- [ ] `git mv packages/fossflow-worker packages/axoview-worker`
- [ ] `git mv packages/fossflow-e2e packages/axoview-e2e`
- [ ] Commit immediately, no other edits: `refactor: rename workspace folders to axoview-*`. Gives clean `git log --follow` history.

## Phase 5 — package.json cascade

- [ ] **Root [package.json](../../package.json):** `name: fossflow-monorepo` → `axoview-monorepo`. Every script under `scripts:` referencing `packages/fossflow-*` → `packages/axoview-*` (lines 11–25, 28). `docker:build` tag → `axoview:local`.
- [ ] **packages/axoview-lib/package.json:** `name: fossflow` → `axoview`. `repository.url` → `https://github.com/molikas/axoview`. Description string can switch to "An open-source React component for drawing network diagrams — forked from FossFLOW (which was forked from Isoflow)." to preserve lineage in the published package metadata.
- [ ] **packages/axoview-app/package.json:** `name: fossflow-app` → `axoview-app`. Dependency `"fossflow": "*"` → `"axoview": "*"`. **`@isoflow/isopacks` dependency stays as-is.**
- [ ] **packages/axoview-backend/package.json:** `name: fossflow-backend` → `axoview-backend`.
- [ ] **packages/axoview-worker/package.json:** `name: fossflow-worker` → `axoview-worker`. `wrangler pages dev ../fossflow-app/build` → `../axoview-app/build`.
- [ ] **packages/axoview-e2e/package.json:** `name: @fossflow/e2e` → `@axoview/e2e`.
- [ ] Delete `node_modules` + `package-lock.json`, run `npm install` from root — must complete without workspace resolution errors. **Confirm `@isoflow/isopacks` resolves and downloads (not renamed).** Commit the new lockfile.
- [ ] Commit: `chore(pkg): rename package names to axoview-*`.

## Phase 6 — Infrastructure

- [ ] **[Dockerfile](../../Dockerfile)** lines 9, 10, 31, 34 — all path refs to `packages/axoview-*`.
- [ ] **[compose.yml](../../compose.yml):** service `fossflow` → `axoview`, image `stnsmith/fossflow:latest` → `molikas/axoview:latest`.
- [ ] **[compose.dev.yml](../../compose.dev.yml):** service `fossflow` → `axoview`.
- [ ] **[docker-entrypoint.sh](../../docker-entrypoint.sh):** log message (line 5) + cd path (line 6).
- [ ] **nginx.conf** (root): grep for `fossflow` refs.
- [ ] **[wrangler.toml](../../wrangler.toml):** `name = "fossflow"` → `"axoview"`, `pages_build_output_dir = packages/axoview-app/build`.
- [ ] **[.github/workflows/docker.yml](../../.github/workflows/docker.yml):** Docker Hub image refs.
- [ ] **[.github/workflows/pages.yml](../../.github/workflows/pages.yml):** Cloudflare Pages project name.
- [ ] **[.github/workflows/release.yml](../../.github/workflows/release.yml):** release naming.
- [ ] **[.github/workflows/e2e-tests.yml](../../.github/workflows/e2e-tests.yml), [test.yml](../../.github/workflows/test.yml), [dependabot-automerge.yml](../../.github/workflows/dependabot-automerge.yml), [ethicalcheck.yml](../../.github/workflows/ethicalcheck.yml).**
- [ ] **[.releaserc.json](../../.releaserc.json):** release commit message format.
- [ ] **[.github/ISSUE_TEMPLATE/](../../.github/ISSUE_TEMPLATE/)** — bug-report + feature-request templates.
- [ ] **[functions/api/[[path]].ts](../../functions/api/%5B%5Bpath%5D%5D.ts):** check for fossflow strings.
- [ ] Commit: `chore(infra): rename Docker / CF / CI references to axoview`.

## Phase 7 — Public assets + docs + attribution

### 7a — App-visible chrome

- [ ] **[manifest.json](../../packages/fossflow-app/public/manifest.json):** `short_name`, `name`, `description`.
- [ ] **[index.html](../../packages/fossflow-app/public/index.html):** `<title>` (line 27), description meta (line 10), splash logo text (line 81 — currently `Foss<span>FLOW</span>` → `Axo<span>view</span>` or similar). Splash CSS prefix `ff-splash` → `ax-splash` (lines 31–74) + matching handler in `App.tsx`.
- [ ] **Logo assets** in `packages/axoview-app/public/`: `favicon.ico`, `logo192.png`, `logo512.png`. **Net-new artwork required.** If logo isn't ready, ship placeholder PNGs with the letter A on a `#2563eb` background — same theme color as current.

### 7b — Attribution (Decision #12)

- [ ] **[AboutTab.tsx](../../packages/fossflow-lib/src/components/SettingsDialog/AboutTab.tsx):** rewrite the body to:
  - Replace `FossFLOW Community Edition` → `Axoview` (or `Axoview Community Edition` if you want to keep the suffix).
  - Add a new credits block below the version, with explicit attribution lines:
    - `Forked from FossFLOW` — link to `https://github.com/stan-smith/FossFLOW`
    - `Icons by Isoflow (@isoflow/isopacks)` — link to `https://github.com/markmanx/isoflow`
  - Keep the GitHub button; point it at the new repo via the existing `REPOSITORY_URL` constant.
- [ ] **[README.md](../../README.md) intro (line 1):** rewrite to retain both lineage credits. Suggested:
  > Axoview is an isometric diagramming tool, forked from [FossFLOW](https://github.com/stan-smith/FossFLOW) (itself forked from [Isoflow](https://github.com/markmanx/isoflow)), with expanded editing features, file management, full internationalisation, project-zip workspace bundles, multi-target deployment (Docker / Cloudflare Pages), and large performance improvements. Icons under the bundled `@isoflow/isopacks` pack remain attributed to Isoflow.
- [ ] **[LICENSE](../../LICENSE):** verify the upstream copyright lines (Isoflow / FossFLOW authors) are intact. If renaming touched LICENSE in Phase 2, restore the original attribution. Add a `Copyright (c) 2026 Igor Sidenica — Axoview project` line **without** removing prior copyrights.
- [ ] Optional but recommended: create `NOTICE.md` at repo root summarizing the lineage and isopacks attribution in one place. Link to it from README and AboutTab.

### 7c — Long-form docs

- [ ] **[CHANGELOG.md](../../CHANGELOG.md):** add entry under `[Unreleased]`: `Renamed project FossFLOW → Axoview; Isoflow + FossFLOW attribution preserved in README, LICENSE, and About tab.` Leave historical entries intact.
- [ ] **[PLAN.md](../../PLAN.md), [flare_plan.md](../../flare_plan.md), [known_issues.md](../../known_issues.md):** product-name refs.
- [ ] **[docs/](../) full sweep:** architecture.md, ux-principles.md, testing.md, deployment.md, perf-troubleshooting.md.
- [ ] **[docs/adr/](../adr/)** — 6 ADRs. Replace product name; leave historical decision text intact (decisions don't change because the name does).
- [ ] **[docs/upstream-changelog.md](../upstream-changelog.md):** prepend a one-line note that this is the pre-rename history; do NOT mass-replace inside (it's verbatim upstream).
- [ ] **i18n:** sweep every locale in `packages/axoview-lib/src/i18n/` for hardcoded `FossFLOW`. Verify there's no localized string saying "Built on FossFLOW" — if there is, it stays (it's lineage attribution, not branding).
- [ ] **[scripts/update-version.js](../../scripts/update-version.js):** verify it still finds the right package.json paths.
- [ ] Commit: `docs: rename project references FossFLOW → Axoview; preserve Isoflow + FossFLOW attribution`.

## Phase 8 — Migration shims (localStorage + ZIP importer)

This is the **only phase with user-data risk.** Tests 8 through 14 in the test list are non-negotiable acceptance gates.

### 8a — localStorage key migration

- [ ] Inventory all localStorage keys with `fossflow` prefix. Grep:
  - `packages/axoview-app/src/services/storage/providers/LocalStorageProvider.ts`
  - `packages/axoview-lib/src/utils/localStorageSave.ts`
  - `packages/axoview-app/src/utils/sessionDump.ts`
- [ ] Add a one-shot migration function `migrateFossflowLocalStorageKeys()`:
  - On app boot, scan `localStorage` for any key starting with `fossflow_` or `fossflow-`.
  - For each, copy value to the `axoview_` / `axoview-` equivalent **only if the destination key doesn't already exist**.
  - Delete the original key in either case (so the scan is idempotent on next boot).
  - Write a sentinel key `axoview_migration_v1 = 'done'` so the scan runs at most once per browser profile.
- [ ] Hook into `App.tsx` boot — must run **before** any provider reads localStorage. Place adjacent to existing storage provider init.
- [ ] Same sweep for `sessionStorage` if any keys use the fossflow prefix.

### 8b — ZIP importer backwards compatibility

- [ ] Edit [packages/axoview-app/src/services/project/projectZip.ts](../../packages/fossflow-app/src/services/project/projectZip.ts):
  - Change `PROJECT_FORMAT` constant to `'axoview-project'` (new exports use this).
  - Add a sibling constant `LEGACY_PROJECT_FORMATS = new Set(['fossflow-project'])`.
  - Update the format check at line 192 from `manifest.format !== PROJECT_FORMAT` to: **accept** if `format === PROJECT_FORMAT || LEGACY_PROJECT_FORMATS.has(format)`. Reject otherwise.
  - Update the "newer FossFLOW" error message on line 200 to "newer Axoview".
  - Update filename helpers on lines 70–74 to emit `axoview-project-*.zip` / `axoview-folder-*.zip` for new exports.
- [ ] **Do not change** the schema beyond `format`. Folders, diagrams, IDs, tree manifest — all unchanged.

### 8c — Debug globals alias

- [ ] Set `window.__axoview__` as the canonical debug global in `App.tsx` and `diagnosticsStore.ts`.
- [ ] Keep `window.__fossflow__` pointing at the same object as an alias. Add a one-time `console.warn` on first access: `"window.__fossflow__ is deprecated; use window.__axoview__"`. Remove the alias in 2 releases.

- [ ] Commit: `feat(rename): backwards-compatible migration for localStorage + ZIP importer + __fossflow__ alias`.

## Phase 9 — Skills + memory cleanup

### Skills (in this repo, rename branch)

- [ ] **[.claude/commands/audit.md](../../.claude/commands/audit.md)** — title (line 1), description (line 3), UX-principles ref (line 5), all `fossflow-lib` / `fossflow-app` paths (lines 13, 19, 43, 56, 59, 83, 84, 89, 90, 91, 92, 111, 115, 120, 125, 129, 133, 141, 145, 170, 175, 182, 188, 192, 197).
- [ ] **[.claude/commands/feature.md](../../.claude/commands/feature.md)** — title (line 1), description (line 3), UX-principles ref (line 5), memory path (line 25), tactical-doc trigger (line 42).
- [ ] **[.claude/commands/notes.md](../../.claude/commands/notes.md)** — title (line 1), package paths (lines 179–182), memory path (line 198).
- [ ] **[.claude/commands/shake-out.md](../../.claude/commands/shake-out.md)** — UX-principles ref (line 5), build instruction (line 53 — `fossflow-lib` → `axoview-lib`).
- [ ] **[.claude/commands/ship.md](../../.claude/commands/ship.md)** — package paths (lines 24–27, 32, 33).
- [ ] Memory-path references inside skill files (`C:\Users\isidenica\.claude\projects\c--myTemp-FossFLOW\...`) — **leave alone for now.** They become correct after the cwd rename in Phase 10; flipping them prematurely would point at a directory that doesn't yet exist.
- [ ] Commit: `chore(skills): rename FossFLOW → Axoview in .claude/commands`.

### User-level memory (outside the repo; manual fix-up by user)

- [ ] In [`MEMORY.md`](C:/Users/isidenica/.claude/projects/c--myTemp-FossFLOW/memory/MEMORY.md): update 3 index entries (`FossFlow Implementation Plan`, `FossFlow Cloudflare Deployment Plan`, `FossFlow docs structure`) to `Axoview …`.
- [ ] In `project_docs_convention.md`: name field (line 2). Historical ref to `FOSSFLOW_ENCYCLOPEDIA.md` on line 62 stays as-is (it's a record of what was deleted, not a branding string).
- [ ] In `project_flare_plan.md`: name field (line 2), path on line 7, `fossflow-backend` ref (line 25 → `axoview-backend`). The rejected `fossflow-core` ref on line 25 is a historical decision — reframe to `axoview-core` or leave annotated.
- [ ] In `project_implementation_plan.md`: name + description + path (lines 2, 3, 7).
- [ ] **Memory directory orphan:** after the cwd rename (Phase 10), the harness creates a fresh `c--myTemp-axoview/memory/` on the next session. Manually copy the updated files into it. The old `c--myTemp-FossFLOW/memory/` becomes orphan — delete after one verification session in the new dir.

## Phase 10 — External services

⚠ **Mostly irreversible.** Execute only after Phases 1–9 are merged to `integration` and the test list at the bottom is fully green.

- [ ] **Domain registration:** register chosen TLD (recommended `axoview.app` or `axoview.dev`).
- [ ] **GitHub repo rename:** already done 2026-05-19. Update any external bookmarks / CI webhooks pointing at old URL.
- [ ] **npm publish:** from `packages/axoview-lib/`, run `npm publish`. Verify package appears on registry with the lineage-preserving description.
- [ ] **npm deprecate old package:** `npm deprecate fossflow "Renamed to axoview — install axoview instead. See https://github.com/molikas/axoview"`.
- [ ] **Docker Hub:** create `molikas/axoview` repo. Push image. Update README + deployment.md.
- [ ] **Cloudflare Pages:** attempt rename via dashboard. If unsupported, create new Pages project pointing at `github.com/molikas/axoview` `master`, deploy, then DNS-cutover. Old project stays live until cutover confirmed.
- [ ] **Working directory rename:** `c:\myTemp\FossFLOW` → `c:\myTemp\axoview` on local machine. Close all editors / terminals / Claude Code sessions first. Re-open in new path.
- [ ] **Memory copy-over:** copy updated files from `~/.claude/projects/c--myTemp-FossFLOW/memory/` to `~/.claude/projects/c--myTemp-axoview/memory/` (the latter created by harness on first session in new cwd). Verify in next session.

---

## Test list

Tests below are the acceptance gate for merging `rename/axoview` → `integration`. Grouped by what's at risk.

### Build + smoke (catches structural breakage)

1. [ ] `npm install` from root completes with no workspace resolution errors.
2. [ ] `npm run build:lib` — `packages/axoview-lib` builds clean.
3. [ ] `npm run build:app` — `packages/axoview-app` builds clean and finds the `axoview` workspace dependency.
4. [ ] `npm run build` (combined) — green.
5. [ ] `npm run test:unit` — full lib unit suite green.
6. [ ] `npm run test:smoke` — Playwright smoke green.
7. [ ] `npm run dev` — dev server starts, app loads in browser, splash shows `Axoview` text.

### Backwards compatibility (non-negotiable user-data tests)

8. [ ] **Unit — ZIP importer accepts legacy format.** Add to `packages/axoview-app/src/services/project/__tests__/projectZip.test.ts`: build a ZIP with `manifest.format = 'fossflow-project'`, assert `parseProject()` returns successfully and produces correct folders + diagrams. Use the stashed fixture from Phase 0 step 4.
9. [ ] **Unit — ZIP importer accepts new format.** Same test with `format = 'axoview-project'` — must also pass.
10. [ ] **Unit — ZIP importer rejects unknown format.** `format = 'something-else'` must throw `ProjectZipError` with code `BAD_FORMAT`.
11. [ ] **Unit — ZIP exporter emits new format.** Export a project, parse the manifest, assert `format === 'axoview-project'` and filename matches `axoview-project-*.zip`.
12. [ ] **Unit — localStorage migration shim.** Seed `localStorage` with several `fossflow_*` keys including realistic diagram JSON. Run boot. Assert: old keys deleted, new `axoview_*` keys present with identical values, sentinel `axoview_migration_v1 === 'done'`.
13. [ ] **Unit — migration runs at most once.** Re-run the boot path; assert no work happens on the second call (no unexpected writes).
14. [ ] **Unit — migration does not overwrite.** Seed both old `fossflow_X` AND new `axoview_X` with different values; assert new value is preserved, old is deleted.

### Attribution (Decision #12 — must not regress)

15. [ ] **Unit / snapshot — `AboutTab.tsx`** renders both attribution strings: matches `/Forked from FossFLOW/i` AND `/Isoflow/i` (icon-pack credit).
16. [ ] **Lint check — `@isoflow/isopacks` still imported.** Grep:
    ```
    git ls-files | xargs grep -l '@isoflow/isopacks'
    ```
    Must return ≥ 1 result; if zero, the icon-pack dependency was accidentally renamed — fail.
17. [ ] **Lint check — README intro.** First paragraph of `README.md` must contain `FossFLOW` AND `Isoflow` substrings.
18. [ ] **Lint check — LICENSE.** `LICENSE` must still contain the upstream Isoflow / FossFLOW copyright lines AND the new Axoview copyright line.

### Manual smoke (catches things unit tests miss)

19. [ ] Open a pre-rename FossFLOW-exported ZIP via the in-app importer; verify diagrams + folders import without error, names + IDs intact.
20. [ ] Save a diagram, reload page, verify diagram still present (proves localStorage migration ran correctly on a real browser profile).
21. [ ] Export a project, re-import it on a fresh session, verify roundtrip works under the new format.
22. [ ] Open DevTools → `window.__axoview__` returns the store object. Verify `window.__fossflow__` returns the same object **and** a deprecation warning fires once in the console.
23. [ ] Open Settings → About tab. Verify both attribution lines render and the links open the upstream repos.
24. [ ] Check PWA install on Chrome — manifest pulls `Axoview` name + icons.
25. [ ] Check that `<title>` shows `Axoview` in the tab.

### Hygiene checks (residual references)

26. [ ] Grep for residual lowercase `fossflow`:
    ```
    git ls-files | xargs grep -l fossflow 2>$null
    ```
    Expected: `docs/upstream-changelog.md`, `CHANGELOG.md` historical entries, README/About lineage attribution strings, possibly `package-lock.json` (until reinstall). Anything else is a bug.
27. [ ] Same grep for `Isoflow`:
    ```
    git ls-files | xargs grep -l Isoflow 2>$null
    ```
    Expected residual: `@isoflow/isopacks` references in dependency declarations (external package, **must not** be renamed), historical changelog entries, README + AboutTab lineage credits.
28. [ ] `npm view axoview` returns the freshly-published package after Phase 10.
29. [ ] `npm view fossflow` shows the deprecation message.
30. [ ] Cloudflare Pages deployment of new project succeeds; production URL serves the new app.

### Regression sanity (no functionality should change)

31. [ ] `npm run test:e2e` — full Playwright suite green (chromium + firefox projects).
32. [ ] `npm run test:visual` — visual regression baseline matches (if there are intentional UI changes from Phase 7 splash/title, regenerate baselines and commit the diff with explanation in the commit message).

---

## Wrap-up

When the test list is fully green and Phase 10 external services are live:

1. Merge `rename/axoview` → `integration` (and from there → `master` per [/ship](../../.claude/commands/ship.md)).
2. Add one line to `PLAN.md` POST phase: `[POST] Rename FossFLOW → Axoview (rename/axoview merged YYYY-MM-DD)`.
3. Delete this tactical doc — `git rm docs/tactical/rename-axoview.md`.
4. Update the **Active tactical docs** list in `project_docs_convention.md` (user memory): remove the entry for this doc.
5. Update the index entry in `MEMORY.md` if any project memory still refers to "FossFlow" by name.
6. Tag `v2026.5.22-axoview` (or whatever the next semver is) to mark the brand cutover.

The durable record is: the commit log on `rename/axoview`, the POST-phase entry in `PLAN.md`, the LICENSE + README + AboutTab attribution lines, and the deprecation notice on the old `fossflow` npm package.
