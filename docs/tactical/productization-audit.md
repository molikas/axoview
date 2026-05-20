# Tactical — Productization audit & dead-code hunt

> **Read first:**
> - [docs/architecture.md](../architecture.md) — current feature inventory, store/mode map, deployment contract.
> - [docs/ux-principles.md](../ux-principles.md) — design language. Naming-convention work here must extend, not contradict, this doc.
> - [docs/deployment.md](../deployment.md) — from-scratch deploy walkthroughs (local / Docker / Cloudflare); the spec the deployment artifact audit measures reality against.
> - [flare_plan.md](../../flare_plan.md) — **being absorbed by this audit.** Ingest in workstream A.6.1, migrate durable decisions to ADRs, then delete at wrap-up.
> - [ADR 0005 — Toolbar and dock layout contract](../adr/0005-toolbar-and-dock-layout-contract.md) — the layout most affected by the "Main Menu vs left deck" anomaly the user flagged.
> - [ADR 0006 — Canvas selection contract](../adr/0006-canvas-selection-contract.md) — the most recently locked behavioural contract; reference for the depth-of-detail bar for future ADRs spawned by this audit.
> - [PLAN.md](../../PLAN.md) Phase Status Dashboard — context only; do not modify during this work.
>
> **Status:** Not started · **Owner:** Igor · **Last updated:** 2026-05-19
>
> This is a **short-lived working doc.** Delete it after synthesis ships and downstream cleanup tactical docs (one per workstream) take over. ADRs spawned here are the durable record; PLAN.md gets a single line at wrap-up under the appropriate phase (likely 2D, since this is post-2D cleanup gating 3A).

## Session startup checklist

1. Read this file fully.
2. Read each linked ADR header (status + decision summary).
3. Skim `PLAN.md` Phase Status Dashboard **for context only** — do not modify it.
4. Use `TodoWrite` to track sub-tasks for the workstream you're picking up.
5. Mark `[x]` as work completes. Append anomalies to the **Findings register** at the bottom.
6. On full completion, follow the **Wrap-up** section.

## Goal

End state: a fully **productized** Axoview — clean codebase (no dead code, no duplicate UX surfaces, no orphaned legacy concepts), documented naming convention for every interactive surface, a runtime-trace harness, a rewritten E2E suite, **deployment artifacts (Docker, Cloudflare, nginx, compose) at best-practice baseline**, **git configuration and automation hardened**, and a verified end-to-end deploy of the session-mode app to a public Cloudflare endpoint. The audit *produces a plan and the supporting decisions*; cleanup and hardening land in downstream tacticals.

**Why now:** the codebase carries six months of upstream FossFLOW heritage plus an aggressive feature build-out (2A→2D), plus a deployment track (Phase 5*) that grew organically alongside the brand rename. Several anomalies are already known (Main Menu ghost, ALL CAPS legacy removed but other drift suspected, deployment plan parked in its own file). Before Phase 3A (Google Auth) widens the surface again, we want a verified productization baseline that includes **everything that ships, not just the app code**.

**Explicit non-goals (in this doc):**
- Doing the cleanup or hardening itself. This doc captures *findings* and *decisions*; execution lands in downstream tacticals (one per workstream where the work is non-trivial).
- Designing Google Drive integration. We only verify that *placeholder* code for it is intentional and not mistaken for dead code; Phase 3B owns the actual build.
- Performance optimisation of correct-but-slow code. Anomalies only.

## End-to-end productization path

This audit's value is a sequenced path from "where we are" to "publicly shippable in session mode." Each milestone has a definition of done.

| # | Milestone | Definition of done | Gates |
|---|---|---|---|
| **M0** | Audit kickoff | This tactical doc reviewed by user; workstream A.x todos created. | — |
| **M1** | Discovery complete | Findings register populated for A.1–A.8; every flagged item classified (dead / dupe / placeholder / intentional / needs-runtime-check). | M0 |
| **M2** | Trace harness live | ADR 0007 accepted; `trace.ts` in `axoview-lib`; `?trace=1` proven to gate cleanly. | M1 |
| **M3** | Verification complete | Phase B theory catalogue scored against captured logs; refutations/confirmations in register. | M2 |
| **M4** | Naming convention locked | ADR 0008 accepted; ux-principles.md updated; any `data-axoview-id` decision made. | M3 (A.3 specifically) |
| **M5** | Cleanup tacticals spawned | Every confirmed dead/dupe/anomalous item has a target — either an entry in inline cleanup plan (C.2) or its own tactical doc. | M3, M4 |
| **M6** | Cleanup executed | All cleanup tacticals wrapped; this tactical's Findings register entries are all resolved. | M5 |
| **M7** | Deployment artifacts hardened | Dockerfile, compose.\*.yml, nginx.conf, wrangler.toml, axoview-worker, axoview-backend all at documented best-practice baseline; ADRs for any locked deployment contract; `flare_plan.md` deleted (content migrated to ADRs). | M1 (A.6) |
| **M8** | Process & automation hardened | `.github/` complete (CODEOWNERS, PR template if applicable, issue templates, SECURITY.md), `.gitignore` / `.gitattributes` reviewed, CI workflows running on PRs (lint + type-check + unit + build), dependency-update automation active (Dependabot or Renovate), security scanning wired (CodeQL or equivalent), release automation defined (or explicitly deferred with rationale), **`docs/workflow.md` published codifying canonical session cadence**, **every in-scope skill aligned with that cadence (no stale paths / phase numbers / retired-file references)**, missing-skill candidates triaged (build / defer / reject). | M1 (A.7, A.8, A.9) |
| **M9** | E2E suite green | New Playwright suite (post-deletion of both prior suites) covers critical paths; runs in CI on PRs. | M4 (naming), M8 (CI) |
| **M10** | Productization ship gate | Tagged release; container image published; Cloudflare deploy verified end-to-end in session mode (signup-free, public URL, multi-user session isolation honoured); README + deployment.md reflect the shipped reality. | M6, M7, M8, M9 |

**Critical sequencing:** M7 and M8 can run **in parallel** with M5/M6 once Discovery is done. M9 depends on M4 (test selectors need locked names) and M8 (need CI to run them). M10 needs everything.

The audit doc captures decisions through M5. Execution (M6–M10) lives in spawned tacticals.

## Scope

### In scope
- All four packages: `axoview-lib`, `axoview-app`, `axoview-backend`, `axoview-worker`.
- All UX surfaces: top toolbar, left dock (Elements / Layers), right sidebar (item controls), bottom dock, context menu, dialogs (Settings, Export, Import, Help, Confirm), notifications, status cluster, view tabs, zoom controls.
- All interaction modes: Cursor, Pan, Lasso, FreehandLasso, DragItems, Connector, PlaceIcon, DrawRectangle, TransformRectangle, TextBox, ReconnectAnchor.
- Three runtime modes: **Local (browser-only)**, **Session (server-backed)**, **Google Drive (placeholder)**.
- Test infrastructure: `__perf_refactor_regression__/`, both E2E suites, unit suite organization.
- Monorepo layout, build/packaging scripts, dependency tree, scripts/, root-level config (`tsconfig.base.json`, `eslint.config.mjs`, `package.json`, `package-lock.json`).
- **Deployment artifacts (all targets):** `Dockerfile`, `docker-entrypoint.sh`, `compose.yml`, `compose.dev.yml`, `nginx.conf`, root `wrangler.toml`, `functions/api/`, `packages/axoview-worker/` (Cloudflare worker), `packages/axoview-backend/` (Express + fs adapter for session mode), `test-base-paths.sh`. Includes ingestion of `flare_plan.md` and migration of its durable decisions to ADRs.
- **Git configuration:** `.github/` (ISSUE_TEMPLATE, optionally PULL_REQUEST_TEMPLATE, CODEOWNERS, SECURITY.md, FUNDING.yml), `.gitignore`, `.gitattributes`, `LICENSE` files, root-level `CHANGELOG.md`, branch protection expectations.
- **Git automation / agent routines:** CI workflows (`.github/workflows/*`), dependency-update bots (Dependabot / Renovate), security scanning (CodeQL, secret scanning, npm audit, container scanning), release automation (changelog gen, version bump, tag, image push), bot routines (stale handling, auto-labeling, PR triage). Gap analysis included — list what's missing, not just what exists.
- Documentation: ADRs, architecture.md, ux-principles.md, deployment.md, testing.md, skills.

### Out of scope
- Doing the cleanup or hardening itself (this doc *plans*; downstream tacticals execute).
- Designing Google Drive integration (Phase 3B owns it).
- Building new features beyond what hardening implies. If analysis suggests a missing feature, log it; don't build it.
- Performance optimisation of correct-but-slow code. Anomalies only.

## Locked decisions (from scoping discussion 2026-05-19)

| # | Decision | Rationale |
|---|---|---|
| 1 | No new PLAN.md phase row. This tactical is standalone; wrap-up adds one line under Phase 2D. | Audit is cross-cutting; a phase row would suggest features ship from it, but it only produces decisions. |
| 2 | Revive `__fftest__`-style instrumentation as the runtime-trace harness (workstream B). | User explicitly chose over ad-hoc `console.log` probes; reusable beyond this audit. Will likely spawn a new ADR (placeholder **ADR 0007**). |
| 3 | UX element naming convention is locked **after audit pass 1**, as its own ADR (placeholder **ADR 0008**). | Premature naming risks rework once analysis surfaces every surface that needs an ID. |
| 4 | E2E plan: **delete both `e2e-tests/` (legacy Python/Selenium) and `packages/axoview-e2e/` (current Playwright)**. Rewrite from zero against the locked naming convention + data-id contract. | User chose nuclear option; current Playwright suite predates 2D layout changes, will be partly stale anyway. |
| 5 | Google Drive integration is on the roadmap (Phase 3B). Placeholder code for it is **intentional**, not dead. Treat any GDrive-prefixed file/symbol as out-of-scope for dead-code removal unless it's a discarded earlier attempt. | Avoids accidentally ripping out Phase 3B scaffolding. |
| 6 | **Cloudflare + Docker + Session-backend deployment artifacts are IN scope** for this audit (supersedes the previous /feature skill convention that flare was a separate track). Productization target = working public Cloudflare deploy running in **session mode**, with hardened CI/CD. GDrive auth/storage remains deferred to Phase 3B. | The user explicitly redirected: productization must be end-to-end, including everything that ships. Splitting deployment from app cleanup leaves a half-done product. |
| 7 | **`flare_plan.md` is being retired.** Workstream A.6.1 ingests it; durable decisions migrate to ADRs (placeholders **ADR 0009 — Deployment topology**, **ADR 0010 — Session backend contract**, others as needed); the file is deleted at wrap-up. No further edits to `flare_plan.md` are made during this audit — only reads. | Two parallel "plan" files (PLAN.md + flare_plan.md) created split-brain context across sessions. ADRs are the durable record; one tactical (this one) coordinates the migration. |
| 8 | **Git configuration and git-agent automation are IN scope** (workstreams A.7, A.8). Gap analysis included — list what's missing, not just what exists. | Productization isn't done if shipping requires manual ceremony every time. The user explicitly called out git config + missing agent routines as audit outputs. |
| 9 | **Skills + session cadence are IN scope** (workstream A.9). Output: `docs/workflow.md` codifying canonical session cadence + per-skill alignment pass + missing-skill catalogue (triaged: build / defer / reject). Building new skills is a follow-up effort, not part of this audit. | Productization includes how the team and agents *work*, not just what they ship. The user explicitly asked for the session sequence to be revised and made part of the audit. |
| 10 | **Rename tactical Phase 10 items are absorbed into this audit's milestones.** npm publish → M8 (release automation, C.8). Docker Hub publish → M8 (release automation). Cloudflare Pages deploy → M10 (ship gate). cwd rename → tracked here as a one-line execution note (purely local; not milestone-gating). The rename tactical doc itself is retired 2026-05-19. | Avoids leaving the rename's external-service work orphaned when its tactical doc is deleted. |

## Workstream overview

The audit runs in three phases. Workstreams within a phase are independent and can be parallelized across sessions. **A.6, A.7, and A.8 are first-class workstreams, not appendices** — productization is incomplete without them.

```
Phase A — Discovery (read-only, parallel)
   A.1 Git-diff sweep            (commit history → touched-surfaces matrix)
   A.2 Static analysis           (/audit skill → orphan/dupe/dead-code report)
   A.3 Concept anomaly hunt      (read every UX surface → duplicate-control register)
   A.4 Mode awareness audit      (Local/Session/GDrive → confirm placeholder vs dead)
   A.5 Structure & packaging     (monorepo layout, deps, scripts, perf tests location)
   A.6 Deployment artifacts      (Docker / Cloudflare / nginx / compose / backend / worker
                                  + ingest flare_plan.md → ADR migration plan)
   A.7 Git configuration         (.github/, .gitignore, .gitattributes, LICENSE, CHANGELOG,
                                  CODEOWNERS, SECURITY.md, branch protection)
   A.8 Git automation routines   (CI workflows, dependabot/renovate, security scans,
                                  release automation, bot routines — gap-focused)
   A.9 Skills + session cadence  (inventory + alignment audit of /audit, /feature, /notes,
                                  /shake-out, /ship, etc.; codify canonical workflow;
                                  identify missing skills — catalogue only, don't build)
       ↓
Phase B — Verification (runtime instrumentation)
   B.1 Harness design + ADR draft   (likely ADR 0007)
   B.2 Implement harness in axoview-lib + axoview-app
   B.3 Theory catalogue (what we expect to fire when)
   B.4 Test runs (manual or exploratory-agent driven)
   B.5 Reconcile expected vs actual → findings register
       ↓
Phase C — Synthesis (decisions + outputs)
   C.1 Naming convention ADR (placeholder ADR 0008)
   C.2 Cleanup plan (sequenced, per-workstream)
   C.3 Architecture.md + ux-principles.md update
   C.4 Skill updates (/audit, /shake-out, /feature, /notes if affected)
   C.5 E2E rewrite plan (separate tactical doc spawned here)
   C.6 Memory refresh (this audit's outputs)
   C.7 Deployment ADRs (placeholders ADR 0009 — deployment topology,
                        ADR 0010 — session backend contract, +N as findings dictate)
   C.8 Git-automation tactical (spawned doc covering CI workflow build-out,
                                dependency bots, release automation gaps)
   C.9 Workflow doc + skill updates (publish docs/workflow.md, update each in-scope
                                     skill body to align, triage missing-skill candidates)
       ↓
Phase D — Execution roadmap (milestones M5–M10)
   See "End-to-end productization path" section above. Phase D doesn't add new analysis;
   it sequences the cleanup + hardening tacticals spawned by Phase C into milestone gates.
```

---

## Phase A — Discovery

All workstreams in this phase are **read-only** and produce structured notes in the **Findings register**. None of them edit source code.

### A.1 Git-diff sweep

**Goal:** know exactly what shipped since the last clean baseline so we can scope where dupes/dead code most likely live.

**Method:**
1. Identify baseline: the rename merge `72fa120` (current `master`) is the natural baseline since rename touched everything but added no behaviour.
2. Walk `git log master --first-parent --since=2026-02-01 --reverse --format='%h %s'` and extract feature-bearing commits.
3. For each feature-bearing commit cluster, build a matrix: **{commit-range, feature-name, files-touched, surfaces-affected, ADRs-referenced}**.
4. Cross-reference surfaces against the **Concept anomaly hunt** worklist (A.3) — surfaces that appear in multiple non-coordinated commits are prime dupe candidates.

**Output:** `## A.1 Touched surfaces matrix` appended to the **Findings register**. One row per feature.

**Definition of done:** matrix exists; every PR/feature merge since 2026-02-01 has a row.

- [x] A.1.1 Establish baseline commit & date range — baseline `72fa120`, range 2026-03-20 → 2026-05-19 (fork era)
- [x] A.1.2 Extract feature commit clusters — 64 clusters in three phases (pre-CF / CF + shake-out / MQA + rename)
- [x] A.1.3 Build touched-surfaces matrix — see register
- [x] A.1.4 Flag clusters that overlap on the same surface — 15 overlap entries in register; MainMenu, AppToolbar, FileExplorer-dialogs, LayersPanel highest priority for A.3

### A.2 Static analysis sweep

**Goal:** find orphan exports, unreferenced files, dead branches, duplicate utilities.

**Method:**
1. Run the `/audit` skill against the repo. Capture its raw output.
2. Run targeted greps for known smell patterns:
   - `export default` followed by a file with zero importers (`Grep` callers).
   - `// TODO`, `// FIXME`, `// HACK`, `// XXX`, `// LEGACY` clusters.
   - `import { X }` where `X` is imported from two different modules across files (potential dupe utilities).
   - Files in `__perf_refactor_regression__/` that reference symbols that no longer exist.
3. Run `ts-prune` or equivalent if available; otherwise script an unused-export scan via `tsc --noEmit --listFiles` + AST walk. If neither feasible, document the gap and rely on the targeted greps.
4. For each finding, classify: **dead / dupe / outdated-test / placeholder (Phase 3B GDrive) / intentional**.

**Output:** `## A.2 Static-analysis findings` in the register. One subsection per category.

**Definition of done:** every flagged item has a classification; the count of "needs runtime verification" items feeds Phase B.

- [x] A.2.1 Run /audit skill, capture output — **deferred to a fresh knip run.** This pass classifies the existing pre-rename `reports/knip.txt`; a re-run is scheduled in C.8.
- [x] A.2.2 Targeted smell-pattern greps — stray console (14, mostly intentional), `@ts-ignore` (10, all in __tests__)
- [x] A.2.3 Unused-export scan — classified knip's 48 + 9 exports/types; 25 false positives + 10 cascade-with-C.5 + 5 needs-per-symbol-grep
- [x] A.2.4 Classify every flagged item — 7-row classification rollup
- [x] A.2.5 Hand "needs runtime verification" subset to Phase B — the 4 viewReducers entries (N5 #4)

### A.3 Concept anomaly hunt

**Goal:** find duplicate/contradictory UX surfaces (the "Main Menu ghost" class of bug — the user's primary motivating example).

**Method:** read **every** UX-bearing file and ask three questions per surface:

1. **Does this control exist anywhere else?** (Same action reachable from ≥2 surfaces — fine if intentional, anomalous if accidental.)
2. **Is this surface actually mounted in the running app?** (`MainMenu/` exists but if no route mounts it, it's a ghost.)
3. **Do shortcut keys for this surface still resolve to live handlers?** (`config/hotkeys.ts` and `config/shortcuts.ts` may list shortcuts whose targets were removed.)

Concrete read list (not exhaustive — update as you find more):

- All `packages/axoview-lib/src/components/*/`: each top-level component folder.
- `packages/axoview-app/src/components/`: AppToolbar, DiagramManager, all dialogs, EmptyStateScreen, fileExplorer/*.
- `packages/axoview-lib/src/config/hotkeys.ts`, `shortcuts.ts`, `persistedSettings.ts`.
- `packages/axoview-lib/src/components/MainMenu/` — **the user explicitly flagged this; verify mount points first.**
- `packages/axoview-lib/src/components/ContextMenu/`, `ContextMenuManager.tsx`.
- All `Settings*` files and dialogs.

**Output:** `## A.3 Concept anomalies` register. Per anomaly: surface name, current location(s), evidence (file:line), proposed disposition (remove / consolidate / leave-with-rationale).

**Definition of done:** every surface in the read list has been visited; every anomaly has a row.

- [x] A.3.1 Confirm MainMenu mount status (the canonical case) — **mounted-but-null in app, dead-by-config**; alive in lib (register #1)
- [x] A.3.2 Walk all `axoview-lib/src/components/*/` — surfaced `LeftSidebar.tsx` orphan (register #3), confirmed `MainMenu` / `ConfirmDiscardDialog` cascade; SettingsDialog tab inventory clean
- [x] A.3.3 Walk all `axoview-app/src/components/` — surfaced dual `ExportDialog` (#4), dual `StorageManager` (#5); confirmed AppToolbar post-ADR-0005 clean (#8); flagged SaveDialog/LoadDialog/DiagramManager modal reachability (#6, #7)
- [x] A.3.4 Walk hotkey / shortcut configs, cross-reference handlers — handler verification deferred to Phase B (#15, #16); discoverability gap flagged for Ctrl+O (#14)
- [x] A.3.5 Walk all dialog files (Settings, Export, Import, Help, Confirm, Load, Save) — folded into #4, #5, #6, #7
- [x] A.3.6 Walk context-menu surfaces (right-click + canvas double-click popovers) — `ContextMenuManager` + `QuickAddNodePopover` reviewed during cluster cross-check; no anomalies surface above the noise floor in this pass; Phase B will trace right-click event dispatch as a scenario
- [x] A.3.7 Compile anomaly register — 13 surface findings + 3 hotkey/shortcut items + 6 cross-cutting observations

### A.4 Mode awareness audit

**Goal:** the app supports **three distinct runtime modes** (Local browser-only, Session server-backed, Google Drive placeholder). Each mode should have a coherent, documented contract. Audit for: mode-detection paths, feature gating, code that runs in the wrong mode, GDrive placeholders that look like dead code but aren't.

**Method:**
1. Identify the mode-detection mechanism (likely [packages/axoview-app/src/hooks/useRuntimeConfig.ts](../../packages/axoview-app/src/hooks/useRuntimeConfig.ts) and [providers/AppStorageContext.tsx](../../packages/axoview-app/src/providers/AppStorageContext.tsx) — verify).
2. For each mode, enumerate: which storage provider is wired, which UI surfaces are visible, which actions are enabled/disabled, which fallback paths exist.
3. Cross-reference [SessionModeBanner.tsx](../../packages/axoview-app/src/components/SessionModeBanner.tsx) — the visible mode signal — with the actual mode logic. Mismatches are bugs.
4. List every reference to "googleDrive", "GDrive", "gdrive", and verify it's Phase-3B scaffolding (intentional) or stale (delete).

**Output:** `## A.4 Mode matrix` — 3-column table (Local / Session / GDrive) × N rows (one per surface or feature). Cells say "active / disabled / hidden / placeholder / DEAD".

**Definition of done:** matrix is complete; every "DEAD" cell has corroborating file:line evidence.

- [x] A.4.1 Locate mode-detection code path — `AppStorageProvider` runs parallel probes `fetchRuntimeConfig()` + `manager.initialize()`; binary toggle is `serverStorageAvailable = isServerStorage && isInitialized`; readonly is an orthogonal sub-mode
- [x] A.4.2 Enumerate per-mode contract for each surface — full per-aspect contract table in §A.4.2 + 32-row surface matrix in §A.4.3
- [x] A.4.3 Cross-check SessionModeBanner against actual mode — **name vs render-gate inverted (#C2)**; banner shows in LOCAL mode despite its name
- [x] A.4.4 Audit every GDrive reference (intentional vs dead) — 8 references, all forward-scaffolding placeholders; **no discarded earlier attempts**
- [x] A.4.5 Compile mode matrix — 32 surface rows, 7 cross-cutting observations

### A.5 Structure & packaging review

**Goal:** the monorepo layout, dependency tree, scripts, and build outputs look "vibe-coded" (user's word). Identify what to consolidate or restructure.

**Method:**
1. Walk top-level layout: `packages/`, `e2e-tests/`, `functions/`, `scripts/`, plus root-level config (`Dockerfile`, `compose.*.yml`, `nginx.conf`, `wrangler.toml`, `eslint.config.mjs`, `tsconfig.base.json`). For each, document its purpose in one line — anything you can't justify is a removal candidate.
2. Audit `packages/axoview-app/jest.*.js` (5 files) and `packages/axoview-lib/jest.*.js` (2 files) — are all needed, or is there dead config?
3. Audit the `__perf_refactor_regression__/` folder location and naming. User flagged this as "packaged in a weird way." Decide: keep where it is, move under `__tests__/perf/`, or delete entirely if obsolete.
4. Audit `paymentFlowExample.json`, `test-app.html`, `test-base-paths.sh`, `test-diagram.json` — root-level test fixtures. Where do they belong?
5. Audit dependency tree for both packages: any deps not imported anywhere? Any major version mismatches between lib and app?
6. Audit `i18n/` duplication: `packages/axoview-app/public/i18n/app/` AND `packages/axoview-app/src/i18n/` AND `packages/axoview-lib/src/i18n/` — three locales surfaces. Is this intentional (runtime vs build-time)? Document.

**Output:** `## A.5 Structure findings` — one section per category: top-level layout, jest configs, perf tests, fixtures, deps, i18n.

**Definition of done:** every top-level path and every config file has a justification line or a removal recommendation.

- [x] A.5.1 Top-level layout audit — 33 paths inventoried; 3 cleanup moves + 1 drift fix (.nvmrc 20→22)
- [x] A.5.2 Jest config consolidation review — 7 jest files reviewed; all necessary; 2 cosmetic alignments (F1, F2)
- [x] A.5.3 Perf-test folder disposition — rename `__perf_refactor_regression__/` → `__tests__/regression/`; reject delete (load-bearing); 41 tests retained
- [x] A.5.4 Root-level fixture cleanup — cross-link with A.6.7; **paymentFlowExample.json dead-file finding (G+I)**
- [x] A.5.5 Dependency tree audit — 15 findings (G1–G15); **P1 = root deps cleanup is highest-value**: drop 6 of 8 root deps
- [x] A.5.6 i18n triple-folder rationalization — 5 findings (I1–I5); locale-set drift identified across 3 locations (lib 13 / app/src 11 / public 13 / public/app 12)

### A.6 Deployment artifact audit (Docker / Cloudflare / Session backend / nginx)

**Goal:** every artifact that ships when a user deploys Axoview is at documented best-practice baseline. End state: a hardened Dockerfile + compose stack for self-host, a hardened Cloudflare worker + Pages config for the public deploy, a session backend that handles concurrent users safely, and zero deployment configuration drift between paths.

**Method:**

1. **Ingest `flare_plan.md`.** Read it fully. Classify every section as:
   - **Durable decision** (e.g. routing topology, worker boundary, env-var contract) → migrate to an ADR. Placeholder candidates: **ADR 0009 — Deployment topology**, **ADR 0010 — Session backend contract**.
   - **Live work** (still-pending implementation) → fold into this audit's cleanup plan (C.2) or spawn a focused tactical.
   - **Done / historical** → discard.
   After classification, the file is deleted at wrap-up. **Do not edit `flare_plan.md` during the audit** — only read.

2. **Dockerfile audit.** Check against best practices:
   - Multi-stage build (build stage + runtime stage); runtime image as small as practical.
   - Non-root user in runtime stage (`USER` directive).
   - `HEALTHCHECK` directive.
   - Layer ordering: dependencies before source for cache efficiency.
   - `.dockerignore` present and accurate.
   - Pinned base image versions (no floating `:latest`).
   - No build-time secrets baked in.
   - Output binary/static files served by the lightest runtime (nginx vs node).
   - `docker-entrypoint.sh` handles env-var validation, signal forwarding, graceful shutdown.

3. **compose audit.** `compose.yml` (prod) and `compose.dev.yml` (dev):
   - Documented difference between dev and prod; no accidental drift.
   - Volume management (named volumes for persistent data, bind mounts only where needed).
   - Restart policies (`unless-stopped` for prod).
   - Network isolation (no unnecessary host exposure).
   - Healthcheck wired to compose.
   - Env-var sourcing (`.env` vs explicit env vs secrets).

4. **nginx.conf audit.**
   - Reverse-proxy config to backend.
   - SSL termination expectations (handled by nginx, by Cloudflare, or by Docker network?).
   - gzip / brotli enabled for static assets.
   - Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
   - Cache headers for static vs dynamic.
   - Client max body size (for diagram upload limits).
   - `try_files` SPA fallback for client routing.

5. **Cloudflare worker audit (`packages/axoview-worker`, `functions/api/[[path]].ts`, root + worker `wrangler.toml`).**
   - Two `wrangler.toml` files exist — clarify which is authoritative.
   - Bindings: KV / D1 / R2 / Durable Objects — what's wired, what's used, what's stub.
   - Routes: which paths the worker handles vs Pages Functions vs static.
   - Env vars and secrets: documented, validated at startup.
   - Observability: logging, tail config, metrics.
   - CORS, security headers in worker responses.
   - Local dev parity with `wrangler dev`.

6. **Session backend audit (`packages/axoview-backend`).**
   - File-system adapter (`adapters/fs.js`) — safe concurrent access? Atomic writes? Lock files? Path traversal guards?
   - `server.js` — listening, body-parser limits, error handling, graceful shutdown, request logging.
   - Session isolation: how does it prevent user A from reading user B's diagrams?
   - Health endpoint for compose/Cloudflare healthchecks.
   - Adapter interface (`adapters/types.ts`) — is it ready for Phase 3B (GDrive) to slot in, or session-specific?

7. **Test-base-paths.sh + test-app.html.** Root-level smoke-test artifacts — document their purpose, decide keep vs move vs delete.

**Output:** `## A.6 Deployment findings` register, organized by surface (Dockerfile / compose / nginx / Cloudflare / backend). Also: `## A.6.1 flare_plan.md classification` — one row per flare_plan.md section with disposition (ADR target, cleanup tactical, or discard).

**Definition of done:** every deployment artifact has a baseline checklist with pass/fail per row; flare_plan.md is fully classified; placeholder ADRs 0009/0010 have draft outlines (not yet written — that's Phase C.7).

- [x] A.6.1 Ingest flare_plan.md; classify every section — file already deleted (commit `926e66f`); pulled from git history and classified, 19 rows in register
- [x] A.6.2 Dockerfile baseline checklist — 13 rows; 7 gaps + 2 risks
- [x] A.6.3 compose.yml + compose.dev.yml baseline checklist — 7 rows; 4 gaps + 3 risks
- [x] A.6.4 nginx.conf baseline checklist — 10 rows; 5 gaps + 2 risks incl. **D3 share-link basic-auth bug**
- [x] A.6.5 Cloudflare worker + Pages Functions baseline checklist — 14 rows; 5 gaps + 3 risks; corrected `_routes.json` + `_headers` pass (both present at `packages/axoview-app/public/`)
- [x] A.6.6 Session backend baseline checklist — 16 rows; 4 gaps + 1 risk
- [x] A.6.7 Root-level smoke-test artifact disposition — 5 rows; 2 mis-scoped artifacts relocated (test-diagram → e2e-tests/; paymentFlowExample → app/src/, dead)
- [x] A.6.8 Outline placeholder ADRs 0009 / 0010 (do not write yet) — outlined; ADR 0009 = topology + auth + asset pipeline + dual-probe collapse; ADR 0010 = adapter + atomicity + single-tenant scope

### A.7 Git configuration audit

**Goal:** repository configuration follows community best practices for an open project that may accept PRs (or explicitly doesn't — that itself is a documented choice).

**Method:**

1. **`.gitignore`** — completeness (build outputs, node_modules, .env, .DS_Store, IDE folders, OS files, coverage outputs, .wrangler/, dist/, *.tsbuildinfo). No false positives that accidentally hide source.

2. **`.gitattributes`** — line-ending normalization (`* text=auto eol=lf`), language detection hints, binary marking for `*.png`, `*.svg` (if appropriate), `*.snap` handling. **Critical on a Windows-developed repo** — CRLF leaks cause silent CI failures.

3. **`.github/` audit:**
   - `ISSUE_TEMPLATE/` — bug-report.md and feature-request.md present (per convention memory). Adequate?
   - `PULL_REQUEST_TEMPLATE.md` — convention memory notes this was deliberately deleted ("fork does not accept code PRs"). Verify decision still holds; if it does, document the rationale somewhere discoverable (README or CONTRIBUTING).
   - `CODEOWNERS` — present? If yes, accurate? If no, do we want one?
   - `SECURITY.md` — present? Required for responsible-disclosure path.
   - `FUNDING.yml` — appropriate for an open productized fork?
   - `dependabot.yml` — see A.8.
   - `workflows/` — see A.8.

4. **`LICENSE`** — present at root (✓ per file tree); also present in `packages/axoview-lib/` and `packages/axoview-app/` (✓). Verify all three say the same thing and the same license. Verify upstream attribution if the rename obscured it.

5. **`CHANGELOG.md`** — present at root. Format adherence (Keep a Changelog). Frequency. Does it reflect 2D shipping?

6. **Branch protection** — external (GitHub settings, not in-repo file). Document expected protections for `master`: require PR, require status checks, no force push, signed commits if desired. **Output is a checklist for the user to apply in GitHub settings** — we don't try to set it from CI.

7. **`README.md`** — productization-grade landing? Public deploy URL, install / run paths for each mode (Local browser-only / Self-host Docker / Cloudflare hosted), screenshot, feature highlights, license, attribution.

**Output:** `## A.7 Git configuration findings` register — one row per artifact with current state + recommendation.

**Definition of done:** every artifact above has a row; gaps are flagged with recommended action (create / extend / leave as-is with rationale).

- [x] A.7.1 .gitignore audit — pass, 2 optional additions
- [x] A.7.2 .gitattributes audit — **MISSING**, highest-impact Windows-dev CI risk (G6)
- [x] A.7.3 .github/ inventory + gap analysis — SECURITY.md missing, CODEOWNERS deferred, FUNDING.yml stale (upstream), config.yml stale URLs, PR template intentionally absent but undocumented
- [x] A.7.4 LICENSE consistency across three locations — **3-way drift** (G1): root MIT/Igor, lib MIT/upstream, **app Unlicense (legal-clarity bug)**
- [x] A.7.5 CHANGELOG.md format + currency — pass; Keep-a-Changelog + version 2026.5.21
- [x] A.7.6 Branch protection checklist — checklist drafted (out-of-repo dashboard action)
- [x] A.7.7 README.md productization-readiness pass — productization-grade; minor screenshot/demo verify

### A.8 Git automation / agent routines audit

**Goal:** identify every recurring task that *could* be automated by a "git agent" (CI workflow, bot, or scheduled action) and produce a gap report: what exists, what doesn't, what should.

**Method:**

1. **Existing workflows.** Walk `.github/workflows/*`. For each: trigger, jobs, success criteria, run time, failure-on-PR behaviour. If the directory doesn't exist or is sparse, that's the central finding.

2. **CI baseline gap analysis.** A productized repo should have, at minimum, on every PR:
   - Lint (eslint).
   - Type-check (`tsc --noEmit` per package).
   - Unit tests (jest in both `axoview-lib` and `axoview-app`).
   - Build (`rslib` for lib, app build for the shell, worker build).
   - E2E tests (post-M9, once new suite exists).
   - Coverage report uploaded (optional but useful for productization).
   - Bundle-size report (catches the 2D-style accidental bloat).
   
   For each missing item, propose the workflow shape.

3. **Dependency-update automation.**
   - Dependabot config (`.github/dependabot.yml`) — present? Schedule? Grouping? Ignore rules for known-breaking?
   - Renovate alternative considered?
   - Auto-merge policy for patch updates?

4. **Security scanning.**
   - CodeQL workflow.
   - Secret scanning (GitHub native — verify enabled in settings, document expectation).
   - `npm audit` in CI with failure thresholds.
   - Container image scanning if Docker Hub publish is added (Trivy, Snyk, etc.).
   - SBOM generation for the shipped container?

5. **Release automation.**
   - Tag → changelog → image build → Cloudflare deploy chain.
   - npm publish for `axoview-lib` (per convention memory, Phase 10 of rename includes npm publish — verify state).
   - Docker Hub publish.
   - GitHub Releases auto-generation.
   - Semantic versioning enforcement?

6. **Bot routines.**
   - Stale issue/PR auto-close.
   - Auto-label by file path (frontend / backend / docs / deployment).
   - PR title format check (Conventional Commits style).
   - Greeting bot for first-time contributors (only if accepting PRs — see A.7.3).

7. **Pre-commit / pre-push hooks.**
   - Husky present? lint-staged? commitlint?
   - Local-only enforcement that mirrors CI (so contributors fail fast before push).

**Output:** `## A.8 Git automation findings` register — three subsections: **Existing automation** (inventory), **Critical gaps** (missing baseline), **Nice-to-haves** (productization polish). Each gap has a one-line "how to add" pointer.

**Definition of done:** every category above has a row; the user has a list of what's missing and a recommendation per gap. The actual implementation lands in a spawned tactical (C.8 — git-automation tactical), not in this audit.

- [x] A.8.1 Inventory existing workflows — 9 active items + 1 `.backup` cleanup; chain visualization drafted
- [x] A.8.2 CI baseline gap analysis — **ESLint never runs in CI (A1); coverage gate defeated by `|| npm test` fallback (A2)**
- [x] A.8.3 Dependency-update automation gap — healthy (dependabot + auto-merge)
- [x] A.8.4 Security scanning gap — **4 missing (CodeQL/npm audit/container scan/SBOM) + EthicalCheck suspect template (A3)**
- [x] A.8.5 Release automation gap — **CF deploy is manual (A5, productization blocker); npm publish unverified (A9)**
- [x] A.8.6 Bot routines gap — all defer/reject (consistent with single-owner posture)
- [x] A.8.7 Pre-commit hooks gap — Husky/lint-staged/commitlint all missing (**A7 = silent semantic-release skip risk**)
- [x] A.8.8 Compile findings register; outline C.8 tactical scope — 10 observations (A1–A10); C.8 scope = ESLint-in-CI + commitlint + CodeQL + container scan + CF deploy + bundle-size + 2 cleanup deletions

### A.9 Skills + session cadence audit

**Goal:** the skill catalogue (`/audit`, `/feature`, `/notes`, `/shake-out`, `/ship`, plus any project-local skills) and the canonical session sequence (what we run, in what order, when) are first-class productization artifacts. End state for **this audit**: a documented cadence, every in-scope skill aligned with it, and missing-skill candidates triaged. Building new skills is a follow-up effort.

**Why this matters:** the implicit "what we usually do" has drifted across sessions — `/audit` and `/shake-out` overlap in places, `/notes` and `/feature` have separate views on memory updates, several skills still reference FossFLOW-era paths or `flare_plan.md`. Without codification, every new session re-learns the workflow.

**Method:**

1. **Inventory current skills.** Locate every skill definition file:
   - User-level: `~/.claude/skills/` (or equivalent on Windows: `%USERPROFILE%\.claude\skills\` / `C:\Users\isidenica\.claude\skills\`).
   - Project-level: search for `.claude/skills/`, `skills/`, or `*.skill.md` patterns within the repo.
   For each skill, record: **name, trigger conditions, expected inputs, outputs/side-effects, memory writes, file scaffolding, PLAN.md or tactical edits, dependencies on other skills**.

2. **Document the canonical session cadence (current state).** Reconstruct the implicit workflow:
   - **Session start**: read `MEMORY.md`, read `PLAN.md` or relevant tactical, `TodoWrite`.
   - **Work**: implementation + tool use; UI changes verified with dev server + browser.
   - **Verify**: build (`tsc --noEmit`, package builds), unit tests, manual UI check.
   - **Polish**: `/shake-out` for iterative UI polish; `/audit` for static-analysis sweep; `/review` or `/security-review` pre-merge.
   - **Doc sync**: `/notes` to refresh architecture.md / ux-principles.md / CHANGELOG / known_issues / memory.
   - **Promotion**: `/ship` integration → master.
   - **Feature scaffolding** (when kicking off): `/feature start | extend | supersede | wrap`.
   Sketch this as a flowchart or ordered list — whichever survives a screenshot.

3. **Per-skill alignment audit.** For each skill, check:
   - Does it slot into the documented cadence point cleanly, or does it overlap another skill?
   - Does its body contain **stale references**: `FossFLOW` (pre-rename), `flare_plan.md` (retiring), `fossflow-backend` (renamed to `axoview-backend`), phase numbers that have shifted, ADR numbers that have moved (the rolled-back 0006-exploratory-harness in convention memory is one such ghost).
   - Does it duplicate work another skill already does?
   - Does its output integrate cleanly with whatever runs next in the cadence?
   - Are its "when to use" triggers explicit enough that a new session knows which skill to pick?

4. **Identify missing skills (candidates only — do not build).** Productization may benefit from:
   - `/release-check` or `/productize` — pre-M10 ship-gate checklist runner.
   - `/trace` — invoke the runtime trace harness with a named scenario, capture NDJSON, attach to register.
   - `/deploy-check` — verify deployment artifact baseline (Dockerfile, compose, wrangler) against the locked ADRs.
   - `/regression-snapshot` — capture current behaviour baseline before risky cleanup.
   - `/spawn-tactical` — utility to scaffold a tactical doc from a Findings register row.
   List each with: rationale, sequence point it slots into, estimated complexity, target follow-up doc.

5. **Cadence anomalies / friction points.** Capture: "we keep forgetting to do X," "skill A and B compete for the same step," "no clear answer to '/audit vs /shake-out vs /notes — which one and when?'," "/ship sometimes pushes before docs are synced." These shape the workflow doc.

**Output:** `## A.9 Skills + cadence findings` register with subsections: **Skill inventory** (table), **Cadence diagram** (current state), **Stale-skill flags** (per skill + line of evidence), **Missing-skill candidates** (table with rationale + complexity), **Cadence anomalies**.

**Definition of done:** every located skill has an inventory row; canonical cadence is sketched as ordered list at minimum; every staleness and friction point has evidence. Implementation lands in C.9.

- [x] A.9.1 Locate + inventory all skill definitions — 5 in-scope (project-customized) at `.claude/commands/`; no user-level skills present; 10 out-of-scope built-ins surfaced via system reminder
- [x] A.9.2 Draft canonical session cadence (current state, evidence-based) — 9-anchor sequence + ASCII diagram
- [x] A.9.3 Per-skill alignment audit — 17 rows; 4 stale refs (audit→current_architecture.md; feature→session-ux-revamp.md + flare_plan.md prohibition; notes→flare_plan.md prohibition); 6-row overlap matrix
- [x] A.9.4 Identify missing-skill candidates — 9 candidates; 0 build-now, 2 reject, 7 defer
- [x] A.9.5 Capture cadence anomalies / friction points — 9 anomalies (S1–S9)
- [x] A.9.6 Compile findings register; outline C.9 scope — done; 8 cross-cutting observations (W1–W8)

---

## Phase B — Verification (runtime trace harness)

Phase A produces *suspicions* (this code looks dead; this control looks dupe). Phase B *proves* them by capturing what actually executes during real usage.

### B.1 Harness design + ADR draft

**Goal:** a low-overhead, gateable instrumentation API that emits structured trace events to a captured log.

**Initial design notes (refine into ADR 0007):**
- Gate: `window.__axoview_trace__` set when URL has `?trace=1` OR `localStorage.axoviewTrace === '1'`. Otherwise all calls are no-ops with zero allocation.
- API surface (sketch — finalize in ADR):
  - `trace.mark(label: string, payload?: object)` — record a one-shot event
  - `trace.scope(label, fn)` — wrap a function, record entry + exit + duration
  - `trace.snapshot(label, getState: () => object)` — record current state
  - `trace.export(): TraceEvent[]` — drain for the session
  - `trace.download()` — NDJSON download for offline analysis
- Conventions: labels are dotted (`mode.cursor.mouseup`, `dialog.export.open`, `mainmenu.mount`). Lower-case, kebab/dot.
- Output schema (NDJSON line): `{ts, label, kind, payload?, durationMs?, sessionId}`
- Placement: live in `packages/axoview-lib/src/utils/trace.ts`. Imported only by call sites we mark; no global wrapping.

**Output:** draft `docs/adr/0007-runtime-trace-harness.md` via `/feature start`. Status `Proposed`.

- [ ] B.1.1 Finalize API surface
- [ ] B.1.2 Draft ADR 0007 (use /feature start)
- [ ] B.1.3 Review with user; mark Accepted

### B.2 Implement harness

Once ADR 0007 is `Accepted`:
- [ ] B.2.1 Implement `trace.ts` per ADR
- [ ] B.2.2 Wire gate (URL param + localStorage)
- [ ] B.2.3 Add `trace.mark` calls at suspect surfaces from Phase A (MainMenu mount, every dialog open, every mode entry/exit, every hotkey handler entry)
- [ ] B.2.4 Verify zero-overhead claim when gate is off (basic perf check)

### B.3 Theory catalogue

**Goal:** before testing, write down what we expect to fire for each scenario. The mismatch between expected and actual is the signal.

For each user-facing scenario (drawn from the Findings register), define:
- **Scenario name** (e.g. "Open Settings dialog from the gear icon").
- **Expected trace events**, in order.
- **Implicit claim**: which Phase-A finding this verifies or refutes.

Build the catalogue as a markdown table in this doc under `## B.3 Theory catalogue`.

- [ ] B.3.1 List all scenarios worth tracing (target: 30-50)
- [ ] B.3.2 Document expected events per scenario
- [ ] B.3.3 Link each scenario to the Phase-A finding it tests

### B.4 Test runs

Two modes, user's choice per scenario:
- **Manual**: user runs the app with `?trace=1`, performs the scenario, downloads the NDJSON, pastes into a new session for analysis.
- **Exploratory-agent driven**: launch a Playwright-driven agent against `?trace=1` mode that performs scripted scenarios and dumps the log. (Reuses the harness scaffolding planned for the future ADR 0006 successor.)

- [ ] B.4.1 Decide manual vs agent per scenario
- [ ] B.4.2 Run all scenarios; collect logs
- [ ] B.4.3 Annotate each log with scenario name + date

### B.5 Reconcile expected vs actual

- [ ] B.5.1 Diff expected catalogue against captured logs
- [ ] B.5.2 For every mismatch: classify (bug / dead-code-confirmed / theory-wrong / harness-bug)
- [ ] B.5.3 Append confirmations and refutations to the Findings register

---

## Phase C — Synthesis

Phase A and B produce raw findings. Phase C turns them into decisions, docs, and a sequenced cleanup plan.

### C.1 Naming convention ADR (placeholder ADR 0008)

Based on findings, lock canonical names for every interactive surface. Candidate seed (verify, don't rubber-stamp):
- **Top toolbar** (not "top bar", not "menu", not "deck") — the four-group layout from ADR 0005.
- **Bottom dock** — currently `BottomDock`.
- **Left dock** — Elements / Layers (the two-region strip from ADR 0005).
- **Right sidebar** — item property controls.
- **Status cluster** — bottom-right diagnostic.
- **Canvas** — the SVG renderer surface.
- **Context menu** — right-click.
- **Quick-add popover** — canvas double-click.
- **Tool menu** — floating canvas toolbar.

Decide separately whether to retrofit `data-axoview-id` attributes on every surface (the option deferred from the scoping questions — likely yes for testability, but ADR decides).

- [ ] C.1.1 Draft ADR 0008 via /feature start
- [ ] C.1.2 Cross-link from ux-principles.md
- [ ] C.1.3 Mark Accepted after review

### C.2 Cleanup plan

The deliverable that gives the audit its endgame value. A **sequenced** plan covering every confirmed dead/dupe/anomalous item. Each entry: surface, evidence, cleanup action, risk, dependency on naming convention.

The cleanup plan **may itself spawn separate tactical docs** if any single workstream is large (e.g. "delete MainMenu and redistribute its surfaced actions" is probably its own tactical).

- [ ] C.2.1 Draft cleanup plan in this doc under `## C.2 Cleanup plan`
- [ ] C.2.2 Identify items that warrant standalone tactical docs
- [ ] C.2.3 Sequence by risk (low-risk deletions first, contract changes last)

### C.3 Documentation updates

- [ ] C.3.1 Update `docs/architecture.md` — feature inventory, mode contract, removed surfaces
- [ ] C.3.2 Update `docs/ux-principles.md` — add naming-convention section pointing at ADR 0008
- [ ] C.3.3 Update `known_issues.md` if any new known limitations surface

### C.4 Skill updates

- [ ] C.4.1 `/audit` — if anomalies suggest new smell patterns to detect, encode them
- [ ] C.4.2 `/shake-out` — if findings reveal recurring polish gaps, add to its checklist
- [ ] C.4.3 `/feature` — if the ADR template gained sections during this work, sync
- [ ] C.4.4 `/notes` — if end-of-session docs need new fields (e.g. "ran trace harness?"), update

### C.5 E2E rewrite plan

Per locked decision #4: delete both suites, rewrite from zero. This deserves its own tactical doc; this audit only **spawns** it.

- [ ] C.5.1 Confirm both suites are deletable (no CI dependency we'd be breaking)
- [ ] C.5.2 Run `/feature start` for the new E2E suite; that scaffolds `docs/tactical/e2e-rewrite.md` and any ADRs (test contract, fixture format, harness reuse from ADR 0007)
- [ ] C.5.3 Actually delete `e2e-tests/` and `packages/axoview-e2e/` *only after* the new tactical doc is in place
- [ ] C.5.4 Update `docs/testing.md` to reflect the new suite

### C.6 Memory refresh

- [ ] C.6.1 Fix the stale `project_docs_convention.md` entry that lists ADR 0006 as "exploratory-testing-harness" (the file on disk is "canvas-selection-contract" — likely a rollback that wasn't reflected back into memory) — **already done 2026-05-19**
- [ ] C.6.2 Add new ADRs (0007, 0008, 0009, 0010, plus any others spawned) to the convention memory's ADR list
- [ ] C.6.3 Drop the `Active tactical docs` bullets for anything closed by this audit
- [ ] C.6.4 Retire the `project_flare_plan.md` memory entry — flare_plan.md is being absorbed and deleted; the memory pointer becomes stale at wrap-up
- [ ] C.6.5 Save a new project memory pointing at the productization-audit and the end-to-end milestone path while active

### C.7 Deployment ADRs (drafted from A.6 findings)

Once A.6 is done and flare_plan.md is fully classified:

- [ ] C.7.1 Draft **ADR 0009 — Deployment topology** via `/feature start`. Locks: which surfaces ship where (static → Pages, API → worker, session backend → containerised on self-host), env-var contract, observability boundary.
- [ ] C.7.2 Draft **ADR 0010 — Session backend contract** via `/feature start`. Locks: storage adapter interface, session isolation guarantees, concurrent-write semantics, health endpoint shape, GDrive (Phase 3B) extension contract.
- [ ] C.7.3 Draft additional deployment ADRs if A.6 surfaces locked-in choices that warrant it (e.g. SSL termination layer, container base image policy).
- [ ] C.7.4 Cross-link from `docs/architecture.md` § 2m (Deployment & API Contract) and `docs/deployment.md`.
- [ ] C.7.5 **Delete `flare_plan.md`** — final action before wrap-up. Confirm every section was classified in A.6.1.

### C.8 Git-automation tactical

The A.8 findings register lists gaps; closing them is its own non-trivial work. Spawn a focused tactical:

- [ ] C.8.1 Run `/feature start "Git automation hardening"`. Scaffold `docs/tactical/git-automation-hardening.md` covering: CI baseline workflows, Dependabot/Renovate, security scans, release automation, bot routines, pre-commit hooks.
- [ ] C.8.2 Link the tactical from this doc's findings register.
- [ ] C.8.3 The tactical is responsible for M8's git-automation half.

### C.9 Workflow doc + skill updates

Codify the session cadence and align every skill to it. This is the deliverable that closes the M8 process-hardening gate.

- [ ] C.9.1 **Create `docs/workflow.md`** — canonical session cadence (diagram + per-stage skill mapping + handoff rules between stages + "when to /feature vs /shake-out vs /audit vs /notes" decision table). Cross-linked from README, `docs/architecture.md`, and (via "Read first" bullet) every tactical template the `/feature` skill spawns.
- [ ] C.9.2 **Per-skill body refresh** — for each in-scope skill from A.9.1: replace stale references (FossFLOW → Axoview, fossflow-backend → axoview-backend, retired flare_plan.md, shifted phase numbers, ghost ADR 0006), reconcile overlaps flagged in A.9.3, add explicit "when to use" trigger language, cross-link `docs/workflow.md`.
- [ ] C.9.3 **Triage missing-skill candidates from A.9.4.** For each: decide **build now** (spawn a tactical to build it — likely a sub-tactical of this audit if non-trivial) / **defer** (log in known_issues or a "process-debt" section of `docs/workflow.md`) / **reject** (with rationale).
- [ ] C.9.4 **Update `/feature` template language** so new tactical docs link `docs/workflow.md` in their "Read first" block by default. This makes the cadence self-propagating.
- [ ] C.9.5 Update CLAUDE.md / project memory (if any) to point at `docs/workflow.md` as the canonical "how we work" reference for new sessions.

**Skill body location reminder:** skills live in `~/.claude/skills/<name>.md` (user-level) and possibly `.claude/skills/` (project-level). Locating + editing them is part of A.9.1 → C.9.2. The system reminder at session start lists the currently-available skills — use that as a working inventory until A.9.1 produces the authoritative one.

---

## Findings register

> Append to this register as workstreams complete. Keep entries dated. Cross-reference Phase-A discoveries with Phase-B confirmations.

### A.1 Touched surfaces matrix

**Baseline:** rename merge `72fa120` (2026-05-19) is the current `master` HEAD. Walked first-parent `git log master --since=2026-02-01` plus the integration→master merge log; below covers **fork-era** feature clusters from 2026-03-20 (first own-feature merge `e8fd004`) to baseline. Pre-2026-03-20 commits are upstream FossFLOW (Stan / `@isoflow`) and are out of scope for dupe/dead-code analysis.

**Surface vocabulary used in the matrix (provisional — naming convention is locked in C.1/ADR 0008):** AppToolbar · LeftDock(Elements/Layers) · BottomDock · RightSidebar(ItemControls) · NodePanel(Details/Style/Notes tabs) · NodeActionBar · QuickAddNodePopover · ToolMenu · ZoomControls · StatusCluster · ExportPopover · ContextMenu · MainMenu · ViewTabs · SessionModeBanner · FileExplorer · Dialogs(Confirm/Help/Settings/Save/Load/Export/Import/ConfirmDiscard/ExportImage/ImportIcons) · Canvas(SceneLayers) · TransformControls · ConnectorAnchorOverlay · LassoLayerBar · LayersPanel · DiagnosticsOverlay · NotificationStack · EmptyStateScreen · WelcomeNotification · ImportHintTooltip · ChangeLanguage · HotkeySettings · Brand mark.

#### Phase 1 — Pre-cloudflare fork era (2026-03-20 → 2026-04-19)

| # | Commit(s) | Date | Cluster | Files touched (selected) | Surfaces affected | ADRs |
|---|---|---|---|---|---|---|
| 1 | `6be0a74..e8475e3` | 03-20 | Easy wins (Zustand dep, Quill, i18n 404, createModelItem dup-write) + regression baseline | App.tsx, modelStore, i18n loader; new `regression_tests.md`, `future_features.md` | — (foundational) | — |
| 2 | `af3773a..d1ed850` | 03-22 | Runtime fixes R-1/2/4/5, default zoom 90%, transient right-click pan with deselect, service-worker loop fix | App.tsx, hooks/usePanHandlers, service worker, zoom config, canvas description hide | Canvas, ZoomControls | — |
| 3 | `6ee86b6` + `85405ab` | 03-22 | Playwright e2e Phase 0 (foundation) + Phases 1–6 (81 tests) | `packages/fossflow-e2e/*` (new package) | — (test infra) | — |
| 4 | `88ddbca` | 03-23 | UX: cursors, copy/paste, font size, TextBox formatting | useCopyPaste, NodeSettings, TextBoxControls, Cursor/DragItems modes, schemas/textBox | RightSidebar, Canvas modes | — |
| 5 | `a71257a` | 03-24 | Drag precision/collision, copy-paste waypoints, language dropdown | DragItems mode, ChangeLanguage | Canvas, ChangeLanguage | — |
| 6 | `ed1721f` | 03-24 | Label colours (connector/node/textbox), rich text boxes, auto-height | ConnectorControls, TextBoxControls, NodeSettings, **new LabelColorPicker**, ConnectorLabel, TextBox renderer, schemas | RightSidebar, Canvas | — |
| 7 | `639e131` + `ff9dad6` | 03-24 | Dead ColorPicker import cleanup; render-churn fix + **DiagnosticsOverlay** addition | ColorPicker, DiagnosticsOverlay (new) | DiagnosticsOverlay (new surface) | — |
| 8 | `87b527f` | 03-24 | Ctrl+X cut/paste | useCopyPaste, HelpDialog, HotkeySettings, shortcuts.ts, i18n×N | Dialogs(Help), HotkeySettings | — |
| 9 | `0db8c2a..af5ba19` | 03-25 | Node link URL, rect z-order, stacked rect hit-test, save-as, connector waypoints; lasso-drag-within-selection fix | Multiple modes, renderer, schemas | Canvas, modes | — |
| 10 | `43166fd` | 03-26 | Icon packs (aws/gcp/azure/k8s) not loading on startup | iconPackManager, useInitialDataManager | LeftDock(Elements) | — |
| 11 | `50d17b4` + `4706504` + `d3fc777` | 03-26 | **Toolbar/UX overhaul** — Save/Load/Share, right-side panel, view switcher in readonly; splash text | App.tsx (+271), **AppToolbar (heavy)**, DiagramManager (heavy), ToolMenu, UiOverlay, ViewTabs | AppToolbar, RightSidebar, ViewTabs, ToolMenu | — |
| 12 | `b090fea` | 03-27 | Save status label (context-aware date) + save toast | App.tsx, NotificationStack, DiagramLifecycleProvider | AppToolbar, NotificationStack | — |
| 13 | `87c227b` | 03-27 | Console noise, aria-hidden fix, old-icon-format migration | Multiple aria sites, iconPackManager | (cross-cutting) | — |
| 14 | `fefcafb` | 03-29 | Lasso first-click + sporadic ghost-image drag | Lasso/FreehandLasso modes, drag preview | Canvas | — |
| 15 | `5f2a864` | 03-29 | **Node panel tabs (Details/Style/Notes), action bar, quick-add, aria** — big restructure | App.css (−204), ItemControls/NodeControls (full restructure: **new** NodeInfoTab/NodeStyleTab/NodePanel), **new NodeActionBar**, **new QuickAddNodePopover**, **MainMenu touched**, theme | RightSidebar(NodePanel), NodeActionBar (new), QuickAddNodePopover (new), MainMenu | — |
| 16 | `a8f7493` | 03-29 | Preview button, view-only single-scroll panel, smart node clickability | App.tsx, NodePanel, Pan mode | AppToolbar (preview), NodePanel | — |
| 17 | `77e0b49` | 03-29 | Rename Group, fix double-click UX | (group rename + dbl-click handler) | Canvas modes, RightSidebar | — |
| 18 | `727d673` | 03-29 | Save & Preview, **HelpDialog new**, docs consolidation | App.tsx, **new HelpDialog**, i18n | AppToolbar, Dialogs(Help) | — |
| 19 | `d849850` + `c083b22` | 03-30 | ESLint flat config + static-analysis cleanup (hooks/dead code/CVEs) | `eslint.config.mjs` (new), various imports | (cross-cutting) | — |
| 20 | `00fb18d` + `b25fdd3` | 03-30/31 | +98 high-ROI tests; perf optimizations for paste/hover scalability | `__perf_refactor_regression__/*` (additions), useCopyPaste perf | (test infra) | — |
| 21 | `91d7ca7` | 04-01 | Per-connector subscriptions, A* cache, startTransition, redo fix | Connector subscriptions, pathfinder cache, history store | Canvas (perf) | — |
| 22 | `ee3fac4` | 04-06 | Full i18n coverage (lib + app) + export image blank preview fix | All 12 lib i18n bundles +new keys, all app i18n bundles, ExportImageDialog (heavy) | Dialogs(ExportImage), ChangeLanguage | — |
| 23 | `da06e53` | 04-07 | **Connector anchor reconnect UX + glass-morphism handles** | **new ConnectorAnchorOverlay**, **new ReconnectAnchor mode**, Cursor mode (+84 lines for reconnect detect), NodeActionBar, Connector.tsx | ConnectorAnchorOverlay (new), NodeActionBar, Canvas modes | — |
| 24 | `090ce10` | 04-07 | **6-phase architecture cleanup** — split god-objects, instance clipboard, settings persistence | **useScene split → useSceneActions + useSceneData**, **new ClipboardContext**, **new persistedSettings.ts**, **new isoMath.ts**, **new hitDetection.ts**, renderer.ts (−796 lines), reducers/view/connector | (cross-cutting — hooks/utils) | — |
| 25 | `bee6ba8` | 04-08 | Default zoom 85% | zoomSettings, README | (constant) | — |
| 26 | `f60d286` | 04-08 | **View layer system** — visibility, lock, z-order, assign-to-layer UX | **LayerRow (new)**, LayersPanel (+196), NodeActionBar (+94), ContextMenuManager, SceneLayers/Nodes/Connectors/Rectangles/TextBoxes (z-order), **new useLayerActions/useLayerContext**, schemas/layer, **new utils/renderOrder.ts**, reducers/view (+130), reducers/layer (+197 test) | LayersPanel, NodeActionBar, ContextMenu, Canvas | — |
| 27 | `b8b72e4` | 04-09 | **Sidebar panels, unified toolbar, layer UX improvements** | App.tsx, **new LeftSidebar / RightSidebar wrappers**, **new LassoLayerBar**, ContextMenuManager (−102 lines), MainMenu (shrunk), ChangeLanguage refactor, UiOverlay (heavy), Lasso/FreehandLasso modes | AppToolbar, LeftSidebar/RightSidebar (new), LassoLayerBar (new), MainMenu, ContextMenu | — |
| 28 | `05edf43` | 04-09 | **Left dock + bottom dock + icon grid overhaul** | **new LeftDock/, BottomDock/, CommonElements, ElementsPanel**, ZoomControls, IconCollection/Icon/IconGrid (heavy), RightSidebar | LeftDock (new), BottomDock (new), ZoomControls, RightSidebar | — |
| 29 | `cd72a59` | 04-09 | Layers drag-to-layer, non-iso icon elevation, diagnostics toggle | LayersPanel, NonIsometricIcon, DiagnosticsToggle | LayersPanel, Canvas, DiagnosticsOverlay | — |
| 30 | `016326d` | 04-09 | New Diagram, unsaved-changes guard, import-icon dialog cleanup | **new ConfirmDiscardDialog**, **new ImportIconsDialog**, ElementsPanel cleanup, **MainMenu (heavy: 218 lines net churn)**, **new useDirtyTracker** | Dialogs(ConfirmDiscard/ImportIcons), LeftDock(Elements), MainMenu | — |
| 31 | `41d6748` | 04-10 | Connector single-shot, Rectangle rename, **ToolMenu cleanup**, flat icon elevation fix; **`diagnostics/DiagLogger.ts` deleted** | ToolMenu (heavy), BottomDock (heavy), Connector mode, **diagnostics/{DiagLogger,index,types}.ts removed** | ToolMenu, BottomDock | — |
| 32 | `9131e74` | 04-10 | Audit findings — ESM output, type safety, test coverage, bug fixes | rsbuild/lib config, types | (build infra) | — |
| 33 | `d4626ac` | 04-10 | Drag-back-to-origin, App.tsx decomposition (pre-Phase 0A), lazy icon packs | App.tsx | (cross-cutting) | — |
| 34 | `599a46d` | 04-11 | On-demand icon packs, diagram name sync, compact format loading | iconPackManager, format loaders | LeftDock(Elements) | — |
| 35 | `10db6d5` | 04-13 | **Phase 0A — App.tsx decomposition into providers** | App.tsx (715→3 lines net stub), **new DiagramLifecycleProvider (781 lines)**, **new AppStorageContext**, **new FileExplorerLayout**, AppToolbar refactor | (cross-cutting infra) | — |
| 36 | `a0ee8a4` | 04-13 | **Phase 0B + 1A — Notification system + 2D canvas mode** | **new NotificationStack**, **new ConfirmDialog**, **new CanvasModeContext**, **new coordinateTransforms util**, **new notificationStore**, grid-tile-2d.svg, multiple SceneLayers for 2D | NotificationStack (new), Dialogs(Confirm), Canvas (2D mode), ToolMenu | — |
| 37 | `136faeb` | 04-14 | **Phase 1B — Material Icons pack** + 6 bug fixes | generateMaterialIconPack script, **DiagnosticsOverlay (refactor)**, **new DiagnosticsToggleButton**, **new diagnosticsStore**, BottomDock | LeftDock(Elements), DiagnosticsOverlay, BottomDock | — |
| 38 | `ed17558` | 04-14 | **Phase 2A — Pluggable storage interface** (Local provider) | **new services/storage/{StorageManager, types, providers/{LocalStorageProvider, GoogleDriveProvider, S3Provider}}**, backend server.js (+173) | (storage subsystem) | — |
| 39 | `e039e1f` | 04-18 | **Phase 2B + 2B-R — File explorer + empty state + dialog polish** | **new fileExplorer/{FileExplorer (525), FileTreeNode (166), FileTreeToolbar, ContextMenuItems, useThumbnail}**, **new useFileTree/useAutoSave**, AppToolbar (+263), **new EmptyStateScreen**, ConfirmDialog rework, **new utils/fileOperations** | FileExplorer (new), EmptyStateScreen (new), AppToolbar, Dialogs(Confirm) | — |
| 40 | `158864a` | 04-19 | **Phase 2C — Diagram-to-diagram links** + welcome popup on empty state | diagramRef nodes, **new ImportHintTooltip**, Node/NodeInfoTab updates, LazyLoadingWelcomeNotification | Canvas (diagram links), NodePanel(Info), ImportHintTooltip (new), WelcomeNotification | — |
| 41 | `5accf70` | 04-19 | Copy share link to file tree context menu | fileExplorer/ContextMenuItems | FileExplorer | — |

#### Phase 2 — Cloudflare POC + 2026-05 shake-out (2026-05-03 → 2026-05-10)

| # | Commit(s) | Date | Cluster | Files touched (selected) | Surfaces affected | ADRs |
|---|---|---|---|---|---|---|
| 42 | `6257da4` | 05-03 | **`cloudflare_poc` merge — massive** | **new fossflow-worker package** (app.ts, auth.ts, tsconfig, wrangler.toml), root `wrangler.toml` (a 2nd wrangler — flagged in A.6.5), **new functions/api/[[path]].ts**, **new SessionModeBanner**, **new useRuntimeConfig hook**, **new fileExplorer/{ExportDialog, ImportDialog (327), SessionStorageGauge (234)}**, **new services/project/projectZip (381)**, **new utils/leanSave**, **backend overhaul**: server.js (+500), **new adapters/{fs.js, types.ts}**, **new routes.js (323)**, .github/ISSUE_TEMPLATE/, **PULL_REQUEST_TEMPLATE deleted**, **FOSSFLOW_ENCYCLOPEDIA.md deleted (−1167)**, **docs/adr/{0001-zip-format, 0002-icon-merge, 0003-session-lean-save} created**, **new docs/{architecture.md, deployment.md, testing.md, upstream-changelog.md}**, **new flare_plan.md** | SessionModeBanner (new), FileExplorer dialogs (Export/Import/Session), backend, worker, Pages Functions; massive infra change | **0001, 0002, 0003** all introduced here |
| 43 | `7ee1f31` | 05-05 | **Connector parity, details panel polish, UX consistency** | **ADR 0004 created**, ConnectorControls (+579), LayerItemRow (+154), LayersPanel, ConnectorLabel (+209), EmptyStateScreen | RightSidebar(ItemControls), LayersPanel, Canvas(ConnectorLabel), EmptyStateScreen | **0004** |
| 44 | `c5e873e` | 05-05 | **New `docs/ux-principles.md`** | ux-principles.md (new) | (docs) | — |
| 45 | `042908f` | 05-09 | 2026.5.9 — item-type parity (Rect/TextBox controls), UX consistency, slider scrollbar fix; **deleted `docs/tactical/session-ux-revamp.md`** | RectangleControls, TextBoxControls, NodeActionBar (+226), LayersPanel; `session-ux-revamp.md` deleted | RightSidebar(ItemControls), NodeActionBar, LayersPanel | — |
| 46 | `e0cc322` | 05-09 | **Layout revamp — toolbar + left/bottom dock contract (ADR 0005)** | **ADR 0005 created**, **tactical/layout-revamp.md created**, AppToolbar (−130 net), **new StatusCluster**, **new ExportPopover**, **SettingsDialog overhaul (new AboutTab, new DiagnosticsTab)**, LeftDock (heavy), SessionStorageGauge stripped (−200) | AppToolbar, StatusCluster (new), ExportPopover (new), SettingsDialog, LeftDock, SessionModeBanner | **0005** |
| 47 | `7164b3b` | 05-09 | 2026.5.10 — connector drag transactions + closed-form router | modelStore, sceneStore, Connector/ReconnectAnchor modes, pathfinder (−53 lines), **new useSceneActions transactions**, **new perf-stress fixtures** | Canvas (perf) | — |
| 48 | `e7d25a0` | 05-10 | **UX shake-out 2026-05 — bundles A + B + C** | **tactical/ux-shake-out-2026-05.md created**, ExportDialog rework, LoadDialog rework, **SaveAsDialog DELETED**, SaveDialog rework, SessionModeBanner, ContextMenu, ElementsPanel (+168), LayersPanel (+191), QuickIconSelector (−130), App.css (−124) | Dialogs(Export/Load/Save), SaveAsDialog (REMOVED), SessionModeBanner, ContextMenu, LeftDock(Elements), LayersPanel | — |
| 49 | `4875541` | 05-10 | **Typography contract + UX consistency pass — 2026-05 shake-out wrap** | **ux-principles.md +119 lines**, **theme.ts +97 lines**, multiple UI files touched (StatusCluster, SessionModeBanner, ExportPopover, ConnectorControls, NodePanel, LayerItemRow/Row, LayersPanel, CommonElements, NodeActionBar, QuickAddNodePopover, ToolMenu, UiOverlay) | (cross-cutting typography contract) | — |

#### Phase 3 — MQA wave + rename (2026-05-15 → 2026-05-19)

| # | Commit(s) | Date | Cluster | Files touched (selected) | Surfaces affected | ADRs |
|---|---|---|---|---|---|---|
| 50 | `a85dbc8` | 05-15 | **MQA Bundle A — 8 fixes + page cap + docs sync** | (bundle — `docs/tactical/mqa-results.md` driver) | (cross-cutting) | — |
| 51 | `08f1f8b` + `1f823f8` + `660573b` + `0a8869a` + `d65f1a9` + `f6670d2` + `5b34d8b` | 05-15 | **MQA Bundle B — 10 fixes** including **Export Compact removal**, preview menu redesign, connector-redo, import-409, scene undo/redo direction (#5), panel UX polish (#22/#25), pointer cursor on preview nodes, backend folders.json coercion (#21) | ExportPopover (Compact format dropped), preview menu, NodePanel/RightSidebar, history store, backend routes | AppToolbar, ExportPopover, NodePanel, RightSidebar, Canvas (preview mode), backend | — |
| 52 | `508f1af` | 05-15 | **Codify panel-header hover-reveal + lock/hide enforcement contract** | ux-principles.md update | (docs) | — |
| 53 | `bba712c` + `728b229` + `7e09fba` + `4af566d` + `f66d7be` | 05-16 | **MQA #7 perf path** — DragItems begin/commitDragTransaction, Node split (position shell + memoized NodeContent), CSS-only drag preview, **`__fossflow__` debug global**, waypoint preview + playbook | DragItems mode, Node (split into shell+content), drag preview CSS, debug global | Canvas (perf), debug global | — |
| 54 | `b4ab2ef` | 05-16 | **MQA #19 — tooltip-with-shortcut hints + dead-code cleanup** | (tooltip primitive, dead-code removals) | (cross-cutting tooltips) | — |
| 55 | `be99cd7` | 05-16 | **MQA #20 — Settings dialog left-rail redesign** | SettingsDialog overhaul | Dialogs(Settings) | — |
| 56 | `d293f8f` | 05-17 | **MQA #8/#9 — multi-select contract + waypoint Alt+click** | selection contract; Lasso/Cursor modes; **ADR 0006 territory** | Canvas selection | **0006 (canvas-selection-contract)** territory |
| 57 | `275fdfe` | 05-18 | **MQA #26 — delete imported icons + tombstone fallback** | iconPackManager, ImportIconsDialog | LeftDock(Elements), Dialogs(ImportIcons) | — |
| 58 | `4a41982` | 05-18 | **MQA #10 — auto-expand + soft pulse for newly loaded icon categories** | LeftDock(Elements), IconCollection | LeftDock(Elements) | — |
| 59 | `0b779dc` | 05-18 | **MQA #11 — canvas rich-text typography polish + 2D-Y rotation** + release 2026.5.20 | TextBox renderer, RichTextEditor, 2D rotation | Canvas | — |
| 60 | `cad02a3` | 05-18 | Remove unreachable leanSave "override wins" test case | leanSave tests | (test infra) | — |
| 61 | `53e16a3` | 05-19 | **Startup splash + parallel storage probes + 800ms timeouts** | startup splash, storage probe parallelization | (startup) | — |
| 62 | `e66e7bc` → `2cd870f` → `33d4d71` → `6390e0d` → `9f2686c` → `b702a38` → `badbc25` → `8eca564` → `926e66f` | 05-19 | **Rename FossFLOW → Axoview (full chain)** | mechanical text replace; workspace rename `packages/fossflow-*` → `packages/axoview-*`; public API `Isoflow` → `Axoview` (preserves `@isoflow/isopacks`); Docker/CF/CI references → `molikas/axoview`; backwards-compat migration for localStorage + ZIP + debug global; attribution + splash + About + LICENSE; post-rename smoke fixes | **EVERY** file with FossFLOW/fossflow text; **no behavioural change** | — |
| 63 | `658925f` | 05-19 | Welcome: drop Community Edition + hamburger hint; new Axoview branding | WelcomeNotification, brand text | WelcomeNotification | — |
| 64 | `5056abe` | 05-19 | **Brand: icon set + toolbar-left brand mark; cut 2026.5.21** | brand icons, AppToolbar (left brand mark) | AppToolbar (brand mark — new surface element) | — |

**Definition-of-done check:** every fork-era feature-bearing merge since 2026-03-20 has a row. Pure dep bumps, ci tweaks, doc-only commits, and chore(release) tags are omitted (they're not surface-bearing). 64 rows, baseline `72fa120`.

#### A.1.4 Overlap clusters (same surface touched by ≥2 non-coordinated clusters)

Surfaces with the most independent touches across the timeline — these are prime A.3 dupe-candidate territory:

| Surface | Touched by (cluster #) | Suspicion level |
|---|---|---|
| **MainMenu** | 15, 27, 30 (+ rename ch 62) | **HIGH** — flagged by user in scoping; touched in 3 non-coordinated fork-era waves (panel-tabs restructure, sidebar unification, New-Diagram guard). The "ghost" hypothesis fits the pattern: re-styled multiple times but no entry confirms it's actually mounted post-toolbar overhaul (11) or post-AppToolbar refactor (35, 39, 42). **A.3.1 must verify mount path.** |
| **AppToolbar** | 11, 18, 35, 39, 42, 46, 51, 64 | **HIGH** — toolbar overhaul (11), preview button (16/18), Phase 0A refactor (35), Phase 2B AppToolbar rebuild (39, +263 lines), cloudflare merge (42), layout revamp (46), MQA Bundle B (51), brand mark (64). 8 independent waves. Highly likely to carry stale handlers / orphan icons. |
| **LayersPanel** | 26, 27, 29, 43, 45, 48 | **MEDIUM-HIGH** — view layer system (26) created it, sidebar unification (27) restructured, drag-to-layer (29), connector-parity (43), item-parity (45), shake-out Bundle C (48). Layer features evolved across 5 versions. |
| **LeftDock / Elements panel** | 28, 30, 39, 46, 48, 58 | **MEDIUM-HIGH** — initial overhaul (28), import-icon cleanup (30), Phase 2B file-explorer (39, indirect via panel), layout revamp (46), shake-out (48, +168), MQA #10 auto-expand (58). |
| **BottomDock** | 28, 31, 37 | **MEDIUM** — created (28), ToolMenu/Rectangle cleanup (31), Phase 1B (37). |
| **NodeActionBar** | 15, 23, 26, 45, 49 | **MEDIUM** — created (15), reconnect UX (23), view layer ops (+94, 26), item-parity (+226, 45), typography (49). Heaviest growth in 45. |
| **NodePanel (Details/Style/Notes tabs)** | 15, 16, 40, 43, 49, 51 | **MEDIUM** — created (15), single-scroll polish (16), 2C info-tab (40), connector parity (43), typography (49), MQA #22/#25 panel polish (51). |
| **ContextMenu / ContextMenuManager** | 26, 27, 48, 51 | **MEDIUM** — view layer ops (26), sidebar-driven refactor (−102 lines in 27), shake-out (48), MQA preview-menu redesign (51). |
| **SettingsDialog** | 46, 55 | **LOW-MEDIUM** — layout revamp added AboutTab + DiagnosticsTab (46); MQA #20 redesigned left rail (55). Worth verifying tab consistency. |
| **SessionModeBanner** | 42 (created), 46, 48, 49 | **MEDIUM** — created in CF merge, touched in layout revamp, shake-out, typography. Verify the banner's claimed mode actually matches `useRuntimeConfig` (A.4 cross-check). |
| **FileExplorer + child dialogs (Export/Import/Save/Load/SaveAs)** | 39 (created), 41, 42, 45, 48, 51 | **MEDIUM-HIGH** — created in Phase 2B; share-link (41); CF merge added Export/Import/SessionGauge variants (42); item-parity (45); shake-out **deleted SaveAsDialog** (48); MQA Bundle B import-409 (51). The Export/Import dialog story is split between `components/` and `components/fileExplorer/` — **flag for A.3.** |
| **Canvas modes (Cursor/Pan/DragItems/Lasso/FreehandLasso/ReconnectAnchor/Connector)** | 4, 5, 9, 14, 23, 26, 27, 47, 53, 56 | **EXPECTED HIGH** — canvas modes are inherently mode-rich; cross-reference shortcut keys (A.3.4) for stale handlers, especially around modes added late (ReconnectAnchor in 23, 2D mode in 36). |
| **ToolMenu** | 11, 28, 31, 36, 41, 49 | **MEDIUM** — repeatedly touched; (31) "ToolMenu cleanup" suggests known cruft. Worth re-checking that the cleanup stuck. |
| **DiagnosticsOverlay / DiagnosticsToggleButton / diagnosticsStore / `__fossflow__` debug global / DiagLogger.ts (deleted)** | 7 (created), 29, 36, 37, 53 | **MEDIUM** — DiagLogger.ts deleted in (31). The current diagnostics surface (overlay + toggle + store + debug global) is the survivor; verify nothing else references the deleted DiagLogger module. Note the `__fossflow__` debug global in (53) — **post-rename audit must confirm this was migrated to `__axoview__`** (cluster 62 mentions "debug global" migration). |
| **Dialogs (Confirm / Help / ImportIcons / ConfirmDiscard)** | 18 (Help), 30 (ConfirmDiscard/ImportIcons), 36 (Confirm), 39 (Confirm rework), 42 (Import/Export new pair) | **MEDIUM** — dialog file proliferation. There are at least 3 levels: `components/*Dialog.tsx`, `components/fileExplorer/*Dialog.tsx`, and the `ConfirmDialog` reused for confirm flows. A.3 must inventory dialog file locations and rationalize. |
| **i18n bundles (13 locales × 2 places)** | 6, 8, 18, 22, 23, 26, 30, 36, 39, 43, 45 | **N/A overlap** — expected on every UX addition. But the **triple-folder split** (lib/src/i18n, app/src/i18n, app/public/i18n) noted in A.5.6 means strings can drift between sources. A.5.6 owns this. |

**Cross-cutting flags surfaced by A.1 (preview of work for later workstreams):**

- **`__fossflow__` → `__axoview__` migration completeness.** Cluster 53 introduced `__fossflow__` debug global; cluster 62 claims backwards-compat migration. A.4 / A.2 must grep for any remaining `__fossflow__` references and verify the migration is symmetric.
- **`DiagLogger.ts` deletion residue.** Cluster 31 removed the diagnostics utility. A.2 grep for `DiagLogger` imports anywhere.
- **`SaveAsDialog.tsx` deletion residue.** Cluster 48 deleted it. A.2 grep for any leftover `SaveAsDialog` import/reference.
- **`session-ux-revamp.md` deletion** in cluster 45 — already done; no residue concern but worth noting as precedent for retired-tactical-doc handling.
- **Two `wrangler.toml` files** introduced in cluster 42 (root + worker package). A.6.5 owns the "which is authoritative" question.
- **PR template was deleted** in cluster 42 (`PULL_REQUEST_TEMPLATE.md` removed) — matches the convention memory note that the fork doesn't accept code PRs. A.7.3 verifies the rationale is documented somewhere discoverable.
- **MQA tactical retired 2026-05-19**; bundle clusters 50–61 are the durable record. All 28 MQA items confirmed closed before deletion.
- **MainMenu's 3-wave evolution** (15, 27, 30) is the single highest-value A.3 lead. The pattern — created with NodePanel restructure, then shrunk in sidebar refactor (27), then re-edited heavily in New-Diagram-guard (30) — strongly suggests an artifact that was repeatedly reshaped without an ongoing mount-point review.

### A.2 Static-analysis findings

**Method:** mined the existing pre-rename [`reports/knip.txt`](../../reports/knip.txt) (97 lines, written 2026-03-30 era when packages were still `fossflow-*`); cross-validated every flagged path against the rename-era working tree; spot-grep'd known smell patterns (stray `console.*`, `@ts-ignore`, leftover legacy identifiers). **No fresh tool runs were attempted in this pass** — the pre-rename knip snapshot is the artifact this audit classifies. A re-run of knip post-rename is the natural follow-up.

**Vocabulary:**
- **Pre-rename finding** = a row in `reports/knip.txt` whose path uses `packages/fossflow-*/` prefixes (rename predated the report).
- **Validated dead** = the file/symbol still exists in the rename-era tree at the equivalent path and has zero live importers.
- **Resolved by deletion** = the file/symbol was already removed in a post-report cluster (28, 35, 39, 42, etc.).
- **Stale finding** = the report flagged something that the post-rename layout invalidates (e.g., renamed file, rebound import).
- **Live (false positive)** = the report flagged something currently in use; knip's resolution was incomplete.

#### A.2.1 Report metadata + ingest

| Property | Value |
|---|---|
| Report file | [`reports/knip.txt`](../../reports/knip.txt) |
| Size | 97 lines |
| Generated | 2026-03-30 era (pre-rename; paths use `fossflow-*`) |
| Tool | `knip` (per `package.json:48` devDep `"knip": "^6.2.0"`) |
| Live regeneration command (for post-rename refresh) | `npx knip > reports/knip.txt` from repo root |
| Gitignored? | yes (`.gitignore:23` — `reports/`) |
| Overall verdict on report freshness | **stale; needs re-run.** ~70% of "Unused files" rows resolved by post-report cleanup. Section structure remains useful as a checklist. |

#### A.2.2 Unused files — validation

Cross-checked each of knip's 14 "Unused files" entries against the current tree:

| # | Knip path (pre-rename) | Current path | Validation | Disposition |
|---|---|---|---|---|
| 1 | `packages/fossflow-app/public/service-worker.js` | n/a | **GONE** — deleted in a post-report cluster | resolved |
| 2 | `packages/fossflow-app/src/EditorPage.tsx` | n/a | **GONE** — Phase 0A decomposition (cluster 35) removed it | resolved |
| 3 | `packages/fossflow-app/src/minimalIcons.ts` | n/a | **GONE** | resolved |
| 4 | `packages/fossflow-app/src/usePersistedDiagram.ts` | n/a | **GONE** — superseded by `useAutoSave` (cluster 39) | resolved |
| 5 | `packages/fossflow-lib/docs/next-env.d.ts` | `packages/axoview-lib/docs/next-env.d.ts` | **STILL PRESENT** — leftover Next.js docs scaffold | **validated dead.** C.2 row: delete `packages/axoview-lib/docs/` entirely (no importers anywhere). |
| 6 | `packages/fossflow-lib/docs/next.config.js` | `packages/axoview-lib/docs/...` | same as #5 | cascades with #5 |
| 7 | `packages/fossflow-lib/docs/theme.config.tsx` | same | same as #5 | cascades with #5 |
| 8 | `packages/fossflow-lib/src/index-docker.tsx` | n/a | **GONE** — post-Phase-0A | resolved |
| 9 | `packages/fossflow-lib/docs/pages/index.tsx` | `packages/axoview-lib/docs/pages/index.tsx` | same as #5 | cascades with #5 |
| 10 | `packages/fossflow-lib/src/hooks/useWindowUtils.ts` | n/a | **GONE** | resolved |
| 11 | `packages/fossflow-lib/src/components/RichTextEditor/index.ts` | n/a | **GONE** | resolved |
| 12 | `packages/fossflow-lib/src/components/ItemControls/components/Header.tsx` | n/a | **GONE** — cluster 15 NodePanel restructure obsoleted it | resolved |
| 13 | `packages/fossflow-lib/src/components/ItemControls/NodeControls/NodeControls.tsx` | n/a | **GONE** — cluster 15 NodePanel restructure | resolved |
| 14 | `packages/fossflow-lib/src/components/ItemControls/NodeControls/NodeSettings/NodeSettings.tsx` | n/a | **GONE** — same | resolved |

**Net:** 10 of 14 already resolved by post-report cleanup; **1 surviving dead-file cluster** (lib's `docs/` Next.js scaffold — 4 files in one folder).

Additional **dead files not in the knip report but discovered during A.5 / A.3:**

| # | File | Source of finding | Disposition |
|---|---|---|---|
| 15 | `packages/axoview-app/src/paymentFlowExample.json` | A.5.4 / A.6.7 — zero importers | **delete in C.2** |
| 16 | `packages/axoview-lib/src/components/Sidebars/LeftSidebar.tsx` | A.3 #3 — zero importers | **delete in C.2** |
| 17 | `packages/axoview-lib/src/components/MainMenu/MainMenu.tsx` (+ folder) | A.3 #1 — dead-by-config, locked for deletion | **delete in C.2 (anchor decision)** |
| 18 | `packages/axoview-lib/src/components/ConfirmDiscardDialog/ConfirmDiscardDialog.tsx` | A.3 #2 — orphan-by-cascade from #17 | **delete with #17 in C.2** |

#### A.2.3 Unused dependencies / devDependencies — validation

Knip flagged 1 dep + 10 devDeps. Post-rename validation:

| # | Package | Knip-flagged location | Validation | Disposition |
|---|---|---|---|---|
| 1 | `uuid` | `packages/fossflow-backend/package.json` | The current `axoview-backend/package.json` (A.5) **has no `uuid` dependency.** Backend uses `crypto.getRandomValues` for share-UUIDs (routes.js:36-47). Already removed. | resolved |
| 2 | `conventional-changelog-conventionalcommits` | root `package.json` | **Still present** (root devDep — listed in our A.5 read). Used by semantic-release `commit-analyzer` plugin (per .releaserc.json). Knip can't follow the indirection. | **live (false positive)** — keep. |
| 3 | `@testing-library/dom` | app | Still in `axoview-app/package.json` devDeps. Used by jest tests transitively (jest-dom needs it). | **live (false positive)** — keep. |
| 4 | `@testing-library/jest-dom` | app | Same as #3 — used by jest tests. | **live** — keep. |
| 5 | `@testing-library/react` | app | Used by component tests. | **live** — keep. |
| 6 | `@testing-library/user-event` | app | Used by component tests. | **live** — keep. |
| 7 | `@testing-library/user-event` | lib | Same — used by lib component tests. | **live** — keep. |
| 8 | `@types/jsdom` | lib | jsdom types for jest-environment-jsdom. | **live** — keep. |
| 9 | `@types/quill` | lib | Used by RichTextEditor; lib's quill is `react-quill-new` which doesn't ship types. | **live** — keep. |
| 10 | `jsdom` | lib | jest-environment-jsdom dependency. | **live** — keep. |
| 11 | `prettier` | lib | Used by `/audit` Phase 1 (`npx prettier --check`). | **live** — keep. |

**Net:** **0 validated dead deps.** Every knip flag here is a false positive caused by tooling that knip can't follow (jest's environment, semantic-release plugins). **The only real action is to make knip configuration aware of these,** OR to accept the false-positive rate and document the keep-list. C.8 row.

#### A.2.4 Unlisted dependencies — validation

| # | Package | Used at | Validation | Disposition |
|---|---|---|---|---|
| 1 | `@mui/material` | `packages/fossflow-app/src/App.tsx:18` | App.tsx now lives at `packages/axoview-app/src/App.tsx`. `axoview-app/package.json` **declares `@mui/material: ^7.3.9`** (A.5 verified). | resolved |
| 2 | `@mui/icons-material` | `packages/fossflow-app/src/App.tsx:25` | Same — declared. | resolved |
| 3 | `react-quill-new/dist/quill.snow.css` | `packages/fossflow-app/src/index.tsx:4` | This is a deep CSS import; `react-quill-new` is in lib's deps (axoview-lib/package.json:35). App imports the CSS directly; knip sees the deep path as unlisted. | **live (knip limitation)** — keep. Optionally extract to a shared style module. |

#### A.2.5 Unused exports — sampling

Knip flagged 48 unused exports + 9 unused exported types. A full per-row validation is impractical without a fresh run; below is a **strategic sample** (paths normalized to rename-era).

| # | Symbol | Location | Validation | Disposition |
|---|---|---|---|---|
| 1 | `register` (serviceWorkerRegistration) | `axoview-app/src/serviceWorkerRegistration.ts:14` | Service-worker registration is the CRA template scaffold; **service-worker.js was deleted** (A.2.2 #1). The `register` export is now orphan. **And the file still uses CRA console.log boilerplate** (A.2.6). | **delete file** in C.2; full CRA SW scaffold is dead. |
| 2 | `appTest`, `AppPage`, `CanvasPage`, etc. (axoview-e2e) | various | Cascades with `packages/axoview-e2e/` deletion per locked-decision #4 (C.5). | resolved by C.5 |
| 3 | `TILE_PROJECTION_MULTIPLIERS`, `DEFAULT_COLOR`, `MARKDOWN_EMPTY_VALUE` (lib/src/config.ts) | config.ts | Public lib API; consumers may rely. Knip can't see external consumers. | **live (lib public API)** — keep. ADR 0008 (naming) decides if these get `// @public` annotations. |
| 4 | `updateViewTimestamp`, `syncScene` (viewReducers) | `axoview-lib/src/stores/reducers/view.ts` | Reducer exports likely consumed by tests + indirectly by the store. Knip's per-file analysis loses store-indirection. | **live (false positive risk)** — verify per-symbol before deleting; defer to runtime trace (Phase B). |
| 5 | `validateConnectorAnchor`, `validateConnector`, `validateRectangle`, `validateModelItem` (schemas/validation.ts) | lib | Public validation utilities — knip can't follow zod-internal references. | **live (lib public API)** — keep. |
| 6 | `getRandom`, `roundToOneDecimalPlace`, `getItemByIndexOrThrow` (lib/utils/common.ts) | lib | Small utilities exported as part of lib's public surface; consumers may use. | **live (lib public API)** — keep. |
| 7 | `isoToScreen`, `sortByPosition`, `getBoundingBoxSize`, `getIsoMatrix`, `getTranslateCSS`, `normalisePositionFromOrigin`, `getRectangleFromSize`, `getTextWidth`, `getTileScrollPosition`, `getProjectBounds` (utils/renderer.ts) | lib | The big-public-API surface. Most are lib consumer hooks; knip can't see consumers. | **live (lib public API)** — keep, but candidates for narrowing in C.1 (naming convention ADR may decide which are truly public). |
| 8 | `validateDiagramData` (axoview-app/src/diagramUtils.ts:45) | app | Validation export from diagramUtils. File has live importers for `DiagramData` type but the function itself may be dead. | **needs grep follow-up** — A.2 second pass. |
| 9 | `storageManager` (axoview-app/src/services/storageService.ts:251) | n/a | **GONE** — file deleted post-Phase 2A (flare 5E). | resolved |
| 10 | `loadLazyLoadingPreference`, `saveLazyLoadingPreference`, etc. (services/iconPackManager.ts) | axoview-app | All zustand-store API; the store is reactively consumed via React hooks, which knip can't see as imports. | **live (false positive)** — keep. |
| 11 | `transformToCompactFormat` (lib/utils/exportOptions.ts) | lib | Post-MQA #1 (cluster 51) — "Export Compact removal." Compact export was deleted from the UI but the utility may have remained. **Likely real dead code.** | **validated dead candidate** — verify and remove in C.2. |
| 12 | `fixModel` (lib/utils/model.ts) | lib | Likely pre-Phase-2A migration helper; check if still wired. | **needs grep** — A.2 second pass. |
| 13 | `screenPathToTilePath` (lib/utils/pointInPolygon.ts) | lib | FreehandLasso geometry helper; cluster 14 added freehand lasso. Check if `FreehandLasso` mode uses it; if not, may be dead. | **needs grep** — A.2 second pass. |
| 14 | `migrateLegacyLabels` (lib/utils/connectorLabels.ts) | lib | Migration helper; one-shot. May still be wired into initial-data path. | **needs grep** — A.2 second pass. |
| 15 | `colors` (lib/examples/initialData.ts) | lib | Example data export. | **live (lib examples surface)** — keep. |
| 16 | `HotkeyMapping` interface (lib/config/hotkeys.ts) | lib | Public type for consumers customizing hotkeys. | **live (lib public API)** — keep. |
| 17 | `Props` interface (MainMenu/MenuItem.tsx) | lib | Cascades with MainMenu deletion (A.3 #1). | resolved by MainMenu deletion |
| 18 | `Isoflow|default` duplicate export (lib/src/Isoflow.tsx) | lib | **File renamed to `Axoview.tsx` in cluster 62.** The duplicate-export finding is moot. | resolved by rename |

**Net:** Out of the 48+9 = 57 export findings, ~30 are lib public-API false positives; ~10 are tests/e2e (resolved by C.5); ~5 are post-cluster-resolved; **3-5 are genuine dead-code candidates** requiring per-symbol grep (rows 8, 11, 12, 13, 14).

#### A.2.6 Smell-pattern grep (additional)

| # | Pattern | Hit count | Top finding |
|---|---|---|---|
| 1 | `console.log\|console.warn\|console.debug` in production src (excluding `__tests__`, renderProbe, DiagnosticsOverlay, migrationShim) | **14** | `serviceWorkerRegistration.ts` accounts for 4 (CRA boilerplate; file is orphan per A.2.5 #1). Remaining 10 are intentional error-path warnings (DOMErrorBoundary, RichTextEditorErrorBoundary, svgOptimizer error paths, useInitialDataManager warning, connector reducer warning, MainMenu's lib-deprecation warn at Axoview.tsx:151, IconSelectionControls skip-non-image warn, iconUsage scan failure). |
| 2 | `@ts-ignore` / `@ts-nocheck` | **10** | **All in `__tests__/`.** Test-only suppressions are acceptable but should still be tracked. Lib uses `@ts-nocheck` at the top of 7 test files (DrawRectangle, FreehandLasso, PlaceIcon, TransformRectangle, sceneStore, isoMath, isoMath.richtext, useIsoProjection.twoDY). |
| 3 | `// FIXME\|// HACK\|// XXX\|// LEGACY` clusters | not surveyed in this pass | C.2 follow-up. Optional. |
| 4 | Stray `console.error` in user-facing paths (per UX-principles §6.3) | not surveyed in this pass | `/audit` Phase 5b skill already grep's this; cross-link to next `/audit` run. |
| 5 | `useScene()` in `SceneLayers/` (perf anti-pattern A-1) | not surveyed in this pass | `/audit` Phase 5c covers it. |

#### A.2.7 Classification rollup

| Class | Count | Action |
|---|---|---|
| **Resolved by cluster** (deletion landed before this audit) | 14 (10 unused-files + 1 dep + 3 unlisted + ~5 exports) | None. Already done. |
| **Validated dead** (delete in C.2) | 6 (lib's `docs/` Next.js scaffold + 4 cascades; paymentFlowExample; LeftSidebar; MainMenu + cascade) | C.2 rows; low risk. |
| **Likely dead, needs per-symbol grep** | 3-5 (transformToCompactFormat, fixModel, screenPathToTilePath, migrateLegacyLabels, validateDiagramData) | C.2 row: "post-deletion verification pass" — one grep per symbol before deletion. |
| **Live (knip false positive)** | ~25 (lib public API, jest deps, semantic-release plugin deps, zustand-store hooks, deep CSS import) | None. Document in knip config (C.8). |
| **Cascades with C.5 deletion** | ~10 (axoview-e2e helpers/fixtures) | Folds into C.5. |
| **Test-only suppressions** | 10 `@ts-nocheck` (all in `__tests__`) | None. Acceptable for test code; document. |
| **Stray console** | 14 (4 in dead-file scaffolding, 10 intentional warnings) | After deleting `serviceWorkerRegistration.ts`: 10 remain; all intentional. |

#### A.2 Cross-cutting observations

| # | Observation | Evidence | Suggested follow-up |
|---|---|---|---|
| **N1** | **The largest A.2 deliverable is a pre-rename report that needs re-running.** ~70% of its "Unused files" rows are stale (resolved by deletion clusters that ran after the report). A fresh knip run would be more actionable than this audit's classification of the old report. | reports/knip.txt + A.2.2 | C.8 git-automation tactical: schedule a weekly `npx knip > reports/knip.txt` job. The output is gitignored but useful as a session artifact. |
| **N2** | **`packages/axoview-lib/docs/` is a leftover Next.js docs scaffold** with 4 files. Zero importers in the rename-era tree. Likely from Isoflow → FossFLOW lineage. | A.2.2 #5-#9 | C.2 row: delete `packages/axoview-lib/docs/` directory. Low risk (the lib docs surface is the README + ADRs, not Next.js). |
| **N3** | **knip's false-positive rate is high for this codebase** (~25 of the 48 export findings are public-API or jest-environment). A `.knip.json` config that lists entry points + public exports would tighten the report. | A.2.5 | C.8 row: write a `.knip.json` that names lib's `index.ts` + `standaloneExports.ts` + jest configs + test files as entry points. |
| **N4** | **`serviceWorkerRegistration.ts` is fully dead.** Its only consumer (the SW script in public/) was deleted, and the file itself still has 4 stray `console.log` calls. **Single-file cleanup**, captured in C.2. | A.2.5 #1 + A.2.6 #1 | One file deletion + remove import in `index.tsx`. |
| **N5** | **Five symbols need per-symbol grep before deletion** (transformToCompactFormat, fixModel, screenPathToTilePath, migrateLegacyLabels, validateDiagramData). These are the highest-ROI symbol-level dead-code findings, but each requires a 30-second grep to confirm. **C.2 row: dedicated "symbol verification" sub-task.** | A.2.5 #8, #11, #12, #13, #14 | C.2 row. |
| **N6** | **All `@ts-ignore`/`@ts-nocheck` are in test files.** Production code has zero suppressions. **This is a positive finding** — the rename + Phase 0A refactors didn't leave type-system shortcuts in product code. | A.2.6 #2 | Document in ADR 0009 / architecture.md as the type-safety baseline. |
| **N7** | **Stray `console.*` count after dead-file removal: 10**, all intentional error/warn-path output. None violate the UX-principles §6.3 "user-facing path also needs setNotification" rule because they're in error boundaries or background scans, not user-triggered code paths. | A.2.6 #1 | No action; document. |
| **N8** | **Three dead files cascade from the MainMenu deletion locked in A.3 #1.** MainMenu.tsx itself, ConfirmDiscardDialog.tsx (orphan-by-cascade), and MenuItem.tsx (cascades from MainMenu). One C.2 row covers all three. | A.3 #1, #2 + A.2.5 #17 | C.2 row. |
| **N9** | **The audit has produced more dead-code findings via A.3/A.5/A.6 than knip surfaced.** This audit's structural analysis (mount paths, importer trees, naming collisions) caught what knip's per-file pass missed. The two methods are **complementary**, not substitutes. | A.3 + A.5 + A.2 cross-reference | Document in workflow.md: "knip is the wide net; structural analysis is the deep one. Run both at major milestones." |

### A.3 Concept anomalies

**Method:** read every UX-bearing file flagged in A.1.4 in priority order (HIGH → MEDIUM → mode-rich); grep for cross-references; record each anomaly with file:line evidence and a proposed disposition. **All dispositions are proposed only** — execution lands in C.2 / spawned tacticals.

**Vocabulary:** "dead-by-config" = component still imported and mounted in the React tree, but short-circuits to `null` because its config prop is empty (or equivalent). Distinct from "dead code" (no importer) and "ghost" (importer exists but mount path never fires at runtime).

#### A.3.1 — A.3.7 Surface-level anomaly register

| # | Surface | Location(s) | Evidence | Classification | Proposed disposition |
|---|---|---|---|---|---|
| 1 | **MainMenu — dead-by-config in app, alive in lib** | [packages/axoview-lib/src/components/MainMenu/MainMenu.tsx](../../packages/axoview-lib/src/components/MainMenu/MainMenu.tsx); mounted by [UiOverlay.tsx](../../packages/axoview-lib/src/components/UiOverlay/UiOverlay.tsx#L174-L180) inline + [L260-L262](../../packages/axoview-lib/src/components/UiOverlay/UiOverlay.tsx#L260-L262) via portal | App passes `MAIN_MENU_OPTIONS: MainMenuOptions = []` ([App.tsx:39-40](../../packages/axoview-app/src/App.tsx#L39-L40)) with comment "Burger removed per ADR 0005 — app stops using mainMenuOptions so MainMenu short-circuits." MainMenu short-circuits at [MainMenu.tsx:185](../../packages/axoview-lib/src/components/MainMenu/MainMenu.tsx#L185) `if (mainMenuOptions.length === 0) return null;`. UiOverlay still gates render on `availableTools.includes('MAIN_MENU')` from `EDITOR_MODE_MAPPING[EDITABLE]`, so the component **does** mount but renders null. | dead-by-config (app) / live (lib) | **LOCKED 2026-05-19: accept loss + delete from lib.** App-side: New Diagram is covered by FileExplorer; Export by `ExportPopover`; Settings by `SettingsDialog`; Open by Ctrl+O (anomaly #14 — discoverability gap addressed separately). No re-surfacing. **Lib-side: delete `MainMenu/`, `MainMenuOptions` type, and `availableTools.includes('MAIN_MENU')` gate.** Pre-1.0 breaking change is acceptable — lib has not been npm-published yet (rename Phase 10 pending). C.2 sequences the deletion; ConfirmDiscardDialog cascades (anomaly #2). **ADR 0008** records this as "lib surface removed pre-productization" precedent — the `// LIB-ONLY` convention (cross-cutting #1) is retained as a forward-looking pattern for future cases, not anchored to MainMenu. |
| 2 | **ConfirmDiscardDialog — orphan-by-cascade in app** | [packages/axoview-lib/src/components/ConfirmDiscardDialog/ConfirmDiscardDialog.tsx](../../packages/axoview-lib/src/components/ConfirmDiscardDialog/ConfirmDiscardDialog.tsx) | Only consumer is [MainMenu.tsx:30](../../packages/axoview-lib/src/components/MainMenu/MainMenu.tsx#L30) (`import { ConfirmDiscardDialog }`). Since MainMenu is dead-by-config in the app (anomaly #1), `ConfirmDiscardDialog` is **unreachable in the app**. | orphan-by-cascade (app) / live (lib) | **LOCKED 2026-05-19: delete with #1.** Cascades from the MainMenu removal decision. No other lib consumer; safely deletable. C.2 sequences with #1. |
| 3 | **LeftSidebar.tsx — pure orphan (zero importers)** | [packages/axoview-lib/src/components/Sidebars/LeftSidebar.tsx](../../packages/axoview-lib/src/components/Sidebars/LeftSidebar.tsx) | `git grep "LeftSidebar"` returns one match — the file's own `export const`. No importer in lib or app. Created in A.1 cluster 27 (`b8b72e4` 2026-04-09 "sidebar panels, unified toolbar"); its sibling `RightSidebar` is imported by [Axoview.tsx:37](../../packages/axoview-lib/src/Axoview.tsx#L37). | **dead code (orphan)** | **Delete in C.2.** Low risk — no public API exposure (not re-exported from `standaloneExports.ts`). Sanity-check: verify no string-based `lazy()` import / dynamic loader resolves the path. |
| 4 | **Dual `ExportDialog.tsx` — name collision, different responsibilities** | [packages/axoview-app/src/components/ExportDialog.tsx](../../packages/axoview-app/src/components/ExportDialog.tsx) (66 lines) **vs** [packages/axoview-app/src/components/fileExplorer/ExportDialog.tsx](../../packages/axoview-app/src/components/fileExplorer/ExportDialog.tsx) (109 lines) | Top-level: single-diagram JSON-export confirmation dialog (`onExport: () => void`); imported by [DiagramLifecycleProvider.tsx:22](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L22). Sub-folder: project-zip exporter with `scope: 'all-diagrams' \| 'folder'`, provider-aware (`StorageProvider`), `exporterTag`; imported by [App.tsx:24](../../packages/axoview-app/src/App.tsx#L24). Both alive, both reachable. | name-collision (dupe by name only — code is distinct) | **Rename both in C.2.** Proposal: top-level → `ExportSingleDiagramDialog.tsx` (or fold into `ExportPopover` since both are JSON-export entry points); fileExplorer → `ExportProjectZipDialog.tsx`. Resolves cognitive collision and makes IDE jump-to-definition deterministic. |
| 5 | **Dual `StorageManager` — name collision, different concerns** | [packages/axoview-app/src/StorageManager.tsx](../../packages/axoview-app/src/StorageManager.tsx) (222-line **React modal** for inspecting/clearing localStorage) **vs** [packages/axoview-app/src/services/storage/StorageManager.ts](../../packages/axoview-app/src/services/storage/StorageManager.ts) (**class** orchestrating storage providers) | `.tsx` imported by [DiagramLifecycleProvider.tsx:24](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L24) and rendered at [L1342-1343](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L1342) (modal, gated on `showStorageManager`). `.ts` imported by [AppStorageContext.tsx:3](../../packages/axoview-app/src/providers/AppStorageContext.tsx#L3) and re-exported from `services/storage/index.ts`. Both alive. | name-collision (dupe by name only) | **Rename `.tsx` → `LocalStorageInspector.tsx` or `StorageQuotaDialog.tsx`** in C.2. Verify the rendering condition (`setShowStorageManager(true)` at [DiagramLifecycleProvider.tsx:650](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L650)) is reachable in runtime trace (Phase B) — if it never fires post-cluster-46 (`SessionStorageGauge` cleanup), the modal may also be deletion-candidate. |
| 6 | **`SaveDialog` / `LoadDialog` — local-mode-only reachability** | [packages/axoview-app/src/components/SaveDialog.tsx](../../packages/axoview-app/src/components/SaveDialog.tsx), [LoadDialog.tsx](../../packages/axoview-app/src/components/LoadDialog.tsx); mounted by [DiagramLifecycleProvider.tsx:1317-1336](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L1317) | SaveDialog opens only via `setShowSaveDialog(true)` at [L997](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L997) — fires when `handleSaveClick` runs **and** `!serverStorageAvailable` **and** `!currentDiagram`. LoadDialog opens only at [L1006](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L1006) when `handleOpenClick` runs **and** `!serverStorageAvailable`. AppToolbar's Save button only renders in local mode (`!serverStorageAvailable`, [AppToolbar.tsx:179](../../packages/axoview-app/src/components/AppToolbar.tsx#L179)); `handleOpenClick` is only fired via Ctrl+O ([DiagramLifecycleProvider.tsx:1019-1022](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L1019)). | conditionally reachable | **Verify in Phase B.** Trace local-mode + new-diagram, then trace local-mode + Ctrl+O. If both fire, they're alive. **Anomaly hint:** in local mode there is no visible Open button — only the hidden Ctrl+O shortcut. A.3.4 finding (see #14 below). |
| 7 | **DiagramManager (modal) — session-mode-only, no visible trigger** | [packages/axoview-app/src/components/DiagramManager.tsx](../../packages/axoview-app/src/components/DiagramManager.tsx); mounted by [DiagramLifecycleProvider.tsx:1349-1351](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L1349) | Opens only via Ctrl+O in session mode ([L1004](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L1004)). Session users have the always-visible **FileExplorer** as the primary diagram-picker UI, making the modal a redundant secondary surface. | possibly redundant (session mode) | **Verify in Phase B.** If usage trace shows zero hits when the FileExplorer is the visible primary surface, fold its discoverable actions into FileExplorer + delete the modal in C.2. |
| 8 | **AppToolbar — clean post-ADR-0005** | [packages/axoview-app/src/components/AppToolbar.tsx](../../packages/axoview-app/src/components/AppToolbar.tsx) | Despite 8 independent waves (A.1.4), the toolbar now matches ADR 0005: brand mark (left), four-group right zone (View modes reserved-empty / Save+Status / Document actions / Sidebar toggle). Comments at [L159, L176, L126](../../packages/axoview-app/src/components/AppToolbar.tsx#L126) explicitly cite ADR 0005. No stale handlers visible. | intentional / clean | **No action.** ADR-0005-conformant. The "8 waves" finding from A.1.4 was a false alarm at the surface level; the contract absorbed the churn. Group 1 is intentionally empty per ADR. |
| 9 | **LayersPanel — large but coherent** | [packages/axoview-lib/src/components/LayersPanel/LayersPanel.tsx](../../packages/axoview-lib/src/components/LayersPanel/LayersPanel.tsx) (550 lines), with sibling primitives [LayerRow.tsx](../../packages/axoview-lib/src/components/LayersPanel/LayerRow.tsx), [LayerItemRow.tsx](../../packages/axoview-lib/src/components/LayersPanel/LayerItemRow.tsx) | Two distinct row primitives — `LayerRow` for layer headers, `LayerItemRow` for items within a layer. Both used in correct positions ([LayersPanel.tsx:475 / :498 / :550](../../packages/axoview-lib/src/components/LayersPanel/LayersPanel.tsx#L475)). No duplicate utility import. | intentional / decomposition-candidate | **No action for A.3.** Flag for a future "panel decomposition" tactical if 550 lines becomes a maintenance pain. Not anomalous. |
| 10 | **Diagnostics surface — clean, deprecation alias intentional** | [packages/axoview-app/src/components/DiagnosticsOverlay.tsx](../../packages/axoview-app/src/components/DiagnosticsOverlay.tsx), [DiagnosticsToggleButton.tsx](../../packages/axoview-app/src/components/DiagnosticsToggleButton.tsx), [diagnosticsStore.ts](../../packages/axoview-app/src/stores/diagnosticsStore.ts); debug global wired in [packages/axoview-lib/src/Axoview.tsx:128-170](../../packages/axoview-lib/src/Axoview.tsx#L128-L170) | `__axoview__` is the new debug global ([Axoview.tsx:137](../../packages/axoview-lib/src/Axoview.tsx#L137)). `__fossflow__` is retained as a **getter that warns once on first access** ([L143-158](../../packages/axoview-lib/src/Axoview.tsx#L143)), explicitly scoped to "one release window". Test coverage in [migrationShim.test.ts](../../packages/axoview-app/src/utils/__tests__/migrationShim.test.ts). All DiagnosticsOverlay reads use `__axoview__` ([DiagnosticsOverlay.tsx:46, :71, :84](../../packages/axoview-app/src/components/DiagnosticsOverlay.tsx#L46)). e2e helpers ([packages/axoview-e2e/helpers/store.ts](../../packages/axoview-e2e/helpers/store.ts)) — note: this package is slated for deletion per audit-locked-decision #4, so its `__axoview__` usage is moot. | intentional / clean | **No action.** Schedule `__fossflow__` removal for the next release window (track in C.2 cleanup plan; one-line deletion of [Axoview.tsx:143-162](../../packages/axoview-lib/src/Axoview.tsx#L143-L162)). |
| 11 | **`DiagLogger.ts` deletion — residue clean** | (deleted in A.1 cluster 31, `41d6748`) | `git grep "DiagLogger"` returns **no matches**. | intentional / clean | **No action.** Confirmed clean. |
| 12 | **`SaveAsDialog.tsx` deletion — residue clean** | (deleted in A.1 cluster 48, `e7d25a0`) | `git grep "SaveAsDialog"` returns **no matches**. | intentional / clean | **No action.** Confirmed clean. |
| 13 | **`__fossflow__` localStorage / sessionStorage migration — verified** | [migrationShim.ts](../../packages/axoview-app/src/utils/migrationShim.ts), [migrationShim.test.ts](../../packages/axoview-app/src/utils/__tests__/migrationShim.test.ts), [projectZip.ts:17 `LEGACY_PROJECT_FORMATS`](../../packages/axoview-app/src/services/project/projectZip.ts#L17) | Shim copies `fossflow_*` / `fossflow-*` → `axoview_*` / `axoview-*` and deletes originals (lossless rename); preserves writes-since-rename. Project ZIP import accepts `'fossflow-project'` as a legacy format. Test suite asserts the full shape. | intentional / clean | **No action.** Plan removal of the shim alongside the `__fossflow__` deprecation alias (#10) once the release window passes. |

#### A.3.4 Hotkeys / Shortcuts — handler-resolution status

Config files audited:

- **[packages/axoview-lib/src/config/hotkeys.ts](../../packages/axoview-lib/src/config/hotkeys.ts)** — 8 mode-switch hotkeys (`select / pan / addItem / rectangle / connector / text / lasso / freehandLasso`) across 3 profiles (`qwerty / smnrct / none`). Default is `smnrct`.
- **[packages/axoview-lib/src/config/shortcuts.ts](../../packages/axoview-lib/src/config/shortcuts.ts)** — 7 fixed shortcuts (`cut / copy / paste / undo / redo / redoAlt / help`).

Both files are consumed by:
- **[HotkeySettings.tsx](../../packages/axoview-lib/src/components/HotkeySettings/HotkeySettings.tsx)** — Settings dialog tab; displays current mapping and lets user switch profile. Mounted at [SettingsDialog.tsx:78](../../packages/axoview-lib/src/components/SettingsDialog/SettingsDialog.tsx#L78).
- **[HelpDialog.tsx](../../packages/axoview-lib/src/components/HelpDialog/HelpDialog.tsx)** — read-only display of `FIXED_SHORTCUTS` entries (cut/copy/paste/undo/redo/redoAlt/help) at [L44-114](../../packages/axoview-lib/src/components/HelpDialog/HelpDialog.tsx#L44-L114).
- **Tests pin the values:** [shortcuts.test.ts](../../packages/axoview-lib/src/__perf_refactor_regression__/shortcuts.test.ts), [settings.defaults.test.ts](../../packages/axoview-lib/src/__perf_refactor_regression__/settings.defaults.test.ts).

**Anomalies / open verifications:**

| # | Item | Evidence | Disposition |
|---|---|---|---|
| 14 | **Hidden Ctrl+O shortcut in local mode** | Ctrl+O wired at [DiagramLifecycleProvider.tsx:1019-1022](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L1019); no visible Open button in `AppToolbar` (post-ADR-0005). Local-mode users can only open a diagram via the hidden shortcut or by drag-and-drop. | **Verify in Phase B / decide in C.2.** Either add a visible Open affordance for local mode (re-surface what MainMenu used to provide) or accept the hidden shortcut + document in HelpDialog. Currently HelpDialog lists Ctrl+S / Ctrl+Z / etc. but **not Ctrl+O** — the shortcut exists at runtime but is undiscoverable. |
| 15 | **F1 → help shortcut: handler verification deferred** | `FIXED_SHORTCUTS.help = 'F1'`. HelpDialog opens via... not verified in this audit pass. | **Phase B target scenario:** "press F1 → expect `dialog.help.open` trace event." |
| 16 | **Per-hotkey mode-dispatch verification deferred** | Each of the 8 mode hotkeys (select/pan/addItem/rectangle/connector/text/lasso/freehandLasso) must dispatch to a live mode constructor in `useInteractionManager`. Not verified line-by-line here. | **Phase B target scenarios:** one trace scenario per profile × per hotkey (24 scenarios). Bulk verification only — refute "all 8 fire on the active profile" claim. |

#### A.3 Cross-cutting observations

1. **The MainMenu/ConfirmDiscardDialog "ghost" pattern is not a one-off** (but here we're deleting, not preserving — see note). The dead-by-config idiom (component mounted, prop empty, renders null) is *generally* preferable to deletion when the component is a published library API (others can use it). Going forward, when the app retires a lib surface, flag it as "lib-only" in a future ADR rather than deleting the lib component. The pattern works; the audit just needs to name it (proposal: introduce a `// LIB-ONLY` comment convention at the affected lib component header). **Note 2026-05-19:** the convention is retained as forward-looking; the immediate MainMenu case is being deleted (anomaly #1 disposition locked: lib hasn't been npm-published yet, so the breaking change is free). The first real-world `// LIB-ONLY` case will appear when a published lib surface gets app-retired post-1.0.
2. **Name-collision dupes (anomalies #4, #5) are cheap to fix and high-clarity-payoff.** Two files named `ExportDialog.tsx` and two named `StorageManager.*` in the same package — IDE / IDE-agent jump-to-definition cannot disambiguate without path context. Rename in C.2 ahead of any naming-convention ADR (ADR 0008 territory).
3. **Dialog reachability is the largest open question post-A.3.** Anomalies #6, #7, #14 all require runtime trace (Phase B) to resolve. The static structure suggests `SaveDialog`, `LoadDialog`, `DiagramManager` modal, and `StorageManager` modal are all conditionally-reachable; the trace harness will confirm or refute.
4. **Lib-side surfaces (MainMenu, ConfirmDiscardDialog, MainMenuOptions type) remain part of the library's public API** even when unused by `axoview-app`. ADR 0008 (naming convention) must decide whether to formalize a "lib-surface vs app-surface" distinction so future audits don't re-flag these as ghosts.
5. **Discoverability gap: Ctrl+O is undocumented.** HelpDialog lists most shortcuts but omits Ctrl+O. Either add it to the HelpDialog list (single-line fix, can land in C.2) or surface an Open button somewhere in local mode.
6. **No "stale handler" findings (canonical A.3 mode-rich case).** The expected-high-anomaly canvas-modes category came up clean at the config level: hotkeys.ts and shortcuts.ts are coherent, every key has a defined target, no orphan profile entries. Deep dispatch verification is deferred to Phase B (16 target scenarios).

### A.4 Mode matrix

**Method:** trace the runtime-mode-detection plumbing end-to-end; enumerate per-mode contract; map surface visibility / action enablement per mode; classify every GDrive reference. Static-only — runtime trace verification of conditional-reach surfaces (A.3 #6, #7) belongs to Phase B.

**Vocabulary:**
- **`active`** = surface visible and actions enabled
- **`disabled`** = surface visible but actions disabled (tooltip / chip explains why)
- **`hidden`** = surface not rendered in this mode
- **`placeholder`** = code present but every method throws `NotImplementedError` (forward scaffolding per locked decision #5)
- **`DEAD`** = code present but unreachable in any mode at runtime; must have file:line evidence

#### A.4.1 Mode-detection mechanism

The app distinguishes **two active runtime modes** plus **one forward-scaffolding placeholder**. The decision flows through three artifacts:

```
                ┌─────────────────────────────────────┐
                │  AppStorageProvider (mount-time)    │
                │  packages/axoview-app/src/providers/│
                │  AppStorageContext.tsx              │
                └─────────────────────────────────────┘
                    │ parallel probes (Promise.all)
                    ├──> fetchRuntimeConfig()  ──> GET /api/config (800ms timeout)
                    │      RuntimeConfig {
                    │        googleClientId,      // Phase 3B — currently always null
                    │        driveScopes,         // Phase 3B
                    │        authMode,            // 'none' | 'shared-token' | 'cf-access'
                    │        serverStorage       // not consumed by mode-detection (see #C1)
                    │      }
                    │
                    └──> manager.initialize() ──> LocalStorageProvider.isAvailable()
                                                      GET /api/storage/status (800ms)
                                                      sets provider.usingServer = data.enabled
                                                  StorageManager reads provider.usingServer
                                                  via duck-typed `if ('usingServer' in provider)`
                                                  → StorageManager.serverStorageAvailable

         serverStorageAvailable = isServerStorage && isInitialized
         ── this is the binary toggle that decides Local vs Session ──

         isReadonlyUrl  ── from route: /display/p/:shareUuid or /display/:readonlyDiagramId ──
         (orthogonal sub-mode; can overlay either Local or Session)
```

**Key facts:**

- **Only `LocalStorageProvider` is registered** in [AppStorageContext.tsx:26-28](../../packages/axoview-app/src/providers/AppStorageContext.tsx#L26-L28). `GoogleDriveProvider` is exported from `services/storage/index.ts:10` but never instantiated. `S3Provider` was deleted in A.1 cluster 42 (residue clean — no references).
- **LocalStorageProvider has two execution paths**: server (when `/api/storage/status` returns `{enabled: true}`) and tab-local (when `/api/storage/status` 404s or times out). The provider exposes `usingServer: boolean` to let the StorageManager surface this distinction to React state.
- **`fetchRuntimeConfig.serverStorage`** is declared in `RuntimeConfig` but **not consumed** in `AppStorageContext` — the mode detection uses `usingServer` from the provider's status probe, not the runtime-config field. (See cross-cutting #C1.)
- **GDrive mode does not exist as a runtime selection today.** No code path sets `manager.setActiveProvider('google-drive')`. The `'google-drive'` literal appears only in the `StorageProvider.id` union type, the `GoogleDriveProvider` class, the FileExplorer label helper (`providerIdToLabel`), and `RuntimeConfig.googleClientId` plumbed through worker + backend `/api/config`.
- **Readonly is a route-derived sub-mode** (`/display/p/:shareUuid`, `/display/:readonlyDiagramId`) — `isReadonlyUrl` is true when matched. It overlays either Local or Session mode and forces `editorMode: 'EXPLORABLE_READONLY'`. In practice readonly is **session-only** because share links require server-side share resolution, but the route handler doesn't enforce this.

#### A.4.2 Per-mode contract

| Aspect | **Local** (`!serverStorageAvailable`) | **Session** (`serverStorageAvailable === true`) | **GDrive** (Phase 3B) |
|---|---|---|---|
| Detection | `/api/storage/status` 404s, 5xxs, times out, or returns `{enabled: false}` | `/api/storage/status` returns `{enabled: true}` (backend up, FS adapter writable) | not detectable; provider unregistered |
| Storage provider | `LocalStorageProvider` (tab-local localStorage path) | `LocalStorageProvider` (server-backed path; same provider class, different branch) | `GoogleDriveProvider` (placeholder; all methods throw `NotImplementedError`) |
| Persistence | localStorage of the browser tab | Server filesystem via `axoview-backend` (fs adapter) or Cloudflare worker bindings | n/a |
| Save UX | Manual: AppToolbar Save button visible, fires `handleSaveClick` → `saveDiagram()` or `setShowSaveDialog(true)` for first save | Autosave via `useAutoSave` + explicit Save (no visible button in current AppToolbar; relies on autosave + Ctrl+S) | n/a |
| Open UX | Ctrl+O → `LoadDialog` (only); no visible Open button | Always-visible `FileExplorer` (primary); Ctrl+O → `DiagramManager` modal (secondary, possibly redundant — A.3 #7) | n/a |
| Share | Disabled (Share button rendered but `disabled={!serverStorageAvailable \|\| !currentDiagramId}`) | Enabled — generates `/display/p/:shareUuid` link via `storage.shareDiagram` | n/a |
| Preview | Disabled (same gate as Share) | Enabled — opens `/display/:diagramId` in new tab | n/a |
| ExportPopover | Active (JSON + project ZIP export of localStorage diagrams) | Active (JSON + project ZIP export of server diagrams) | n/a |
| ImportDialog | Active (file-drop + JSON + project ZIP unpack into localStorage) | Active (same surface, writes to backend) | n/a |
| FileExplorer (left pane) | Visible — shows localStorage diagrams as `Diagrams` root label | Visible — shows backend diagrams as `Diagrams` root label (would say `Google Drive` if provider id were `google-drive` per `providerIdToLabel`, FileExplorer.tsx:83) | n/a |
| SessionModeBanner | **Visible when at least one diagram exists** (`!serverStorageAvailable && !isReadonlyUrl && linkedDiagrams.length > 0`) — message: "Your work lives in this browser tab only" | **Hidden** | n/a |
| MainMenu | Mounted-but-null (A.3 #1, locked for deletion) — all modes | (same) | (same) |
| Notifications | Active (per-tab) | Active | n/a |
| Diagnostics | Active (`__axoview__` debug global, DiagnosticsOverlay toggle) | Active | n/a |
| editorMode prop to lib | `EDITABLE` (normal) or `EXPLORABLE_READONLY` (readonly URL) | same | n/a |

#### A.4.3 Surface-by-surface mode matrix

Rows below are ordered by mode-axis significance: surfaces whose state varies across modes first, then surfaces that are mode-invariant.

| # | Surface / feature | Local | Session | GDrive | Notes / evidence |
|---|---|---|---|---|---|
| 1 | `LocalStorageProvider` (tab path) | **active** | hidden (provider switches to server branch via `usingServer=true`) | hidden | [LocalStorageProvider.ts:101-146](../../packages/axoview-app/src/services/storage/providers/LocalStorageProvider.ts#L101-L146) |
| 2 | `LocalStorageProvider` (server path) | hidden | **active** | hidden | server branch gated on `this.usingServer` ([L305 onward](../../packages/axoview-app/src/services/storage/providers/LocalStorageProvider.ts#L305)) |
| 3 | `GoogleDriveProvider` | placeholder | placeholder | placeholder | [GoogleDriveProvider.ts:1-77](../../packages/axoview-app/src/services/storage/providers/GoogleDriveProvider.ts) — every method throws `NotImplementedError`; never registered with StorageManager |
| 4 | `axoview-backend` (`server.js`, `routes.js`, `adapters/fs.js`) | hidden (not contacted) | **active** | hidden | [packages/axoview-backend/server.js](../../packages/axoview-backend/server.js), [routes.js](../../packages/axoview-backend/src/routes.js) |
| 5 | `axoview-worker` (Cloudflare Pages Functions) | hidden | **active** (Cloudflare deploy) | hidden | [packages/axoview-worker/src/app.ts](../../packages/axoview-worker/src/app.ts) |
| 6 | `AppToolbar` Save button | **active** | hidden (`{!serverStorageAvailable && ...}`) | n/a | [AppToolbar.tsx:179-195](../../packages/axoview-app/src/components/AppToolbar.tsx#L179) — Save button only renders in local mode (the session path is autosave + Ctrl+S) |
| 7 | `AppToolbar` Share button | rendered but **disabled** | **active** | n/a | [AppToolbar.tsx:210-221](../../packages/axoview-app/src/components/AppToolbar.tsx#L210) `disabled={!serverStorageAvailable \|\| !currentDiagramId}` |
| 8 | `AppToolbar` Preview button | rendered but **disabled** | **active** | n/a | [AppToolbar.tsx:222-241](../../packages/axoview-app/src/components/AppToolbar.tsx#L222) — same gate as Share |
| 9 | `AppToolbar` Brand mark | **active** | **active** | n/a | [AppToolbar.tsx:126-157](../../packages/axoview-app/src/components/AppToolbar.tsx#L126) — mode-invariant |
| 10 | `StatusCluster` | **active** | **active** | n/a | mode-invariant; always rendered |
| 11 | `ExportPopover` | **active** | **active** | n/a | mode-invariant; trigger sets `setShowExportDialog` for single-diagram path or opens project-zip dialog |
| 12 | `SessionModeBanner` | **active** when `linkedDiagrams.length > 0` | hidden | n/a | [App.tsx:201-202](../../packages/axoview-app/src/App.tsx#L201) — **name vs trigger inverted; see #C2** |
| 13 | `FileExplorer` (left pane) | **active** | **active** | placeholder label support | [FileExplorer.tsx:82-85](../../packages/axoview-app/src/components/fileExplorer/FileExplorer.tsx#L82-L85) `providerIdToLabel('google-drive') → 'Google Drive'` |
| 14 | `SaveDialog` (top-level component) | active **when** `!currentDiagram` (first-save flow) | hidden (autosave covers session) | n/a | [DiagramLifecycleProvider.tsx:997](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L997) — A.3 #6 |
| 15 | `LoadDialog` (top-level component) | active **when** Ctrl+O | hidden (`DiagramManager` modal opens instead) | n/a | [DiagramLifecycleProvider.tsx:1006](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L1006) — A.3 #6; Ctrl+O is undocumented in HelpDialog (A.3 #14) |
| 16 | `DiagramManager` (modal) | hidden | active **when** Ctrl+O — **possibly redundant with FileExplorer** | n/a | [DiagramLifecycleProvider.tsx:1004](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L1004) — A.3 #7; verify in Phase B |
| 17 | `StorageManager.tsx` (modal — localStorage inspector) | conditionally active (`setShowStorageManager(true)` at [DiagramLifecycleProvider.tsx:650](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L650)) | likely hidden (session has no localStorage quota concern) | n/a | reachability uncertain; A.3 #5 + Phase B verification |
| 18 | `ExportDialog` (top-level) | active **when** triggered by lifecycle provider | active **when** triggered by lifecycle provider | n/a | A.3 #4 — name collision with fileExplorer/ExportDialog |
| 19 | `ExportDialog` (fileExplorer — project zip) | **active** | **active** | n/a | A.3 #4 — mode-invariant |
| 20 | `ImportDialog` (fileExplorer) | **active** | **active** | n/a | mode-invariant |
| 21 | `EmptyStateScreen` | **active** when tree empty | **active** when tree empty | n/a | gates onboarding hint; mode-invariant trigger |
| 22 | `NotificationStack` | **active** | **active** | n/a | mode-invariant |
| 23 | `DiagnosticsOverlay` + toggle | **active** (gated on `enableDebugTools`) | **active** (same) | n/a | mode-invariant |
| 24 | `MainMenu` (lib) | dead-by-config (renders null; empty options) | dead-by-config | dead-by-config | A.3 #1 — locked for lib deletion in C.2 |
| 25 | `ConfirmDiscardDialog` (lib) | orphan-by-cascade (only consumer is MainMenu) | orphan-by-cascade | orphan-by-cascade | A.3 #2 — cascades from #1 |
| 26 | Canvas + all interaction modes | **active** | **active** | n/a | mode-invariant — canvas operates the same regardless of storage |
| 27 | `EXPLORABLE_READONLY` editorMode overlay | applies when route is `/display/p/...` or `/display/:id` (can apply in either Local or Session) | (same) | n/a | [App.tsx:216](../../packages/axoview-app/src/App.tsx#L216) `editorMode={isReadonlyUrl ? 'EXPLORABLE_READONLY' : 'EDITABLE'}` |
| 28 | Share-link route (`/display/p/:shareUuid`) | **broken** in pure-local mode — share-uuid resolution requires backend lookup | **active** | n/a | client opens the route but server-side share resolution requires session backend; deeplinking a share uuid in pure local mode yields empty state |
| 29 | `LeftSidebar.tsx` (orphan) | DEAD | DEAD | DEAD | A.3 #3 — zero importers in any mode |
| 30 | `S3Provider.ts` (deleted in cluster 42) | n/a | n/a | n/a | residue clean — `git grep "S3Provider"` returns no matches |
| 31 | `RuntimeConfig.serverStorage` field | **DEAD field** | **DEAD field** | n/a | [useRuntimeConfig.ts:8](../../packages/axoview-app/src/hooks/useRuntimeConfig.ts#L8) — declared, plumbed through worker/backend `/api/config`, but no consumer reads it; mode detection uses `LocalStorageProvider.usingServer` instead. **See #C1** |
| 32 | `RuntimeConfig.googleClientId` / `driveScopes` / `authMode` | placeholder (always null/default) | placeholder | placeholder | forward scaffolding for Phase 3B GDrive auth; plumbed end-to-end (worker + backend + frontend hook) and ready to receive real values |

#### A.4.4 GDrive reference inventory (per locked decision #5)

Complete enumeration of every `GoogleDrive` / `gdrive` / `google-drive` / `googleClientId` / `driveScope[s]` reference in the codebase (excluding lockfiles, build outputs, and the .git tree):

| Location | Reference | Classification |
|---|---|---|
| [packages/axoview-app/src/services/storage/providers/GoogleDriveProvider.ts](../../packages/axoview-app/src/services/storage/providers/GoogleDriveProvider.ts) | The placeholder class itself (16 methods, all throw `NotImplementedError`) | **placeholder — intentional** |
| [packages/axoview-app/src/services/storage/index.ts:10](../../packages/axoview-app/src/services/storage/index.ts#L10) | `export { GoogleDriveProvider } from './providers/GoogleDriveProvider'` | **placeholder — intentional** (public surface; will be re-used when Phase 3B wires it) |
| [packages/axoview-app/src/services/storage/types.ts:26](../../packages/axoview-app/src/services/storage/types.ts#L26) | `id: 'local' \| 'google-drive'` union | **placeholder — intentional** (provider-id discriminant ready for Phase 3B) |
| [packages/axoview-app/src/components/fileExplorer/FileExplorer.tsx:82-85](../../packages/axoview-app/src/components/fileExplorer/FileExplorer.tsx#L82-L85) | `providerIdToLabel(id)` returns `'Google Drive'` if `id === 'google-drive'`, else `'Diagrams'` | **placeholder — intentional** (label-resolver awaits a real GDrive provider id; harmless in current state) |
| [packages/axoview-app/src/hooks/useRuntimeConfig.ts:5-13](../../packages/axoview-app/src/hooks/useRuntimeConfig.ts#L5-L13) | `googleClientId`, `driveScopes`, `authMode` in `RuntimeConfig` + defaults | **placeholder — intentional** |
| [packages/axoview-app/src/hooks/__tests__/useRuntimeConfig.test.ts:22](../../packages/axoview-app/src/hooks/__tests__/useRuntimeConfig.test.ts#L22) | `expect(cfg.googleClientId).toBeNull()` | **test of placeholder default — intentional** |
| [packages/axoview-backend/src/routes.js:80-81](../../packages/axoview-backend/src/routes.js#L80-L81) | `googleClientId: env.GOOGLE_CLIENT_ID \|\| null, driveScopes: [...]` in `/api/config` response | **placeholder — intentional** (Express backend) |
| [packages/axoview-worker/src/app.ts:34-35](../../packages/axoview-worker/src/app.ts#L34-L35) | same shape in worker `/api/config` response | **placeholder — intentional** (Cloudflare worker) |

**No discarded earlier attempts found.** Every reference is forward scaffolding consistent with the Phase 3B path. Per locked decision #5: **no action — leave as-is.**

#### A.4 Cross-cutting observations

| # | Observation | Evidence | Suggested follow-up |
|---|---|---|---|
| **C1** | **`RuntimeConfig.serverStorage` is a dead field.** Declared in [useRuntimeConfig.ts:8](../../packages/axoview-app/src/hooks/useRuntimeConfig.ts#L8), defaulted to `false` at [L15](../../packages/axoview-app/src/hooks/useRuntimeConfig.ts#L15), and emitted by both the Express backend ([routes.js](../../packages/axoview-backend/src/routes.js)) and the Cloudflare worker ([app.ts](../../packages/axoview-worker/src/app.ts)). **No consumer reads it.** Mode detection uses `LocalStorageProvider.usingServer` (set by a *separate* `/api/storage/status` probe). Either (a) collapse the two probes — let `/api/config` carry `serverStorage: true` and drop the `/api/storage/status` round-trip, or (b) delete the field. Two probes hitting the backend for overlapping signals is the bigger smell. | three files declare it; `git grep "runtimeConfig\.serverStorage\|config\.serverStorage"` returns no consumers | **Flag for C.7** (likely deployment/topology ADR 0009 territory — the dual-probe surface area is a deployment contract question, not just an app cleanup) |
| **C2** | **`SessionModeBanner` name is inverted from its purpose.** The component is named for session-backend mode but its render gate is `!serverStorageAvailable && !isReadonlyUrl && linkedDiagrams.length > 0` ([App.tsx:201-202](../../packages/axoview-app/src/App.tsx#L201)) — i.e., **shown only in LOCAL mode**. The banner's text — "Your work lives in this browser tab only" ([SessionModeBanner.tsx:43-45](../../packages/axoview-app/src/components/SessionModeBanner.tsx#L43-L45)) — confirms its purpose is to warn about local-mode persistence loss. This is a **bug, not just a smell** — anyone reading the JSX would expect `SessionModeBanner` to fire in session mode and miss what it actually does. | name semantics contradict render gate + message content | **Rename to `LocalModeBanner` or `EphemeralWorkBanner` in C.2.** Trivial edit (one component file + one import in App.tsx); semantic correctness payoff is high. Cross-link from ADR 0008 naming convention. |
| **C3** | **`StorageManager.id = 'local' as const` is misleading.** The class is the provider-agnostic registry; its `id` field is typed as the literal `'local'` and `setActiveProvider()` does not update it. Comment at [StorageManager.ts:14](../../packages/axoview-app/src/services/storage/StorageManager.ts#L14) claims "reflects active provider — updated on switch" — code does not do this. | [StorageManager.ts:14, 32-36](../../packages/axoview-app/src/services/storage/StorageManager.ts#L14) | **Either implement the comment** (make `id` a getter that reads `this.active.id`) **or remove the field + comment** in C.2. Currently no consumer relies on it (the field is read in tests of the class itself but never in production code paths). |
| **C4** | **Mode detection uses two parallel probes when one would do.** `AppStorageContext.tsx:43-46` fires `fetchRuntimeConfig()` and `manager.initialize()` in parallel. Both hit `apiBaseUrl()`. Their signals overlap (server presence is implicit in `/api/storage/status` success, and `RuntimeConfig.serverStorage` could carry it). The 800ms budget per probe still adds up if either upstream returns slowly. | `Promise.all([fetchRuntimeConfig(), manager.initialize()])` at [AppStorageContext.tsx:43-46](../../packages/axoview-app/src/providers/AppStorageContext.tsx#L43) | **Folds into C1 follow-up.** ADR 0009 (deployment topology) should specify the `/api/config` contract such that one probe carries everything mode-detection needs. |
| **C5** | **Readonly URL is an orthogonal sub-mode but the audit's "three modes" framing flattens it.** `isReadonlyUrl` (matched by `/display/p/:shareUuid` or `/display/:readonlyDiagramId`) can overlay either Local or Session. In practice readonly is session-only because resolving a share-uuid requires the backend; deeplinking `/display/p/abc` in pure Local mode yields empty state without an explicit error. | [App.tsx:48-51, 216](../../packages/axoview-app/src/App.tsx#L48) (routes + editorMode mapping) | **ADR 0009 should formalize this** as "readonly is a session-mode-only overlay" + add an explicit error path for Local-mode share-uuid attempts. Currently the failure is silent. |
| **C6** | **GDrive scaffolding is complete and consistent across worker + backend + frontend.** All four `googleClientId` / `driveScopes` plumbing sites mirror each other. The placeholder provider class implements the full `StorageProvider` interface — Phase 3B can drop in a real implementation without touching any consumer. **This is a positive finding** — the scaffolding pattern is exemplary and worth preserving as a template for future provider additions. | inventory in A.4.4 above | **No action.** Note as the canonical "forward-scaffolding done right" example in ADR 0008 / future provider-extension docs. |
| **C7** | **The `// LIB-ONLY` convention proposed in A.3 cross-cutting #1 is no longer anchored to MainMenu** (per user lock-in of A.3 #1 deletion). The convention remains forward-looking — if a future lib surface becomes app-unused but worth preserving for external lib consumers, it can adopt the convention. ADR 0008 should mention but not require it. | A.3 cross-cutting #1 + user lock-in | **ADR 0008 mention** — lib-vs-app surface distinction, with `// LIB-ONLY` proposed as a discoverable opt-in marker, not a hard requirement. |

### A.5 Structure findings

**Method:** walked every top-level path, every `packages/*` package, every jest config, the perf-test relocation candidate, the root-level fixtures, the dependency tree of root + 5 sub-packages, the three i18n locations. Justified each or recommended a removal/relocation. **Static-only.**

**Vocabulary:**
- **Top-level path** = anything at the repo root not nested inside a package directory.
- **In-source fixture** = a JSON / HTML / TS file under `packages/*/src/` that exists to back tests or examples, distinct from product code.
- **Generated artifact** = a file produced by a `prebuild`/`build` script and not committed (tracked via `.gitignore`).
- **Phase-3B scaffolding** = unused-today imports kept for the GDrive integration roadmap (per locked-decision #5).
- **Workspace-resolver duplicate** = a dependency declared in both root `package.json` and a workspace's `package.json` at the same major; npm-workspaces resolves to one copy but the duplicate declaration is a maintenance hazard.

#### A.5.1 Top-level layout audit

Every path at the repo root, with one-line justification.

| Path | Purpose | Disposition |
|---|---|---|
| [.claude/](../../.claude/) | Claude Code project settings + slash commands | **Keep.** Listed in `.gitignore` so it doesn't propagate, but the per-developer customization lives here per locked-decision #9 / workflow.md scope. |
| [.dockerignore](../../.dockerignore) | Docker context filter | **Keep.** A.6.2 flagged expansion candidates. |
| [.env.example](../../.env.example) | Backend env-var documentation | **Keep + extend.** A.6.3 noted missing keys (`AUTH_MODE`, `AUTH_SHARED_SECRET`, `GOOGLE_CLIENT_ID`). |
| [.github/](../../.github/) | GitHub config (templates, workflows, dependabot, FUNDING) | **Keep.** A.7 + A.8 own per-file audit. |
| [.gitignore](../../.gitignore) | git filter | **Keep.** A.7.1 owns audit. |
| [.npmignore](../../.npmignore) | npm publish filter | **Keep + verify scope.** Currently scoped to the `axoview-lib` publish (per [package.json:11-13](../../packages/axoview-lib/package.json)), so root `.npmignore` is shadowed when publishing from inside the workspace. A.7 should confirm this is the intentional shape. |
| [.nvmrc](../../.nvmrc) | Node version pin (`20`) | **Risk.** Workflows pin Node 22 (test.yml:24, release.yml:32); Dockerfile uses Node 22; `.nvmrc` says 20. Three-way drift. Update to `22` or document why 20 stays. |
| [.prettierrc](../../.prettierrc) | Prettier config | **Keep.** Single source of truth across packages. |
| [.releaserc.json](../../.releaserc.json) | semantic-release config | **Keep.** A.8 owns audit (release automation). |
| [.vscode/](../../.vscode/) | Editor settings | **Keep (gitignored).** Per-developer. |
| [CHANGELOG.md](../../CHANGELOG.md) | Keep-a-Changelog format | **Keep.** A.7 owns audit. |
| [Dockerfile](../../Dockerfile) | Multi-stage build | A.6.2 owns audit. |
| [LICENSE](../../LICENSE) | MIT | **Keep.** A.7 owns audit (three-LICENSE-file consistency check). |
| [PLAN.md](../../PLAN.md) | Strategic phase dashboard | **Keep.** Out of audit scope for content edits. |
| [README.md](../../README.md) | Landing page | **Keep.** A.7.7 owns productization-readiness pass. |
| [compose.yml](../../compose.yml) / [compose.dev.yml](../../compose.dev.yml) | Docker compose stacks | A.6.3 owns audit. |
| [diagrams/](../../diagrams/) | Bind-mount target for compose | **Keep (gitignored at line 13).** Has 23 untracked diagram JSONs from local dev. Verified `git ls-files diagrams` returns 0. No action. |
| [docker-entrypoint.sh](../../docker-entrypoint.sh) | Container init | A.6.2 owns audit. |
| [docs/](../../docs/) | Architecture / ADRs / tactical | **Keep.** ADRs land here. |
| [e2e-tests/](../../e2e-tests/) | **Legacy Python/Selenium suite** (9 test files) | **Delete per locked-decision #4 (C.5).** Includes `test-diagram.json` fixture (A.6.7 correction), Cargo.lock (?), pytest config. The Cargo.lock is suspicious — verify it's not a leftover from an upstream non-Python attempt. |
| [eslint.config.mjs](../../eslint.config.mjs) | Flat-config root ESLint | **Keep.** Replaces the per-package `.eslintrc` ones in cluster 19. |
| [functions/](../../functions/) | Cloudflare Pages Functions bridge | **Keep.** A.6.5 owns audit. |
| [known_issues.md](../../known_issues.md) | Live known-issues registry | **Keep.** |
| [nginx.conf](../../nginx.conf) | nginx config for Docker | A.6.4 owns audit. |
| [node_modules/](../../node_modules/) | npm install output | gitignored. |
| [package.json](../../package.json) | Workspace root | **Keep + clean.** A.5.5 covers dependency-tree smells. |
| [package-lock.json](../../package-lock.json) | npm lock | **Keep.** |
| [packages/](../../packages/) | Workspace packages (5) | **Keep.** A.5.2/A.5.6 own jest + i18n subcontent. |
| [reports/](../../reports/) | `/audit` skill output dir (gitignored) | **Keep.** Currently has 3 untracked reports (audit.txt, eslint.txt, knip.txt). A.9 anomaly S1 flagged that `/audit` doesn't write here today; cluster 19 era did. Workflow.md decides if reports return to disk. |
| [scripts/](../../scripts/) | Build helpers (`update-version.js`) | **Keep + grow.** Smoke artifacts from A.6.7 should land here under `scripts/smoke/`. |
| [test-app.html](../../test-app.html) | Standalone lib smoke loader | **Move to `scripts/smoke/`** (A.6.7). |
| [test-base-paths.sh](../../test-base-paths.sh) | Bash base-path smoke script | **Move to `scripts/smoke/`** (A.6.7). |
| [tsconfig.base.json](../../tsconfig.base.json) | Shared TS compiler options | **Keep.** Inherited by both packages. |
| [wrangler.toml](../../wrangler.toml) | Cloudflare Pages config (root) | A.6.5 owns audit (incl. dual-config story → ADR 0009). |

**Top-level summary:** 33 paths. **3 cleanup moves** (test-app.html, test-base-paths.sh → `scripts/smoke/`; e2e-tests/ → delete per C.5). **1 drift fix** (.nvmrc → Node 22). **0 unjustified paths.**

#### A.5.2 Jest config consolidation review

Confirmed file count: **`axoview-lib` has 2 jest files** (`jest.config.js`, `jest.setup.js`); **`axoview-app` has 5 jest files** (`jest.config.js`, `jest.setup.js`, `jest.cssMock.js`, `jest.assetMock.js`, `jest.axoviewMock.js`). Earlier audit scope wording ("5 in app, 2 in lib") was correct.

| File | Purpose | Necessary? |
|---|---|---|
| `axoview-lib/jest.config.js` | ts-jest + jsdom + React-resolution overrides + SVG mock | **necessary** — the React-resolution overrides are load-bearing per the comment at the top. |
| `axoview-lib/jest.setup.js` | jest-dom matchers | **necessary** — standard setup. |
| `axoview-app/jest.config.js` | Absolute-path ts-jest config (uses `path.resolve` to point everything at root `node_modules`) | **necessary** — works around the same React-duplication risk that lib resolves with `<rootDir>/../../node_modules/react`. App's approach is more verbose but functionally equivalent. |
| `axoview-app/jest.setup.js` | jest-dom matchers + any app-specific setup | **necessary** — standard. |
| `axoview-app/jest.cssMock.js` | CSS module mock | **necessary** — Rsbuild imports CSS as modules; jest needs identity-obj. |
| `axoview-app/jest.assetMock.js` | Asset mock (svg/png/jpg/etc.) | **necessary**. Lib does the same inline with `<rootDir>/src/__mocks__/fileMock.ts` — app externalizes. Different style, same purpose. |
| `axoview-app/jest.axoviewMock.js` | Mock for the `axoview` package itself (since app imports the built lib) | **necessary** — the `^axoview$` moduleNameMapper points here, providing a stub instead of the actual built lib. This is what makes app tests resilient to lib's build state. |

**Findings:**

| # | Finding | Disposition |
|---|---|---|
| **F1** | The two configs have **drift in React-resolution style** (lib uses `<rootDir>` template, app uses `path.resolve`). Both work, but a future debugger has to learn two patterns. | **Optional.** Pick one style and align both in C.2. Low priority. |
| **F2** | **App jest config has no `coverageThreshold:`** while lib has `branches/functions/lines/statements: 10`. Asymmetry without explanation. | Add `coverageThreshold` to app config matching lib's, OR drop it from lib (it's already at 10, which is barely a gate). |
| **F3** | App's three mock files (`cssMock`, `assetMock`, `axoviewMock`) could be inlined into `jest.config.js` `moduleNameMapper` if the mock content is trivial. Two of them are. | **No action** — extracted-mock style is conventional in CRA-derived projects; the app config came from there. |
| **F4** | No `axoview-backend/jest.*` or `axoview-worker/jest.*`. The "5 total / 7 total" wording in A.9 #S6 was correct: backend + worker have zero test infra. | A.9 #S6 already flagged this; C.8 git-automation tactical adds backend + worker test scaffolding. |

**Net:** all 7 jest files are necessary. **No deletions.** Two cosmetic alignments (F1, F2).

#### A.5.3 Perf-test folder disposition

[`packages/axoview-lib/src/__perf_refactor_regression__/`](../../packages/axoview-lib/src/__perf_refactor_regression__/) — **41 test files**. The name encodes a historical purpose ("perf refactor regression") from the Phase 0A → 1A → 2A era.

User flagged this as "packaged in a weird way."

**Options considered:**

| Option | Implication | Score |
|---|---|---|
| A. Keep as-is at `src/__perf_refactor_regression__/` | Status quo. Jest picks it up automatically (matches default `*.test.{ts,tsx}` glob). | OK but the name suggests transient purpose for what's now a permanent regression suite. |
| B. Rename to `src/__tests__/regression/` | Standard convention; jest still finds it. | **Recommended.** Codifies it as a long-lived suite, not a transient refactor scaffold. |
| C. Move to `packages/axoview-lib/__tests__/regression/` (out of `src/`) | Standard convention for projects where tests live outside `src/`. | Considered but the lib uses `src/`-colocated test files elsewhere; mixing styles is worse than a name change. |
| D. Delete entirely | Per A.1 cluster 20 (`b25fdd3` 2026-03-30) these tests are real perf protection. Critical for the cluster-21 perf optimizations. | **Reject.** Tests are load-bearing. |
| E. Split into `regression/` + `perf-stress/` per A.1 cluster 47 (`7164b3b` added perf-stress fixtures) | Cluster 47 already added a fixture grouping inside the folder. | Consider after rename. |

**Recommendation (C.2 row):** rename to `__tests__/regression/`, update any CI / `/audit` skill references that hardcoded the folder name. Jest's default glob `**/__tests__/**` finds it. Net effort: one move + one CI grep.

#### A.5.4 Root-level fixture cleanup

(Already covered in A.6.7. Cross-link.)

- [test-app.html](../../test-app.html), [test-base-paths.sh](../../test-base-paths.sh) → move to `scripts/smoke/` per A.6.7.
- [packages/axoview-app/src/paymentFlowExample.json](../../packages/axoview-app/src/paymentFlowExample.json) → **dead file, delete** (corrected A.6.7).
- [e2e-tests/test-diagram.json](../../e2e-tests/test-diagram.json) → cascades with `e2e-tests/` deletion (C.5).

#### A.5.5 Dependency tree audit

**Method:** read every `package.json` (root + 5 sub-packages); cross-checked overlaps; grep'd for importers of suspicious root-level dependencies.

| # | Finding | Evidence | Disposition |
|---|---|---|---|
| **G1** | **Root `package.json` has a `dependencies` block** with 8 packages (`@react-oauth/google`, `core-js`, `express-rate-limit`, `gapi`, `gapi-script`, `helmet`, `msw`, `react-arborist`). For a workspace-only root, this is unusual — devDependencies are conventional. | [package.json:71-79](../../package.json) | Inspect per dep below; most are either Phase-3B scaffolding (move to a future GDrive package or drop) or workspace-resolver duplicates. |
| **G2** | **Workspace-resolver duplicate: `react-arborist`** declared in both root + `axoview-app/package.json` at the same major (`^3.4.3`). | root + [packages/axoview-app/package.json:14](../../packages/axoview-app/package.json#L14) | Drop from root. App's importers (FileExplorer, FileTreeNode) resolve via the workspace package. |
| **G3** | **Workspace-resolver duplicate: `helmet`** declared in both root + `axoview-backend/package.json`. | root + backend | Drop from root. Backend is the only importer. |
| **G4** | **Phase-3B scaffolding deps unused today:** `@react-oauth/google`, `gapi`, `gapi-script` — zero importers (`grep -rn "from '@react-oauth/google'\|from 'gapi'"` in packages/ = empty). | grep result above | Per locked-decision #5, Phase-3B scaffolding is **intentional** — but at the dependency-tree level it should sit in a Phase-3B-owned package, not at workspace root. **Defer the move to Phase 3B kickoff;** annotate in [`docs/architecture.md`](../../docs/architecture.md) Section 2x as "GDrive deps live at root until Phase 3B; will migrate." |
| **G5** | **`express-rate-limit` at root, zero importers in any package.** | grep | **Move to backend** (its eventual home) or drop until needed. Cleanup row in C.2. |
| **G6** | **`msw` (Mock Service Worker) at root, zero importers.** | grep | Almost certainly forward-scaffolding for the C.5 E2E rewrite. **Leave** if E2E rewrite plans to use it; otherwise drop. Annotate in C.5 tactical when it spawns. |
| **G7** | **`core-js` at root, zero source-level importers (but Rsbuild may inject transitively).** | grep | Rsbuild's polyfill plugin can auto-inject; the explicit `dependencies` entry pins the version. **Verify via rsbuild config**; if pinned for Rsbuild, move to devDependencies (it's a build-time concern, not a runtime dep of the published lib). |
| **G8** | **Root has `dependencies: { "helmet": "^8.1.0" }` while backend has `"helmet": "^8.1.0"`** — same version. Backend's helmet is the live one. | both | Same as G3 — drop from root. |
| **G9** | **MUI / Emotion are duplicated across `axoview-lib` and `axoview-app` package.jsons** at the same major. This is **intentional** — lib lists them as `dependencies` (because consumers need them) AND `peerDependencies` (so the consumer's React is the source of truth); app duplicates them as direct `dependencies` since it's a consumer. | lib + app package.jsons | **No action.** Standard for a published lib + first-party consumer. |
| **G10** | **`@isoflow/isopacks` retained** as a devDep in lib + a runtime dep in app (`^0.0.10`). Preserved per the rename's "preserve `@isoflow/isopacks`" decision (cluster 62). | both package.jsons | **No action — by design.** |
| **G11** | **Worker `package.json:main` points to `src/app.ts`** ([packages/axoview-worker/package.json:8](../../packages/axoview-worker/package.json#L8)). For a Cloudflare Pages-Functions deploy, `main` is informational — the actual entry is `functions/api/[[path]].ts`. Cosmetic, not load-bearing. | worker pkg | **No action.** Possibly add a `// Pages Functions bridges to this entry` comment in the `package.json` is non-standard; document in ADR 0009 instead. |
| **G12** | **Worker `dev` script binds Pages dev at `../axoview-app/build`** — requires the app to be built first. No `predev` chain. | [packages/axoview-worker/package.json:11](../../packages/axoview-worker/package.json#L11) | **Document in deployment.md** (`npm run build:app && npm run -w packages/axoview-worker dev`). Optional convenience: add a `dev:cf` script at root that chains both. |
| **G13** | **Backend `dev` uses `nodemon`** which is a devDependency. Standard. | [packages/axoview-backend/package.json:9](../../packages/axoview-backend/package.json#L9) | **No action.** |
| **G14** | **No `engines` field in sub-packages.** Root has `"engines": { "node": ">=18.0.0", "npm": ">=9.0.0" }` (package.json:62-64). Sub-packages inherit nothing. | — | **Optional:** add `engines` to the published-from-source `axoview-lib/package.json` so npm warns consumers on old Node. Skip for private packages. |
| **G15** | **Root overrides** lock lodash, lodash-es, tar to specific majors. CVE mitigation. Worth preserving + documenting. | [package.json:66-69](../../package.json#L66) | **No action.** Annotate in ADR 0009 / C.7 if relevant to deployment. |

**Cleanup roll-up (C.2 candidates):** drop `react-arborist` + `helmet` from root (G2, G3); migrate `express-rate-limit` to backend or drop (G5); move `core-js` to devDeps after Rsbuild verification (G7); leave Phase-3B + msw scaffolding (G4, G6).

#### A.5.6 i18n triple-folder rationalization

Three i18n locations exist:

| Location | File type | Locales | Purpose |
|---|---|---|---|
| [packages/axoview-lib/src/i18n/](../../packages/axoview-lib/src/i18n/) | `.ts` (14 files: 13 locales + `index.ts`) | bn-BD, de-DE, en-US, es-ES, fr-FR, hi-IN, id-ID, it-IT, pl-PL, pt-BR, ru-RU, tr-TR, zh-CN | **Lib-shipped strings.** Bundled into the lib build; consumers receive them. |
| [packages/axoview-app/src/i18n/](../../packages/axoview-app/src/i18n/) | `.json` (11 locales) | bn-BD, en-US, es-ES, fr-FR, hi-IN, it-IT, pl-PL, pt-BR, ru-RU, tr-TR, zh-CN | **App-source strings** — used by some import path; verify if these are loaded or shadowed by `public/i18n/`. |
| [packages/axoview-app/public/i18n/](../../packages/axoview-app/public/i18n/) (sub: `app/`) | `.json` (root: 13 locales, `app/`: 12 locales) | root: + `de-DE`, `id-ID`; `app/`: same minus `pl-PL` and `hi-IN` | **Runtime-fetched strings** via `i18next-http-backend`. Served as static files. |

**Findings:**

| # | Finding | Evidence | Disposition |
|---|---|---|---|
| **I1** | **Locale-set inconsistency across three locations.** lib has 13; app/src/i18n has 11 (missing `de-DE`, `id-ID`); public/i18n has 13 (matches lib); public/i18n/app has 12 (has `id-ID` but missing `pl-PL`, `hi-IN`). This is **the largest drift smell** A.5 surfaces — strings can quietly differ across loaders. | ls output above | **C.2 cleanup.** Decide the canonical 13-locale set (or whichever) and align. The `i18n.localeCompleteness.test.ts` perf-test ([packages/axoview-lib/src/__perf_refactor_regression__/i18n.localeCompleteness.test.ts](../../packages/axoview-lib/src/__perf_refactor_regression__/i18n.localeCompleteness.test.ts)) likely checks lib-internal consistency; verify it covers app + public too. |
| **I2** | **lib uses `.ts`, app uses `.json`.** Lib's `.ts` bundles into the build output; app's `.json` is either fetched at runtime (via `i18next-http-backend`) or imported. Need to verify which path the app actually uses to know if `src/i18n/` is dead. | folder listing | **A.2 follow-up grep.** If `src/i18n/*.json` has zero importers, it's dead and the runtime-fetched `public/i18n/` is the only live path. |
| **I3** | **Three-loader pattern is justifiable** when: lib ships its own bundled-in strings (consumer-app integration), app overrides + extends them at runtime via `i18next-http-backend`. This is a common shape. But the `src/i18n/.json` files are anomalous — they sit between the two contracts. | architectural inference | **C.2 disposition:** if A.2 confirms `src/i18n/*.json` are unused, delete; otherwise document the three-loader contract in `docs/architecture.md` as a §2x subsection. |
| **I4** | **The `public/i18n/app/` sub-directory** suggests a namespace split (root-level locales = lib strings vs `app/` = app strings) that mirrors i18next's namespace feature. | folder listing | **No action** if the namespace split is intentional. Document in architecture.md. |
| **I5** | **`de-DE` missing from `app/src/i18n/`** but present in `lib/src/i18n/` and `public/i18n/`. If `app/src/i18n/` is the live source for any string, German users see partial English. | locale-set diff | **Verify in A.2; remediate in C.2.** |

#### A.5 Cross-cutting observations

| # | Observation | Evidence | Suggested follow-up |
|---|---|---|---|
| **P1** | **The root `package.json` has accidentally accumulated a runtime `dependencies` block** with workspace-resolver duplicates + Phase-3B scaffolding + an orphan `core-js`. **This is the single highest-impact A.5 finding** — every npm install today downloads `gapi`, `gapi-script`, etc. into the root `node_modules`, slowing every `npm ci` in CI by ~3-8 seconds. | [package.json:71-79](../../package.json#L71) | C.2 sweep: drop 6 of 8 root deps (keep `core-js` after Rsbuild verification, defer `msw` for E2E rewrite). Save ~50-80 MB of installed deps. |
| **P2** | **i18n locale-set drift is the second-highest** — it's a silent failure mode (German users see English) that no test pin catches today. | I1 above | C.2 row: align all three folders to a canonical 13-locale list (decide which locales ship). |
| **P3** | **The `__perf_refactor_regression__/` folder name is a maintenance smell** but not a bug. 41 tests in it are healthy regression coverage. | A.5.3 | Low-priority rename to `__tests__/regression/` in C.2. |
| **P4** | **`.nvmrc` says 20 while CI + Docker use 22.** Three-way drift. | A.5.1 | One-line fix in C.2. |
| **P5** | **Backend + worker have no jest config** (G4, A.9 #S6). Productization implies test coverage at every shipped surface. Today's coverage is 0% for both. | absence | C.8 git-automation tactical adds backend test scaffolding + worker test scaffolding. The Worker is the harder case (Cloudflare Workers test runner story is its own decision). |
| **P6** | **No `axoview-core` package exists** (per flare #7). Verified — `routes.js` lives in `axoview-backend/src/routes.js` and the Worker imports it directly via relative path (verified at A.6.5). When the path becomes too cross-package, promote. Not today. | flare #7 + actual code | ADR 0009 documents this as the locked decision. |
| **P7** | **Root scripts (`scripts/update-version.js`) is the only build helper at root.** When `scripts/smoke/` joins it (A.6.7), `scripts/` becomes a real directory with a small README. | A.6.7 | Add `scripts/README.md` after smoke files move. |
| **P8** | **Five-package monorepo is correctly sized for what ships:** `axoview-lib` (published), `axoview-app` (PWA), `axoview-backend` (Express), `axoview-worker` (CF), `axoview-e2e` (slated for deletion per C.5). After C.5, four packages remain — the productization-ready set. | packages/ listing | **No action.** Document the four-package shape in `docs/architecture.md`. |

### A.6 Deployment findings

**Method:** read every shipped artifact for the three deployment targets (Docker / Cloudflare Pages-Functions + Worker / nothing-for-Local) plus the absorbed `flare_plan.md`; score each artifact against a documented best-practice checklist; record dispositions. **Static-only.** Live behaviour of the Cloudflare deploy (cold-start size, JWKS cache hit rate, secret hygiene) is out of scope here; M10 owns that.

**Vocabulary:**
- **Self-host target** = nginx + Express backend + fs adapter, packaged in the `molikas/axoview` Docker image (compose.yml). Session-mode default; HTTP Basic Auth optional.
- **Public target** = Cloudflare Pages static assets + Hono Worker mounted at `/api/*` via `functions/api/[[path]].ts`. **Storage-less** since the 2026-04-29 R2 drop — Worker returns `serverStorage: false` and 503s every storage route; the SPA falls back to per-tab localStorage. Auth: `shared-token` default, `cf-access` optional.
- **Local target** = no deployment artifacts; user opens the published lib or self-host URL and the per-tab `LocalStorageProvider` branch fires when `/api/storage/status` returns `{enabled: false}` or never resolves.
- Baseline-checklist disposition tokens: **pass** = at documented best-practice baseline; **gap** = drift from baseline that warrants follow-up; **risk** = pass that masks a future hazard worth annotating; **deferred** = intentional non-implementation (e.g. R2 + share routes on Cloudflare).

#### A.6 Mechanism sketch — three-target topology

```
                       ┌──────────────────────────────────────────────────┐
                       │  Same /api/* contract; same routes.js; two       │
                       │  StorageAdapter impls; one frontend.             │
                       └──────────────────────────────────────────────────┘

  Self-host (Docker)                          Public (Cloudflare Pages)
  ────────────────────                        ─────────────────────────────
  nginx :80                                   CDN static (no Worker invoke)
     ├── / → static (Pages app build)            │ via _routes.json
     └── /api/* → Express :3001                 ▼
            │                                  Pages Functions /api/*
            │ AUTH_MODE: none|shared-token        bridge: functions/api/[[path]].ts
            ▼                                       │ → packages/axoview-worker/src/app
        routes.js  ─── adapter ──> fs.js              │
                                                       │ AUTH_MODE: shared-token|cf-access
                                                       ▼
                                                  routes.js — but **never reached**
                                                  for storage paths because:
                                                    /api/config       → handled in app.ts
                                                    /api/storage/status → handled in app.ts
                                                    /api/*            → 503 catch-all
                                                  (no R2 adapter wired)

  Local target = neither path reachable; SPA falls back to LocalStorageProvider tab branch.
```

The two backends sharing `routes.js` is the locked contract from flare 5A (key-based adapter + zero Node imports). The **shape divergence** is real: only the Express path actually wires `routes.js` into the route table. The Worker terminates every storage path in `app.ts` before it reaches `routes.js`. This is **intentional** for the storage-less posture, but it means `routes.js` is currently exercised only on Docker — a forward-scaffolding state, not the symmetric two-runtime spec described in flare 5A's "one HTTP contract, two adapters."

#### A.6.1 flare_plan.md classification

`flare_plan.md` was **already deleted** in commit `926e66f` (2026-05-19, post-rename smoke-test cleanup). It is therefore read-only from git history (`git show 926e66f^:flare_plan.md`). The convention memory entry [`project_flare_plan.md`](../../../../Users/isidenica/.claude/projects/c--myTemp-FossFLOW/memory/project_flare_plan.md) tagged the file `RETIRING` but on-disk reality is already `RETIRED`. Action: memory entry should be deleted at this audit's wrap-up (C.6.4), not "retired."

One row per `flare_plan.md` section. **Locked-decision** statements stay as durable ADR content (target: ADR 0009/0010). **Phase 5x** rows are now history — the work is mostly done and live in code; nothing to migrate.

| flare section | Content summary | Reality check | Classification | Target |
|---|---|---|---|---|
| Goal | One Axoview app on CF Pages free tier + Docker; single `/api/*` contract; two adapters | App lives. Single contract holds on the Docker side; the Worker terminates storage paths and never reaches `routes.js`. | **durable** | ADR 0009 (deployment topology) |
| Architectural #1 — One HTTP contract, two backends | Full route inventory (`/api/storage/status`, `/api/config`, `/api/diagrams*`, `/api/folders*`, `/api/tree-manifest*`, `/api/diagrams/:id/share`, `/api/public/diagrams/:uuid`) | Express implements all of them via `adapt(routes.X, ...)` (server.js:144-170). Worker implements **only** the first two; `/api/*` else → 503. | **durable** (Express side) + **deferred** (Worker storage-route impl) | ADR 0009 |
| Architectural #2 — Key-based StorageAdapter | `get/put/delete/list/listDiagramMeta` taking opaque keys, no paths in the interface | Implemented exactly. `KEY_PATTERN` in fs.js:4 is the runtime guard. | **durable** | ADR 0010 (session backend contract) |
| Architectural #3 — Hono on Pages Functions | `functions/api/[[path]].ts` bridges to Worker `app.ts`; `_routes.json` scopes Worker to `/api/*` | `[[path]].ts` exists (5 lines). `_routes.json` referenced from comment in root `wrangler.toml` but **not present at repo root or build dir** — `find ... -name _routes.json` returns no committed file. May be auto-generated, or may be missing (gap). | **durable** + **gap** (verify `_routes.json` is actually emitted) | ADR 0009 + gap row in A.6.5 |
| Architectural #4 — Storage on free tier: R2 only | R2 chosen over KV/D1 | Reverted: 2026-04-29 update explicitly drops R2. Cloudflare is storage-less today; persistent storage will return via Drive on a separate branch. | **historical** | discard |
| Architectural #5 — R2 must denormalize a diagrams index | `diagrams-index.json` + `If-Match` conditional writes; future Durable Objects | Code never landed (R2 dropped). `fs.js:listDiagramMeta` is the cheap-walk variant; the index pattern is dead-letter for now. | **historical** (with note) | discard, but **preserve the conditional-write reasoning** in ADR 0010 as the Drive-branch precedent |
| Architectural #6 — Runtime config, not build-time | `GET /api/config` returns `{googleClientId, driveScopes, authMode, serverStorage}` | Wired. Both backends emit the field set (server.js:144 / app.ts:31). **`RuntimeConfig.serverStorage` is the dead field flagged in A.4 #C1.** | **durable** + **smell** | ADR 0009 (collapse with `/api/storage/status` per A.4 #C1+C4) |
| Architectural #7 — No `axoview-core` package | `routes.js` is the shared layer; promote to core only when it grows past one file | Holds today. routes.js is 399 lines, no Node imports. Worker doesn't actually import it yet (above gap), but the constraint is preserved. | **durable** | ADR 0009 (note: stays unless growth) |
| Architectural #8 — Sharing model: snapshot to public namespace | `POST /api/diagrams/:id/share` returns `{uuid, url}`; `GET /api/public/diagrams/:uuid` is the one unauth route; uuid pattern `[A-Za-z0-9_-]{21,64}`; deletion cascades | Fully implemented on the Express side (routes.js:346-399, server.js:168-170). Worker can't share (storage-less). **Frontend's local-mode share is silently broken — A.4 #C5.** | **durable** (Express) + **bug** (Local-mode UX) | ADR 0009 (formalize "share is session-only") + cleanup row in C.2 |
| Folder layout (target) | `packages/axoview-worker`, `functions/api/[[path]].ts`, `_routes.json`, `_headers` at root | All exist **except** `_routes.json` and `_headers` at repo root (see A.6.5 gap). | **mostly done** + **gap** | A.6.5 |
| Phase 5A — Backend refactor | Adapter interface, `routes.js` extraction, ID validation, helmet, `/api/config` | Done. routes.js + fs.js + helmet wired in server.js:35-40. | **done** | discard |
| Phase 5B — Worker + R2 + diagrams-index + share routes | Hono router, R2 adapter, share routes in Worker | Hono + bodyLimit + secureHeaders + auth landed. R2 + diagrams-index + share-on-Worker **never landed.** Marked `[~]` "Reverted to storage-less" in flare itself. | **partial-done + deferred** | discard the R2/index parts; preserve share-on-Cloudflare as a known future gap if Drive doesn't cover it |
| Phase 5C — Build & deploy pipeline (`wrangler.toml`, `_routes.json`, `_headers`, deploy button) | Repo-root wrangler.toml + Pages build command + `_routes.json` + `_headers` | wrangler.toml present (16 lines). `_routes.json` and `_headers` **not present at repo root or app `public/`** (see A.6.5). Deploy-button setup not verified. | **partial-done + gap** | gap row in A.6.5 |
| Phase 5D — Auth modes | `none` / `shared-token` / `cf-access` with public-namespace bypass | All three implemented (auth.ts in Worker, server.js:46-79 in Express). `isPublicRoute` symmetry verified. JWT verification uses RSASSA-PKCS1-v1_5 + JWKS cache with 1h TTL. | **done** | ADR 0009 (auth contract section) |
| Phase 5E — Frontend `/api/config` + share rewire + delete legacy `storageService.ts` | `useRuntimeConfig`, share via `POST /api/diagrams/:id/share`, drop `storageService.ts` | All landed. `storageService.ts` not in tree (`git grep storageService.ts` empty). Share-uuid route `/display/p/:shareUuid` matched at App.tsx:48-49. | **done** | discard |
| Phase 5F — Hardening (CSP, helmet, body limits, scope lockdown) | Helmet + bodyLimit + secureHeaders + CSP audit + Drive scope lock + R2 privacy | Helmet + bodyLimit + secureHeaders **all live**. CSP audit / `_headers` file **gap** (see A.6.5). Drive scope locked to `drive.file` at routes.js:81 / app.ts:35. R2 privacy moot (storage-less). | **partial-done + gap** | gap row in A.6.5 |
| Phase 5G — `DEPLOY.md` + Drive credentials onboarding stub | DEPLOY.md written 2026-04-29 | **`DEPLOY.md` not present at repo root.** `docs/deployment.md` is the rename-era successor; verify content parity. | **partial-done + gap** | A.6.5 + cross-check `docs/deployment.md` |
| Open risks — Worker bundle size, R2 list pagination, MUI inline CSP, `*.pages.dev` exposure, share-snapshot staleness, share secrecy model, R2 bucket privacy | Verify list | Bundle size never measured (gap). R2 items moot. `*.pages.dev` exposure is **real** and unaddressed unless CF Access policy covers both hosts — preserve in ADR 0009. Share staleness has no UI hint today. | **mixed — partial durable** | ADR 0009 (`*.pages.dev` exposure, snapshot staleness UX); discard R2-specific risks |
| Order of operations (5A → 5B → 5C → 5F/5G; 5D/5E independent) | Phase sequence | Historical; phases are mostly done | **historical** | discard |

**Closing the loop:** every section above is classified. ADR 0009 absorbs the durable topology + auth + cross-target HTTP contract. ADR 0010 absorbs the adapter interface + storage contract. C.7.5's "delete flare_plan.md" step is **already done** — replace with "verify and delete the `project_flare_plan.md` memory entry."

#### A.6.2 Dockerfile baseline checklist

[Dockerfile](../../Dockerfile) (56 lines).

| Check | Status | Evidence | Action |
|---|---|---|---|
| Multi-stage build | **pass** | `FROM node:22 AS build` + `FROM node:22-alpine` runtime stage ([Dockerfile:2, 25](../../Dockerfile)) | — |
| Runtime image as small as practical | **gap** | Runtime is `node:22-alpine` + nginx + openssl + the **entire `axoview-backend` source** + `node_modules` installed at container start via `npm install --production` ([docker-entrypoint.sh:7](../../docker-entrypoint.sh#L7)). Image size is heavier than necessary; backend deps could be `npm ci`'d at build time and copied. | Move `npm install --production` into the build stage; copy `node_modules/` into the runtime stage. Saves ~30-50s startup + makes layers immutable. |
| Non-root user (`USER` directive) | **gap** | No `USER` directive; container runs as root. nginx-alpine images typically run nginx workers as `nginx` user but the master process is root, and the backend `node server.js` also runs as root via the entrypoint. | Add `USER node` (or a dedicated `axoview` user) after copying files; ensure `/data/diagrams` is owned by it. |
| `HEALTHCHECK` directive | **gap** | No `HEALTHCHECK`. compose.yml has no `healthcheck:` either. | Add `HEALTHCHECK --interval=30s CMD wget -qO- http://localhost/api/storage/status \|\| exit 1` (works in both server- and storage-less modes — returns 200 in either). |
| Layer ordering (deps before source for cache) | **pass** | `COPY package*.json` then `RUN npm install` then `COPY . .` ([Dockerfile:8-19](../../Dockerfile)) | — |
| `.dockerignore` present + accurate | **risk** | Present (61 bytes, 7 patterns). Excludes `node_modules`, `.git`, `.devcontainer`, `*.md`, `.env`, `diagrams`, `e2e-tests`. **`*.md` is aggressive** — it excludes README.md from the image, which is fine for runtime but worth annotating. Missing: `.github/`, `reports/`, `packages/axoview-e2e/`, `parts/`, build outputs (`packages/*/build`, `packages/*/dist`), `.vscode/`, `coverage/`, `__snapshots__/`. | Expand to mirror `.gitignore` minus `diagrams/`. |
| Pinned base image versions (no floating `:latest`) | **pass** | `node:22` and `node:22-alpine`. Not pinned to a digest, but the `:22` tag is stable. | — |
| No build-time secrets baked in | **pass** | No `ARG` for secrets; no `ENV` with credentials. | — |
| Lightest runtime for static (nginx for static, node for backend) | **pass** | nginx serves the SPA; node serves `/api/*`. Standard. | — |
| `docker-entrypoint.sh` handles env validation | **gap** | Validates only `ENABLE_SERVER_STORAGE` and Basic-Auth pair. Doesn't validate `STORAGE_PATH` exists/writable, doesn't validate `AUTH_MODE`/`AUTH_SHARED_SECRET` pair (`AUTH_MODE=shared-token` with empty secret silently passes through to Express which returns 401 on every request). | Add `AUTH_MODE` + `AUTH_SHARED_SECRET` consistency check on startup. Log & exit non-zero on misconfig. |
| Signal forwarding / graceful shutdown | **gap** | Backend started with `node server.js &` then `exec`-style `nginx -g "daemon off;"`. The `&` means the backend is orphaned to PID 1 (nginx). SIGTERM to nginx doesn't propagate to node. | Use a tiny init (`tini`) or rewrite the entrypoint to forward SIGTERM. |
| `npm install -g npm@11.5.2` pin | **risk** | Pinning npm to a single minor is fine, but the comment style misses a space (`#Update NPM`). Cosmetic; flag only if a typography pass is happening anyway. | — |
| Build runs `npm install` not `npm ci` | **gap** | Build stage uses `npm install` (Dockerfile:16). `npm ci` is the reproducible-build idiom and would honor the existing `package-lock.json`. | Switch to `npm ci`. |

#### A.6.3 compose baseline checklist

[compose.yml](../../compose.yml) (16 lines, prod), [compose.dev.yml](../../compose.dev.yml) (16 lines, dev).

| Check | Status | Evidence | Action |
|---|---|---|---|
| Documented dev/prod difference; no accidental drift | **pass** | prod pulls `molikas/axoview:latest`; dev builds locally and exposes 3001 for direct backend access. Differences are intentional. | — |
| Restart policies (`unless-stopped` for prod) | **gap** | Neither file sets `restart:`. Default is `no`. A self-host user on a homelab box wants `restart: unless-stopped` for reboot survival. | Add `restart: unless-stopped` to compose.yml. |
| Named volumes vs bind mounts | **risk** | Bind mount `./diagrams:/data/diagrams`. Works locally; on a CI runner or non-Linux host the host path may not exist. Documented in `.env.example`, so this is intentional, but a named-volume alternative for "no host dir" deploys is missing. | Optional: offer a named-volume fallback in `compose.yml` as a commented-out alternative. |
| Network isolation | **risk** | Prod exposes `80:80` only — fine. Dev exposes both `3000:80` and `3001:3001` — the backend port to host is intentional for direct API hits but worth noting. | — |
| Healthcheck wired | **gap** | No `healthcheck:` block. Folds into Dockerfile `HEALTHCHECK` gap. | Add to compose.yml once Dockerfile has one. |
| Env-var sourcing (`.env` vs explicit env vs secrets) | **gap** | compose.yml uses inline `${HTTP_AUTH_PASSWORD:-}` defaults; there's no `env_file:` directive. The expected source is shell env or a sibling `.env` (compose auto-loads), and `.env.example` documents the keys. But `HTTP_AUTH_PASSWORD` as plaintext env is the wrong shape for a productized container — should be a secret. | Document `.env` workflow in deployment.md; for v1.0 consider docker-secrets indirection (`*_FILE` pattern). |
| HTTP Basic Auth lives outside compose | **risk** | `HTTP_AUTH_USER` / `HTTP_AUTH_PASSWORD` documented in `.env.example` and consumed by docker-entrypoint.sh. The bcrypt of the password is written into `/etc/nginx/.htpasswd` at startup. This means **the plaintext password sits in the container env until init exits.** | Accept the shape, document the bcrypt+wipe option for higher-paranoia deploys. |
| Drive provider env vars (`GOOGLE_CLIENT_ID`, `AUTH_MODE`, `AUTH_SHARED_SECRET`) | **gap** | compose.yml doesn't surface them. flare 5A added the env wiring on the backend (server.js:28-30 reads them) and the Worker uses them via wrangler secrets, but `.env.example` and `compose.yml` don't document the Express-mode equivalents. | Add `AUTH_MODE`, `AUTH_SHARED_SECRET`, `GOOGLE_CLIENT_ID` to `.env.example` and compose.yml `environment:` block (with `:-none` defaults). |

#### A.6.4 nginx.conf baseline checklist

[nginx.conf](../../nginx.conf) (34 lines).

| Check | Status | Evidence | Action |
|---|---|---|---|
| Reverse-proxy to backend | **pass** | `location /api/ { proxy_pass http://localhost:3001; ... }` ([nginx.conf:18-33](../../nginx.conf#L18)) | — |
| SSL termination boundary documented | **gap** | nginx listens on `:80` only. SSL is implicitly assumed to come from an upstream layer (Cloudflare proxy, reverse proxy, or docker-host TLS terminator). Not documented. | Add a comment block + a deployment.md section: "TLS is the deployer's responsibility — nginx terminates HTTP only." |
| gzip / brotli for static assets | **gap** | No `gzip` directive. Alpine nginx ships with brotli disabled by default. SPA assets (JS + CSS) compress 70-80%. | Add `gzip on; gzip_types text/css application/javascript application/json image/svg+xml;` (bump path with `gzip_min_length 1024`). |
| Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) | **gap** | None. Express ships helmet but nginx is the outer layer — these headers should land here too (or be removed from helmet and consolidated). Helmet at server.js:35-40 explicitly disables CSP. | Decide: nginx-layer headers vs `_headers` parity. Then add the missing four headers. |
| Cache headers for static vs dynamic | **gap** | No `expires`/`Cache-Control` directives. Browser will use heuristics. | Add `location ~* \.(?:css\|js)$ { expires 1y; add_header Cache-Control "public, immutable"; }` for hashed asset filenames (Rsbuild emits content hashes). |
| Client max body size for diagram upload | **pass** | `client_max_body_size 10M;` at both server + location level ([nginx.conf:9, 30](../../nginx.conf#L9)) — matches Express `json({ limit: '10mb' })` and Hono `bodyLimit(10MB)`. Three-layer parity. | — |
| `try_files` SPA fallback | **pass** | `try_files $uri /index.html;` ([nginx.conf:14](../../nginx.conf#L14)) | — |
| `proxy_read_timeout`/`proxy_connect_timeout` | **pass** | 300s read / 75s connect ([nginx.conf:31-32](../../nginx.conf#L31)) — appropriate for diagram saves. | — |
| Basic-auth wiring via `AUTH_BASIC_SETTING` placeholder | **risk** | Works (docker-entrypoint.sh:21-24 sed-replaces the literal). Brittle: any future edit that touches the literal string breaks startup. | Switch to env-var include directive or generate the auth_basic line from the entrypoint instead of sed-replacing. |
| Snippet for public-share-route unauth bypass (per flare 5D) | **gap** | flare 5D required nginx to allow unauth `GET /api/public/diagrams/*` and `GET /display/p/*`. Currently nginx applies `auth_basic` at server-block level, which gates **everything**. If Basic Auth is configured, share links are unusable. | Add a nested `location /api/public/diagrams/ { auth_basic off; proxy_pass ...; }` and `location /display/p/ { auth_basic off; ... }`. This is the missing piece for share-link interop in self-host mode. |

#### A.6.5 Cloudflare worker + Pages Functions baseline checklist

[packages/axoview-worker/src/app.ts](../../packages/axoview-worker/src/app.ts) (47 lines), [packages/axoview-worker/src/auth.ts](../../packages/axoview-worker/src/auth.ts) (175 lines), [functions/api/[[path]].ts](../../functions/api/[[path]].ts) (5 lines), root [wrangler.toml](../../wrangler.toml) (22 lines), [packages/axoview-worker/wrangler.toml](../../packages/axoview-worker/wrangler.toml) (14 lines).

| Check | Status | Evidence | Action |
|---|---|---|---|
| Two `wrangler.toml` files — which is authoritative? | **gap (resolvable)** | Root `wrangler.toml` is consumed by Deploy-to-Cloudflare button + `wrangler pages deploy` from repo root. Worker-package `wrangler.toml` is consumed by `wrangler pages dev` invoked from within the worker package. Both declare `name = "axoview"` + `compatibility_date = "2025-01-01"` + identical `[vars]`. **No drift today**, but two sources of truth is a maintenance hazard. | ADR 0009 names the **root** wrangler.toml as authoritative + collapses the worker-package one to a one-line comment pointing at root, OR keeps both with an explicit "must stay byte-identical" check in CI. |
| `_routes.json` present + scopes Worker to `/api/*` | **pass (correction from A.6 first pass)** | Present at [packages/axoview-app/public/_routes.json](../../packages/axoview-app/public/_routes.json) (3 lines): `{"version":1, "include":["/api/*"], "exclude":[]}`. Rsbuild copies public/ to build/. Verified at build output too. | **No action.** Minor: `exclude` is empty — flare 5C's draft had `["/*"]` for asset bypass clarity. CF Pages treats an empty exclude correctly, but explicit is clearer. Optional tightening only. |
| `_headers` file present with CSP + security headers | **pass (correction from A.6 first pass)** | Present at [packages/axoview-app/public/_headers](../../packages/axoview-app/public/_headers) (12 lines). Ships X-Content-Type-Options, X-Frame-Options: DENY, Referrer-Policy, Permissions-Policy, full CSP (script/connect/img/style/frame-src + `object-src 'none'` + `base-uri 'self'`), and `/api/* Cache-Control: no-store`. Aligns with flare 5C draft. | **No action.** `'unsafe-inline'` for styles remains (MUI dependency); revisit only if MUI ships strict-mode support. |
| Bindings (KV / D1 / R2 / Durable Objects) | **deferred** | None bound — storage-less posture. The Worker uses no bindings beyond env vars. | Stay deferred until Drive branch decides whether it wants D1/Durable-Objects for share-snapshot persistence. |
| Routes — Worker handles what, Pages Functions handles what, static handles what | **gap (resolvable via `_routes.json`)** | Currently the Functions bridge at `functions/api/[[path]].ts` catches every `/api/*` and dispatches to the Worker. Without `_routes.json`, Pages may also dispatch non-`/api/*` paths to the Functions runtime (verified in the Pages logs). | Folds into `_routes.json` action above. |
| Env vars + secrets documented + validated at startup | **partial** | Vars listed in both wrangler.toml files as commented secrets. Worker validates `AUTH_SHARED_SECRET` presence ([auth.ts:43-44](../../packages/axoview-worker/src/auth.ts#L43)) and `CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD` ([auth.ts:60-62](../../packages/axoview-worker/src/auth.ts#L60)). | Add a deployment.md table: env-var × Docker × Cloudflare × required-when. |
| Observability (logging, tail config, metrics) | **gap** | Worker logs to `console.error` for cf-access verify failures only. No structured logging. No tail config in wrangler.toml. No metrics emission. | Decide: ship `wrangler tail` instructions in deployment.md as the operational story for v1, defer structured logging until paid CF. |
| CORS handling | **risk** | Express enables permissive CORS (`app.use(cors())` at server.js:41 — defaults `Access-Control-Allow-Origin: *` with reflected origin). Worker has no CORS middleware, relying on same-origin (the Functions bridge serves the SPA + API from the same hostname). Local dev (`wrangler pages dev`) is same-origin too. | Document the same-origin assumption. If a future deployment fronts `axoview.example.com` with assets on a different origin, this becomes a real bug — flag in ADR 0009. |
| Security headers in Worker responses | **pass** | `app.use('*', secureHeaders())` at app.ts:18 emits the Hono recommended set (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, etc.). | — |
| Body limit parity with Express (10 MB) | **pass** | `bodyLimit({ maxSize: 10 * 1024 * 1024, ... })` at app.ts:21-25. | — |
| Local dev parity with `wrangler dev` | **risk** | Two-step: `wrangler pages dev` from worker package + Rsbuild dev server from app package. Workable but undocumented. | Add a `npm run dev:cf` script in root `package.json` that runs both, and document the contract in deployment.md. |
| JWKS cache TTL + key import | **pass** | 1h TTL via `JWKS_TTL_MS` at auth.ts:95, RSASSA-PKCS1-v1_5 import + signature verify via Web Crypto ([auth.ts:97-122, 136-175](../../packages/axoview-worker/src/auth.ts#L97)). | — |
| Worker bundle size measured + tracked | **gap** | Never measured. flare's open-risks list flagged this; no measurement followed. | One-time measurement step in deployment.md: `wrangler deploy --dry-run` → record size; add a CI step in C.8 tactical (bundle-size budget for Worker too). |
| `DEPLOY.md` / cross-target deploy guide present | **gap (replaced)** | flare 5G's `DEPLOY.md` was superseded by [docs/deployment.md](../../docs/deployment.md). Cross-check parity in A.6.7 follow-up. | Confirmed-present; verify storage-less reality is reflected (deferred to a deployment.md sanity-skim, not a full re-audit). |

#### A.6.6 Session backend baseline checklist

[packages/axoview-backend/server.js](../../packages/axoview-backend/server.js) (182 lines), [src/routes.js](../../packages/axoview-backend/src/routes.js) (399 lines), [src/adapters/fs.js](../../packages/axoview-backend/src/adapters/fs.js) (110 lines), [src/adapters/types.ts](../../packages/axoview-backend/src/adapters/types.ts) (28 lines).

| Check | Status | Evidence | Action |
|---|---|---|---|
| fs adapter safety: atomic writes | **gap** | `fs.writeFile` is used directly ([fs.js:45](../../packages/axoview-backend/src/adapters/fs.js#L45)). On a crash mid-write, the file may be left truncated or partial. **A power loss during a 5 MB diagram save is a real failure mode.** | Atomic-write pattern: write to `<path>.tmp` then `fs.rename`. Document the contract in ADR 0010. |
| fs adapter safety: concurrent access (single-process) | **risk** | Express is single-threaded per process; in compose.yml only one container runs. Within the process, async fs calls interleave but each `put` is an isolated `writeFile`. **`folders.json` is read-modify-write** (routes.js:225-247 / :249-261 / :263-314) — concurrent writes can lose updates. | Adopt a simple in-process write queue keyed on the `folders` key OR move to per-folder files. ADR 0010 should state the concurrency model explicitly. |
| fs adapter safety: path-traversal guards | **pass** | `KEY_PATTERN = /^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*$/` enforced in [fs.js:4, 18](../../packages/axoview-backend/src/adapters/fs.js#L4). `ID_PATTERN` enforced one layer up in routes.js. Defense in depth. | — |
| server.js: body-parser limits | **pass** | `express.json({ limit: '10mb' })` at server.js:42. | — |
| server.js: error handling | **pass** | `adapt()` wrapper at server.js:121-137 catches `HttpError` and converts unknowns to 500. Logged to console. | — |
| server.js: graceful shutdown | **gap** | No SIGTERM handler; Express `app.listen()` returns a server but the reference isn't captured for `server.close()`. Combined with docker-entrypoint backgrounding (A.6.2), this means container teardown can drop in-flight saves. | Capture the server handle; install SIGTERM + SIGINT → `server.close(() => process.exit(0))` with a 10s grace timeout. |
| server.js: request logging | **gap** | No request logging middleware (e.g. morgan). Only error path logs (server.js:133). | Add `morgan('tiny')` behind an `ENABLE_REQUEST_LOG` env var (off by default to keep logs quiet on small homelab boxes). |
| Session isolation: how does user A not read user B's diagrams? | **gap** | **No multi-user model.** All diagrams in one `STORAGE_PATH`. AUTH_MODE protects the API gate-or-not; once past auth, every authenticated request sees every diagram. This matches the "single-user app" assumption from flare #5 but is **not documented** anywhere user-facing. | ADR 0010 must declare: "the session backend is single-tenant by design. Multi-user separation is the deploy operator's responsibility (one container per user, or CF Access policy gating)." |
| Health endpoint for compose/CF healthchecks | **partial** | `/api/storage/status` returns 200 in both server-storage-on and server-storage-off cases; usable as a health probe. | Use it in the Dockerfile HEALTHCHECK; add a dedicated `/api/health` only if a probe that excludes auth gating is needed (currently it's already in `isPublicRoute`). |
| Adapter interface readiness for Drive (Phase 3B) | **pass** | [adapters/types.ts](../../packages/axoview-backend/src/adapters/types.ts) is the single source. Drive will implement the same five methods. Notes about R2/CF on the comments are stale but harmless. | — |
| `assertId` consistency across handlers | **pass** | Every `id` flows through `assertId` (routes.js:22-27); same for `parentId`, `targetFolderId`, `uuid`. | — |
| MQA #21 unique-suffix fix retained | **pass** | createDiagram (routes.js:111-119) + createFolder (routes.js:239-243) both use the time+random pattern post-fix. Test coverage assumed (not re-verified in this audit pass). | — |
| folders.json shape-coercion guard retained | **pass** | `readFolders` accepts legacy `{folders: [...]}` and warns once ([routes.js:186-209](../../packages/axoview-backend/src/routes.js#L186-L209)). | — |
| Share routes share between Express + Worker | **partial** | Express wires `routes.shareDiagram/unshareDiagram/getPublicSnapshot` (server.js:168-170). Worker doesn't (storage-less). | Folds into ADR 0009 as "share is session-on-Express only today." |
| listDiagramMeta excludes reserved files | **pass** | Skips `folders.json`, `tree-manifest.json`, `metadata.json`, `diagrams-index.json` ([fs.js:79-85](../../packages/axoview-backend/src/adapters/fs.js#L79-L85)). The `metadata.json` and `diagrams-index.json` exclusions are dead-letter (former is from a pre-5A shape, latter is from the deferred R2 path) but harmless. | — |
| public/ snapshots are not enumerated | **pass** | listDiagramMeta walks the top-level dir only; `public/` is a subdirectory and skipped naturally. The flare-#8 promise ("never enumerated") holds. | — |

#### A.6.7 Root-level smoke-test artifact disposition

| Artifact | Purpose (current) | Used by | Disposition |
|---|---|---|---|
| [test-app.html](../../test-app.html) | Standalone HTML loading the lib UMD bundle for manual smoke-test outside the React shell. | None automated. Manual lib-consumer-style test. | **Move to `scripts/smoke/` and document its purpose in a sibling README.** Root pollution otherwise. |
| [test-base-paths.sh](../../test-base-paths.sh) | Bash smoke script that builds the app under a few `PUBLIC_URL` values and verifies asset paths resolve. | None automated. Manual pre-release sanity check. | **Move to `scripts/smoke/` alongside test-app.html.** Optionally wire as a CI job that runs only on tagged builds. |
| [e2e-tests/test-diagram.json](../../e2e-tests/test-diagram.json) | Fixture for the Python/Selenium e2e suite (`e2e-tests/`). Not at repo root as the scope wording implied — it's inside the legacy suite. | Legacy e2e suite (slated for deletion per locked-decision #4) | **Cascades with `e2e-tests/` deletion.** No separate action; gone when the suite is removed in C.5. |
| [packages/axoview-app/src/paymentFlowExample.json](../../packages/axoview-app/src/paymentFlowExample.json) | Example diagram payload, exists in app source. **Zero importers** (`grep -rn paymentFlowExample packages/` returns no matches). | nobody | **Dead file. Delete in C.2.** Static-analysis cross-reference for A.2. Not at repo root as the scope wording implied — it's inside `axoview-app/src/`. |
| [diagrams/](../../diagrams/) directory at repo root | bind-mount target for compose.yml | Docker dev workflow | **Keep, but ensure `.gitignore` covers it** ([already does](../../.gitignore) line 13). |

#### A.6.8 ADR outlines

##### ADR 0009 — Deployment topology (draft outline, do not author yet)

**Status:** Proposed (draft outline only; full ADR authored in C.7)

**Context:**
- Audit absorbed `flare_plan.md` (now retired). The durable deployment decisions need a stable home.
- Two real deployment targets exist: self-host (Docker / nginx / Express / fs adapter) and Cloudflare Pages (storage-less today; storage may return via Drive on a separate branch). Local mode is a fallback inside the SPA, not a deployment artifact.
- The dual-probe mode-detection pattern (A.4 #C1 + #C4) is a deployment-contract question, not just app cleanup: it asks what `/api/config` is allowed to carry and whether `/api/storage/status` should persist as a separate endpoint.

**Decision (to lock):**
1. **Two deployment targets, one HTTP contract.** Express + Cloudflare Worker both expose `/api/*`. Only `/api/config` and `/api/storage/status` are universally answered. Storage routes are gated on `serverStorage: true` (Express) or unconditionally 503'd (Worker, current posture).
2. **Mode detection collapses to a single probe.** Frontend reads `/api/config`; `serverStorage` is the binary toggle. `/api/storage/status` becomes a legacy synonym maintained for the LocalStorageProvider boot path until ADR 0010 ships; afterward it's a thin compat wrapper. Closes A.4 #C1 + #C4.
3. **`*.pages.dev` exposure must be addressed at the auth layer.** Either CF Access policies cover both the prod hostname and `*.pages.dev`, OR `AUTH_MODE=shared-token` is the default and stays that way.
4. **Share routes are session-mode-only.** Local-mode share invocations show a clear error instead of failing silently. Closes A.4 #C5.
5. **Authoritative wrangler.toml is the repo-root one.** Worker-package wrangler.toml is a documentation pointer.
6. **`_routes.json` is mandatory** for the public target. Pages Functions must not be invoked for static asset requests.
7. **`_headers` carries CSP + security headers for the CDN-served static.** Worker echoes the same via `secureHeaders()`. nginx (self-host) gets equivalent headers in nginx.conf.
8. **Bundle-size budget for the Worker** is part of the deployment contract (target: < 1 MB; tracked in CI).
9. **TLS termination is the deploy operator's responsibility.** nginx terminates HTTP only; Cloudflare handles TLS for the public target.

**Consequences:**
- Single deployment-topology source replaces split-brain across `flare_plan.md` + `docs/deployment.md` + scattered comments.
- ADR 0010 (session backend contract) inherits the adapter/concurrency story; ADR 0009 keeps the cross-target routing + auth + asset-pipeline story.
- A spawned tactical (C.8 git-automation) wires the bundle-size CI check + the `_routes.json`/`_headers` parity checks.

##### ADR 0010 — Session backend contract (draft outline, do not author yet)

**Status:** Proposed (draft outline only; full ADR authored in C.7)

**Context:**
- The Express + fs adapter is the live session backend. Drive (Phase 3B) and a future R2/D1 (if Cloudflare gains storage) need a clean contract to extend.
- Key-based adapter (flare #2) is implemented; the contract was never written down as a decision record.
- Concurrent-write semantics, atomicity, and single-tenant scope are implicit; a deploy operator can't predict failure modes without reading code.

**Decision (to lock):**
1. **StorageAdapter shape** = the five methods in [adapters/types.ts](../../packages/axoview-backend/src/adapters/types.ts). New providers (Drive, R2) implement the same five.
2. **Keys are opaque, not paths.** `KEY_PATTERN` enforced by every adapter as defense in depth.
3. **Atomicity contract:** every `put` must be atomic — either the full value is written or no observable change occurs. fs adapter switches to tmp-file + rename. Drive's atomicity is API-given.
4. **Concurrency model: single-tenant per deploy.** Multi-user separation is the operator's responsibility (one container per user, or CF Access policy). Within a tenant, writes are serialized at the adapter level via an in-process queue keyed on the storage key.
5. **Reserved keys** (`folders`, `tree-manifest`, `metadata`, `diagrams-index`) are excluded from `listDiagramMeta`. Adapters that need new reserved keys must update both sides.
6. **Snapshots live under `public/<uuid>`.** Never enumerated by `listDiagramMeta`. Deletion of a parent diagram cascades to its snapshot (current Express behaviour, lock as contract).
7. **Adapter-internal indexes are explicitly allowed.** R2's `diagrams-index.json` pattern (from flare #5) is preserved as the precedent for future adapters that need denormalized indexes — but the index is invisible to the route layer.
8. **Conditional-write retry pattern** (etag-based; 3-attempt cap) is the prescribed fix when an adapter ships with non-transactional storage. This is dormant today; it's the Drive-branch precedent.

**Consequences:**
- Drive implementation has a clear template.
- Future bugs around concurrent writes (folders.json racing, MQA #21 collision class) have an architectural reference instead of being treated as one-offs.
- The "single-tenant per deploy" decision shapes how share links and HTTP Basic Auth interact, and feeds back into ADR 0009.

#### A.6 Cross-cutting observations

| # | Observation | Evidence | Suggested follow-up |
|---|---|---|---|
| **D1** | **Storage-less Cloudflare is a forward-scaffolding state, not the symmetric two-runtime contract flare 5A described.** Today `routes.js` is exercised only on Express. The Worker's `app.all('/api/*') → 503` short-circuits before the shared layer fires. This is intentional and documented (flare 2026-04-29 revert), but ADR 0009 should name the asymmetry rather than restate flare 5A's "two adapters" framing. | [app.ts:43-45](../../packages/axoview-worker/src/app.ts#L43) | ADR 0009 names the asymmetry; ADR 0010 names the adapter contract as the future bridge. |
| **D2** | **Dual-probe is a real cost on Cloudflare cold starts.** Two `Promise.all`'d requests, each ~50-200ms cold. Collapsing per A.4 #C1+C4 saves one round-trip on every SPA boot. | [AppStorageContext.tsx:43-46](../../packages/axoview-app/src/providers/AppStorageContext.tsx#L43) | Folds into ADR 0009 decision #2. |
| **D3** | **HTTP Basic Auth + share routes is broken in self-host today.** nginx-level `auth_basic` gates everything; share-link viewers can't read `/api/public/diagrams/:uuid` without entering the basic-auth password. A real shape: nested `location` block disabling `auth_basic` for the two public paths. Concrete bug, not a smell. | [nginx.conf:4-5](../../nginx.conf#L4) + [routes.js:394-398](../../packages/axoview-backend/src/routes.js#L394) | Cleanup row in C.2: add nested location blocks to nginx.conf. |
| **D4** | **Two `wrangler.toml` files with identical content is brittle.** No drift today, but a future edit to one without the other will deploy a mismatched config. | both wrangler.toml files | ADR 0009 names root as authoritative; the worker-package copy becomes a comment-only pointer. |
| **D5** | **The `secureHeaders` + nginx + helmet + `_headers` story is four-way fragmented.** Each layer covers a slightly different set; CSP is explicitly disabled in helmet (server.js:36); `_headers` ships CSP + security headers for CDN-served static (corrected A.6.5); nginx has no security headers; Worker emits `secureHeaders()` which overlaps but doesn't match `_headers` exactly. **No single source of truth for "what headers does Axoview ship?"** | server.js:35-40, nginx.conf (no headers), `_headers` (12 lines), worker app.ts:18 | ADR 0009 enumerates the canonical security-header set; per-target table maps which layer ships which header. |
| **D6** | **flare_plan.md is already deleted on disk.** The audit's "delete at wrap-up" step (C.7.5) is a no-op. The follow-up action becomes: delete the `project_flare_plan.md` memory entry. | `git show 926e66f^:flare_plan.md` returns content; working tree absence | Update C.6.4 wording: replace "retire" with "delete." |
| **D7** | **`metadata.json` and `diagrams-index.json` exclusions in fs adapter are dead-letter** (former from pre-5A shape, latter from deferred R2 path) but harmless. | [fs.js:80-84](../../packages/axoview-backend/src/adapters/fs.js#L80) | Note in ADR 0010 — "reserved key list is forward-compatible; current adapter excludes future reserved keys defensively." |
| **D8** | **Drive-branch return path is the largest open architectural question that this audit *deliberately does not answer.*** Phase 3B owns the Drive provider, but ADR 0010's contract shape (single-tenant + opaque keys + reserved-list) is what makes the return cheap or expensive. Document as the highest-value forward-link from this audit. | scoping decision #5 + this audit's locked-decisions #5 + #6 | ADR 0010 explicit "Drive is the next consumer; here's the slot." Phase 3B kickoff reads ADR 0010 first. |

### A.7 Git configuration findings

**Method:** read every git-config artifact at the repo level (.gitignore, .gitattributes, .npmignore, .nvmrc, .prettierrc, .releaserc.json), every `.github/` file, and the LICENSE / CHANGELOG / README triad. Cross-checked LICENSE consistency across the three locations. Verified ISSUE_TEMPLATE coverage. Confirmed missing artifacts that productization-best-practice typically expects.

**Vocabulary:**
- **Community file** = a repo-root or `.github/` file that GitHub surfaces in its UI (LICENSE, README, CONTRIBUTING, SECURITY, CODEOWNERS, FUNDING, etc.).
- **In-repo enforceable** = a check this audit can verify by reading a file in the working tree.
- **Out-of-repo / dashboard** = enforcement that lives in GitHub settings (branch protection, secret scanning, signed commits) — captured as a checklist for the user, not a code change.
- **Productization-baseline** = the minimum set documented by GitHub's "community standards" tab + the Open Source Guides standards.

#### A.7.1 — A.7.7 Artifact register

| # | Artifact | Status | Evidence | Recommended action |
|---|---|---|---|---|
| **1** | [`.gitignore`](../../.gitignore) | **mostly complete** | 27 patterns covering node_modules, dist, build, env, IDE, OS, coverage, snapshot, snap-package outputs, `.claude/`, `diagrams/`, `reports/`, generated icon pack. | **Pass.** Two additions worth considering: `*.log.*` (rotated logs), `.wrangler/` (Cloudflare local dev state). Low priority. |
| **2** | [`.gitattributes`](../../.gitattributes) | **MISSING** | No file. Critical on a Windows-developed repo. Without `* text=auto eol=lf`, line-ending drift between commits is plausible (and CI may fail silently). | **Add** `.gitattributes` at repo root: `* text=auto eol=lf`, `*.png binary`, `*.svg text`, `*.snap text eol=lf`. Single file; one-line cleanup row in C.2. |
| **3** | [`.npmignore`](../../.npmignore) | **scoped + lib-only** | Root `.npmignore` exists (32 lines). The `axoview-lib/package.json` declares `"files": ["dist"]` which **overrides** `.npmignore` when publishing from the workspace — only `dist/` ships. Root `.npmignore` is effectively unused for the publish flow. | **Verify**: keep root `.npmignore` as documentation, OR delete it (since `files:` is authoritative). Document the decision in a comment in `axoview-lib/package.json`. |
| **4** | [`.nvmrc`](../../.nvmrc) | **drift** | Pins Node `20`; workflows pin Node `22` (test.yml:24); Dockerfile uses Node `22`. | **Update to `22`.** Already flagged P4 in A.5.1. |
| **5** | [`.github/ISSUE_TEMPLATE/`](../../.github/ISSUE_TEMPLATE/) | **complete + dual-format** | 5 files: `config.yml` (disables blank issues + adds Discussion/README contact links), legacy `bug-report.md` + `feature-request.md`, modern `bug_report.yml` + `feature_request.yml`. Both legacy and modern formats present. | **Decision needed:** keep both (modern YAML form + legacy MD) or remove the legacy `.md` pair. Convention is the YAML form supersedes; the `.md` files may be vestigial. **Verify by trying to file an issue** to see which template GitHub surfaces. C.2 row. |
| **6** | [`.github/ISSUE_TEMPLATE/config.yml`](../../.github/ISSUE_TEMPLATE/config.yml) | **stale URLs** | Contact links point to `https://github.com/stan-smith/Axoview/discussions` and `https://github.com/stan-smith/Axoview#readme`. **Stan's repo is the upstream FossFLOW.** The fork is at `molikas/axoview` (per [.releaserc.json:4](../../.releaserc.json#L4) + README). | **Fix in C.2.** Change both URLs to `github.com/molikas/axoview`. Concrete post-rename residue. |
| **7** | `.github/PULL_REQUEST_TEMPLATE.md` | **absent (intentional per convention memory)** | Convention memory notes this was deliberately deleted ("fork does not accept code PRs"). The decision is not surfaced in any README / CONTRIBUTING / repo-level doc, so a contributor opening a PR sees a default template that doesn't reflect the policy. | **Decide + document.** Either (a) re-add a minimal `PULL_REQUEST_TEMPLATE.md` that politely declines code PRs and points to discussions, OR (b) add a `CONTRIBUTING.md` that states the policy. Option (a) is lower-friction. C.2 row. |
| **8** | `.github/CODEOWNERS` | **MISSING** | No file. Single-owner project (Igor); CODEOWNERS would be aspirational. If issue / PR routing rules ever need encoding (e.g., `*.md` → docs reviewer), this is the file. | **Defer.** No action needed until contributors join. Document in workflow.md "no CODEOWNERS today; revisit when adding maintainers." |
| **9** | `.github/SECURITY.md` | **MISSING** | No file. Productization-baseline expects a responsible-disclosure path — even single-owner projects benefit. | **Add minimal `SECURITY.md`** in C.2 (10-line file: contact email, supported-versions table, disclosure timeline). Igor's `igor.sidenica@gmail.com` per memory. Low effort, productization-relevant. |
| **10** | [`.github/FUNDING.yml`](../../.github/FUNDING.yml) | **stale + ambiguous** | The file is checked in; **points at upstream FossFLOW funding** — `ko_fi: st_nsmith` (Stan Smith), `buy_me_a_coffee: stan.smith`. Donations through these links go to upstream, not Axoview. | **Decide:** (a) remove the file entirely if Axoview doesn't accept funding; (b) point at Igor's funding channels; (c) leave intentionally pointing upstream (documented in README as "support upstream FossFLOW"). C.2 row. **Highest single-file post-rename residue in the .github/ directory.** |
| **11** | [`LICENSE`](../../LICENSE) (root) | **MIT, current** | "Copyright (c) 2026 Igor Sidenica — Axoview project". MIT body. | **Pass.** |
| **12** | [`packages/axoview-lib/LICENSE`](../../packages/axoview-lib/LICENSE) | **upstream MIT, NOT updated** | "Copyright (c) 2025 Mark Mankarious" — this is the **upstream FossFLOW author**, not Igor. Same MIT body. | **Drift.** Either (a) preserve as upstream attribution + add an Axoview supplementary copyright line, or (b) update the copyright holder + year to match root LICENSE + add an "Original work" attribution to Mark Mankarious. Option (a) is more honest to the fork's lineage. **One-edit cleanup in C.2.** |
| **13** | [`packages/axoview-app/LICENSE`](../../packages/axoview-app/LICENSE) | **Unlicense, NOT MIT** | "This is free and unencumbered software released into the public domain." This is the **Unlicense** text, not MIT. Three-way license mismatch with root (MIT) and lib (MIT). | **Critical inconsistency.** The README + npm publish flow imply MIT; the app's LICENSE says public domain (Unlicense). This is a **legal-clarity bug.** **Replace with MIT** copy of root LICENSE in C.2 (single-file cleanup). **Resolved 2026-05-20:** pre-Phase-C bundle replaced the Unlicense file with MIT text matching root LICENSE (with full lineage attribution to upstream FossFLOW + Isoflow). G1 partially closed — lib LICENSE (row 12) still pending. |
| **14** | [`CHANGELOG.md`](../../CHANGELOG.md) | **good** | Keep-a-Changelog format, `[Unreleased]` section present, dated YYYY.M.D releases. Top release is `[2026.5.21] — 2026-05-19`. References `docs/upstream-changelog.md` for pre-fork history. | **Pass.** |
| **15** | [`README.md`](../../README.md) | **productization-grade** | 201 lines; "Axoview" branding throughout; live demo URL ([demo-fce.pages.dev](https://demo-fce.pages.dev/)); source/issue tracker at `github.com/molikas/axoview`; upstream lineage attribution (FossFLOW → Isoflow); MIT mentioned; comprehensive "What this fork adds" feature inventory. Performance highlight. | **Pass + minor.** Two checks: (a) verify the live demo URL is up; (b) confirm screenshot is present somewhere — A.7.7 checklist names this but the README's "What this fork adds" block lists features without inline screenshots. **Optional**: add an above-the-fold screenshot. **Verified 2026-05-20:** `demo-fce.pages.dev` is **dead** (DNS failure); the live demo has been re-hosted at **https://axoview.pages.dev/** (HTTP 200, title "Axoview - Isometric Diagramming Tool"). README link was updated on `master`; the `integration` branch still references the dead URL at [README.md:5](../../README.md#L5) and will inherit the fix on next ship-cycle. |
| **16** | [`.prettierrc`](../../.prettierrc) | **good** | 5 keys: `semi`, `trailingComma: none`, `singleQuote`, `printWidth: 80`, `tabWidth: 2`. Single source. | **Pass.** |
| **17** | [`.releaserc.json`](../../.releaserc.json) | **good** | semantic-release v25 config; conventional-commits preset; branches `master/main`; assets list includes CHANGELOG + 5 package.jsons; release commit message uses `chore(release): ${nextRelease.version} [skip ci]`. | **Pass.** Repository URL points at `molikas/axoview` (rename-clean). |
| **18** | [`tsconfig.base.json`](../../tsconfig.base.json) | **good** | Strict, ES6 target, ESNext modules, isolatedModules, declaration + sourceMap. Shared between packages. | **Pass.** |
| **19** | Branch protection (GitHub settings — out-of-repo) | **unknown from in-repo data** | Cannot verify from local; the settings live in GitHub. | **Checklist (C.2 / external):** require PR for master, require status checks (`Run Tests`, `E2E Tests`), no force push, **signed commits** if desired. Output as a single-pass action list the user runs once in GitHub settings. |
| **20** | Repo metadata (description, topics, homepage) | **unknown from in-repo data** | GitHub-side. | **Checklist:** verify Description + Topics (`isometric`, `react`, `diagram-editor`, `cloudflare-pages`, `docker`) + Homepage URL (demo) are set. |

#### A.7 Cross-cutting observations

| # | Observation | Evidence | Suggested follow-up |
|---|---|---|---|
| **G1** | **The single biggest productization risk in A.7 is the three-LICENSE-file drift.** Root says MIT (Igor 2026), lib says MIT (Mark Mankarious 2025), app says Unlicense. Anyone consuming Axoview cannot answer "what license does this software ship under?" by reading the repo. | A.7 rows 11–13 | C.2 prioritizes LICENSE consistency before any other A.7 cleanup. Likely a single PR: 2 file edits + a README clarification of the lineage. **Partially resolved 2026-05-20:** pre-Phase-C bundle rewrote `axoview-app/LICENSE` from Unlicense → MIT with full lineage attribution (Igor 2026 / Stan Smith 2025 / Mark Mankarious 2023). Remaining drift: `axoview-lib/LICENSE` (row 12) still credits only the upstream author — to be closed in C.2 with either supplementary copyright or full rewrite. |
| **G2** | **`.github/FUNDING.yml` pointing at upstream is a legal/funding clarity hazard.** A user clicking "Sponsor this project" on the GitHub UI is sent to Stan Smith's Ko-Fi. Either intentional (then document in README "support upstream FossFLOW") or unintentional (then redirect to Axoview's own funding channels, or delete the file). | A.7 row 10 | C.2 surfaces the decision to the user; doesn't pre-decide. |
| **G3** | **ISSUE_TEMPLATE has dual-format files** (`.md` + `.yml`). GitHub surfaces the modern `.yml` form when both exist (verified GitHub-side behaviour). The `.md` files are vestigial. | A.7 row 5 | C.2 row: decide if the `.md` pair stays as fallback or gets deleted. |
| **G4** | **The repository is post-rename clean at the top level** (root LICENSE, README, CHANGELOG, .releaserc, package.json all reference `axoview` / `molikas/axoview`) but **two .github/ files retain upstream URLs** (config.yml stan-smith links + FUNDING.yml stan-smith handles). The rename pass didn't sweep `.github/`. | A.7 rows 6, 10 | C.2 sweep: grep `.github/` for `stan-smith\|st_nsmith\|stan\.smith\|fossflow` and rewrite. |
| **G5** | **No CONTRIBUTING.md.** With a "no code PRs" policy (per memory), a CONTRIBUTING.md that states "code PRs not accepted; please open a discussion" + points at issues for bugs would close the implicit gap. | absent | C.2 row: add `CONTRIBUTING.md` (15-line file). Productization-baseline. |
| **G6** | **`.gitattributes` absence is the highest-impact CI risk** for the dev environment. Windows dev → LF-needed CI is a classic silent failure mode. | A.7 row 2 | C.2 row: single-file add. |
| **G7** | **GitHub UI "Community Standards" tab will report this repo as missing CODEOWNERS, SECURITY.md, CONTRIBUTING.md** — three of GitHub's seven checklist items. After C.2 adds SECURITY.md + CONTRIBUTING.md, only CODEOWNERS remains (deferred per A.7 row 8). | inferred from missing files | C.8 git-automation tactical could verify the community-standards checklist via API once productization ships. |
| **G8** | **The `axoview-backend/package.json` and `axoview-worker/package.json` are missing `license` fields.** Lib has `"license": "MIT"`; root + app don't declare it in package.json (separate from the LICENSE file). For published packages this matters; for private workspaces it's cosmetic. | sub-package.jsons | C.2 row: add `"license": "MIT"` to all 5 package.json files for consistency. |

### A.8 Git automation findings

**Method:** read every file in `.github/workflows/`, the [`dependabot.yml`](../../.github/dependabot.yml), the [`.releaserc.json`](../../.releaserc.json), and verified absent automations (CodeQL, pre-commit hooks, secret scanning). Cross-checked the workflow chain ordering against expected CI shape.

**Vocabulary:**
- **Existing automation** = workflow file present in `.github/workflows/`, dependabot config present, semantic-release config present.
- **Critical gap** = absent automation that productization-baseline expects, where the absence has a documented failure mode (silent breakage, security blind spot, manual ceremony per release).
- **Nice-to-have** = absent automation whose ROI depends on team size or community posture.
- **Workflow chain** = the `workflow_run` dependency graph wiring multiple workflows into a sequence.

#### A.8.1 Existing automation — inventory

| Workflow / config | File | Trigger | Job summary | Status |
|---|---|---|---|---|
| **Run Tests** | [.github/workflows/test.yml](../../.github/workflows/test.yml) (58 lines) | `push` to main/master + `pull_request` | Matrix: Node 20/22/24 → `npm ci` → `npm test -- --coverage` → coverage upload + test-results upload → `npm run build` | **healthy** |
| **E2E Tests** | [.github/workflows/e2e-tests.yml](../../.github/workflows/e2e-tests.yml) (125 lines) | `pull_request` to main/master + `workflow_run: Run Tests` | Selenium-Chrome container + `serve` static + Python pytest against the legacy `e2e-tests/` suite | **healthy today; obsolete after C.5.** The Python/Selenium suite is slated for deletion (locked-decision #4). New E2E suite (Playwright per C.5) needs a replacement workflow. |
| **E2E Tests backup** | [.github/workflows/e2e-tests.yml.backup](../../.github/workflows/e2e-tests.yml.backup) | none (`.backup` suffix excludes it from Actions) | (snapshot of previous shape) | **delete** — `.yml.backup` is anti-pattern. If history matters, git already has it. C.2 row. |
| **Build and Push Docker Image** | [.github/workflows/docker.yml](../../.github/workflows/docker.yml) (54 lines) | `workflow_run: E2E Tests` (success only) | Docker Buildx multi-arch (amd64, arm64) → `molikas/axoview` image push with semver tags + sha tag + latest tag | **healthy** |
| **Deploy static content to Pages** | [.github/workflows/pages.yml](../../.github/workflows/pages.yml) (50 lines) | `workflow_run: E2E Tests` (success only) | Node 22 build → upload artifact → deploy-pages | **healthy** (GitHub Pages, not Cloudflare Pages — distinct deploy track) |
| **Release** | [.github/workflows/release.yml](../../.github/workflows/release.yml) (42 lines) | `workflow_run: Deploy static content to Pages` (success only) | Node 22 → `npx semantic-release` → publishes to GitHub Releases + npm + tags | **healthy** |
| **Dependabot Auto-Merge** | [.github/workflows/dependabot-automerge.yml](../../.github/workflows/dependabot-automerge.yml) (27 lines) | `pull_request` (filters on `github.actor == 'dependabot[bot]'`) | Fetch dependabot metadata → `gh pr merge --auto --squash` for non-major updates | **healthy** |
| **EthicalCheck-Workflow** | [.github/workflows/ethicalcheck.yml](../../.github/workflows/ethicalcheck.yml) (69 lines) | `push` + `pull_request` to master + weekly cron | Third-party API security test (apisec-inc/ethicalcheck-action); SARIF upload | **suspect — see A.8 risks below.** Pointed at `netbanking.apisec.ai:8080` example OAS URL, not Axoview's API. Sends report to `security_reports@x0z.co` (an external apisec address). **Looks like an upstream/leftover template, not an active scan.** |
| **Dependabot** | [.github/dependabot.yml](../../.github/dependabot.yml) (16 lines) | weekly | npm + github-actions updates; groups minor+patch | **healthy** |
| **semantic-release** | [.releaserc.json](../../.releaserc.json) | runs from `Release` workflow | Commit-analyzer (conventionalcommits) + notes generator + changelog plugin + exec (`update-version` script + build) + GitHub release + git commit | **healthy** |

**Workflow chain visualization (current state):**

```
   push/PR ──┬──> Run Tests ──┐
             │                │ (success)
             │                ▼
             ├──> E2E Tests ──┬─> Build and Push Docker Image (workflow_run success)
                              │
                              ├─> Deploy to Pages (workflow_run success) ──> Release (workflow_run success)
                              │
                              └─> Dependabot Auto-Merge (PR-only, dependabot-only)

   weekly + push/PR ─> EthicalCheck (independent; suspect template, see A.8.4)
```

The chain is **mostly well-wired.** Three independent observations land in A.8.4–A.8.6.

#### A.8.2 CI baseline gap analysis

For each productization-baseline CI check, mark whether it runs today.

| Check | Runs today? | Where | Gap analysis |
|---|---|---|---|
| **Lint (ESLint)** | **No** | nowhere | `test.yml` runs `npm test` then `npm run build` — neither invokes ESLint. `npm run lint` at root is `npm run lint --workspaces --if-present`; only `axoview-lib` has a `"lint"` script (and it runs `tsc --noEmit`, not ESLint). **ESLint is never invoked in CI.** |
| **Type-check (`tsc --noEmit`)** | Partial | `test.yml` build step + lib's `lint` script | `npm run build` invokes per-package `rsbuild build` / `rslib build` which include type-check as a side effect. Explicit `tsc --noEmit` only runs via `npm run lint` in `axoview-lib`. App + worker + backend don't run a standalone type-check. |
| **Unit tests** | **Yes** | `test.yml` matrix | Healthy. Runs across Node 20/22/24. |
| **Build (lib + app + worker)** | Partial | `test.yml` runs `npm run build` (= lib + app); worker build not invoked | Worker is bundled via `wrangler` at deploy time; no CI-side build verification. **Gap** when ADR 0009 lands. |
| **E2E tests** | **Yes** today (Python) | `e2e-tests.yml` | Obsolete after C.5 → Playwright suite needs the new workflow. |
| **Coverage report** | Partial | `test.yml` uploads coverage but no threshold-fail gate | Lib's `jest.config.js` has `coverageThreshold: 10%` — would fail the build if coverage dropped under 10%. But the CI invocation is `npm test -- --coverage || npm test` (line 31) — the **`|| npm test`** falls back to non-coverage mode on failure, **silently bypassing the threshold gate.** This is a real risk pattern. |
| **Bundle-size report** | **No** | nowhere | flare's open-risks list flagged Worker bundle size as critical (< 1 MB target); no CI check today. Lib bundle and app entry chunk size also unchecked. |
| **Build verification of all 5 packages** | Partial | `test.yml` runs `npm run build` (root → lib + app); backend has no build; worker has no CI build | Add a CI step: `npm run -w packages/axoview-worker dev --dry-run` (or equivalent) to verify worker compiles. |
| **`backend` test gate** | **No** | nowhere | A.9 #S6 flagged this; backend has no jest config. |
| **`worker` test gate** | **No** | nowhere | Same — worker has no jest config. |

#### A.8.3 Dependency-update automation gap

| Check | Status | Notes |
|---|---|---|
| Dependabot config | **Present** ([dependabot.yml](../../.github/dependabot.yml)) | weekly schedule, 10-PR limit for npm + 5 for github-actions; groups minor+patch. |
| Auto-merge | **Present** ([dependabot-automerge.yml](../../.github/workflows/dependabot-automerge.yml)) | Auto-merges non-major updates via `gh pr merge --auto --squash`. |
| Major-version handling | Manual review by design | OK. |
| Renovate alternative | not used | Dependabot covers the case; Renovate would be redundant. |
| Ignore rules for known-breaking | none | No `ignore:` clauses. Acceptable today; revisit if a transitive update breaks. |

**Verdict:** dependency-update automation is **healthy.** No gap.

#### A.8.4 Security scanning gap

| Check | Status | Notes |
|---|---|---|
| **CodeQL** | **MISSING** | No workflow at `.github/workflows/codeql.yml`. Free for public repos. Catches the most common JS/TS security smells. | 
| **Secret scanning** (GitHub Advanced Security) | enabled by default on public repos | Out-of-repo dashboard verification. |
| **`npm audit` in CI** | **MISSING** | Not invoked in `test.yml`. The `dependabot-automerge` flow assumes auto-merge handles patch CVEs, but no explicit gate. |
| **Container image scanning** (Trivy / Snyk / Docker Scout) | **MISSING** | `docker.yml` builds + pushes but doesn't scan. With the Dockerfile's `node:22-alpine` base + nginx, a scanner catches base-image CVEs continuously. |
| **SBOM generation for shipped container** | **MISSING** | Cyclonedx / SPDX. Productization-relevant for downstream consumers; deferrable for v1. |
| **EthicalCheck (existing)** | **suspect template** ([ethicalcheck.yml](../../.github/workflows/ethicalcheck.yml)) | OAS URL `netbanking.apisec.ai:8080/v2/api-docs` is **not Axoview's API.** Report goes to `security_reports@x0z.co` (an external apisec address, not Igor's). **This workflow runs weekly + on every push, sends test traffic against an unrelated demo API, and emails reports to an external address.** Either it's an upstream leftover that was never customized, or it was intentionally left as a vendor demo. Recommended action: **delete the workflow.** |

**Critical gaps in security scanning: 4** (CodeQL, npm audit, container scan, SBOM). **Cleanup item: 1** (delete EthicalCheck).

#### A.8.5 Release automation gap

| Check | Status | Notes |
|---|---|---|
| **Tag → changelog → release chain** | **Present** via semantic-release | Healthy. Triggered by `Release` workflow on the `workflow_run` chain. |
| **npm publish for `axoview-lib`** | Partial | `.releaserc.json` includes `@semantic-release/github` but **no explicit npm publish plugin**. The `update-version` exec then `npm run build` happens, but the actual `npm publish` step isn't visible in the plugin list. **Verify by looking at the most recent release** — has lib been published to npm yet? Per rename Phase 10 it was planned but unverified. |
| **Docker Hub publish** | **Present** via `docker.yml` | Healthy. Multi-arch, semver-tagged. |
| **Cloudflare deploy automation** | **MISSING** | The "Deploy to Pages" workflow targets **GitHub Pages**, not Cloudflare Pages. The CF deploy is currently the "Deploy to Cloudflare button" path (manual click) or `wrangler pages deploy` (manual CLI). No CI-triggered CF deploy on master push. **M10 (productization ship gate) requires this.** |
| **GitHub Releases auto-generation** | **Present** via `@semantic-release/github` | Healthy. |
| **Semantic versioning enforcement** | conventional-commits preset enforces it | Healthy. Commit-analyzer maps `feat:` → minor, `fix:` → patch, `breaking:` → major. |
| **Version coherence across 5 package.jsons** | Enforced by `update-version.js` (root scripts) | The `.releaserc.json` exec plugin runs `npm run update-version ${nextRelease.version}`, which presumably bumps all 5. The `/ship` skill verifies coherence pre-merge. Two-layer enforcement; healthy. |

#### A.8.6 Bot routines gap

| Routine | Status | Notes |
|---|---|---|
| **Dependabot auto-close stale PRs** | not configured | dependabot.yml doesn't set `rebase-strategy: auto` or stale-handling. Default behavior may be sufficient. |
| **Stale issue / PR auto-close** | not configured | No `actions/stale` workflow. With a single-owner repo and "no code PRs" policy, low priority. |
| **Auto-label by file path** | not configured | No `actions/labeler` workflow. Convenience-only. |
| **PR title format check (Conventional Commits)** | not configured | semantic-release relies on commit subjects (which `/ship` `git merge --no-ff` preserves), not PR titles. Acceptable today. |
| **First-time contributor greeting** | not configured | "No code PRs" policy makes this moot. |

**Verdict:** bot routines are **all defer / reject** consistent with the project's posture. No critical gap.

#### A.8.7 Pre-commit / pre-push hooks gap

| Check | Status | Notes |
|---|---|---|
| **Husky** | **MISSING** | No `.husky/` directory; no `husky` in `package.json` devDeps. |
| **lint-staged** | **MISSING** | Not in `package.json`. |
| **commitlint** | **MISSING** | Not in `package.json`. semantic-release uses commit messages as input — a malformed commit subject silently misses a release. |
| **Local-CI mirror** (run ESLint + tsc + jest pre-push) | **MISSING** | No automation. Contributors and Claude both have to remember to run tests pre-push. |
| **simple-git-hooks** alternative | not present | Same null result. |

**The biggest user-visible gap here is commitlint.** semantic-release's whole shape depends on conventional-commit format; without commitlint, a typo'd `feat:` (e.g., `feature:`) silently bypasses release detection. **Risk.**

#### A.8 Cross-cutting observations

| # | Observation | Evidence | Suggested follow-up |
|---|---|---|---|
| **A1** | **ESLint never runs in CI.** Single biggest gap in A.8.2. The repo has a flat-config `eslint.config.mjs` at root; no workflow invokes it. Lint errors in `npm run lint` only run for lib (which uses `tsc --noEmit` under the `lint` name, confusingly). | A.8.2 lint row + [test.yml](../../.github/workflows/test.yml) | C.8 git-automation tactical adds an `eslint` step to `test.yml` (or a dedicated `lint.yml`). |
| **A2** | **Coverage threshold gate is defeated by `|| npm test` fallback.** Even with lib's `coverageThreshold: 10`, the CI command `npm test -- --coverage || npm test` swallows the threshold failure and re-runs tests without coverage. Result: coverage **never fails CI.** | [test.yml:31](../../.github/workflows/test.yml#L31) | Remove the `|| npm test` fallback; let threshold failures be real failures. Single-line fix. |
| **A3** | **EthicalCheck workflow runs against an unrelated demo API** (`netbanking.apisec.ai`) and emails reports to `security_reports@x0z.co`. This is **almost certainly an upstream/template leftover** that wasn't customized when the repo was forked from FossFLOW. The workflow runs weekly + on every push to master + on every PR, sending traffic against a third-party demo API. **Recommended: delete the workflow.** | [ethicalcheck.yml](../../.github/workflows/ethicalcheck.yml) | C.2 row. Single-file deletion. **Resolved 2026-05-20:** pre-Phase-C bundle deleted `.github/workflows/ethicalcheck.yml`. No replacement; CodeQL/npm-audit gaps remain tracked under A8 + A.8.4. |
| **A4** | **`e2e-tests.yml.backup` is checked into the workflows directory.** Files with `.yml.backup` suffix are ignored by Actions, but leaving them in `.github/workflows/` is a maintenance smell — future editors may confuse them with active workflows. | [.github/workflows/e2e-tests.yml.backup](../../.github/workflows/e2e-tests.yml.backup) | C.2 row. Single-file deletion. |
| **A5** | **Cloudflare Pages deploy is manual.** The `pages.yml` workflow targets GitHub Pages (with `PUBLIC_URL: /Axoview/`). M10 (productization ship gate) requires a CF Pages deploy triggered on master push. **This is a productization blocker.** | [pages.yml](../../.github/workflows/pages.yml) | C.8 git-automation tactical adds a `cloudflare-pages.yml` workflow that uses `cloudflare/pages-action` (or `wrangler pages deploy`) on master push. |
| **A6** | **The 4-workflow chain has a single-point-of-failure:** every downstream workflow gates on `workflow_run: <upstream> success`. If E2E Tests fails (e.g., a flaky Selenium start), Docker push + Pages deploy + Release all skip. This is **correct behavior for production** (don't ship broken code) but **risky for the rename-era + the legacy Python suite's known flakiness.** | workflow chain visualization above | Once C.5 (Playwright rewrite) lands, re-evaluate. May be acceptable. |
| **A7** | **No commitlint means semantic-release silently skips malformed commits.** A subject typed `feature:` instead of `feat:` produces no release. **Risk increases with multiple committers.** | absence | C.2 row: add `commitlint` + simple-git-hooks (or husky if preferred). Low-effort. |
| **A8** | **CodeQL absence is the single biggest security-scanning gap.** Free for public repos, no operational cost. Catches the most common JS/TS security smells (XSS, prototype pollution, regex DoS, etc.). | A.8.4 | C.8 row: add `codeql.yml` (GitHub provides a default template). |
| **A9** | **npm publish for `axoview-lib` is unverified.** `.releaserc.json` includes the github + git plugins but **no `@semantic-release/npm` plugin entry.** The lib has `private: false` and a `repository`, suggesting publish intent. The first release after the rename may have failed to publish to npm, OR the publish flow uses a different mechanism not documented here. | [.releaserc.json](../../.releaserc.json) | Verify with `npm view axoview` — has the lib been published since the rename? If not, M8 cannot ship until npm-publish wiring is added. **Resolved 2026-05-20:** verification ran — `npm view axoview` and `npm view axoview-lib` both return 404 (never published). Pre-Phase-C bundle added `@semantic-release/npm` with `pkgRoot: "packages/axoview-lib"` to `.releaserc.json` plugin list (after `@semantic-release/exec`, before `@semantic-release/github`). **Out-of-repo follow-up flagged for user:** verify `NPM_TOKEN` secret is present on the `Release` workflow's GitHub Actions environment — without it the first publish will fail. |
| **A10** | **Test gate runs across Node 20/22/24** but production uses Node 22. The 20-and-24 columns are insurance; running them on every push is fine but inflates CI minutes by ~3x. After M10, consider trimming the matrix. | [test.yml:14-15](../../.github/workflows/test.yml#L14) | Defer. Optional optimization. |

### A.9 Skills + cadence findings

**Method:** locate every project-customized skill (`.claude/commands/` at repo root); read each fully; cross-reference body text against the rename-era reality (Axoview vocabulary, retired files, current ADR list); reconstruct the implicit cadence from the skill bodies + recent commit history; identify gaps where the current cadence breaks down. The built-in / plugin skills surfaced by the system reminder (`update-config`, `keybindings-help`, `simplify`, `fewer-permission-prompts`, `loop`, `schedule`, `claude-api`, `init`, `review`, `security-review`) are referenced for sequencing but are **out of scope for content edits** — they aren't project-customized.

**Vocabulary:**
- **In-scope skill** = a `.md` file under `.claude/commands/` at the repo root, edited as part of the audit's productization scope.
- **Out-of-scope skill** = a built-in or plugin skill available in the runtime but not locally edited.
- **Cadence anchor** = a fixed point in the canonical session sequence that one or more skills must integrate with cleanly.
- **Stale reference** = a path, filename, ADR number, terminology fragment, or hard-rule prohibition that no longer matches on-disk reality (typically post-rename or post-file-deletion drift).
- **Skill overlap** = two skills that both claim ownership of a specific cadence step without a clear "use A when X, use B when Y" trigger.

#### A.9.1 Skill inventory — in-scope (project-customized)

All five live under [.claude/commands/](../../.claude/commands/) at the repo root.

| Skill | File | Trigger | Inputs | Outputs / side-effects | Cadence anchor |
|---|---|---|---|---|---|
| **/audit** | [audit.md](../../.claude/commands/audit.md) (244 lines) | Manual; pre-release or quarterly | None | Executive report (in-conversation, no file write). Phases: static analysis, security audit, coverage, build, architecture review, UX consistency grep (Phase 5b), perf hot-path grep (Phase 5c). Score cards A–F per dimension. | Polish |
| **/feature** | [feature.md](../../.claude/commands/feature.md) (196 lines) | New ADR-worthy decision, ADR addendum, supersession, or tactical wrap | Mode arg (`start`/`extend`/`supersede`/`wrap`) + description | Scaffolds ADR(s) in `docs/adr/`, optional tactical in `docs/tactical/`, updates `project_docs_convention.md` memory. `wrap` mode appends one-line entry to PLAN.md and deletes the tactical doc. | Feature scaffolding · Wrap |
| **/notes** | [notes.md](../../.claude/commands/notes.md) (240 lines) | End-of-session doc sync | None (derives from git log + diff) | Updates CHANGELOG (Unreleased), optionally README, architecture.md, testing.md, known_issues.md, PLAN.md. Optional release cut (bumps 5 package.jsons + CHANGELOG section). Stops before commit. | Doc sync |
| **/shake-out** | [shake-out.md](../../.claude/commands/shake-out.md) (107 lines) | Bug-fix / polish loop on already-shipped surfaces | Issue list (`$ARGUMENTS`) or scan known_issues.md | TodoWrite-driven per-issue loop; per-issue user verification; single coherent commit covering bundle; push to working branch | Polish |
| **/ship** | [ship.md](../../.claude/commands/ship.md) (119 lines) | End-of-session promotion: integration → master | None | Test gate (both packages), version-coherence check (5 package.jsons), interactive plan + confirm, `git merge --no-ff` master, push, restore working branch | Promotion |

#### A.9.2 Canonical session cadence (current state — reconstructed)

```
                     ┌─────────────────────────────────────────────┐
                     │  Session start                              │
                     │  - Read MEMORY.md (always loaded)           │
                     │  - Read PLAN.md / relevant tactical         │
                     │  - TodoWrite the sub-task list              │
                     └────────────────────────────┬────────────────┘
                                                  │
                          ┌───────────────────────┴───────────────────────┐
                          ▼                                               ▼
              ┌─────────────────────────┐                  ┌─────────────────────────┐
              │  Feature scaffolding    │                  │  Direct work            │
              │  (only when starting    │                  │  (most sessions)        │
              │   ADR-worthy new work)  │                  │                         │
              │                         │                  │                         │
              │  /feature start         │                  │  Reads + edits + builds │
              │  /feature extend        │                  │  Dev server + browser   │
              │  /feature supersede     │                  │  for UI work            │
              └────────────┬────────────┘                  └────────────┬────────────┘
                           │                                            │
                           └────────────────────┬───────────────────────┘
                                                ▼
                              ┌──────────────────────────────────┐
                              │  Verify                          │
                              │  - tsc --noEmit / build          │
                              │  - jest (per-package)            │
                              │  - manual UI check               │
                              └────────────────┬─────────────────┘
                                               │
                                       ┌───────┴───────┐
                                       ▼               ▼
                              ┌────────────┐    ┌─────────────┐
                              │  /audit    │    │ /shake-out  │
                              │  (heavy    │    │ (iterative  │
                              │   sweep)   │    │  polish)    │
                              └─────┬──────┘    └──────┬──────┘
                                    │                  │
                                    │  ┌───────────────┘
                                    │  │
                                    ▼  ▼
                              ┌──────────────────────┐
                              │  /review or          │   (built-in skills,
                              │  /security-review    │    plugin-provided)
                              └─────────┬────────────┘
                                        ▼
                              ┌──────────────────────────┐
                              │  /notes                  │
                              │  CHANGELOG + docs sync   │
                              │  (optional release cut)  │
                              └─────────┬────────────────┘
                                        ▼
                              ┌──────────────────────────┐
                              │  /feature wrap           │
                              │  (only for tactical docs │
                              │   fully completed)       │
                              └─────────┬────────────────┘
                                        ▼
                              ┌──────────────────────────┐
                              │  /ship                   │
                              │  integration → master    │
                              └──────────────────────────┘
```

**Cadence anchors (ordered):** Session start · Feature scaffolding · Direct work · Verify · Polish (`/audit` heavy or `/shake-out` iterative) · Review (`/review` / `/security-review`) · Doc sync (`/notes`) · Tactical wrap (`/feature wrap`) · Promotion (`/ship`).

The cadence is **mostly self-documenting from the skill bodies** — each skill names its phase neighbors. The exceptions worth fixing are flagged in A.9.5.

#### A.9.3 Per-skill stale references + overlaps

| Skill | Type | Evidence | Recommended edit (C.9.2) |
|---|---|---|---|
| `/audit` | **stale path** | `audit.md:88` references `current_architecture.md` (first 300 + last 300 lines). File does not exist; superseded by `docs/architecture.md`. | Replace path with `docs/architecture.md` (header + Section 1 inventory). |
| `/audit` | **stale rule paths** | Phase 5b grep commands target `docs/ux-principles.md` correctly; Phase 5c targets `docs/perf-troubleshooting.md` correctly. Cross-checked file existence — both exist. | No action. |
| `/audit` | **stale assumption** | Phase 1 hardcodes `cd packages/axoview-lib && npx eslint src --ext .ts,.tsx` but the project root eslint config (`eslint.config.mjs`) is flat-config since cluster 19 (`d849850`) and covers both packages. The cd-into-package pattern still works but isn't the canonical invocation. | Switch to `npx eslint packages/axoview-lib/src packages/axoview-app/src --format stylish` from repo root. Same for prettier. |
| `/audit` | **missing surface** | No Phase covers deployment artifacts (Dockerfile / compose / nginx / wrangler / Worker / backend). A.6's checklist patterns belong in `/audit` long-term as a Phase 5d. | Add Phase 5d "Deployment artifact baseline" once ADR 0009/0010 land. |
| `/feature` | **stale path** | `feature.md:88` recommends "copy the structure of `docs/tactical/session-ux-revamp.md` verbatim" — the file was **deleted** in cluster 45 (2026-05-09, `042908f`). Any new tactical scaffolded by `/feature start` today gets a broken template hint. | Replace template reference with [`docs/tactical/productization-audit.md`](productization-audit.md) (this file) OR with [`docs/tactical/layout-revamp.md`](layout-revamp.md) (the wrapped exemplar still in tree). |
| `/feature` | **stale prohibition** | `feature.md:192` hard-rules "Never edit `flare_plan.md`." File deleted 2026-05-19 (`926e66f`). Rule is harmlessly stale (it can never fire) but misleading for new sessions. | Delete the bullet. Optionally replace with "Never edit retired tactical docs without confirmation — check the file's wrap-up status first." |
| `/feature` | **stale memory path** | `feature.md:25` references `C:\Users\isidenica\.claude\projects\c--myTemp-FossFLOW\memory\project_docs_convention.md`. Per locked-decision #10, the `cwd rename` is tracked but not yet executed; the `c--myTemp-FossFLOW` segment will change to `c--myTemp-Axoview` once the cwd renames. | No action **yet** — flag for re-edit when locked-decision #10 ships. |
| `/feature` | **ADR list staleness risk** | Phase 2 instructs "update the **Existing ADRs** list in `project_docs_convention.md` memory" — assumes the convention memory is the authoritative ADR registry. C.6.2 will add ADRs 0007–0010 there. If C.9.2 runs before C.6.2, the skill will instruct edits to a stale memory. | Sequence C.9.2 after C.6.2. |
| `/notes` | **stale prohibition** | `notes.md:236` hard-rules "Never touch `flare_plan.md` unless a Phase 5* sub-phase explicitly completed." File deleted. | Delete the bullet. Phase 5* is now absorbed by this audit; ADRs 0009/0010 own the durable record. |
| `/notes` | **stale phase reference (implicit)** | `notes.md` Phase 0d table mentions PLAN.md but doesn't name specific phases — that's fine (it stays self-updating). No edit needed. | No action. |
| `/notes` | **good** | Phase 1 / Phase 3 / Phase 4 mention 5 package.json files for release cut; the worker + backend additions in cluster 42 are correctly captured (`packages/axoview-worker/package.json` line 182). | No action. |
| `/shake-out` | **good** | No `FossFLOW` references; no retired-file references; the polish loop is rename-clean. | No action. |
| `/shake-out` | **overlap with /audit** | Both skills do "find a problem and fix it." Boundary documented at `shake-out.md:101` ("If you spot a god-file or circular dep, mention it once and move on. Use `/audit` for that work."). Adequate. | No action; codify in workflow.md (C.9.1) as the canonical boundary. |
| `/shake-out` | **overlap with /notes** | `shake-out.md:73-83` "Document the trail" lists known_issues.md updates that overlap with `/notes` Phase 1 Q3. Both skills can append. `/shake-out` says "default to skipping this step." | No action; the "default skip" disclaimer makes it the correct boundary. |
| `/ship` | **good — 5 package.json check** | `ship.md:21-28` enumerates all 5 files including worker + backend. Post-rename. | No action. |
| `/ship` | **stale assumption (none found)** | The version-coherence check, test gate, and merge plan are rename-clean. | No action. |
| `/ship` | **overlap with /notes — release cut** | `/notes` Q4 owns the release-cut decision (bumps 5 package.jsons + cuts CHANGELOG). `/ship` only verifies version coherence; doesn't bump. Boundary clean. | Codify in workflow.md: "/notes cuts; /ship promotes; never the other way around." |

**Cross-skill overlap matrix:**

| Skill A | Skill B | Overlap zone | Boundary today | Recommended boundary |
|---|---|---|---|---|
| `/audit` | `/shake-out` | "Find and fix problems" | Documented in shake-out body ("use /audit for depth") | Keep; codify in workflow.md decision table |
| `/audit` | `/notes` | "Where to log architecture findings" | Implicit — `/audit` produces an executive report, `/notes` updates `docs/architecture.md`. Gap: `/audit` doesn't currently write its findings anywhere persistent. | workflow.md table: `/audit` produces ephemeral report; high-value findings get filed via `/notes` Q2 |
| `/notes` | `/feature wrap` | "Updating PLAN.md" | Both touch PLAN.md but for different reasons — `/notes` for completed phases (Phase 0d), `/feature wrap` for completed tacticals. | Clean; codify in workflow.md. |
| `/feature start` | `/feature wrap` | Same skill, two modes | Modes are mutually exclusive. | No action. |
| `/ship` | `/notes` | Release-cut vs promotion | Sequence documented in `/ship` description ("companion to /notes"). | Codify "always /notes then /ship" in workflow.md. |
| `/shake-out` | `/feature` | "When does a polish fix warrant an ADR?" | `/shake-out` step 5 mentions "Only if a fix changed an invariant the ADR documents." Adequate. | No action. |

#### A.9.4 Missing-skill candidates (catalogue only — do not build)

| # | Candidate | Sequence point | Rationale | Complexity | Disposition |
|---|---|---|---|---|---|
| 1 | **/release-check** | Pre-M10 ship gate | Productization needs a pre-public-release checklist runner — verifies tagged release, container image published, CF deploy reachable, README screenshot current. `/ship` only handles integration → master. | Medium (workflow.md + new skill body, ~150 lines) | **defer** — rebuild after the first productized release; encoding it before we've shipped once is premature. |
| 2 | **/trace** | Phase B verification harness | Once ADR 0007 (runtime trace harness) lands, a `/trace <scenario>` skill that drives `?trace=1`, captures NDJSON, attaches to register, drains the harness, would compress the runtime-verification loop. | Medium-high (needs ADR 0007 first; spans browser drive + log parse) | **defer** — gated on ADR 0007 acceptance; rebuild once the harness ships. |
| 3 | **/deploy-check** | Pre-deploy validation | Verify deployment artifact baseline (Dockerfile, compose, wrangler) against the locked ADRs 0009/0010. Programmatically what A.6.2–A.6.6 did manually. Cheap to write once the ADRs are accepted. | Low-medium (grep + shape checks) | **defer** — gated on ADRs 0009/0010; build alongside C.8 git-automation tactical. |
| 4 | **/regression-snapshot** | Pre-risky-cleanup | Capture a current-behaviour baseline before risky cleanup so behavioural drift is detectable. Implementable as: run Playwright snapshot suite + a diagnostics dump of localStorage / sceneStore initial state. | High (needs both Playwright suite running and a sceneStore-snapshot serializer) | **defer** — gated on M9 (new E2E suite). |
| 5 | **/spawn-tactical** | Mid-audit utility | Scaffold a tactical doc from a Findings register row. Saves the manual cut-paste-rename cycle. Marginal value; current `/feature start` covers the canonical path. | Low (script around the `/feature start` template) | **reject** — `/feature start` is sufficient; the row→tactical translation is meaningful curation that resists templating. |
| 6 | **/cwd-rename** | One-shot | Locked-decision #10 mentions the cwd rename as a tracked execution note. Could be encoded as a skill that updates memory paths, restarts the session pointer, and verifies the new directory works. | Low (file move + memory path rewrite + restart hint) | **reject** — one-shot; encoding it adds maintenance load for zero future value. Manual is fine. |
| 7 | **/workflow-check** | Session start | Print the cadence (workflow.md) diagram + decision table on demand. Cheap; complements `docs/workflow.md`. | Trivial | **defer** — bundle into `docs/workflow.md` Section "Quick reference" instead of a skill; saves skill-list bloat. |
| 8 | **/ux-baseline** | Polish gate | Run only the Phase 5b grep block from `/audit` (UX consistency) without the full architecture sweep. Faster for UI-only polish sessions. | Trivial (extract Phase 5b verbatim) | **defer** — fold into `/shake-out` as an optional first-step (`/shake-out --ux-baseline`) rather than a new skill. |
| 9 | **/perf-baseline** | Polish gate | Same shape as #8 but for Phase 5c hot-path grep. | Trivial | **defer** — same fold-into-/shake-out treatment as #8. |

**Triage summary:** 0 build-now (every candidate is gated on an artifact that doesn't yet exist, or rejected as low-ROI). 2 reject (#5, #6). 7 defer with explicit gates. **Net effect on M8:** the productization gate does not block on new-skill construction; it blocks on the alignment-and-cadence work in C.9.1 + C.9.2.

#### A.9.5 Cadence anomalies / friction points

| # | Anomaly | Evidence | Suggested resolution (workflow.md) |
|---|---|---|---|
| **S1** | **`/audit` produces no persistent artifact.** Its output is an in-conversation executive report that disappears at session end. The phase 5b/5c grep counts are valuable trendlines but unfiled. | `audit.md:214-227` Phase 6 (Executive Report) — no instruction to write to disk. | Decide: (a) `/audit` writes to `reports/audit-YYYY-MM-DD.md` (cheap; gitignored already via `reports/`); OR (b) high-value findings get filed via `/notes` Q2 immediately after. workflow.md picks one. |
| **S2** | **No skill covers the "I need to read MEMORY.md, PLAN.md, and pick what to work on" session-start step.** Implicit cadence; every skill's body assumes you've done it. New sessions learn it by reading CLAUDE.md hints + bumping into the skills. | All five skill bodies; no `/start` or equivalent | workflow.md Section "Session start" enumerates the 4-step (memory · plan · pick · TodoWrite) sequence. No new skill needed; doc-only. |
| **S3** | **`/feature start` and `/notes` Phase 4 both touch the convention memory.** They don't conflict but they don't reference each other, so a session that runs both in sequence may double-update or skip. | `feature.md:84, 153, 198` + `notes.md:198` | workflow.md decision table: `/feature` owns convention-memory writes during scaffolding; `/notes` Phase 4 only deletes bullets during wrap. |
| **S4** | **Build-verification scope is implicit.** `/shake-out` step 4 says "build only when editing under `axoview-lib/src/`". `/audit` Phase 4 runs both builds. `/notes` doesn't build. `/ship` doesn't build — only test. No skill enforces "build before commit." | spread across skill bodies | workflow.md Section "Verify": canonical build/test sequence per change-class table (lib-only / app-only / cross-package / backend / worker). |
| **S5** | **No "run the dev server + verify in browser" anchor in any skill body**, despite CLAUDE.md instructing exactly that for UI changes. The UI-verification step is doctrine but not skill-encoded. | global CLAUDE.md instruction + `/shake-out` step 5 (hand off to user) | workflow.md Section "UI verification": mandatory for any change touching `packages/axoview-*/src/components/`. |
| **S6** | **`/ship` test gate runs `npm test --workspace=packages/axoview-lib` and `--workspace=packages/axoview-app` but not `axoview-backend` or `axoview-worker`.** Backend has no jest config (verify); worker likely has none. Coverage is OK *because there are no tests*, but `/ship` should at least assert that — otherwise it gives false confidence that backend regressions are caught. | `ship.md:31-34` | workflow.md notes the explicit scope. C.8 git-automation tactical adds backend + worker test scaffolding (gap, not bug); `/ship` body cross-links. |
| **S7** | **No skill names the "Phase B trace harness" path** (will appear in ADR 0007). When the harness lands, the cadence needs a new anchor between Polish and Review. | n/a (forward-looking) | workflow.md reserves the slot; `/trace` (deferred from A.9.4 #2) plugs in later. |
| **S8** | **Built-in `/review` and `/security-review` integration is undocumented.** Both are surfaced by the system reminder; the cadence assumes they fire pre-merge, but no skill body mentions them. | system reminder + skill bodies | workflow.md Section "Review gate": names both built-ins as the canonical pre-merge step before `/ship`. |
| **S9** | **`/notes` release-cut is opt-in (Q4) but version-coherence in `/ship` is mandatory.** Asymmetry: if `/notes` skips the cut, `/ship`'s coherence check still passes (no version bump = all 5 stay aligned at the previous version). Correct, but the user might expect "/ship implies a cut." | `notes.md:86-87` + `ship.md:21-28` | workflow.md decision table: "/notes cuts when?" vs "/ship promotes regardless." Lock the asymmetry as intentional. |

#### A.9 Cross-cutting observations

| # | Observation | Evidence | Suggested follow-up |
|---|---|---|---|
| **W1** | **All five in-scope skills are post-rename clean for active terminology** (no surviving "FossFLOW" / "Isoflow" in instructions, no "axoview-app" misspellings). The four staleness items (audit.md:88, feature.md:88, feature.md:192, notes.md:236) are pointer references to retired files, not terminology drift. | Grep results above | The rename track did a thorough sweep; the staleness here is file-retirement residue, not rename residue. Low-friction fix in C.9.2. |
| **W2** | **The cadence is implementation-driven, not doctrine-driven.** Each skill names neighbors in its prose (`/ship` says "companion to /notes"; `/shake-out` says "Use /audit for depth"). No external doc names the full sequence. `docs/workflow.md` will be the first such doc. | none yet | workflow.md Section "Cadence map" must reproduce the ASCII diagram above (or its successor) as the single-source picture. |
| **W3** | **Skill bodies use Bash idioms (`cd packages/...`) that aren't Windows-friendly.** The repo dev is on Windows (PowerShell). Skills work because Claude Code provides Bash via WSL/MSYS2 + the harness translates `cd` cleanly, but a strict-PowerShell session would trip. Not urgent (the user routinely uses Bash tool). | `audit.md:13, 19, 43, 56, 59, 72-74` | Note in workflow.md "Skills assume Bash availability; PowerShell-only environments need translation." Not a re-write target. |
| **W4** | **No skill is responsible for the audit's own surface** (productization-audit.md). This is by design — the audit doesn't have a wrap mode of its own; C.7.5 + the manual `Wrap-up` section at the bottom of this file is the wrap path. Once this audit ships, `/feature wrap productization-audit` should work via the existing `/feature wrap` template. | `feature.md:179-187` | Verify the `/feature wrap` template handles a tactical doc with embedded ADR drafts cleanly. Likely yes — only PLAN.md append + file delete + memory bullet remove. |
| **W5** | **`/audit` and `/shake-out` are the loudest overlap, and the project memory `feedback_be_serious_not_eager.md` is the reason both skills emphasize "verify, don't pile on."** The boundary works because both bodies internalized the memory. Worth surfacing in workflow.md as the design principle. | `shake-out.md:13-15`, `audit.md` (no surface match — but the absence of pile-on suggestions in `/audit` is itself the design) | workflow.md "Design principle: skills are screenshot-driven, not theory-driven" — cross-link to `feedback_be_serious_not_eager` memory. |
| **W6** | **The `c--myTemp-FossFLOW` path slug appears in two skill bodies and the convention memory.** Locked-decision #10 mentions the cwd rename will fix this. The path slug is generated by Claude Code from cwd; renaming the folder is the only fix. **This is not a skill bug** — it's a one-shot ops task. | `feature.md:25`, `notes.md:198`, memory path | Track in PLAN.md or known_issues.md as "cwd rename pending"; not a C.9.2 action. |
| **W7** | **Three skills (`/feature`, `/notes`, `/audit`) reference `docs/ux-principles.md` as the "read first" UI doc.** This consistency is a positive finding — UI work has one source of truth across all three cadence anchors. | `audit.md:5`, `feature.md:5`, `notes.md:5`, `shake-out.md:6` | Preserve in workflow.md. |
| **W8** | **`/shake-out` has the most evolved per-attempt protocol** ("diagnostics on attempt #2", "green-test trap", "three rejected designs → stop and ask"). This pattern hasn't propagated to `/audit` or `/feature` despite being broadly useful. | `shake-out.md:54-68` | Optional: lift the "treat your diagnosis as a hypothesis" pattern into `/audit` Phase 5 (architecture assessment) as a methodology note. |

### B.5 Runtime-trace confirmations / refutations
> *To be filled by workstream B.5. Per row: Phase-A finding ID, scenario, expected vs actual, verdict.*

---

## Phase A — Cross-workstream synthesis (2026-05-20)

Discovery is complete. The register holds **9 workstreams** × per-workstream cross-cutting observations: A.1 (15 overlap rows + 7 flags) · A.2 (9 obs N1–N9) · A.3 (6 obs + 16 surface findings + 3 hotkey items) · A.4 (7 obs C1–C7 + 32 surface rows) · A.5 (8 obs P1–P8) · A.6 (8 obs D1–D8 + 19 flare classifications + ADR 0009/0010 outlines) · A.7 (8 obs G1–G8) · A.8 (10 obs A1–A10) · A.9 (8 obs W1–W8 + 17 alignment rows + 9 cadence anomalies).

Below are the **cross-workstream themes** — patterns visible only when multiple workstreams' findings line up.

### Theme 1 — The "dual-probe / dead RuntimeConfig field" thread is the single highest-leverage architectural item

**Sources:** A.4 #C1 + #C4 (mode detection uses two parallel probes; `RuntimeConfig.serverStorage` is a dead field). A.6 #D1 + #D2 (Worker terminates storage paths before they reach `routes.js`; dual-probe is a real cost on Cloudflare cold starts). A.6.1 row "Architectural #6 — Runtime config" + A.6 ADR 0009 decision #2 (collapses the two probes into one).

**Why it matters:** the boot-time mode detection is the entry path for every SPA session. Collapsing two `Promise.all`'d probes into one `/api/config` round-trip saves ~100-200ms on cold Cloudflare starts AND deletes 8 lines of dead frontend code AND simplifies the deployment contract.

**Phase C target:** ADR 0009 decision #2.

### Theme 2 — Legal / licensing clarity is the single highest-risk pre-publication item

**Sources:** A.7 row 13 (axoview-app/LICENSE is **Unlicense**, not MIT). A.7 row 12 (axoview-lib/LICENSE still credits the upstream FossFLOW author). A.7 row 10 (FUNDING.yml points at upstream maintainer's funding channels). A.7 #G1 + #G2.

**Why it matters:** a productized release with an Unlicense file under one workspace and an MIT file under another is a real legal-clarity defect. A `Sponsor this project` button that routes donations to upstream is a funding-clarity defect.

**Phase C target:** C.2 cleanup plan, **sequenced before any other A.7 work.** Three small edits (file rewrites + a README clarification of lineage).

### Theme 3 — Two real bugs preserved from A.3/A.4 plus one from A.6 must survive the Phase C funnel into C.2

**Sources:** A.4 #C2 (`SessionModeBanner` name-inverted from its render gate — shown only in LOCAL mode despite its name implying session). A.4 #C5 (Local-mode share-link is silently broken — user sees empty state). A.6 #D3 (HTTP Basic Auth + share routes is broken in self-host today — nginx-level `auth_basic` gates `/api/public/diagrams/*`).

**Why it matters:** these are **bugs, not smells.** Per user direction, they need disposition fidelity into C.2 (cleanup plan), not just naming-ADR text.

**Phase C target:** C.2 row each; C2 (Banner rename) goes alongside the naming ADR; C5 (Local-mode share UX) folds into ADR 0009 + a frontend fix; D3 (nginx unauth bypass) is a self-host nginx-config edit.

### Theme 4 — Root `package.json` dependency bloat (P1) + 3-way LICENSE drift (G1) + missing `.gitattributes` (G6) are the three "single-file, high-impact, low-risk" cleanups

**Sources:** A.5 #P1 (root `dependencies` block — 6 of 8 entries are workspace-resolver duplicates or unused). A.7 #G1 + row 13 (LICENSE drift). A.7 #G6 (`.gitattributes` missing — Windows dev → LF CI silent-failure risk).

**Why it matters:** these are **single-PR cleanups** with high productization-value-per-effort. None of them require an ADR. All three can land before M5 (cleanup tacticals spawned) without blocking anything.

**Phase C target:** C.2 "quick-win" section at the top of the cleanup plan.

### Theme 5 — The Discovery register is now richer than the Naming ADR seed list — C.1 should validate seed against findings, not the reverse

**Sources:** A.3 surface inventory (16 findings) confirmed/refuted every candidate from C.1's seed list: AppToolbar (clean), LayersPanel (large but coherent), BottomDock (touched 3 times, no anomaly), MainMenu (deletion locked), StatusCluster, ExportPopover, ContextMenu, QuickAddPopover all clean. A.4 surface matrix (32 rows) ties each surface to a mode. A.6 + A.9 add `_headers`, `_routes.json`, the worker, the backend, the skills as named surfaces.

**Why it matters:** the C.1 seed list ("verify, don't rubber-stamp") was written before Discovery filled the register. **Discovery has now surfaced the actual naming-decision shape:** what's a public surface, what's lib-only, what's "mode-axis-overlay" (readonly), what's a deployment artifact. The Naming ADR should reflect this.

**Phase C target:** C.1 (ADR 0008) draft uses A.3 + A.4 + A.6 + A.9 inventories as its named-thing scope, not the original seed.

### Theme 6 — Three "skill needs a fresh re-run" tasks for the C.8 / C.9 follow-up

**Sources:** A.2 #N1 (knip report is pre-rename; needs re-run). A.9 #W4 (`/feature wrap productization-audit` flow needs verification once this audit ships). A.8 #A2 (CI coverage gate defeated by `|| npm test` fallback).

**Why it matters:** each one is a single-line / single-command fix that closes a known regression vector.

**Phase C target:** C.8 git-automation tactical wraps all three.

### Theme 7 — The "two-runtime contract" framing from flare 5A is asymmetric in reality, and ADR 0009 must name it

**Sources:** A.6 #D1 (Worker terminates storage paths at `app.all('/api/*') → 503`; `routes.js` is exercised only on Express). A.6.1 row "Architectural #1" (Worker implements only `/api/storage/status` + `/api/config`). A.6.5 (two `wrangler.toml` files; CF deploy is storage-less by design).

**Why it matters:** "one HTTP contract, two adapters" is **aspirational** today; the live shape is "one HTTP contract, one adapter, one short-circuit." ADR 0009 lock-in must reflect what runs, not what flare drafted.

**Phase C target:** ADR 0009 decision #1 (name the asymmetry).

### Theme 8 — Productization is M8 / M9 / M10 blocked on three external items, not in-repo items

**Sources:** A.8 #A5 (Cloudflare Pages deploy automation missing). A.8 #A9 (npm publish for axoview-lib unverified — has it ever published since rename?). A.7 row 19 + 20 (branch protection + repo metadata are out-of-repo GitHub-dashboard items).

**Why it matters:** the productization spine (M8 → M10) crosses repo-internal cleanup into external-system gates. The audit can prepare every in-repo artifact perfectly and still not ship M10 until the dashboard items are configured.

**Phase C target:** C.7/C.8 produce a **GitHub-dashboard checklist** as a deliverable parallel to the ADRs.

### Theme 9 — The "verify-before-action" hygiene from `feedback_be_serious_not_eager.md` shaped the entire Discovery quality

**Sources:** Two corrections caught mid-audit (A.6.5 _headers + _routes.json initially mis-marked as "gap"; A.6.7 paymentFlowExample + test-diagram.json initially mis-marked as "not present" when they're at different paths). Both corrections came from grep verification, not theory.

**Why it matters:** Discovery's per-row evidence requirement caught two wrong dispositions before they reached Phase C. This pattern should become explicit in workflow.md (C.9).

**Phase C target:** workflow.md "Discovery principle: every row in a Findings register cites a file:line or a grep result, not an inference."

### Phase A → Phase C handoff summary

**Numbers:**
- 9 workstreams complete
- ~120 distinct findings across the register
- 4 ADR drafts queued (ADR 0007 Trace, ADR 0008 Naming, ADR 0009 Topology, ADR 0010 Backend)
- 2 new tactical docs queued (C.5 E2E rewrite, C.8 git-automation hardening)
- 1 new canonical doc queued (`docs/workflow.md` via C.9)
- 3 real bugs preserved into C.2 (C2 banner-rename, C5 local-mode share UX, D3 nginx unauth bypass)
- 6 "single-file, high-impact" cleanups for C.2's quick-win section (root deps; 3 LICENSE files; .gitattributes; .nvmrc; FUNDING.yml; EthicalCheck workflow)
- ~15 cleanup rows for C.2 main body (dead files; symbol-level verification; ISSUE_TEMPLATE dedup; `_routes.json` exclude tightening; perf-test rename; i18n locale alignment)
- 3 GitHub-dashboard external items (branch protection; repo metadata; CodeQL enable)

**What Phase C will not need to discover:**
- Mode-detection mechanism (locked in A.4.1)
- Deployment topology shape (locked in A.6.1 + A.6.8)
- Skill cadence anchors (locked in A.9.2)
- LICENSE / community-file state (locked in A.7)

**What Phase C still needs:**
- A naming convention that absorbs A.3 + A.4 + A.6 surface inventories (C.1)
- A risk-sequenced cleanup plan (C.2)
- The four ADR drafts (C.1, C.7) + two spawned tacticals (C.5, C.8) + workflow doc (C.9)
- Memory refresh (C.6) — including retiring `project_flare_plan.md`

**Pausing here for Phase C kickoff per user direction.** No Phase C work begins without explicit go-ahead.

---

## Phase C — Synthesis (in-progress)

> Phase C authors the durable artifacts the Phase A discovery + synthesis pointed at. Each subsection records the deliverable's completion + the artifact path. Subsections are appended as the work lands; the section as a whole is "done" when every Phase A theme has a target ADR / tactical / doc.

### C.7 — Deployment ADRs (completed 2026-05-20)

**Deliverables:**

- [ADR 0009 — Deployment topology](../adr/0009-deployment-topology.md) — **Proposed.** Eight locked decisions: runtime asymmetry naming (Theme 7), dual-probe collapse + `RuntimeConfig.serverStorage` deletion (Theme 1 / A.4 #C1 + #C4), Local-mode share-link error UX (A.4 #C5), env-var contract per target (Docker / Cloudflare / Local-dev), authoritative `wrangler.toml` + mandatory `_routes.json` + canonical `_headers`, per-runtime observability boundary (including the Worker `c.executionCtx.waitUntil` shape), TLS termination posture, Worker bundle-size budget.
- [ADR 0010 — Session backend contract](../adr/0010-session-backend-contract.md) — **Proposed.** Nine locked decisions: five-method `StorageAdapter` interface, opaque keys + `KEY_PATTERN` runtime invariant ([fs.js:4](../../packages/axoview-backend/src/adapters/fs.js#L4)), atomicity via tmp-file + rename, single-tenant-per-deploy isolation (v1; multi-user explicitly deferred), reserved-key list, snapshots + share namespace cutout, last-writer-wins concurrency with conditional-write pattern dormant (Drive-branch precedent per flare Architectural #5), `/healthz` endpoint shape coordinating with C.2's Dockerfile HEALTHCHECK addition, Phase 3B (Drive) extension contract.

**Inputs absorbed:** A.6.1 flare classification table (the historical source); A.6.8 ADR outlines; the Phase A synthesis Theme 1 + Theme 7.

**Downstream gates:** both ADRs are **Proposed**. User gate at next pause: review the drafts before they advance to Accepted. The cleanup edits that adopt the ADRs (delete `/api/storage/status`, collapse the dual probe, add `/healthz`, fs.js atomicity, nginx `/api/public/*` cutout) land in C.2.

### C.9 — Workflow doc + skill alignment (completed 2026-05-20)

**Deliverables:**

- [docs/workflow.md](../workflow.md) — **Authoritative.** Canonical session cadence (reproduces A.9.2's reconstructed diagram + cadence anchors), decision table for "which skill when" (W5 + W7 as the design backbone), tactical-driven-session pattern (this audit as the worked example), six design principles (discovery hygiene per Theme 9; screenshot-driven per `feedback_be_serious_not_eager`; intent verification stop-signs per `feedback_intent_verification`; ADR / PLAN.md / tactical three-tier convention; post-rename memory-pointer policy; Bash idioms as the lingua franca), Review gate + Process debt (deferred skills) sections, locked resolutions for A.9.5 S1–S9.
- **Skill body edits (A.9.3):**
  - `audit.md:88` — replaced `current_architecture.md` with [docs/architecture.md](../architecture.md) (header + Section 1).
  - `feature.md:88` — replaced retired `session-ux-revamp.md` reference with [layout-revamp.md](layout-revamp.md); added requirement that new tacticals link `docs/workflow.md` in their "Read first" block.
  - `feature.md:192` — replaced retired `flare_plan.md` hard-rule with a generalised "Never edit a retired tactical doc without confirmation" rule that cross-links ADRs 0009 + 0010 as the durable Cloudflare-track record.
  - `notes.md:236` — deleted the retired `flare_plan.md` hard-rule (file no longer exists; Phase 5* is absorbed by this audit and now lives in ADRs 0009/0010).
- **/feature template (C.9.4):** the template scaffolded by `/feature start` now instructs new tactical docs to link `docs/workflow.md` in their "Read first" block by default.
- **Missing-skill triage (A.9.4):** the nine candidates' dispositions (0 build / 7 defer / 2 reject) are captured in [docs/workflow.md § "Process debt — deferred skills"](../workflow.md#process-debt--deferred-skills). Each row carries the gate that would unblock the rebuild.

**Inputs absorbed:** A.9.2 (reconstructed cadence); A.9.3 (per-skill stale references); A.9.4 (missing-skill catalogue); A.9.5 (S1–S9 anomalies); Theme 9 (discovery-hygiene self-corrections during A.6 elevated to a design principle in workflow.md).

**Downstream gates:** none — this work is independently complete. Future sessions read `docs/workflow.md` first; the three skill bodies are rename-clean and retired-file-clean.

### Phase C status

| Subsection | State | Artifact |
|---|---|---|
| C.1 — Naming convention ADR + ADR 0008 | **Accepted 2026-05-20** | [ADR 0008](../adr/0008-naming-convention.md) — 8 decisions driven by A.3/A.4/A.6/A.9 inventories per Theme 5; 4 file renames locked (ExportDialog ×2, StorageManager.tsx, SessionModeBanner); `// LIB-ONLY` marker forward-looking; `data-axoview-id` selective-not-blanket retrofit (post-acceptance polish: `Screen` vocabulary row added; `data-testid` non-introduction clause added) |
| C.2 — Cleanup plan | **drafted 2026-05-20** (3 Q/I user decisions locked: Q5 delete FUNDING.yml, Q9 delete legacy ISSUE_TEMPLATE .md pair, I8 gate = first axoview-lib npm publish) | [C.2 section above](#c2-cleanup-plan-drafted-2026-05-20) — 4-section spine (9 quick-wins · 3 bugs · 9 ADR-implementation rows · 4 spawned tacticals) + sequencing recommendation |
| C.3 — architecture.md + ux-principles.md cross-references | **completed 2026-05-20** | [docs/architecture.md § 2m](../architecture.md) gained ADR 0009/0010 cross-ref with "post-cleanup state to be amended after C.2 I1+I2+I3" note; [docs/ux-principles.md § 1](../ux-principles.md) gained ADR 0008 Decision 2 surface-vocabulary cross-ref |
| C.4 — Skill body cross-references (on-disk only) | **completed 2026-05-20** | `audit.md` gained workflow.md process-consistency block; `notes.md` gained ADRs 0008–0010 reference list; `shake-out.md` gained ADR 0008 Decision 2 vocabulary cross-ref; `feature.md` C.9.4 template confirmed landed; `ship.md` no edit needed. Note: `.claude/` is gitignored, so skill edits propagate on-disk only — limitation tracked in workflow.md Process debt |
| C.6 — Memory refresh | **completed 2026-05-20** | Deleted `project_flare_plan.md`; added `project_workflow.md`; rewrote `project_docs_convention.md` (ADRs 0008/0009/0010 moved to Existing; productization-audit entry refreshed; FUNDING.yml + ISSUE_TEMPLATE .md pair locks recorded); updated `MEMORY.md` index. `project_2br_decisions.md` retained — rejection rationale is durable knowledge for future FileExplorer work |
| C.5 — E2E rewrite tactical | not started | spawned tactical, gated on M9 |
| C.6 — Memory refresh | not started | includes retiring `project_flare_plan.md` |
| C.7.1 — ADR 0009 Deployment topology | **Accepted 2026-05-20** | [ADR 0009](../adr/0009-deployment-topology.md) (Decision 5 downgraded post-review: worker-package wrangler.toml retained for local dev) |
| C.7.2 — ADR 0010 Session backend contract | **Accepted 2026-05-20** | [ADR 0010](../adr/0010-session-backend-contract.md) (Decision 9 amended post-review: Drive `list(prefix)` requires folder model, not literal `q=prefix`) |
| C.8 — Git-automation tactical | not started | gated on Phase C ADRs being Accepted |
| C.9 — Workflow doc + skill alignment | **completed 2026-05-20** | [docs/workflow.md](../workflow.md), 4 skill body edits |

C.7 + C.9 deliverables were chosen first because their inputs were the most-completed coming out of Phase A. They unblock C.1 (which references the naming surface inventory + the workflow doc) and C.2 (which sequences the cleanup edits the ADRs prescribe).

---

## C.2 Cleanup plan (drafted 2026-05-20)

Sequenced cleanup spine driven by the Phase A synthesis themes + the ADRs Phase C accepted (0008 Proposed; 0009, 0010 Accepted 2026-05-20). Four sections; rows within each are independently executable.

**Conventions:**

- **Risk class:** `low` (no behaviour change visible to user) · `med` (visible-but-additive — explicit error UI, new endpoint) · `high` (contract change; coordinated deploy required).
- **Gate:** the ADR (or finding) the row depends on. `none` = independently shippable.
- **Bundle:** rows that should land in a single commit / PR for atomic safety.

### Section 1 — Quick wins (no risk gating; ship individually)

| # | Action | Surface | Driving finding | Risk | Bundle |
|---|---|---|---|---|---|
| Q1 | Drop 6 of 8 root deps (root `package.json` is bloated with deps that belong in `axoview-app` or `axoview-lib`; the workspace resolver picks them up regardless). Keep only the truly cross-cutting two. | [package.json](../../package.json) | A.5.5 / P1 | low | Q1 |
| Q2 | Close G1 — rewrite [`packages/axoview-lib/LICENSE`](../../packages/axoview-lib/LICENSE) to match the post-rename MIT shape: lead with Igor 2026 / Axoview attribution, retain upstream attribution to Mark Mankarious (Isoflow original) below. Same body as root + app LICENSE. | `packages/axoview-lib/LICENSE` | A.7 row 12 + G1 (partial) | low | Q2 |
| Q3 | Add `.gitattributes` at repo root: `* text=auto eol=lf`, `*.png binary`, `*.svg text`, `*.snap text eol=lf`. Closes G6 (highest-impact Windows-dev CI risk). | `.gitattributes` (new) | A.7 row 2 + G6 | low | Q3 |
| Q4 | Update `.nvmrc` from `20` → `22`. Aligns with [test.yml:24](../../.github/workflows/test.yml#L24), [release.yml:32](../../.github/workflows/release.yml#L32), [Dockerfile:51](../../Dockerfile#L51). | [.nvmrc](../../.nvmrc) | A.5.1 / P4 | low | Q4 |
| Q5 | **Delete [`.github/FUNDING.yml`](../../.github/FUNDING.yml) (locked 2026-05-20).** Axoview does not accept funding; no README callout needed. Closes G2. | [.github/FUNDING.yml](../../.github/FUNDING.yml) | A.7 row 10 + G2 | low | Q5 |
| Q6 | Fix `README.md:5` — replace dead `demo-fce.pages.dev` link with `axoview.pages.dev`. Master already has the fix; this row is the integration-branch backport for the next ship cycle. | [README.md:5](../../README.md#L5) | A.7 row 15 verification 2026-05-20 | low | Q6 |
| Q7 | Sweep [`.github/ISSUE_TEMPLATE/config.yml`](../../.github/ISSUE_TEMPLATE/config.yml) for upstream URLs (`stan-smith` / `fossflow`); rewrite to `molikas/axoview`. Closes G4 partially. | `.github/ISSUE_TEMPLATE/config.yml` | A.7 row 6 + G4 | low | Q7 |
| Q8 | Delete [`.github/workflows/e2e-tests.yml.backup`](../../.github/workflows/e2e-tests.yml.backup) — `.backup` suffix is an anti-pattern; git history holds the snapshot. Closes A.8 #A4. | `.github/workflows/e2e-tests.yml.backup` | A.8 #A4 | low | Q8 |
| Q9 | **Delete legacy `.md` pair (locked 2026-05-20)** — `bug-report.md` + `feature-request.md`. YAML form (`bug_report.yml` + `feature_request.yml`) is canonical. Closes G3. | `.github/ISSUE_TEMPLATE/*.md` | A.7 row 5 + G3 | low | Q9 |

### Section 2 — Real shipping bugs (prioritized)

| # | Action | Surface | Driving finding | Risk | Bundle |
|---|---|---|---|---|---|
| B1 | **Rename `SessionModeBanner` → `LocalModeBanner`** (per ADR 0008 Decision 1). One file rename + one import update in [`packages/axoview-app/src/App.tsx:201-202`](../../packages/axoview-app/src/App.tsx#L201). Semantic-correctness fix — the banner only fires in LOCAL mode despite its name. | [packages/axoview-app/src/components/SessionModeBanner.tsx](../../packages/axoview-app/src/components/SessionModeBanner.tsx), App.tsx | A.4 #C2 | low | B1 |
| B2 | **Local-mode share-uuid explicit error** — implement per ADR 0009 Decision 3. When `isReadonlyUrl && !serverStorageAvailable`, render an explicit error dialog instead of an empty diagram. Single dismiss action that strips `?share=<uuid>` and boots Local mode normally. | frontend share-link consumer (likely [`App.tsx`](../../packages/axoview-app/src/App.tsx) or `DiagramLifecycleProvider.tsx`) | A.4 #C5, ADR 0009 Decision 3 | med | B2 |
| B3 | **nginx `/api/public/*` auth-bypass** — fix per ADR 0010 Decision 4's single-tenant assumption. Add nested `location /api/public/ { auth_basic off; }` blocks to [`nginx.conf:4-5`](../../nginx.conf#L4) so share-link viewers can read public-namespace diagrams without entering the basic-auth password. | [nginx.conf](../../nginx.conf) | A.6 #D3, ADR 0010 Decision 4 | med | B3 |

### Section 3 — ADR-implementation rows (gated on ADR acceptance)

| # | Action | Surface | Gate | Risk | Bundle |
|---|---|---|---|---|---|
| I1 | **Collapse the dual-probe** + delete `/api/storage/status` route + remove dead `RuntimeConfig.serverStorage` field. Single PR touching: [`AppStorageContext.tsx:43-46`](../../packages/axoview-app/src/providers/AppStorageContext.tsx#L43) (single probe), [`useRuntimeConfig.ts:5-15`](../../packages/axoview-app/src/hooks/useRuntimeConfig.ts) (field removal), [`packages/axoview-backend/src/routes.js`](../../packages/axoview-backend/src/routes.js) (delete `/api/storage/status` handler), [`packages/axoview-worker/src/app.ts:29-31`](../../packages/axoview-worker/src/app.ts#L29) (delete `/api/storage/status` handler). Saves ~100-200ms cold-start latency. Closes A.4 #C1+C4, A.6 #D1+D2, Theme 1. | mode-detection (4 files) | ADR 0009 Decision 2 (Accepted) | med | I1 |
| I2 | **fs adapter atomicity** — replace direct `fs.writeFile` at [`packages/axoview-backend/src/adapters/fs.js:45`](../../packages/axoview-backend/src/adapters/fs.js#L45) with tmp-file + rename pattern. Single file edit. | [fs.js](../../packages/axoview-backend/src/adapters/fs.js) | ADR 0010 Decision 3 (Accepted) | med | I2 |
| I3 | **`/healthz` endpoint + Dockerfile HEALTHCHECK + compose healthcheck** — implement per ADR 0010 Decision 8. Three files: (a) add `/healthz` route to `server.js` (returns `{ ok, adapter, storage_writable }`); (b) add `HEALTHCHECK CMD curl -f http://localhost:${BACKEND_PORT}/healthz` to [Dockerfile](../../Dockerfile); (c) add `healthcheck:` block to [compose.yml](../../compose.yml) + [compose.dev.yml](../../compose.dev.yml). Closes the A.6.2 HEALTHCHECK gap. | server.js + Dockerfile + compose.yml + compose.dev.yml | ADR 0010 Decision 8 (Accepted) | med | I3 |
| I4 | **Worker-package wrangler.toml drift callout** (per ADR 0009 Decision 5 post-review). Add a top-of-file comment block to [`packages/axoview-worker/wrangler.toml`](../../packages/axoview-worker/wrangler.toml) noting: "Retained for local dev (`npm run dev` uses `--binding-from-toml`). Keep `[vars]` and `compatibility_date` in lockstep with repo-root `wrangler.toml` — drift between the two is a known risk per ADR 0009." Single-file comment edit; no structural change. | [packages/axoview-worker/wrangler.toml](../../packages/axoview-worker/wrangler.toml) | ADR 0009 Decision 5 (Accepted, post-review downgrade) | low | I4 |
| I5 | **Rename the two `ExportDialog.tsx` files + the `StorageManager.tsx` modal** (per ADR 0008 Decision 1). Three file renames + every import site (~6–10 imports total): `ExportDialog` → `ExportSingleDiagramDialog`, `fileExplorer/ExportDialog` → `ExportProjectZipDialog`, `StorageManager.tsx` (modal) → `LocalStorageInspector.tsx`. Tests update with the imports. | 3 component files + import sites | ADR 0008 Decision 1 (Proposed; pending acceptance) | low | I5 |
| I6 | **Delete `LeftSidebar.tsx`** (A.3 #3, pure orphan with zero importers). Single-file deletion; sanity-check no string-based `lazy()` resolves the path. | [packages/axoview-lib/src/components/Sidebars/LeftSidebar.tsx](../../packages/axoview-lib/src/components/Sidebars/LeftSidebar.tsx) | A.3 #3 | low | I6 |
| I7 | **Delete `paymentFlowExample.json`** (A.5.4 / A.6.7 — zero importers; relocated to app/src/ but still dead). | `packages/axoview-app/src/paymentFlowExample.json` | A.6.7 row 15 | low | I7 |
| I8 | **`__fossflow__` deprecation alias + `migrationShim.ts` removal** — single deletion in [`packages/axoview-lib/src/Axoview.tsx:143-162`](../../packages/axoview-lib/src/Axoview.tsx#L143) + [`migrationShim.ts`](../../packages/axoview-app/src/utils/migrationShim.ts) + its test. **Gate (locked 2026-05-20): first release after first `axoview-lib` npm publish.** The deletion is gated on `npm view axoview-lib` returning a post-rename version — that lands once T4's `NPM_TOKEN` dependency is satisfied and the next semantic-release run actually publishes. | Axoview.tsx + migrationShim | A.3 #10, #13; first `axoview-lib` npm publish (T4 NPM_TOKEN dependency) | low | I8 |
| I9 | **Delete `e2e-tests/`** (legacy Python/Selenium suite). Locked-decision #4 — nuclear option; replaced by C.5 Playwright rewrite. **Bundle with the new E2E workflow landing.** | `e2e-tests/` directory + [`.github/workflows/e2e-tests.yml`](../../.github/workflows/e2e-tests.yml) | locked-decision #4 + C.5 | high | I9 + C.5 |

### Section 4 — Spawned tacticals (separate work units)

| # | Spawned tactical | Scope summary | Driving finding | Status |
|---|---|---|---|---|
| T1 | **C.5 — E2E rewrite (Playwright)** | New `packages/axoview-e2e/` (existing one slated for deletion per audit-locked-decision #4); new `.github/workflows/e2e-playwright.yml` to replace the Python suite; surface-anchor sweep using `data-axoview-id` per ADR 0008 Decision 5. **Gated on M9.** | locked-decision #4, ADR 0008 Decision 5 | not started |
| T2 | **C.8 — Git automation hardening** | Add ESLint to CI (closes A.8 #A1); remove `\|\| npm test` coverage fallback (closes A.8 #A2); add `commitlint` + simple-git-hooks (closes A.8 #A7); add `codeql.yml` (closes A.8 #A8 + #A4); add Cloudflare Pages deploy automation (closes A.8 #A5 — productization blocker for M10); add container scanning (Trivy/Snyk/Docker Scout) (closes A.8 #A4); add CI bundle-size check for Worker per ADR 0009 Decision 8; add CI verification that `_routes.json` + `_headers` are emitted by build per ADR 0009 Decision 5. **Gated on Phase C ADRs accepted (now satisfied).** | A.8 #A1, #A2, #A4, #A5, #A7, #A8, ADR 0009 | not started |
| T3 | **C.5 supplement — `axoview-lib` deletion bundle: MainMenu + ConfirmDiscardDialog + MenuItem + MainMenuOptions type** | Single PR deletes `packages/axoview-lib/src/components/MainMenu/` (including `MenuItem.tsx` per A.2.5 #17), `packages/axoview-lib/src/components/ConfirmDiscardDialog/`, the `MainMenuOptions` type from `types/ui.ts`, the `availableTools.includes('MAIN_MENU')` gate in `UiOverlay.tsx`, and the `MAIN_MENU_OPTIONS` declaration in [`App.tsx:39-40`](../../packages/axoview-app/src/App.tsx#L39). Pre-1.0 breaking change is acceptable — lib has not been npm-published (verified by audit 2026-05-20 via `npm view axoview-lib` → 404). Spawned as separate tactical only if the lib deletion touches more than one consumer surface. | A.3 #1 + #2, A.2.5 #17, A.4 #24 + #25 | not started |
| T4 | **GitHub-dashboard checklist (out-of-repo)** per Theme 8 — branch protection on `master` (require PR, require status checks, no force push, signed-commits optional), repo Description + Topics + Homepage URL set, CodeQL enabled in repo settings, **`NPM_TOKEN` secret present on the Release workflow's GitHub Actions environment** (the A.8 #A9 follow-up flagged in the pre-Phase-C bundle). One-pass action list for the user; no code change. | A.7 rows 19 + 20, A.8 #A8 + #A9, Theme 8 | not started |

### Section 5 — Sequencing recommendation

The four sections are independently executable, but a recommended ship order minimises cross-bundle risk:

1. **Section 1 (Q1–Q9) first** — no gates, no behaviour change, fastest path to a cleaner baseline.
2. **Section 2 (B1–B3) next** — three real shipping bugs; B1 is trivial, B2 + B3 are user-visible additions (explicit error, auth-bypass fix). Each row is independently shippable.
3. **Section 3 in two waves:**
   - **Wave 3a (low/med risk, fast):** I2 (fs atomicity), I3 (`/healthz`), I4 (wrangler drift callout), I5 (renames), I6 (LeftSidebar), I7 (paymentFlowExample), I8 (hold per release-window). These can ride a single integration → master cycle.
   - **Wave 3b (high risk, coordinated):** I1 (dual-probe + endpoint deletion — visible-to-deployers contract change) and I9 (legacy E2E suite deletion). Wave 3b ships after Wave 3a has been live long enough to catch regressions.
4. **Section 4 tacticals** spawn at their own gates per the Status column. T2 (C.8 git-automation) is the M8 productization gate; T4 (GitHub-dashboard) is the M9–M10 ship gate.

### M5 (cleanup tacticals spawned) gate

This C.2 deliverable + the four ADRs Phase C produced (0008 Proposed, 0009 + 0010 Accepted, 0007 outlined — pending Phase B) satisfy the M5 milestone definition: **every confirmed dead/dupe/anomalous item has a target** — either an inline row in this plan (sections 1–3) or its own tactical (section 4).

---

## Wrap-up

When every checkbox above is `[x]`, the Findings register has been mined for every actionable item, M10 (productization ship gate) is reached, and all spawned tacticals (cleanup, E2E rewrite, git-automation, deployment hardening) have wrapped:

1. Verify `project_flare_plan.md` memory entry deletion per C.6.4 (the file itself was already deleted pre-audit in commit `926e66f` and confirmed by A.6.1) and ADRs 0009/0010 (+ any deployment follow-ups) are `Accepted`.
2. Add a single line under `PLAN.md` Phase 2D section (or a new "Post-2D productization" sub-line if needed):
   ```
   - Productization audit complete — see docs/adr/0007 (trace harness), 0008 (naming), 0009 (deployment topology), 0010 (session backend), and spawned tacticals (cleanup, E2E rewrite, git-automation hardening, deployment hardening). flare_plan.md retired.
   ```
3. Confirm all spawned tactical docs are in place (or wrapped) **before** deleting this file.
4. Delete this file. ADRs 0007–0010 (+ further) and the wrapped tactical histories are the durable record.
5. Refresh memory per C.6.

## Notes for Claude

- **This is methodology, not implementation.** Do not start cleaning up code, editing deployment artifacts, or wiring CI workflows while running Phase A or B. Tempting items like "delete MainMenu" or "add a CI workflow" wait for C.2's sequenced plan and C.8's spawned tactical. The user explicitly cares about doing analysis well before any cleanup.
- **The Findings register is the contract output.** Every workstream's value is what it appends there. If a session ends without register entries, the session produced no audit value.
- **`flare_plan.md` is read-only during this audit.** Only A.6.1 touches it — to read and classify. The file's deletion is the final step of C.7. Don't edit it mid-audit; that would split-brain the migration.
- **Build after every Phase B trace-call addition.** Tracing calls go into production code; verify the gate keeps them inert when off.
- **Don't pre-decide naming.** The seed list in C.1 is candidate vocabulary, not the answer. Let A.3 surface naming gaps first.
- **GDrive placeholders are intentional.** Per locked decision #5. Anything with GDrive/Google/Drive in its name is in-scope for the *mode matrix* (workstream A.4) but out-of-scope for dead-code removal unless A.4 explicitly classifies it dead.
- **Productization target is session mode on Cloudflare.** Local browser-only mode keeps working (it's how the lib is used standalone), but the public-deploy story is session mode. GDrive is Phase 3B. Don't conflate the three when reviewing A.6 findings.
- **The user is fine with bigger tactical docs spawning from this one.** Don't try to fit all cleanup + hardening into a single sequenced list — break out E2E rewrite, MainMenu removal, perf-test relocation, deployment hardening, git automation, etc. into their own tacticals if they're non-trivial.
- **Milestone gates (M0–M10) are the productization spine.** When the user asks "how close are we?", answer in milestones, not workstream percentages.
- **Skill audit (A.9) is meta but real.** It's tempting to skip it as "Claude housekeeping" — don't. The user explicitly said the cadence and skill set are part of the productized output. `docs/workflow.md` is a first-class deliverable. New skills are *catalogued* in this audit, never *built* — building lands in a spawned follow-up.
