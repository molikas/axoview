# Axoview Technical Review — 2026-05

> **Status:** Session A complete (sections 0–4 + 9). Sessions B + C populate sections 5–8 + 10–11. Last updated 2026-05-23.

---

## 0. How to use this document

**Audience.** An external reviewer (likely another AI agent) asked to assess Axoview's current state and suggest improvements. The artifact serves two lenses at once:

1. **General code-quality review** — architecture, testing, technical debt, maintainability.
2. **Productization-readiness review** — distribution model, deployment posture, CI/CD discipline, error UX, security headers, repo hygiene.

The reviewer prompts in [§10](#10-reviewer-prompts) split into two checklists; the rest of the artifact serves both.

**Reading order.**

- Read **1 → 2 → 3 → 4** sequentially. Those four sections build the mental model.
- Jump to **§10** for the actual review questions.
- Treat **§5–§8** as reference material; consult as needed.
- **§9** is the durable decisions record (ADRs are the source of truth; §9 is a quick-scan view).
- **§11** lists known gaps the productization audit did not close — review for cumulative-debt impact.

**Snapshot date.** This artifact is dated **2026-05-23** and is **not a living doc**. It captures the post-M10 state of the [productization audit](tactical/productization-audit.md) (v1.0.0 shipped 2026-05-23). The audit itself, the ADRs, [PLAN.md](../PLAN.md), and [docs/architecture.md](architecture.md) are the living artifacts; this one is a frozen review surface.

**Vocabulary note (load-bearing).** Two pairs of terms appear throughout, and one of them is inverted from intuition:

| User-facing prose says… | Internal code-name says… | What it means |
|---|---|---|
| **browser-only** | **Local mode** | No backend; the SPA persists to `localStorage` / `sessionStorage`. Default Cloudflare Pages posture today. |
| **server-backed** | **Session mode** | An Express-or-Worker backend persists diagrams. The Docker compose stack runs in this mode. |

The historical name `Session mode` originated when the only persistence path was the per-tab `sessionStorage` — over time the backend became the load-bearing storage and the name stuck despite the inversion. This artifact uses **"browser-only"** and **"server-backed"** in narrative prose. Internal symbols (`LocalModeBanner`, `LocalStorageProvider`, `SessionStorageGauge`) keep their code names. See [ADR 0008 Decision 1](adr/0008-naming-convention.md#1-component-file-names-disambiguate-when-colliding-describe-surface-not-state) for the rename that closed the worst offender (the old `SessionModeBanner` was renamed `LocalModeBanner` precisely because it only fires in browser-only mode).

**One more vocabulary lock — Dialog / Modal / Popover / Panel / Banner / Screen.** [ADR 0008 Decision 2](adr/0008-naming-convention.md#2-modal-vs-popover-vs-dialog-vs-panel--locked-vocabulary) and [ADR 0011 §2](adr/0011-error-ux-contract.md) reserve these terms. The reviewer should expect "Dialog" to mean centred + focus-trapped + dismissible (the error-UX shape), "Popover" to mean trigger-anchored, "Panel" to mean persistent chrome region.

---

## 1. Executive summary

Axoview is a browser-based isometric diagram editor — a fork of the upstream [FossFLOW](https://github.com/stan-smith/FossFLOW) project (lineage acknowledged in the lib's LICENSE) that has been hardened, restructured, and productized to ship as a self-hostable Docker container and as a Cloudflare Pages deployment at [https://axoview.pages.dev/](https://axoview.pages.dev/). The user-facing artefact is an SPA: drag icons onto an isometric (or 2D cartesian) grid, connect them with routed connectors, label them, group them into views and layers, save the workspace as a tree of folders + diagrams, and either share a public-snapshot URL or export the whole workspace as a project zip.

The 2026 work split into two arcs. **Arc 1 (Phase 0A → 2D, completed by early May 2026)** rebuilt the editor's foundations: a 745-line `App.tsx` was decomposed into focused providers ([Phase 0A](../PLAN.md)); a notification store replaced six `alert()` calls ([Phase 0B](../PLAN.md)); the canvas gained a 2D cartesian mode alongside the isometric default ([Phase 1A](../PLAN.md), [ADR-free, strategy-pattern via `coordinateTransforms.ts`](../packages/axoview-lib/src/utils/coordinateTransforms.ts)); a pluggable storage interface replaced inline service calls ([Phase 2A](../PLAN.md)); a VS Code-style file explorer landed ([Phase 2B + 2B-R](../PLAN.md)); cross-diagram links became a first-class feature ([Phase 2C](../PLAN.md)); and a four-group right-zone top toolbar replaced the prior burger-menu junk drawer ([Phase 2D / ADR 0005](adr/0005-toolbar-and-dock-layout-contract.md)). By the end of Arc 1 the editor's UX had reached the polish layer — MQA #7 (multi-element drag perf), MQA #8/#9 (multi-select + Ctrl+A per [ADR 0006](adr/0006-canvas-selection-contract.md)), MQA #26 (imported-icon delete + tombstone), and a typography contract ([UX §1.5](ux-principles.md#15-typography-is-theme-driven--six-tiers-picked-by-role)) all shipped between mid-April and mid-May.

**Arc 2 — the productization audit** ([docs/tactical/productization-audit.md](tactical/productization-audit.md), 2026-05-19 → 2026-05-23) — is what made the v1.0.0 release possible. The audit produced 17 [locked decisions](tactical/productization-audit.md#locked-decisions-from-scoping-discussion-2026-05-19) (catalogued in [§9.2](#92-locked-decisions-productization-audit)), four Accepted ADRs ([0008 Naming](adr/0008-naming-convention.md), [0009 Deployment topology](adr/0009-deployment-topology.md), [0010 Session backend contract](adr/0010-session-backend-contract.md), [0011 Error UX](adr/0011-error-ux-contract.md)), three spawned tacticals ([E2E rewrite](tactical/e2e-suite-rewrite.md), [git-automation hardening](tactical/git-automation-hardening.md), and the cleanup waves embedded in the audit itself), and a canonical workflow doc ([docs/workflow.md](workflow.md)) codifying the session cadence. The audit ran across nine discovery workstreams (A.1–A.9) and synthesised them into nine cross-workstream themes — the most consequential being the **dual-probe collapse** (boot-time mode detection used to fire two parallel `Promise.all`'d HTTP requests; per [ADR 0009 D2](adr/0009-deployment-topology.md#2-mode-detection-collapses-to-a-single-probe-runtimeconfigserverstorage-is-removed) this is now a single `/api/config` call) and the explicit naming of the **runtime asymmetry** (one HTTP contract, one Express adapter, one Worker short-circuit — *not* "one contract, two adapters" as the retired flare plan had it; see [ADR 0009 D1](adr/0009-deployment-topology.md)).

**What shipped in v1.0.0** (2026-05-23, milestone [M10](tactical/productization-audit.md#end-to-end-productization-path)):

- **Two deployment targets, one HTTP contract.** Self-host via `docker compose up --build` (Express + nginx + filesystem adapter); Cloudflare Pages via native git integration (Worker + Pages Functions, storage-less today). The Worker is intentionally storage-less; persistent storage on the Cloudflare side returns when the Google Drive provider lands as Phase 3B. See [ADR 0009](adr/0009-deployment-topology.md).
- **Distribution = container + CDN.** No npm publish for `axoview-lib`; per [Locked Decision #11](tactical/productization-audit.md#locked-decisions-from-scoping-discussion-2026-05-19) the lib is monorepo-only. No Docker Hub image; per [Locked Decision #12](tactical/productization-audit.md#locked-decisions-from-scoping-discussion-2026-05-19) the day-1 self-host story is `git clone + docker compose up`. Both are explicit deferrals with their own ADR + tactical when the user need surfaces.
- **Explicit-error UX for failure-of-intent paths.** Per [ADR 0011](adr/0011-error-ux-contract.md), three dialogs (`LocalModeShareErrorDialog`, `ReadonlyLoadErrorDialog`, `PublicShareLoadErrorDialog`) replace prior silent-empty-canvas states and toast-only fallbacks. The pattern is `<Scenario>ErrorDialog.tsx` + `dialog.<scenario>.*` i18n namespace; side-effect failures (autosave retry, thumbnail dynamic-import) keep their toasts.
- **CI baseline locked.** Per [Locked Decision #16](tactical/productization-audit.md#locked-decisions-from-scoping-discussion-2026-05-19) every push/PR enforces ESLint, Jest coverage thresholds, build-output shape (`_routes.json` + `_headers` must ship), commitlint via `simple-git-hooks`, CodeQL static analysis, and the Worker bundle stays under 1 MB uncompressed per [ADR 0009 D8](adr/0009-deployment-topology.md). Knip runs continuously as soft-fail.
- **E2E suite green.** Per [Locked Decision #4](tactical/productization-audit.md#locked-decisions-from-scoping-discussion-2026-05-19) both prior E2E suites (legacy Python/Selenium and a stale Playwright suite) were deleted; the rewrite is 13 spec files / 33 tests against the J1–J20 [manual test baseline](manual-test-baseline.md), runs on every PR + master push via [`e2e-playwright.yml`](../.github/workflows/e2e-playwright.yml).
- **README + deployment docs reflect shipped reality.** Post-audit cleanup commit `c208fd0` (2026-05-23) replaced operational FossFLOW references with Axoview and corrected the post-audit drift; deployment docs match the env-var contract in [ADR 0009 §4](adr/0009-deployment-topology.md#4-env-var-contract--one-section-per-target).

**What did not ship and is deferred.** Google Drive persistence (Phase 3B); npm publication of `axoview-lib`; a published Docker Hub image; multi-tenant session isolation ([ADR 0010 D4](adr/0010-session-backend-contract.md) explicitly locks single-tenant-per-deploy for v1); accessibility / visual-regression / performance E2E checks; full translations for the German + Indonesian locales (see [§11](#11-open-known-issues)).

**Composition.** The codebase is a Node 22 + npm 10 monorepo of four packages — [`axoview-lib`](../packages/axoview-lib/) (the published-shape React library; 1009 passing + 1 skipped across 93 jest suites total monorepo-wide as of 2026-05-23), [`axoview-app`](../packages/axoview-app/) (the SPA shell consuming the lib), [`axoview-backend`](../packages/axoview-backend/) (Express + filesystem adapter), and [`axoview-worker`](../packages/axoview-worker/) (Hono on Cloudflare Pages Functions) — plus a sibling [`axoview-e2e`](../packages/axoview-e2e/) Playwright test package. State management is Zustand (four stores: model, scene, ui, locale), persistence goes through a `StorageProvider` abstraction defined by [ADR 0010](adr/0010-session-backend-contract.md), UI is MUI v7. Build is rsbuild + tsc; tests are Jest + jsdom for the lib + app, Playwright Chromium for E2E.

**What's load-bearing about the audit, not the code.** The audit's most durable output is *process discipline* — [`docs/workflow.md`](workflow.md) codifies the canonical session cadence (Session start → Direct work → Verify → Polish → Review → Doc sync → Promotion), the design principles enforce "every Findings register row cites file:line or a grep result" ([Theme 9](tactical/productization-audit.md#theme-9--the-verify-before-action-hygiene-from-feedback_be_serious_not_eagermd-shaped-the-entire-discovery-quality), elevated to a workflow.md principle), and the 17 locked decisions form an unambiguous record of what is in/out of scope going forward. The reviewer's biggest leverage is verifying that the *contracts* (ADRs 0008–0011) match the *shipped reality* (code) — drift between them is the canonical productization risk this audit was designed to eliminate.

---

## 2. Before / After

The "Before" column anchors at ~2026-02 — the state at the rename merge `72fa120`, just before the productization arc began. The "After" column reflects post-M10 v1.0.0 (2026-05-23). Citations are commit SHAs or ADR numbers.

### 2.1 At-a-glance comparison

| Dimension | Before (~2026-02) | After (post-M10, 2026-05-23) | Evidence |
|---|---|---|---|
| **App shell** | `App.tsx` was 745 lines (intermixed state / effects / JSX) | `App.tsx` is 103 lines (pure provider composition) | [Phase 0A](../PLAN.md), [architecture.md §2l](architecture.md#2l-axoview-app-provider-decomposition-2026-04-27) |
| **Error feedback** | 6 `alert()` calls + ad-hoc inline toast | `notificationStore` Zustand-driven `NotificationStack`; failure-of-intent paths render explicit Dialogs | [Phase 0B](../PLAN.md), [ADR 0011](adr/0011-error-ux-contract.md) |
| **Storage backend** | Inline `storageService.ts` (build-time env injection); two-tab UI | `StorageProvider` interface ([ADR 0010](adr/0010-session-backend-contract.md)), `StorageManager` orchestrator, VS Code-style file explorer with folder CRUD | [Phase 2A + 2B-R](../PLAN.md) |
| **Mode detection on boot** | Two parallel probes (`/api/config` + `/api/storage/status`) | Single `/api/config` probe; `/api/storage/status` deleted | [ADR 0009 D2](adr/0009-deployment-topology.md#2-mode-detection-collapses-to-a-single-probe-runtimeconfigserverstorage-is-removed), commit `0810690` |
| **Share-link on browser-only** | Silent empty-diagram render | Explicit `LocalModeShareErrorDialog`; dismiss strips `?share=` and boots normally | [ADR 0009 D3](adr/0009-deployment-topology.md), commit `cff3942` |
| **Owner-readonly load failure** | Silent redirect to `/` | Explicit `ReadonlyLoadErrorDialog` with "back to editor" action | [ADR 0009 D3 addendum](adr/0009-deployment-topology.md), commit `2a04061` |
| **Self-host auth posture** | nginx HTTP Basic Auth layer + Express `AUTH_MODE` (two overlapping auth layers) | Single `AUTH_MODE` contract; nginx Basic Auth + `.htpasswd` plumbing removed | [Locked Decision #13](tactical/productization-audit.md#locked-decisions-from-scoping-discussion-2026-05-19) |
| **Top toolbar layout** | Junk-drawer burger menu (New/Open/Clear/Settings/GitHub/Version/Export×3 all under one icon) | Four-group RIGHT zone: View modes (reserved) · Save group · Document actions (Export/Share/Preview) · Sidebar toggle | [ADR 0005](adr/0005-toolbar-and-dock-layout-contract.md) |
| **Naming collisions** | Two `ExportDialog.tsx` in different paths; two `StorageManager` (component + class); `SessionModeBanner` shown in browser-only mode | All four renamed per [ADR 0008 D1](adr/0008-naming-convention.md#1-component-file-names-disambiguate-when-colliding-describe-surface-not-state) | commits per audit C.2 §1–§2 |
| **Surface vocabulary** | Dialog / Modal / Popover used interchangeably | Six locked terms: Dialog · Modal · Popover · Panel · Banner · Screen | [ADR 0008 D2](adr/0008-naming-convention.md#2-modal-vs-popover-vs-dialog-vs-panel--locked-vocabulary), [UX §1](ux-principles.md#1-layout) |
| **Connector model** | `labels[]` only (up to 256 labels); no name, no notes, no F2-rename | First-class `name` + `notes`; F2-rename; Details/Style/Notes tabbed panel (parity with nodes) | [ADR 0004](adr/0004-connector-name-and-details-panel.md) |
| **Selection model** | Single-item via `itemControls`; multi-select existed only inside Lasso mode | Persistent `selectedIds: ItemReference[]` slice; Ctrl+click, Ctrl+A, multi-drag, multi-delete | [ADR 0006](adr/0006-canvas-selection-contract.md) |
| **Multi-element drag perf** | 9–13 FPS on a 6-node drag for 12–19 s windows (MQA #7) | 24–44 FPS sustained; CSS-only preview + `previewConnectorPaths` action; one history entry per drag | [known_issues.md MQA #7](../known_issues.md), Path 4-true |
| **Icon catalog persistence** | Full bundled catalog written to every diagram on every save | Lean save strips bundled fixtures; load-time merge rehydrates them; `requiredPacks` field signals what to lazy-load | [ADR 0002](adr/0002-icon-catalog-merge-on-load.md), [ADR 0003](adr/0003-session-storage-lean-icon-save.md) |
| **Workspace I/O** | Single-diagram JSON export only | Project zip ([ADR 0001](adr/0001-project-zip-format.md)) with manifest + diagrams/ + tree-manifest; three scopes (project / folder / diagram); three destinations (root / new folder / replace-all) | Phase 2B-R + ADR 0001 |
| **fs adapter atomicity** | `fs.writeFile` direct (truncation risk on crash) | tmp-file + rename per [ADR 0010 D3](adr/0010-session-backend-contract.md#3-atomicity--every-put-is-all-or-nothing) | commit `6e1b28c` |
| **Health probes** | None | `/healthz` on Express + Dockerfile `HEALTHCHECK` + compose `healthcheck:` block | [ADR 0010 D8](adr/0010-session-backend-contract.md) |
| **CI gates** | Build only | ESLint hard-fail · coverage hard-fail · build-output shape hard-fail (`_routes.json` + `_headers` present) · commitlint local hook · CodeQL · Worker bundle <1 MB · knip continuous soft-fail | [Locked Decision #16](tactical/productization-audit.md#locked-decisions-from-scoping-discussion-2026-05-19), [git-automation-hardening.md](tactical/git-automation-hardening.md) |
| **E2E suite** | Legacy Python/Selenium under `e2e-tests/` + stale Playwright under `packages/axoview-e2e/` | Both deleted; rewrite from zero: 13 spec files / 33 tests against J1–J20 manual baseline; runs on PR + master | [Locked Decision #4](tactical/productization-audit.md#locked-decisions-from-scoping-discussion-2026-05-19), [e2e-suite-rewrite.md](tactical/e2e-suite-rewrite.md) |
| **CI/deploy workflows** | `.github/workflows/e2e-tests.yml.backup` + Pages workflow + dual deploy paths | Native Cloudflare git integration is canonical; GH Pages workflow deleted; `release.yml` rewired to depend on Run Tests | [Locked Decision #14](tactical/productization-audit.md#locked-decisions-from-scoping-discussion-2026-05-19) |
| **LICENSE / lineage hygiene** | Unlicense on app, MIT on root, upstream author still credited in lib LICENSE, FUNDING.yml pointing upstream | All three normalized (LICENSE files coherent; FUNDING.yml deleted; lineage acknowledged in lib LICENSE prose) | Audit C.2 §1 quick-wins, commits `264887a` / `39a44c1` |
| **Repo hygiene** | No `.gitattributes`; `.nvmrc` was Node 20 (workflows on Node 22); duplicate ISSUE_TEMPLATE `.md` + `.yml` pairs | `.gitattributes` enforces LF; `.nvmrc` is 22; `.md` ISSUE_TEMPLATE deleted (YAML form canonical) | Audit C.2 §1, commit `264887a` |
| **Doc structure** | `current_architecture.md`, `flare_plan.md`, `session-ux-revamp.md`, `details-panel-and-ux-polish.md` as parallel tacticals | Three-tier convention: ADRs in `docs/adr/` (durable) · tacticals in `docs/tactical/` (short-lived) · PLAN.md as dashboard; `flare_plan.md` content migrated to ADRs 0009/0010 then deleted | [docs/workflow.md](workflow.md), [project_docs_convention memory](../../Users/isidenica/.claude/projects/c--myTemp-FossFLOW/memory/project_docs_convention.md) |
| **Workflow doc** | None — process tribal | [`docs/workflow.md`](workflow.md) — canonical session cadence, skill decision table, 6 design principles | [Phase A synthesis Theme 9](tactical/productization-audit.md), workflow.md authored 2026-05-20 |

### 2.2 What did *not* change

Worth naming explicitly so the reviewer doesn't infer churn where there is none:

- **Core canvas engine** (isometric projection, connector pathfinding, hit-testing, view-tab model). The 2D mode landed as a strategy alongside the iso strategy ([Phase 1A](../PLAN.md)); the iso engine itself is unchanged from the upstream fork era.
- **Zustand store topology.** Three lib stores (model, scene, uiState) + the app's `notificationStore` were in place by Phase 0B / Phase 1A; the productization arc made no structural changes here.
- **Auth implementation depth.** `AUTH_MODE = none | shared-token | cf-access` was already implemented end-to-end before the audit. The audit changed posture (removed the overlapping nginx Basic Auth layer per [Locked Decision #13](tactical/productization-audit.md#locked-decisions-from-scoping-discussion-2026-05-19)) but not the supported modes.
- **Single-tenant assumption.** Always single-tenant per deploy; [ADR 0010 D4](adr/0010-session-backend-contract.md) made it explicit and locked rather than newly imposing it.
- **Build system.** rsbuild + tsc throughout the year; no churn.

---

## 3. Architecture overview

### 3a. System diagram

```mermaid
flowchart TB
    subgraph Browser["Browser (SPA)"]
        APP["axoview-app<br/>(SPA shell)"]
        LIB["axoview-lib<br/>(React canvas library)"]
        APP -->|imports + mounts Axoview| LIB
    end

    subgraph Storage["Storage abstraction (ADR 0010)"]
        SM["StorageManager<br/>(provider registry)"]
        LSP["LocalStorageProvider"]
        GDP["GoogleDriveProvider<br/>(NotImplementedError stub)"]
        SM --> LSP
        SM -.->|Phase 3B| GDP
    end

    subgraph Runtimes["Server-backed runtimes"]
        BE["axoview-backend<br/>(Express + fs adapter)"]
        WORKER["axoview-worker<br/>(Hono + Pages Functions)"]
    end

    subgraph Test["E2E test package"]
        E2E["axoview-e2e<br/>(Playwright)"]
    end

    APP --> SM
    LSP -->|fetch /api/* if reachable| BE
    LSP -->|fetch /api/* if reachable| WORKER
    LSP -.->|fallback| LS[("browser<br/>localStorage")]
    BE --> FS[("filesystem<br/>STORAGE_PATH")]
    WORKER -->|always 503 today| NULL[("no storage<br/>browser-only fallback")]

    E2E -.->|drives via Chromium| Browser

    classDef storeless fill:#fee,stroke:#c66
    class WORKER,NULL storeless
```

### 3b. Package responsibilities

The monorepo has four shipped packages plus the E2E test package. Each has one ownership rule.

**[`packages/axoview-lib`](../packages/axoview-lib/)** — the React canvas library. Owns the renderer, scene layers (Nodes, Connectors, Rectangles, TextBoxes), interaction modes (the 11-state machine), the three Zustand stores (model, scene, uiState), the i18n layer (14 locales), and every component inside the canvas chrome (LeftDock, RightSidebar, ToolMenu, BottomDock, dialogs). Primary entry: [`Axoview.tsx`](../packages/axoview-lib/src/Axoview.tsx) (forwardRef component, ~200 lines, mounts the provider tree). Consumed only by `axoview-app` today; per [Locked Decision #11](tactical/productization-audit.md#locked-decisions-from-scoping-discussion-2026-05-19) the lib is monorepo-only (not npm-published). Deploys nowhere on its own; ships as a build output that `axoview-app` imports from `dist/`. Test surface: documented in [`docs/testing.md`](testing.md) (1009 passing + 1 skipped across 93 jest suites total monorepo-wide as of 2026-05-23; the lib carries the bulk).

**[`packages/axoview-app`](../packages/axoview-app/)** — the SPA application shell. Owns everything the lib doesn't: storage providers (`StorageManager` + `LocalStorageProvider` + the Drive stub), the file explorer UI (`FileExplorerLayout`, `FileExplorer`, `FileTreeNode`), the app toolbar (`AppToolbar`), the notification stack (`notificationStore` + `NotificationStack`), the cross-diagram link registry, the icon-pack manager, the diagram lifecycle (`DiagramLifecycleProvider` — save / load / unsaved-changes guard), the share-URL handler, and the error dialogs from [ADR 0011](adr/0011-error-ux-contract.md). Entry: [`App.tsx`](../packages/axoview-app/src/App.tsx) (103 lines, pure provider composition per [§2l](architecture.md#2l-axoview-app-provider-decomposition-2026-04-27)). Deploys to: Cloudflare Pages (static bundle), nginx (Docker compose stack). Test surface: project-zip + LocalStorageProvider + AppStorageContext suites.

**[`packages/axoview-backend`](../packages/axoview-backend/)** — Node 22 + Express + filesystem adapter. Owns the canonical `/api/*` HTTP contract (every route defined in [`src/routes.js`](../packages/axoview-backend/src/routes.js); the Worker imports the same file). Implements the `StorageAdapter` interface ([`src/adapters/types.ts`](../packages/axoview-backend/src/adapters/types.ts)) via [`fs.js`](../packages/axoview-backend/src/adapters/fs.js) — atomicity via tmp-file + rename per [ADR 0010 D3](adr/0010-session-backend-contract.md#3-atomicity--every-put-is-all-or-nothing). Auth via `AUTH_MODE` env var (`none` / `shared-token`; `cf-access` rejected at request time as Cloudflare-only). Health probe at `/healthz` per [ADR 0010 D8](adr/0010-session-backend-contract.md). Deploys to: Docker container behind nginx (compose.yml + Dockerfile). Test surface: **no jest config today** — gap tracked in audit [§C.8](tactical/productization-audit.md). Smoke-tested via Docker.

**[`packages/axoview-worker`](../packages/axoview-worker/)** — Hono on Cloudflare Pages Functions. Owns the Cloudflare-side `/api/*` surface. Imports `routes.js` from `axoview-backend` directly (the cross-package import is the single source of truth — see [productization audit P6](tactical/productization-audit.md)) but **short-circuits every storage route to 503** at [`app.ts:43-45`](../packages/axoview-worker/src/app.ts) per [ADR 0009 D1](adr/0009-deployment-topology.md). Today: storage-less by design. Implements `cf-access` auth (full JWKS RS256 verify in [`auth.ts`](../packages/axoview-worker/src/auth.ts)). Bundle-size budget <1 MB uncompressed (CI-enforced per [ADR 0009 D8](adr/0009-deployment-topology.md)). Deploys to: Cloudflare Pages via native git integration on master push (per [Locked Decision #14](tactical/productization-audit.md#locked-decisions-from-scoping-discussion-2026-05-19)); also runnable locally via `wrangler pages dev`. Test surface: **no jest config today** — same gap as backend.

**[`packages/axoview-e2e`](../packages/axoview-e2e/)** — Playwright Chromium against the local dev server. 13 spec files / 33 tests covering canonical user journeys J1–J20 from [`docs/manual-test-baseline.md`](manual-test-baseline.md). Page Object Model per surface (AppToolbar, FileExplorer, Canvas, NodeInfoTab, LayersPanel, dialogs). Per [ADR 0008 D5](adr/0008-naming-convention.md#5-data-axoview-id-attribute--selective-not-blanket-reserved-for-e2e-and-trace-harness-anchors), `data-axoview-id` attributes are added lazily as specs need them. Runs on PRs + master push via [`.github/workflows/e2e-playwright.yml`](../.github/workflows/e2e-playwright.yml).

### 3c. State management

The lib carries four Zustand stores; the app carries one more (notifications). All five use the React-context-wrapped Zustand pattern (per-mount-instance isolation) — see [architecture.md §2a](architecture.md#2a-store-layer).

| Store | Owner | Persistence | Purpose |
|---|---|---|---|
| `modelStore` | lib | included in saved diagram | Persistent model: items, connectors, rectangles, textBoxes, views, icons, colors. Has its own immer-patch-based history stack (max 50 entries). |
| `sceneStore` | lib | derived (computed from model) | Computed scene data: connector paths, textbox sizes. Independent history stack alongside model's. |
| `uiStateStore` | lib | settings persist to `localStorage` (`axoview-*` keys) | Mode, zoom, scroll, selection (`selectedIds` + `itemControls`), dialogs, settings (hotkey profile, pan/zoom settings, `canvasMode`), `iconPackManager` ref, dirty flag, mouse state. |
| `localeStore` | lib | localStorage | Current locale + dictionary. |
| `notificationStore` | app | not persisted | Side-effect notifications (success / info / warning / error). Capped at 3 visible; queue drains FIFO. |

**Mode detection on boot (per [ADR 0009 D2](adr/0009-deployment-topology.md#2-mode-detection-collapses-to-a-single-probe-runtimeconfigserverstorage-is-removed)).** The SPA issues a single `GET /api/config` request with an 800 ms `AbortSignal.timeout` cap. The `serverStorage: boolean` field in the response selects the path:

- `true` → register `LocalStorageProvider` with `usingServer=true`; it routes `listDiagrams` / `loadDiagram` / `saveDiagram` to `/api/diagrams/*`.
- `false` *or* probe failure → `LocalStorageProvider` with `usingServer=false`; falls back to `sessionStorage`.

The boot path used to fire a dual probe (`/api/config` + `/api/storage/status` in parallel `Promise.all`) — collapsed to one in commit `0810690`. The `/api/storage/status` endpoint is gone from both runtimes.

**Reducer pattern.** Every mutating action in `useScene` (~30 methods) routes through a pure reducer in [`stores/reducers/`](../packages/axoview-lib/src/stores/reducers/). Reducers take `(payload, state) → State` (pure, no I/O, no async, no store reads), use immer `produce()` for immutable updates. The hook layer wraps reducer calls with `saveToHistoryBeforeChange()` to record patches (unless inside a `transaction()`, in which case N operations collapse into one history entry). See [architecture.md §2d](architecture.md#2d-reducer-layer) for the full reducer matrix.

### 3d. Component tree (high level, lib-side)

```mermaid
flowchart TB
    AX["Axoview component<br/>(forwardRef)"]
    AX --> TP["ThemeProvider"]
    TP --> LP["LocaleProvider"]
    LP --> MP["ModelProvider"]
    MP --> SP["SceneProvider"]
    SP --> UP["UiStateProvider"]
    UP --> CP["ClipboardProvider"]
    CP --> LC["LayerContextProvider"]
    LC --> APP_INNER["App (inner forwardRef)"]

    APP_INNER --> RENDERER["Renderer<br/>(canvas + scene layers)"]
    APP_INNER --> UIO["UiOverlay<br/>(menus + dialogs)"]
    APP_INNER --> LD["LeftDockSlot"]
    APP_INNER --> RS["RightSidebarSlot"]
    APP_INNER --> BD["BottomDockSlot"]

    RENDERER --> RECTS["Rectangles layer"]
    RENDERER --> LASSO["Lasso / FreehandLasso"]
    RENDERER --> GRID["Grid"]
    RENDERER --> CONNS["Connectors layer"]
    RENDERER --> TBS["TextBoxes layer"]
    RENDERER --> CL["ConnectorLabels"]
    RENDERER --> INT["interaction div<br/>(empty-canvas hit target)"]
    RENDERER --> NODES["Nodes layer"]
    RENDERER --> TCM["TransformControlsManager"]

    UIO --> TM["ToolMenu"]
    UIO --> MM["MainMenu (unused in app)"]
    UIO --> IC["ItemControlsManager<br/>NodePanel / ConnectorControls / ..."]
    UIO --> DIA["Dialogs<br/>(Export / Help / Settings)"]
    UIO --> NS_LIB["NotificationSnackbar (lib)"]
```

Order matters: the **interaction div** sits *below* the Nodes layer, so `e.target === interactionDiv` is true *only* when the user clicks empty canvas (Nodes capture their own events). This `isRendererInteraction` guard is referenced throughout the mode handlers.

### 3e. Interaction modes

The 11-mode state machine — formal definitions in [architecture.md §2b](architecture.md#2b-mode-state-machine).

```mermaid
stateDiagram-v2
    direction LR
    [*] --> CURSOR
    CURSOR --> DRAG_ITEMS: mousedown on item + mousemove
    CURSOR --> LASSO: mousedown on empty + mousemove
    DRAG_ITEMS --> CURSOR: mouseup
    LASSO --> DRAG_ITEMS: mousedown inside selection + mousemove
    LASSO --> CURSOR: mouseup (no selection)
    LASSO --> CURSOR: mousedown outside selection
    FREEHAND_LASSO --> DRAG_ITEMS: isDragging + mousemove
    FREEHAND_LASSO --> CURSOR: mouseup (no selection)

    CURSOR --> PAN: middle/right/ctrl/alt/empty-area mousedown
    PAN --> CURSOR: left-click (via usePanHandlers)

    CURSOR --> CONNECTOR: hotkey 'c' / ToolMenu / Elements panel
    CONNECTOR --> CURSOR: completion (if returnToCursor)
    CONNECTOR --> CONNECTOR: completion (default)

    CURSOR --> PLACE_ICON: ToolMenu 'Add item'
    PLACE_ICON --> CURSOR: mousedown (places or no-op)

    CURSOR --> RECTANGLE_DRAW: ToolMenu 'Rectangle' / Elements
    RECTANGLE_DRAW --> CURSOR: mouseup
    CURSOR --> RECTANGLE_TRANSFORM: TransformAnchor mousedown
    RECTANGLE_TRANSFORM --> CURSOR: mouseup

    CURSOR --> TEXTBOX: hotkey 't' / Elements
    TEXTBOX --> CURSOR: mouseup

    CURSOR --> RECONNECT_ANCHOR: anchor-handle mousedown
    RECONNECT_ANCHOR --> CURSOR: mouseup

    INTERACTIONS_DISABLED --> [*]: NON_INTERACTIVE editor mode
```

`INTERACTIONS_DISABLED` exists as an early-return state for the `NON_INTERACTIVE` editor mode (one of three editor modes — see [architecture.md §1 "Editor Modes"](architecture.md#1-feature-inventory)). The other two editor modes are `EDITABLE` (all modes active) and `EXPLORABLE_READONLY` (Pan + Zoom + click-to-open readonly NodePanel only).

---

## 4. Sequence diagrams

Six representative flows. Each is tuned to ~10–15 actors/messages — the readable sweet spot. Where a flow has natural pre / post halves, it's split.

### 4a. App boot + mode detection (single `/api/config` probe)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant Browser
    participant App as App.tsx
    participant AppStorage as AppStorageContext
    participant RuntimeCfg as useRuntimeConfig
    participant API as Backend /api/config
    participant SM as StorageManager
    participant LSP as LocalStorageProvider
    participant Splash as Inline splash div

    U->>Browser: navigate to axoview URL
    Browser->>Splash: paints inline splash (~500ms)
    Browser->>App: bundle parses + App mounts
    App->>AppStorage: AppStorageContext.Provider
    AppStorage->>RuntimeCfg: fetchRuntimeConfig() with AbortSignal.timeout(800ms)
    RuntimeCfg->>API: GET /api/config
    alt /api/config succeeds
        API-->>RuntimeCfg: { serverStorage: bool, googleClientId, ... }
        RuntimeCfg-->>AppStorage: config
        AppStorage->>SM: setServerStorage(config.serverStorage)
        SM->>LSP: usingServer = config.serverStorage
    else timeout or network error
        RuntimeCfg-->>AppStorage: console.warn + default { serverStorage: false }
        AppStorage->>SM: setServerStorage(false)
        SM->>LSP: usingServer = false  (sessionStorage fallback)
    end
    AppStorage->>App: isInitialized = true
    App->>Splash: add .ff-splash-hidden after 2 RAFs; remove node after 250ms
    App->>U: editor visible
```

Closes the dual-probe collapse from [ADR 0009 D2](adr/0009-deployment-topology.md#2-mode-detection-collapses-to-a-single-probe-runtimeconfigserverstorage-is-removed). Before the cleanup this fired both `/api/config` **and** `/api/storage/status` via `Promise.all`.

### 4b. Save diagram — browser-only mode

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant Tool as AppToolbar (Save)
    participant DLP as DiagramLifecycleProvider
    participant Lib as Axoview ref
    participant LS as leanSave (utils)
    participant LSP as LocalStorageProvider
    participant SS as sessionStorage
    participant Notif as notificationStore

    U->>Tool: click 💾 Save
    Tool->>DLP: handleSave()
    DLP->>Lib: axoviewRef.current.getModel()
    Lib-->>DLP: model (full, hydrated)
    DLP->>LS: stripDefaultIcons(model)
    LS-->>DLP: leanModel (bundled fixtures stripped)
    DLP->>LSP: sessionSaveDiagram(id, leanModel)
    LSP->>SS: setItem('axoview-diagram-' + id, JSON)
    LSP->>SS: dispatch Event('axoview-session-changed')
    LSP-->>DLP: ok
    DLP->>DLP: clear sessionWorkUnexported flag
    DLP->>Notif: push({severity:'success', message:'Saved'})
    Notif->>U: snackbar (3s autodismiss)
```

The lean-save pass per [ADR 0003](adr/0003-session-storage-lean-icon-save.md) drops icons whose `id` matches `bundledFixtures.byId` and whose metadata is unchanged. On the next load the rehydrate step from [ADR 0002](adr/0002-icon-catalog-merge-on-load.md) re-merges the catalog.

### 4c. Save diagram — server-backed mode

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant DLP as DiagramLifecycleProvider
    participant Lib as Axoview ref
    participant LS as leanSave
    participant LSP as LocalStorageProvider
    participant Net as fetch
    participant API as Express routes.js
    participant FS as fs adapter
    participant Disk as filesystem

    U->>DLP: handleSave() (autosave or explicit)
    DLP->>Lib: getModel()
    Lib-->>DLP: model
    DLP->>LS: stripDefaultIcons(model)
    LS-->>DLP: leanModel
    DLP->>LSP: sessionSaveDiagram(id, leanModel)
    LSP->>Net: PUT /api/diagrams/:id (10 MB body limit)
    Net->>API: PUT /api/diagrams/abc123
    API->>FS: put('diagrams/abc123', bytes)
    FS->>Disk: writeFile(.abc123.<pid>.tmp)
    FS->>Disk: rename(.tmp → abc123.json)
    Disk-->>FS: ok
    FS-->>API: ok
    API-->>Net: 200 OK
    Net-->>LSP: ok
    LSP-->>DLP: ok
```

The Cloudflare Worker path is intentionally asymmetric — `PUT /api/diagrams/:id` hits the `app.all('/api/*') → 503` short-circuit at [`app.ts:43-45`](../packages/axoview-worker/src/app.ts). Cloudflare deploys are storage-less today (per [ADR 0009 D1](adr/0009-deployment-topology.md)), so server-mode persistence is Docker-only until Phase 3B (Google Drive) lands as a new `StorageAdapter`. The atomicity contract (`tmp-file + rename`) is [ADR 0010 D3](adr/0010-session-backend-contract.md#3-atomicity--every-put-is-all-or-nothing).

### 4d. Share link generation + public consumption

```mermaid
sequenceDiagram
    autonumber
    participant U1 as Author
    participant Tool as AppToolbar (Share)
    participant DLP as DiagramLifecycleProvider
    participant API as Express routes.js
    participant FS as fs adapter
    participant Clip as clipboard
    participant U2 as Recipient
    participant Browser as Recipient browser
    participant App as App.tsx (recipient SPA)
    participant Pub as Public namespace route

    U1->>Tool: click 🔗 Share
    Tool->>DLP: handleShare()
    DLP->>API: POST /api/diagrams/:id/share
    API->>FS: put('public/<uuid>', snapshotBytes)
    FS-->>API: ok
    API-->>DLP: { uuid, url: window.location.origin + /display/p/<uuid> }
    DLP->>Clip: navigator.clipboard.writeText(url)
    DLP->>U1: notify "Share link copied"

    U2->>Browser: open /display/p/<uuid>
    Browser->>App: SPA boots
    App->>App: route '/display/p/:uuid'
    App->>Pub: GET /api/public/diagrams/<uuid>  (no auth)
    alt 200 OK
        Pub-->>App: snapshot model
        App->>U2: render EXPLORABLE_READONLY canvas
    else 404 or network error
        App->>App: setPublicShareLoadFailed(true)
        App->>U2: PublicShareLoadErrorDialog (per ADR 0011)
    end
```

The `/api/public/diagrams/:uuid` route bypasses auth middleware on both runtimes (`isPublicRoute` check in Express; same check in Worker `authMiddleware`) — the **only** auth exception in the contract per [ADR 0010 D6](adr/0010-session-backend-contract.md#6-snapshots-and-share-namespace).

### 4e. Diagram-to-diagram link navigation

The contract has two paths — edit-mode swap (via CustomEvent) and readonly-mode navigation (via React Router). Both routed through `interaction/modes/Pan.ts` and `NodePanel` for the readonly case. The B-1 fix (commit `2a04061`) added the explicit error dialog when a target diagram fails to load.

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant Node as Node.tsx (badge click)
    participant Pan as Pan.ts (readonly body click)
    participant Panel as NodePanel (readonly)
    participant Router as React Router
    participant DLP as DiagramLifecycleProvider
    participant LSP as LocalStorageProvider
    participant App as App.tsx

    Note over U,App: Edit mode — swap current diagram in place
    U->>Node: click linked-diagram badge (EDITABLE)
    Node->>App: dispatch axoview-open-diagram-in-editor CustomEvent
    App->>DLP: handleDiagramManagerLoad(targetId)
    DLP->>DLP: checkUnsavedBeforeNavigate(...)
    DLP->>LSP: loadDiagram(targetId)
    LSP-->>DLP: model
    DLP->>App: axoviewRef.current.load(model)
    App-->>U: target diagram replaces current in canvas

    Note over U,App: Readonly mode — open in same tab via router
    U->>Pan: click node body (EXPLORABLE_READONLY)
    Pan->>Panel: open readonly NodePanel
    Panel->>U: show "LINKED DIAGRAM" section
    U->>Panel: click link
    Panel->>Router: navigate('/display/' + targetId)
    Router->>App: route '/display/:id'
    App->>LSP: loadDiagram(targetId)
    alt 200 OK
        LSP-->>App: model
        App-->>U: render readonly canvas
    else load failure
        App->>App: setReadonlyLoadFailed(true)
        App-->>U: ReadonlyLoadErrorDialog ("back to editor")
    end
```

Distinct from §4d's `/display/p/:uuid` public-share route (which bypasses auth and hits the public namespace). The owner-readonly `/display/:id` route runs through `storage.loadDiagram(id)` and respects `AUTH_MODE` in server-backed mode — see the [2026-05-22 addendum to ADR 0009 D3](adr/0009-deployment-topology.md#3-readonly--share-link-is-a-session-mode-only-overlay-local-mode-must-error-explicitly).

### 4f. Error UX — failure-of-intent flow (per [ADR 0011](adr/0011-error-ux-contract.md))

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant Action as User-initiated action
    participant Ctx as Context provider
    participant Dialog as ScenarioErrorDialog
    participant Router as React Router
    participant App as App.tsx (mount site)

    U->>Action: click / type URL / drop file
    Action->>Ctx: trigger handler (e.g. handleLoad)
    Ctx->>Ctx: catch failure
    Ctx->>Ctx: setScenarioError(true)
    Ctx-->>App: state changes via context
    App->>Dialog: open=true
    Dialog->>U: render headline + body + dismiss btn (autoFocus)
    U->>Dialog: click dismiss (or press Enter / Escape)
    Dialog->>App: onDismiss()
    App->>Ctx: clearScenarioError()
    App->>Router: navigate('/', { replace: true }) if base-state restoration needed
```

Three dialogs ship per the contract: `LocalModeShareErrorDialog` (browser-only + share-uuid URL → explicit error per [ADR 0009 D3](adr/0009-deployment-topology.md)); `ReadonlyLoadErrorDialog` (owner-readonly `/display/:id` load failure); `PublicShareLoadErrorDialog` (public `/api/public/diagrams/:uuid` 404 or network error, retrofitted per ADR 0011 B-9a S1). The audit's [B-9a investigation](tactical/productization-audit.md) identified 20 remaining toast-only or `.catch(() => {})` surfaces (S2–S20) that are queued for B-9b retrofit; that batch is **deferred-by-design** per the [2026-05-23 closeout disposition](tactical/productization-audit.md#phase-c-status).

---

## 5. Deployment topology

<!-- TBD Session C — Will cover: Docker compose stack (nginx + Express + filesystem volume); Cloudflare Pages deployment (Worker + Pages Functions + native git integration); env-var contract per target (per ADR 0009 §4); TLS termination per target; bundle-size budget; deploy automation (CF native git integration is canonical per Locked Decision #14). Cross-references: ADR 0009 §§1, 4, 5, 7, 8; docs/deployment.md. -->

---

## 6. Security posture

<!-- TBD Session C — Will cover: auth modes (none / shared-token / cf-access — Cloudflare-only); single-tenant-per-deploy lock (ADR 0010 D4); public-namespace cutout (the only auth exception); CSP delivery per target (Helmet on Express, _headers on Cloudflare, nginx.conf for self-host); CodeQL static analysis; nginx Basic Auth removal (Locked Decision #13); path-traversal blocked at adapter boundary via KEY_PATTERN regex; 10 MB body limit. Cross-references: ADR 0009 §4/§7, ADR 0010 §2/§4/§6. -->

---

## 7. File-by-file inventory

Every git-tracked file in the repo, segmented by the seven units described in [§3b](#3b-package-responsibilities) plus the repo shell and `docs/`. Columns: **Path** · **Type** (`source` | `config` | `test` | `fixture` | `doc` | `asset` | `lockfile` | `style` | `i18n`) · **LOC** (code lines for source/test/config-with-logic; `—` for assets/lockfiles/locales/markdown) · **Purpose** (what the file does and who consumes it) · **Flags** (audit cross-references, duplication smells, no-test-coverage callouts, anomalies a reviewer would ask about). Build outputs, `node_modules`, Playwright report/results, and `.wrangler/` are excluded by design.

Cross-package patterns surfaced only after assembling the seven tables live in [§7.8](#78-cross-package-observations); raw counts roll up in [§7.9](#79-inventory-totals). Where a Flag column cites "audit C.2 / B-10" etc., the reference is to the corresponding row in [docs/tactical/productization-audit.md](tactical/productization-audit.md).

### 7.1 `packages/axoview-lib`

The React canvas library — owns the renderer, scene layers (Nodes, Connectors, Rectangles, TextBoxes), the 11-state interaction machine, the three Zustand stores (model, scene, uiState), the 14-locale i18n layer, and every component inside the canvas chrome. Per [Locked Decision #11](tactical/productization-audit.md#locked-decisions-from-scoping-discussion-2026-05-19) the lib is monorepo-only (not npm-published); `axoview-app` is its sole consumer today.

| Path | Type | LOC | Purpose | Flags |
|---|---|---|---|---|
| `packages/axoview-lib/.gitignore` | config | — | Git ignore rules for the axoview-lib package. | — |
| `packages/axoview-lib/LICENSE` | doc | — | MIT license file for the library; verified by audit row 4 to match repo and app LICENSE. | — |
| `packages/axoview-lib/docs/.gitignore` | config | — | Git ignore inside the legacy Next.js docs scaffold. | Lives inside dead `docs/` scaffold (audit N2 — slated for deletion). |
| `packages/axoview-lib/docs/package.json` | config | — | Standalone package.json for the legacy Next.js docs site. | Dead — audit N2 / C.2 marks the whole `docs/` directory for removal. |
| `packages/axoview-lib/docs/package-lock.json` | lockfile | — | Lockfile for the legacy Next.js docs site. | Dead — cascades with `docs/` deletion (N2). |
| `packages/axoview-lib/docs/pages/_meta.json` | config | — | Nextra navigation metadata for legacy docs site. | Dead — cascades with N2. |
| `packages/axoview-lib/docs/pages/docs/_meta.json` | config | — | Nextra navigation metadata for docs section. | Dead — cascades with N2. |
| `packages/axoview-lib/docs/pages/docs/api/_meta.json` | config | — | Nextra navigation metadata for API docs. | Dead — cascades with N2. |
| `packages/axoview-lib/docs/pages/docs/api/index.mdx` | doc | — | Legacy MDX API reference page consumed by Nextra. | Dead — cascades with N2. |
| `packages/axoview-lib/docs/pages/docs/api/initialData.mdx` | doc | — | Legacy MDX docs for the `initialData` prop. | Dead — cascades with N2. |
| `packages/axoview-lib/docs/pages/docs/contributing.mdx` | doc | — | Legacy MDX contributing guide for library docs site. | Dead — cascades with N2. |
| `packages/axoview-lib/docs/pages/docs/index.mdx` | doc | — | Legacy MDX docs landing page. | Dead — cascades with N2. |
| `packages/axoview-lib/docs/pages/docs/installation.mdx` | doc | — | Legacy MDX install instructions (npm publish flow). | Dead — cascades with N2; also misleading given lib is not actually npm-published (Locked Decision #11). |
| `packages/axoview-lib/docs/pages/docs/isopacks.mdx` | doc | — | Legacy MDX docs on isopack icon usage. | Dead — cascades with N2. |
| `packages/axoview-lib/docs/pages/docs/quickstart.mdx` | doc | — | Legacy MDX quickstart page. | Dead — cascades with N2. |
| `packages/axoview-lib/docs/tsconfig.json` | config | — | TS config for the legacy Nextra docs site. | Dead — cascades with N2. |
| `packages/axoview-lib/jest.config.js` | config | ~40 | Jest configuration for the library's unit + regression test suites; consumed by `npm test`. | — |
| `packages/axoview-lib/jest.setup.js` | config | ~30 | Jest setup (jest-dom matchers, polyfills) loaded by `jest.config.js`. | — |
| `packages/axoview-lib/package.json` | config | — | Package manifest declaring `axoview` v2026.5.21, marked `"private": true` per Locked Decision #11 (not actually npm-published despite "published-shape"). | `"main"`/`"types"`/`"files"` advertise a publishable shape but `private: true` blocks publish — intentional but worth a reviewer flag. |
| `packages/axoview-lib/rslib.config.ts` | config | ~30 | Rslib build configuration producing `dist/` consumed by axoview-app via workspace symlink. | Tied to the dev-server lib-rebuild friction documented in MEMORY. |
| `packages/axoview-lib/tsconfig.declaration.json` | config | — | TS config used by `tsc --project` step in `build` to emit `.d.ts` types. | — |
| `packages/axoview-lib/tsconfig.dev.json` | config | — | TS config variant for development (less strict / different paths) consumed by dev tooling. | Unclear which tool actually consumes it — worth verifying it's not orphaned. |
| `packages/axoview-lib/tsconfig.json` | config | — | Base TS config for the library; extended by other tsconfigs and used by the editor. | — |
| `packages/axoview-lib/src/Axoview.tsx` | source | 326 | Main `<Axoview>` React component plus `useAxoview` imperative-handle hook — the library's primary entry point consumed by axoview-app and external embedders. | Large central component; no dedicated unit test (only covered via integration/regression suites). |
| `packages/axoview-lib/src/__mocks__/fileMock.ts` | fixture | 4 | Jest module-mock that maps SVG/image imports to a stub during tests. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/Connector.modes.test.ts` | test | 521 | Regression suite for the Connector interaction mode's drag/route/anchor behavior. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/Cursor.modes.test.ts` | test | 548 | Regression suite for the Cursor interaction mode (selection, click, hover). | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/Cursor.waypointGestures.test.ts` | test | 266 | Regression for cursor-driven connector waypoint add/move/delete gestures. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/DragItems.modes.test.ts` | test | 555 | Regression for the DragItems interaction mode covering multi-item drag. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/Lasso.modes.test.ts` | test | 407 | Regression for the rectangular Lasso interaction mode. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/Pan.modes.test.ts` | test | 336 | Regression for the Pan interaction mode. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/README.md` | doc | — | Explains intent and conventions of the `__perf_refactor_regression__` suite. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/ReconnectAnchor.modes.test.ts` | test | 216 | Regression for the ReconnectAnchor interaction mode. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/connector.createUndoRedo.test.tsx` | test | 128 | Regression that connector create flows produce single undo/redo entries. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/connector.dragPerf.test.tsx` | test | 235 | Performance regression around connector drag re-renders. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/connector.renderIsolation.test.tsx` | test | 66 | Asserts connector renders are isolated from unrelated state updates. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/dragStart.prevention.test.ts` | test | 36 | Regression that drag-start is correctly prevented in certain modes. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/expandableLabel.selectorConsolidation.test.tsx` | test | 45 | Regression for ExpandableLabel selector consolidation refactor. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/exportImageDialog.initialLoad.test.ts` | test | 89 | Regression around ExportImageDialog initial load behavior. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/exportImageDialog.memo.test.ts` | test | 40 | Regression that ExportImageDialog memoization holds. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/f2.rendererScope.test.ts` | test | 35 | Regression for F2-rename scope being limited to the renderer. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/fixtures/perf-stress-diagram.json` | fixture | — | Large diagram JSON used as a stress fixture by perf regression tests. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/grid.backgroundFormula.test.ts` | test | 226 | Regression for the grid background-CSS formula used by the renderer. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/gsap.dependency.test.ts` | test | 64 | Asserts GSAP was successfully removed (no GSAP imports remain). | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/i18n.config.test.ts` | test | 32 | Regression for i18n config shape. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/i18n.localeCompleteness.test.ts` | test | 46 | Regression that all locales contain the same keys (no missing translations). | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/interactionManager.depStability.test.tsx` | test | 74 | Regression for `useInteractionManager` dependency-array stability. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/keyboard.dispatch.test.tsx` | test | 295 | Regression for keyboard event dispatch and shortcut routing. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/languageDropdown.positioning.test.ts` | test | 40 | Regression for language dropdown positioning fix. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/multiSelect.contract.test.ts` | test | 107 | Regression for multi-select API contract. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/node.linkTooltipDedup.test.ts` | test | 101 | Regression that node link tooltips are properly deduplicated. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/quickAdd.groupButton.test.ts` | test | 142 | Regression for QuickAdd popover group-button behavior. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/quickIconSelector.i18n.test.ts` | test | 71 | Regression that QuickIconSelector strings come from i18n. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/rendererSize.sharedObserver.test.tsx` | test | 106 | Regression that renderer size uses a shared ResizeObserver. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/saveTracking.isAfterLoad.test.ts` | test | 72 | Regression for dirty-tracking after a load (no spurious dirty). | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/settings.defaults.test.ts` | test | 80 | Regression that persisted-settings defaults match expected; pinned by audit. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/shortcuts.test.ts` | test | 33 | Regression that fixed-shortcut mappings match `config/shortcuts.ts`; pinned by audit. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/splashScreen.welcomeNotification.test.ts` | test | 45 | Regression for the splash-screen welcome notification trigger. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/toolMenu.i18n.test.ts` | test | 67 | Regression that ToolMenu copy comes from i18n. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/toolMenu.propagation.test.tsx` | test | 155 | Regression for ToolMenu event propagation behavior. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/uiOverlay.editorModes.test.ts` | test | 102 | Regression for UiOverlay conditional rendering across editor modes. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/useRAFThrottle.cleanup.test.ts` | test | 198 | Regression that `useRAFThrottle` cleans up RAFs on unmount. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/useResizeObserver.lifecycle.test.ts` | test | 166 | Regression for `useResizeObserver` lifecycle. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/useScene.listShape.test.tsx` | test | 282 | Regression that `useScene` returns stable list-shape references. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/useScene.referenceStability.test.tsx` | test | 189 | Regression for `useScene` reference stability across renders. | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/viewOps.integration.test.tsx` | test | 204 | Integration regression for view-ops (add/rename/delete view). | — |
| `packages/axoview-lib/src/__perf_refactor_regression__/viewTabs.titleReadonly.test.ts` | test | 46 | Regression that ViewTabs honors title-readonly state. | — |
| `packages/axoview-lib/src/assets/grid-tile-2d.svg` | asset | — | SVG tile used as the 2D-mode grid background. | — |
| `packages/axoview-lib/src/assets/grid-tile-bg.svg` | asset | — | SVG tile used as the isometric grid background. | — |
| `packages/axoview-lib/src/clipboard/ClipboardContext.tsx` | source | 39 | React context wiring clipboard state for copy/paste consumers in the canvas. | — |
| `packages/axoview-lib/src/clipboard/__tests__/clipboard.test.ts` | test | 69 | Unit tests for the low-level `clipboard.ts` helpers. | — |
| `packages/axoview-lib/src/clipboard/__tests__/useCopyPaste.test.ts` | test | 558 | Unit tests for the `useCopyPaste` hook covering copy/paste/duplicate flows. | — |
| `packages/axoview-lib/src/clipboard/clipboard.ts` | source | 31 | Low-level serialize/deserialize helpers for clipboard payloads. | — |
| `packages/axoview-lib/src/clipboard/useCopyPaste.ts` | source | 316 | `useCopyPaste` hook driving copy/paste/duplicate actions consumed by the canvas. | — |
| `packages/axoview-lib/src/components/BottomDock/BottomDock.tsx` | source | 93 | Bottom-of-canvas dock (mode buttons / status) consumed by `UiOverlay`. | No unit test. |
| `packages/axoview-lib/src/components/Circle/Circle.tsx` | source | 13 | Tiny SVG-circle primitive used by anchors/markers. | No unit test (trivial). |
| `packages/axoview-lib/src/components/ColorSelector/ColorPicker.tsx` | source | 24 | Wrapper around `mui-color-input` color picker, consumed by `ColorSelector`. | — |
| `packages/axoview-lib/src/components/ColorSelector/ColorSelector.tsx` | source | 27 | Color-selection control composing swatches + custom-color input, consumed by item-controls panels. | — |
| `packages/axoview-lib/src/components/ColorSelector/ColorSwatch.tsx` | source | 32 | Single color-swatch button used inside `ColorSelector`. | — |
| `packages/axoview-lib/src/components/ColorSelector/CustomColorInput.tsx` | source | 77 | Hex/text input for custom colors used by `ColorSelector`. | — |
| `packages/axoview-lib/src/components/ColorSelector/__tests__/ColorSelector.test.tsx` | test | 217 | Unit tests for `ColorSelector`. | — |
| `packages/axoview-lib/src/components/ColorSelector/__tests__/CustomColorInput.test.tsx` | test | 144 | Unit tests for `CustomColorInput`. | — |
| `packages/axoview-lib/src/components/ConfirmDiscardDialog/ConfirmDiscardDialog.tsx` | source | 58 | Dialog confirming discard of unsaved changes. | Audit row 18 / N4 — orphan-by-cascade from MainMenu deletion; **delete candidate** in C.2. |
| `packages/axoview-lib/src/components/ConnectorAnchorOverlay/ConnectorAnchorOverlay.tsx` | source | 179 | Overlay rendering anchor handles on connectors, consumed by the renderer. | No unit test. |
| `packages/axoview-lib/src/components/ConnectorEmptySpaceTooltip/ConnectorEmptySpaceTooltip.tsx` | source | 98 | Tooltip shown when hovering empty connector tracks. | No unit test. |
| `packages/axoview-lib/src/components/ConnectorHintTooltip/ConnectorHintTooltip.tsx` | source | 131 | Tooltip with hints for connector usage. | No unit test. |
| `packages/axoview-lib/src/components/ConnectorRerouteTooltip/ConnectorRerouteTooltip.tsx` | source | 125 | Tooltip prompting connector reroute. | No unit test. |
| `packages/axoview-lib/src/components/ConnectorSettings/ConnectorSettings.tsx` | source | 74 | Settings-dialog tab for connector defaults. | No unit test. |
| `packages/axoview-lib/src/components/ContextMenu/ContextMenu.tsx` | source | 37 | Canvas right-click context menu UI. | Audit listed `ContextMenu/`/`ContextMenuManager.tsx` for review — confirm mount path. |
| `packages/axoview-lib/src/components/ContextMenu/ContextMenuManager.tsx` | source | 7 | Mount/manager wrapping `ContextMenu`. | Suspiciously small (7 LOC) — verify it's not a stub or unused. |
| `packages/axoview-lib/src/components/Cursor/Cursor.tsx` | source | 23 | Renders the active-tile cursor overlay on the canvas. | — |
| `packages/axoview-lib/src/components/DOMErrorBoundary/DOMErrorBoundary.tsx` | source | 110 | React error boundary catching DOM/render errors, consumed by the canvas root. | No unit test. |
| `packages/axoview-lib/src/components/DOMErrorBoundary/index.ts` | source | 1 | Barrel re-export for `DOMErrorBoundary`. | — |
| `packages/axoview-lib/src/components/DebugUtils/DebugUtils.tsx` | source | 65 | Debug overlay component used during development; gated. | — |
| `packages/axoview-lib/src/components/DebugUtils/LineItem.tsx` | source | 36 | Single labeled-line row inside debug overlay. | — |
| `packages/axoview-lib/src/components/DebugUtils/SizeIndicator.tsx` | source | 24 | Debug widget showing element sizes. | — |
| `packages/axoview-lib/src/components/DebugUtils/Value.tsx` | source | 27 | Debug widget showing a labeled value. | — |
| `packages/axoview-lib/src/components/DebugUtils/__tests__/DebugUtils.test.tsx` | test | 37 | Snapshot test for `DebugUtils`. | — |
| `packages/axoview-lib/src/components/DebugUtils/__tests__/LineItem.test.tsx` | test | 21 | Snapshot test for `LineItem`. | — |
| `packages/axoview-lib/src/components/DebugUtils/__tests__/SizeIndicator.test.tsx` | test | 42 | Snapshot test for `SizeIndicator`. | — |
| `packages/axoview-lib/src/components/DebugUtils/__tests__/Value.test.tsx` | test | 18 | Snapshot test for `Value`. | — |
| `packages/axoview-lib/src/components/DebugUtils/__tests__/__snapshots__/DebugUtils.test.tsx.snap` | fixture | — | Jest snapshot artifact. | Auto-generated. |
| `packages/axoview-lib/src/components/DebugUtils/__tests__/__snapshots__/LineItem.test.tsx.snap` | fixture | — | Jest snapshot artifact. | Auto-generated. |
| `packages/axoview-lib/src/components/DebugUtils/__tests__/__snapshots__/SizeIndicator.test.tsx.snap` | fixture | — | Jest snapshot artifact. | Auto-generated. |
| `packages/axoview-lib/src/components/DebugUtils/__tests__/__snapshots__/Value.test.tsx.snap` | fixture | — | Jest snapshot artifact. | Auto-generated. |
| `packages/axoview-lib/src/components/DragAndDrop/DragAndDrop.tsx` | source | 34 | Drag-and-drop file/icon handler for the canvas root. | No unit test. |
| `packages/axoview-lib/src/components/ExportImageDialog/ExportImageDialog.tsx` | source | 760 | Dialog to export canvas to PNG/SVG with options; consumed by main menu. | Very large for a single dialog — refactor candidate. No direct unit test (only memo/initial-load regressions). |
| `packages/axoview-lib/src/components/FreehandLasso/FreehandLasso.tsx` | source | 46 | Renders the freehand-lasso path overlay during selection. | — |
| `packages/axoview-lib/src/components/Gradient/Gradient.tsx` | source | 16 | SVG-gradient primitive used by nodes/connectors. | — |
| `packages/axoview-lib/src/components/Grid/Grid.tsx` | source | 76 | Renders the isometric grid background using SVG tiles + CSS formula. | — |
| `packages/axoview-lib/src/components/HelpDialog/HelpDialog.tsx` | source | 304 | Help dialog listing shortcuts + hotkey table; consumed by main menu. | No dedicated unit test (covered indirectly by shortcuts regression). |
| `packages/axoview-lib/src/components/HotkeySettings/HotkeySettings.tsx` | source | 164 | Settings tab letting users switch hotkey profile (qwerty/smnrct/none). | — |
| `packages/axoview-lib/src/components/IconButton/IconButton.tsx` | source | 85 | Shared icon-button primitive used across the UI. | — |
| `packages/axoview-lib/src/components/IconButton/__tests__/IconButton.color.test.tsx` | test | 49 | Unit test for IconButton color behavior. | — |
| `packages/axoview-lib/src/components/IconPackSettings/IconPackSettings.tsx` | source | 173 | Settings tab managing installed icon packs. | — |
| `packages/axoview-lib/src/components/ImportHintTooltip/ImportHintTooltip.tsx` | source | 76 | Tooltip explaining icon-import affordance. | — |
| `packages/axoview-lib/src/components/IsoTileArea/IsoTileArea.tsx` | source | 46 | Renders an isometric tile-shaped area (selection/lasso highlight). | — |
| `packages/axoview-lib/src/components/ItemControls/ConnectorControls/ConnectorControls.tsx` | source | 557 | Right-sidebar control panel for editing a selected connector. | Large component; no direct unit test. |
| `packages/axoview-lib/src/components/ItemControls/IconSelectionControls/Icon.tsx` | source | 142 | Icon-tile rendered inside the icon-picker grid. | — |
| `packages/axoview-lib/src/components/ItemControls/IconSelectionControls/IconCollection.tsx` | source | 116 | Container rendering a category of icons inside the picker. | — |
| `packages/axoview-lib/src/components/ItemControls/IconSelectionControls/IconGrid.tsx` | source | 45 | Grid layout for the icon picker. | — |
| `packages/axoview-lib/src/components/ItemControls/IconSelectionControls/IconSelectionControls.tsx` | source | 285 | Icon-picker top-level component consumed by node controls + left dock. | — |
| `packages/axoview-lib/src/components/ItemControls/IconSelectionControls/Icons.tsx` | source | 37 | List rendering icons inside a category. | — |
| `packages/axoview-lib/src/components/ItemControls/IconSelectionControls/Searchbox.tsx` | source | 34 | Search input for filtering icons. | — |
| `packages/axoview-lib/src/components/ItemControls/IconSelectionControls/__tests__/Icon.test.tsx` | test | 26 | Unit test for the picker `Icon` tile. | — |
| `packages/axoview-lib/src/components/ItemControls/ItemControlsManager.tsx` | source | 48 | Selects the correct item-controls panel based on the selected item type. | — |
| `packages/axoview-lib/src/components/ItemControls/NodeControls/NodeInfoTab/NodeInfoTab.tsx` | source | 247 | Node-controls tab for info/metadata editing (label, description, link). | No unit test. |
| `packages/axoview-lib/src/components/ItemControls/NodeControls/NodePanel/NodePanel.tsx` | source | 377 | Node-controls top-level panel hosting info/style tabs. | No unit test. |
| `packages/axoview-lib/src/components/ItemControls/NodeControls/NodeStyleTab/NodeStyleTab.tsx` | source | 142 | Node-controls tab for visual style (color, icon, label). | No unit test. |
| `packages/axoview-lib/src/components/ItemControls/NodeControls/QuickIconSelector.tsx` | source | 170 | Inline icon-quick-pick used inside the node panel. | — |
| `packages/axoview-lib/src/components/ItemControls/RectangleControls/RectangleControls.tsx` | source | 101 | Right-sidebar control panel for the selected rectangle. | No unit test. |
| `packages/axoview-lib/src/components/ItemControls/TextBoxControls/TextBoxControls.tsx` | source | 123 | Right-sidebar control panel for the selected text box. | No unit test. |
| `packages/axoview-lib/src/components/ItemControls/components/ControlsContainer.tsx` | source | 45 | Shared container layout for item-controls panels. | — |
| `packages/axoview-lib/src/components/ItemControls/components/DeleteButton.tsx` | source | 21 | Shared delete-button used inside item-controls panels. | — |
| `packages/axoview-lib/src/components/ItemControls/components/LabelColorPicker.tsx` | source | 81 | Color picker for labels used by item-controls panels. | — |
| `packages/axoview-lib/src/components/ItemControls/components/Section.tsx` | source | 31 | Section header layout primitive inside item-controls panels. | — |
| `packages/axoview-lib/src/components/Label/ExpandButton.tsx` | source | 35 | Expand/collapse button used by `ExpandableLabel`. | — |
| `packages/axoview-lib/src/components/Label/ExpandableLabel.tsx` | source | 112 | Label that can expand to a richer multi-line view. | — |
| `packages/axoview-lib/src/components/Label/Label.tsx` | source | 81 | Primary label component used on nodes/rectangles/connectors. | — |
| `packages/axoview-lib/src/components/Label/__tests__/Label.test.tsx` | test | 53 | Unit test for `Label`. | — |
| `packages/axoview-lib/src/components/LabelSettings/LabelSettings.tsx` | source | 49 | Settings tab for label defaults. | No unit test. |
| `packages/axoview-lib/src/components/Lasso/Lasso.tsx` | source | 29 | Renders the rectangular-lasso overlay during selection. | — |
| `packages/axoview-lib/src/components/LassoHintTooltip/LassoHintTooltip.tsx` | source | 116 | Tooltip with hints for lasso usage. | No unit test. |
| `packages/axoview-lib/src/components/LassoLayerBar/LassoLayerBar.tsx` | source | 178 | Contextual action bar shown when a lasso selection is active. | No unit test. |
| `packages/axoview-lib/src/components/LayersPanel/LayerItemRow.tsx` | source | 186 | Row rendering an individual item inside the layers panel. | No unit test. |
| `packages/axoview-lib/src/components/LayersPanel/LayerRow.tsx` | source | 243 | Row rendering a layer (with its items) in the layers panel. | No unit test. |
| `packages/axoview-lib/src/components/LayersPanel/LayersPanel.tsx` | source | 535 | Right-sidebar panel listing layers + items; major UI surface. | Large; no direct unit test. |
| `packages/axoview-lib/src/components/LazyLoadingWelcomeNotification/LazyLoadingWelcomeNotification.tsx` | source | 81 | Lazy-loaded welcome notification snackbar. | No unit test (covered by splash regression). |
| `packages/axoview-lib/src/components/LeftDock/CommonElements.tsx` | source | 187 | Common-elements (rectangles, text, connectors) tile picker inside left dock. | No unit test. |
| `packages/axoview-lib/src/components/LeftDock/DeleteIconConfirmDialog.tsx` | source | 184 | Confirm-delete dialog for user-imported icons. | No unit test. |
| `packages/axoview-lib/src/components/LeftDock/ElementsPanel.tsx` | source | 440 | Left-dock panel listing draggable icons/elements. | Large; no direct unit test. |
| `packages/axoview-lib/src/components/LeftDock/ImportIconsDialog.tsx` | source | 80 | Dialog flow for importing user-supplied icons. | No unit test. |
| `packages/axoview-lib/src/components/LeftDock/LeftDock.tsx` | source | 182 | Left-edge dock container hosting elements panel + actions. | No unit test. |
| `packages/axoview-lib/src/components/Loader/Loader.tsx` | source | 22 | Loading-spinner overlay used during async init. | — |
| `packages/axoview-lib/src/components/MainMenu/MainMenu.tsx` | source | 260 | Main menu (file ops, settings, help) component. | Audit row 17 / N4 — flagged dead-by-config, **locked for deletion** in C.2 (anchor decision). |
| `packages/axoview-lib/src/components/MainMenu/MenuItem.tsx` | source | 21 | Menu-item primitive used by `MainMenu`. | Cascades with MainMenu deletion (audit C.2). |
| `packages/axoview-lib/src/components/NodeActionBar/NodeActionBar.tsx` | source | 366 | Floating action bar shown next to a selected node. | No unit test. |
| `packages/axoview-lib/src/components/NotificationSnackbar/NotificationSnackbar.tsx` | source | 30 | Global MUI snackbar for transient notifications. | — |
| `packages/axoview-lib/src/components/PanSettings/PanSettings.tsx` | source | 141 | Settings tab for pan-behavior configuration. | No unit test. |
| `packages/axoview-lib/src/components/QuickAddNodePopover/QuickAddNodePopover.tsx` | source | 127 | Popover for quick-adding a new node by icon. | — |
| `packages/axoview-lib/src/components/Renderer/Renderer.tsx` | source | 223 | The isometric scene renderer hosting all scene layers; central canvas component. | Central component; no direct unit test (covered by integration). |
| `packages/axoview-lib/src/components/RichTextEditor/RichTextEditor.tsx` | source | 131 | Quill-based rich text editor used by labels/text boxes. | — |
| `packages/axoview-lib/src/components/RichTextEditor/RichTextEditorErrorBoundary.tsx` | source | 102 | Error boundary wrapping Quill to catch its known crash modes. | — |
| `packages/axoview-lib/src/components/RichTextEditor/__tests__/RichTextEditor.formats.test.ts` | test | 67 | Unit test for the rich-text format whitelist. | — |
| `packages/axoview-lib/src/components/SceneLayer/SceneLayer.tsx` | source | 50 | Generic positioned scene-layer container used by all scene layers. | — |
| `packages/axoview-lib/src/components/SceneLayers/ConnectorLabels/ConnectorLabel.tsx` | source | 243 | Renders a single connector label on the canvas. | No unit test. |
| `packages/axoview-lib/src/components/SceneLayers/ConnectorLabels/ConnectorLabels.tsx` | source | 28 | Maps the connector list to `ConnectorLabel` components. | — |
| `packages/axoview-lib/src/components/SceneLayers/Connectors/Connector.tsx` | source | 281 | Renders a single connector path with anchors/labels. | No unit test (covered by mode/regression suites). |
| `packages/axoview-lib/src/components/SceneLayers/Connectors/Connectors.tsx` | source | 31 | Maps the connector list to `Connector` components. | — |
| `packages/axoview-lib/src/components/SceneLayers/Nodes/Node/IconTypes/IsometricIcon.tsx` | source | 31 | Renders an isometric-style icon for a node. | — |
| `packages/axoview-lib/src/components/SceneLayers/Nodes/Node/IconTypes/NonIsometricIcon.tsx` | source | 46 | Renders a non-isometric (2D) icon for a node. | — |
| `packages/axoview-lib/src/components/SceneLayers/Nodes/Node/Node.tsx` | source | 350 | Renders a single node with its icon + label + selection state. | No unit test (covered by regression). |
| `packages/axoview-lib/src/components/SceneLayers/Nodes/Nodes.tsx` | source | 47 | Maps the node list to `Node` components. | — |
| `packages/axoview-lib/src/components/SceneLayers/Rectangles/Rectangle.tsx` | source | 28 | Renders a single rectangle on the canvas. | — |
| `packages/axoview-lib/src/components/SceneLayers/Rectangles/Rectangles.tsx` | source | 23 | Maps the rectangle list to `Rectangle` components. | — |
| `packages/axoview-lib/src/components/SceneLayers/TextBoxes/TextBox.tsx` | source | 165 | Renders a single text box on the canvas. | — |
| `packages/axoview-lib/src/components/SceneLayers/TextBoxes/TextBoxes.tsx` | source | 23 | Maps the text-box list to `TextBox` components. | — |
| `packages/axoview-lib/src/components/SettingsDialog/AboutTab.tsx` | source | 64 | About-tab content shown inside the settings dialog. | — |
| `packages/axoview-lib/src/components/SettingsDialog/SettingsDialog.tsx` | source | 213 | Main settings dialog host wiring tabs (hotkeys, icon packs, label, pan, zoom, about). | — |
| `packages/axoview-lib/src/components/Sidebars/RightSidebar.tsx` | source | 64 | Right-sidebar host wrapping item controls + layers panel. | Note: `Sidebars/LeftSidebar.tsx` is **deleted** per audit register #3 — only RightSidebar remains; folder name now arguably stale. |
| `packages/axoview-lib/src/components/Svg/Svg.tsx` | source | 27 | Shared SVG root primitive used by scene layers. | — |
| `packages/axoview-lib/src/components/ToolMenu/ToolMenu.tsx` | source | 159 | Mode-switcher tool menu (cursor/pan/rectangle/connector/etc.). | — |
| `packages/axoview-lib/src/components/TransformControlsManager/NodeTransformControls.tsx` | source | 13 | Thin wrapper assembling transform anchors for nodes. | — |
| `packages/axoview-lib/src/components/TransformControlsManager/RectangleTransformControls.tsx` | source | 36 | Transform anchors for rectangles. | — |
| `packages/axoview-lib/src/components/TransformControlsManager/TextBoxTransformControls.tsx` | source | 18 | Transform anchors for text boxes. | — |
| `packages/axoview-lib/src/components/TransformControlsManager/TransformAnchor.tsx` | source | 61 | A single transform-anchor handle. | — |
| `packages/axoview-lib/src/components/TransformControlsManager/TransformControls.tsx` | source | 83 | Generic transform-controls overlay composed of anchors. | — |
| `packages/axoview-lib/src/components/TransformControlsManager/TransformControlsManager.tsx` | source | 47 | Dispatches to per-type transform-control components based on selection. | — |
| `packages/axoview-lib/src/components/UiElement/UiElement.tsx` | source | 23 | DOM positioning primitive used by UI overlays. | — |
| `packages/axoview-lib/src/components/UiOverlay/UiOverlay.tsx` | source | 321 | Top-level UI overlay hosting docks/menus/sidebars over the canvas. | — |
| `packages/axoview-lib/src/components/ViewTabs/ViewTabs.tsx` | source | 291 | Tab bar for switching between views in the diagram. | No unit test (covered by viewTabs regression). |
| `packages/axoview-lib/src/components/ZoomControls/ZoomControls.tsx` | source | 88 | Zoom in/out/reset control buttons. | — |
| `packages/axoview-lib/src/components/ZoomSettings/ZoomSettings.tsx` | source | 53 | Settings tab for zoom defaults/behavior. | — |
| `packages/axoview-lib/src/config.ts` | source | 168 | Library-wide constants (sizes, defaults, modes); broadly consumed. | — |
| `packages/axoview-lib/src/config/hotkeys.ts` | source | 36 | Hotkey-profile definitions (`qwerty`/`smnrct`/`none`); consumed by HotkeySettings + interaction layer. | Pinned by audit (locked decision #15 area). |
| `packages/axoview-lib/src/config/labelSettings.ts` | source | 6 | Label-setting defaults. | — |
| `packages/axoview-lib/src/config/panSettings.ts` | source | 14 | Pan-setting defaults. | — |
| `packages/axoview-lib/src/config/persistedSettings.ts` | source | 34 | Persisted-settings schema + defaults stored in localStorage. | — |
| `packages/axoview-lib/src/config/shortcuts.ts` | source | 9 | Fixed-shortcut mapping (cut/copy/paste/undo/redo/help). | Pinned by audit. |
| `packages/axoview-lib/src/config/zoomSettings.ts` | source | 6 | Zoom-setting defaults. | — |
| `packages/axoview-lib/src/contexts/CanvasModeContext.tsx` | source | 83 | React context tracking current canvas interaction mode. | — |
| `packages/axoview-lib/src/examples/BasicEditor/BasicEditor.tsx` | source | 6 | Minimal example mounting `<Axoview>` for dev playground. | Dev-only; not shipped to consumers. |
| `packages/axoview-lib/src/examples/DebugTools/DebugTools.tsx` | source | 12 | Dev-playground example showcasing debug tools. | Dev-only. |
| `packages/axoview-lib/src/examples/ReadonlyMode/ReadonlyMode.tsx` | source | 11 | Dev-playground example for readonly mode. | Dev-only. |
| `packages/axoview-lib/src/examples/index.tsx` | source | 42 | Router/index for the dev-playground examples consumed by `src/index.tsx`. | Dev-only. |
| `packages/axoview-lib/src/examples/initialData.ts` | fixture | 767 | Large example diagram (initial data) used by playground examples. | Dev-only; large but justified as a fixture. |
| `packages/axoview-lib/src/fixtures/colors.ts` | fixture | 11 | Default color palette used by the library at runtime + as a fixture. | Despite the `fixtures/` location these are consumed at runtime, not just by tests. |
| `packages/axoview-lib/src/fixtures/icons.ts` | fixture | 2 | Empty bundled-icons array (icons are loaded via isopacks). | — |
| `packages/axoview-lib/src/fixtures/model.ts` | fixture | 14 | Default empty-model template used to bootstrap new diagrams. | Runtime-consumed despite `fixtures/` path. |
| `packages/axoview-lib/src/fixtures/modelItems.ts` | fixture | 19 | Default model-item templates. | Runtime-consumed despite `fixtures/` path. |
| `packages/axoview-lib/src/fixtures/views.ts` | fixture | 61 | Default-view template used when creating new views. | Runtime-consumed despite `fixtures/` path. |
| `packages/axoview-lib/src/global.d.ts` | source | 38 | Ambient global type declarations (window globals, etc.). | — |
| `packages/axoview-lib/src/hooks/__tests__/useHistory.realStore.test.tsx` | test | 180 | Tests `useHistory` against a real zustand store. | — |
| `packages/axoview-lib/src/hooks/__tests__/useHistory.test.tsx` | test | 260 | Unit tests for `useHistory` (undo/redo). | — |
| `packages/axoview-lib/src/hooks/__tests__/useInitialDataManager.test.tsx` | test | 414 | Unit tests for `useInitialDataManager`. | — |
| `packages/axoview-lib/src/hooks/__tests__/useIsoProjection.twoDY.test.tsx` | test | 125 | Tests 2D-Y mode behavior of `useIsoProjection`. | — |
| `packages/axoview-lib/src/hooks/useColor.ts` | source | 14 | Hook resolving color tokens to display values. | No unit test. |
| `packages/axoview-lib/src/hooks/useConnector.ts` | source | 12 | Selector hook returning a connector by id. | No unit test (trivial). |
| `packages/axoview-lib/src/hooks/useDiagramUtils.ts` | source | 46 | Hook exposing diagram-wide utilities to UI. | No unit test. |
| `packages/axoview-lib/src/hooks/useDirtyTracker.ts` | source | 55 | Tracks dirty state of the diagram across edits; consumed by save UI. | No direct unit test (covered by saveTracking regression). |
| `packages/axoview-lib/src/hooks/useHistory.ts` | source | 105 | Undo/redo history hook backed by the model store. | — |
| `packages/axoview-lib/src/hooks/useIcon.tsx` | source | 44 | Hook resolving an icon by id from installed icon packs. | No unit test. |
| `packages/axoview-lib/src/hooks/useIconCategories.ts` | source | 25 | Hook returning grouped icon categories. | No unit test. |
| `packages/axoview-lib/src/hooks/useIconFiltering.ts` | source | 26 | Hook filtering icons by search/category. | No unit test. |
| `packages/axoview-lib/src/hooks/useInitialDataManager.ts` | source | 201 | Manages initial-data hydration into the model store; consumed by `<Axoview>`. | — |
| `packages/axoview-lib/src/hooks/useIsoProjection.ts` | source | 101 | Hook computing isometric ↔ screen projection used by the renderer. | — |
| `packages/axoview-lib/src/hooks/useLayerActions.ts` | source | 99 | Hook exposing layer CRUD actions to the layers UI. | No unit test. |
| `packages/axoview-lib/src/hooks/useLayerContext.ts` | source | 172 | Provides per-layer context (selection, visibility) to layer rows. | No unit test. |
| `packages/axoview-lib/src/hooks/useModelItem.ts` | source | 18 | Selector hook returning a model item by id. | No unit test. |
| `packages/axoview-lib/src/hooks/useRectangle.ts` | source | 11 | Selector hook returning a rectangle by id. | No unit test (trivial). |
| `packages/axoview-lib/src/hooks/useResizeObserver.ts` | source | 35 | Wraps shared ResizeObserver instance for components. | — |
| `packages/axoview-lib/src/hooks/useScene.ts` | source | 12 | Selector hook returning the current scene snapshot. | — |
| `packages/axoview-lib/src/hooks/useSceneActions.ts` | source | 789 | Largest action-hook in the lib; aggregates scene mutations consumed across components. | Very large surface; **refactor candidate** — split per-domain. No direct unit test. |
| `packages/axoview-lib/src/hooks/useSceneData.ts` | source | 107 | Hook returning derived scene data (counts, bounds, etc.). | No unit test. |
| `packages/axoview-lib/src/hooks/useTextBox.ts` | source | 11 | Selector hook returning a text box by id. | No unit test (trivial). |
| `packages/axoview-lib/src/hooks/useTextBoxProps.ts` | source | 116 | Hook deriving text-box render props. | No unit test. |
| `packages/axoview-lib/src/hooks/useView.ts` | source | 29 | Selector hook returning the current view. | No unit test. |
| `packages/axoview-lib/src/hooks/useViewItem.ts` | source | 11 | Selector hook returning a view item by id. | No unit test (trivial). |
| `packages/axoview-lib/src/i18n/bn-BD.ts` | i18n | — | Bengali (Bangladesh) translation bundle. | — |
| `packages/axoview-lib/src/i18n/de-DE.ts` | i18n | — | German translation bundle. | — |
| `packages/axoview-lib/src/i18n/en-US.ts` | i18n | — | English (US) translation bundle — canonical reference for locale-completeness test. | — |
| `packages/axoview-lib/src/i18n/es-ES.ts` | i18n | — | Spanish (Spain) translation bundle. | — |
| `packages/axoview-lib/src/i18n/fr-FR.ts` | i18n | — | French translation bundle. | — |
| `packages/axoview-lib/src/i18n/hi-IN.ts` | i18n | — | Hindi translation bundle. | — |
| `packages/axoview-lib/src/i18n/id-ID.ts` | i18n | — | Indonesian translation bundle. | — |
| `packages/axoview-lib/src/i18n/index.ts` | source | 29 | i18n registry exporting all locale bundles + helpers. | Audit C.2 note: i18n locales are also duplicated in `axoview-app` — three locale surfaces total. |
| `packages/axoview-lib/src/i18n/it-IT.ts` | i18n | — | Italian translation bundle. | — |
| `packages/axoview-lib/src/i18n/pl-PL.ts` | i18n | — | Polish translation bundle. | — |
| `packages/axoview-lib/src/i18n/pt-BR.ts` | i18n | — | Portuguese (Brazil) translation bundle. | — |
| `packages/axoview-lib/src/i18n/ru-RU.ts` | i18n | — | Russian translation bundle. | — |
| `packages/axoview-lib/src/i18n/tr-TR.ts` | i18n | — | Turkish translation bundle. | — |
| `packages/axoview-lib/src/i18n/zh-CN.ts` | i18n | — | Chinese (Simplified) translation bundle. | — |
| `packages/axoview-lib/src/index.html` | asset | — | Dev-server HTML shell loaded by `src/index.tsx`. | Dev-only; not part of the published lib. |
| `packages/axoview-lib/src/index.ts` | source | 6 | Library public-API barrel — primary import surface for consumers. | — |
| `packages/axoview-lib/src/index.tsx` | source | 24 | Dev-server entry mounting the `Examples` playground. | Dev-only; intentionally separate from the library `index.ts` (different file ext disambiguates). |
| `packages/axoview-lib/src/interaction/__tests__/DrawRectangle.test.ts` | test | 148 | Unit tests for the DrawRectangle interaction mode. | — |
| `packages/axoview-lib/src/interaction/__tests__/FreehandLasso.test.ts` | test | 294 | Unit tests for the FreehandLasso interaction mode. | — |
| `packages/axoview-lib/src/interaction/__tests__/PlaceIcon.test.ts` | test | 168 | Unit tests for the PlaceIcon interaction mode. | — |
| `packages/axoview-lib/src/interaction/__tests__/TransformRectangle.test.ts` | test | 168 | Unit tests for the TransformRectangle interaction mode. | — |
| `packages/axoview-lib/src/interaction/__tests__/usePanHandlers.test.ts` | test | 434 | Unit tests for `usePanHandlers`. | — |
| `packages/axoview-lib/src/interaction/modes/Connector.ts` | source | 208 | Connector interaction-mode state machine (mousedown/move/up). | — |
| `packages/axoview-lib/src/interaction/modes/Cursor.ts` | source | 458 | Cursor interaction-mode state machine (selection/click/hover). | Large; no direct mode-level unit test (covered only by regression suite). |
| `packages/axoview-lib/src/interaction/modes/DragItems.ts` | source | 310 | DragItems interaction-mode handling multi-item drag. | No direct unit test (covered by regression). |
| `packages/axoview-lib/src/interaction/modes/FreehandLasso.ts` | source | 252 | FreehandLasso interaction-mode. | — |
| `packages/axoview-lib/src/interaction/modes/Lasso.ts` | source | 231 | Rectangular Lasso interaction-mode. | No direct mode unit test (covered by regression). |
| `packages/axoview-lib/src/interaction/modes/Pan.ts` | source | 71 | Pan interaction-mode. | No direct mode unit test. |
| `packages/axoview-lib/src/interaction/modes/PlaceIcon.ts` | source | 57 | PlaceIcon interaction-mode (drag-from-dock placement). | — |
| `packages/axoview-lib/src/interaction/modes/Rectangle/DrawRectangle.ts` | source | 46 | Rectangle-drawing interaction mode. | — |
| `packages/axoview-lib/src/interaction/modes/Rectangle/TransformRectangle.ts` | source | 69 | Rectangle-transform interaction mode. | — |
| `packages/axoview-lib/src/interaction/modes/ReconnectAnchor.ts` | source | 47 | Reconnect-anchor interaction mode (drag connector endpoint). | — |
| `packages/axoview-lib/src/interaction/modes/TextBox.ts` | source | 32 | TextBox placement interaction-mode. | — |
| `packages/axoview-lib/src/interaction/useInteractionManager.ts` | source | 741 | Central interaction-manager hook routing pointer/keyboard events to active mode. | Very large; **refactor candidate**. No direct unit test (only depStability regression). |
| `packages/axoview-lib/src/interaction/usePanHandlers.ts` | source | 249 | Pan-gesture handlers used by canvas root. | — |
| `packages/axoview-lib/src/interaction/useRAFThrottle.ts` | source | 60 | RAF-throttle hook used by interaction loops. | — |
| `packages/axoview-lib/src/module.d.ts` | source | 4 | Ambient module declarations (e.g., for SVG imports). | — |
| `packages/axoview-lib/src/schemas/__tests__/colors.test.ts` | test | 43 | Schema-validation tests for colors. | — |
| `packages/axoview-lib/src/schemas/__tests__/connector.test.ts` | test | 157 | Schema-validation tests for connectors. | — |
| `packages/axoview-lib/src/schemas/__tests__/icons.test.ts` | test | 43 | Schema-validation tests for icons. | — |
| `packages/axoview-lib/src/schemas/__tests__/layer.test.ts` | test | 58 | Schema-validation tests for layers. | — |
| `packages/axoview-lib/src/schemas/__tests__/modelItems.test.ts` | test | 102 | Schema-validation tests for model items. | — |
| `packages/axoview-lib/src/schemas/__tests__/rectangle.test.ts` | test | 19 | Schema-validation tests for rectangles. | — |
| `packages/axoview-lib/src/schemas/__tests__/textBox.test.ts` | test | 38 | Schema-validation tests for text boxes. | — |
| `packages/axoview-lib/src/schemas/__tests__/validation.test.ts` | test | 145 | Schema-validation tests for the high-level `validation.ts` API. | — |
| `packages/axoview-lib/src/schemas/__tests__/views.test.ts` | test | 133 | Schema-validation tests for views. | — |
| `packages/axoview-lib/src/schemas/colors.ts` | source | 7 | Zod schema for color values. | — |
| `packages/axoview-lib/src/schemas/common.ts` | source | 12 | Shared zod schema primitives. | — |
| `packages/axoview-lib/src/schemas/connector.ts` | source | 52 | Zod schema for connectors. | — |
| `packages/axoview-lib/src/schemas/icons.ts` | source | 11 | Zod schema for icons. | — |
| `packages/axoview-lib/src/schemas/index.ts` | source | 9 | Barrel re-export of all zod schemas. | — |
| `packages/axoview-lib/src/schemas/layer.ts` | source | 10 | Zod schema for layers. | — |
| `packages/axoview-lib/src/schemas/model.ts` | source | 28 | Zod schema for the top-level model. | — |
| `packages/axoview-lib/src/schemas/modelItems.ts` | source | 12 | Zod schema for model items. | — |
| `packages/axoview-lib/src/schemas/rectangle.ts` | source | 11 | Zod schema for rectangles. | — |
| `packages/axoview-lib/src/schemas/textBox.ts` | source | 21 | Zod schema for text boxes. | — |
| `packages/axoview-lib/src/schemas/validation.ts` | source | 258 | High-level validate-input API (`validateConnector`/`validateRectangle`/etc.) consumed by store reducers + public API. | Knip flagged some of these exports as unused (audit row 5) — false positive; kept as lib public API. |
| `packages/axoview-lib/src/schemas/views.ts` | source | 28 | Zod schema for views. | — |
| `packages/axoview-lib/src/standaloneExports.ts` | source | 20 | Re-exports a curated set of internals (utils/types/schemas) for external consumers via `index.ts`. | Defines the lib's "public-API surface" referenced by audit row 7. |
| `packages/axoview-lib/src/stores/__tests__/sceneStore.test.ts` | test | 246 | Tests for the scene zustand store. | — |
| `packages/axoview-lib/src/stores/__tests__/zustand.deprecation.test.ts` | test | 60 | Pin-tests for zustand deprecation warnings (locked dep version). | — |
| `packages/axoview-lib/src/stores/localeStore.tsx` | source | 65 | Zustand store holding active locale + i18n bundle. | — |
| `packages/axoview-lib/src/stores/modelStore.tsx` | source | 209 | Zustand store holding the diagram model; central state. | — |
| `packages/axoview-lib/src/stores/reducers/__tests__/connector.test.ts` | test | 281 | Reducer tests for connectors. | — |
| `packages/axoview-lib/src/stores/reducers/__tests__/layer.test.ts` | test | 232 | Reducer tests for layers. | — |
| `packages/axoview-lib/src/stores/reducers/__tests__/modelItem.test.ts` | test | 87 | Reducer tests for model items. | — |
| `packages/axoview-lib/src/stores/reducers/__tests__/rectangle.test.ts` | test | 263 | Reducer tests for rectangles. | — |
| `packages/axoview-lib/src/stores/reducers/__tests__/textBox.test.ts` | test | 332 | Reducer tests for text boxes. | — |
| `packages/axoview-lib/src/stores/reducers/__tests__/view.test.ts` | test | 160 | Reducer tests for views. | — |
| `packages/axoview-lib/src/stores/reducers/__tests__/viewItem.test.ts` | test | 377 | Reducer tests for view items. | — |
| `packages/axoview-lib/src/stores/reducers/__tests__/viewReducers.branches.test.ts` | test | 215 | Branch-coverage tests for view reducers. | — |
| `packages/axoview-lib/src/stores/reducers/connector.ts` | source | 103 | Reducer functions for connector mutations. | — |
| `packages/axoview-lib/src/stores/reducers/index.ts` | source | 6 | Barrel for reducers. | — |
| `packages/axoview-lib/src/stores/reducers/modelItem.ts` | source | 30 | Reducer functions for model-item mutations. | — |
| `packages/axoview-lib/src/stores/reducers/rectangle.ts` | source | 48 | Reducer functions for rectangle mutations. | — |
| `packages/axoview-lib/src/stores/reducers/textBox.ts` | source | 65 | Reducer functions for text-box mutations. | — |
| `packages/axoview-lib/src/stores/reducers/types.ts` | source | 108 | Shared reducer type definitions. | — |
| `packages/axoview-lib/src/stores/reducers/view.ts` | source | 271 | Reducer functions for view mutations (incl. `updateViewTimestamp`, `syncScene` audited as live). | Knip flagged some exports as unused (audit row 4) — false positive risk; kept. |
| `packages/axoview-lib/src/stores/reducers/viewItem.ts` | source | 84 | Reducer functions for view-item mutations. | — |
| `packages/axoview-lib/src/stores/sceneStore.tsx` | source | 200 | Zustand store holding the derived scene (projected positions, etc.). | — |
| `packages/axoview-lib/src/stores/uiStateStore.tsx` | source | 290 | Zustand store holding UI state (selected, mode, dialogs). | No direct unit test. |
| `packages/axoview-lib/src/styles/GlobalStyles.tsx` | style | 14 | MUI `GlobalStyles` injection for the library. | — |
| `packages/axoview-lib/src/styles/theme.ts` | style | 248 | MUI theme config consumed by the lib's `ThemeProvider`. | — |
| `packages/axoview-lib/src/types/axoviewProps.ts` | source | 484 | Public type for `<Axoview>` props; central type-surface for consumers. | Largest types file; surface area that consumers depend on. |
| `packages/axoview-lib/src/types/common.ts` | source | 46 | Shared common types (Coord, Size, etc.). | — |
| `packages/axoview-lib/src/types/dom-to-image-more.d.ts` | source | 31 | Ambient types for the `dom-to-image-more` dep (no upstream types). | — |
| `packages/axoview-lib/src/types/index.ts` | source | 7 | Types barrel re-export. | — |
| `packages/axoview-lib/src/types/interactions.ts` | source | 34 | Types for interaction events / mode states. | — |
| `packages/axoview-lib/src/types/model.ts` | source | 55 | Types for the diagram model. | — |
| `packages/axoview-lib/src/types/rendererProps.ts` | source | 5 | Renderer prop types. | Very small; verify it's not over-fragmented (5 LOC for its own file). |
| `packages/axoview-lib/src/types/scene.ts` | source | 47 | Types for the derived scene. | — |
| `packages/axoview-lib/src/types/settings.ts` | source | 30 | Types for persisted user settings. | — |
| `packages/axoview-lib/src/types/ui.ts` | source | 279 | Types for UI state (dialogs, selection, modes, etc.). | — |
| `packages/axoview-lib/src/utils/CoordsUtils.ts` | source | 24 | Small coord-math helpers; consumed by interaction/renderer. | Capitalized filename inconsistent with the rest of `utils/` (lowercase) — naming inconsistency flagged by audit's ADR 0008 naming-convention work. |
| `packages/axoview-lib/src/utils/SizeUtils.ts` | source | 27 | Small size-math helpers. | Capitalized filename; same naming inconsistency as `CoordsUtils.ts`. |
| `packages/axoview-lib/src/utils/__tests__/common.test.ts` | test | 15 | Unit tests for `utils/common.ts`. | — |
| `packages/axoview-lib/src/utils/__tests__/connectorSelection.test.ts` | test | 117 | Unit tests for connector-selection helpers. | — |
| `packages/axoview-lib/src/utils/__tests__/coordinateTransforms.test.ts` | test | 216 | Unit tests for coordinate-transform helpers. | — |
| `packages/axoview-lib/src/utils/__tests__/findNearestUnoccupiedTile.test.ts` | test | 194 | Unit tests for tile-occupancy finder. | — |
| `packages/axoview-lib/src/utils/__tests__/immer.test.ts` | test | 23 | Pin-test for immer behavior. | — |
| `packages/axoview-lib/src/utils/__tests__/isoMath.richtext.test.ts` | test | 135 | Isomath tests for rich-text content. | — |
| `packages/axoview-lib/src/utils/__tests__/isoMath.test.ts` | test | 343 | Unit tests for the core `isoMath` library. | — |
| `packages/axoview-lib/src/utils/__tests__/leanSave.test.ts` | test | 96 | Unit tests for the lean-save serializer. | — |
| `packages/axoview-lib/src/utils/__tests__/model.test.ts` | test | 148 | Unit tests for model helpers. | — |
| `packages/axoview-lib/src/utils/__tests__/pointInPolygon.test.ts` | test | 180 | Unit tests for point-in-polygon helper. | — |
| `packages/axoview-lib/src/utils/__tests__/renderOrder.test.ts` | test | 56 | Unit tests for render-order helper. | — |
| `packages/axoview-lib/src/utils/__tests__/renderer.test.ts` | test | 246 | Unit tests for the public `utils/renderer.ts` API surface. | — |
| `packages/axoview-lib/src/utils/common.ts` | source | 100 | Generic small utilities (math/id/array). | — |
| `packages/axoview-lib/src/utils/connectorLabels.ts` | source | 62 | Helpers for connector-label positioning. | — |
| `packages/axoview-lib/src/utils/connectorSelection.ts` | source | 44 | Helpers for connector hit/selection logic. | — |
| `packages/axoview-lib/src/utils/coordinateTransforms.ts` | source | 189 | Iso↔screen coordinate transform helpers. | — |
| `packages/axoview-lib/src/utils/exportOptions.ts` | source | 129 | Export-to-JSON serialization options + helpers; re-exported via `index.ts`. | — |
| `packages/axoview-lib/src/utils/findNearestUnoccupiedTile.ts` | source | 97 | Finds the nearest unoccupied tile for placement. | — |
| `packages/axoview-lib/src/utils/hitDetection.ts` | source | 82 | Pointer hit-detection helpers. | No direct unit test. |
| `packages/axoview-lib/src/utils/index.ts` | source | 14 | Barrel for utils. | — |
| `packages/axoview-lib/src/utils/isoMath.ts` | source | 465 | Core isometric math library (projection, intersection, bounds). | Large; well-tested. |
| `packages/axoview-lib/src/utils/leanSave.ts` | source | 43 | Lean-save serializer (`stripDefaultIcons`/`mergeBundledFixtures`) re-exported via `index.ts`. | — |
| `packages/axoview-lib/src/utils/localStorageSave.ts` | source | 18 | localStorage save/load helpers used by persisted settings + diagram autosave. | No direct unit test. Foundation for the "browser-only" persistence path. |
| `packages/axoview-lib/src/utils/model.ts` | source | 45 | Model-manipulation helpers. | — |
| `packages/axoview-lib/src/utils/pathfinder.ts` | source | 29 | Wrapper around `pathfinding` lib for connector routing. | — |
| `packages/axoview-lib/src/utils/pointInPolygon.ts` | source | 63 | Point-in-polygon geometry helper. | — |
| `packages/axoview-lib/src/utils/renderOrder.ts` | source | 36 | Computes z-order of scene items. | — |
| `packages/axoview-lib/src/utils/renderProbe.ts` | source | 61 | Render-probe utility for measuring render performance (dev). | Audit M2 trace harness lives at `utils/trace.ts` — this `renderProbe.ts` is separate; verify it's not duplicate-purpose with planned trace. |
| `packages/axoview-lib/src/utils/renderer.ts` | source | 238 | Renderer helper library (isoToScreen, sortByPosition, bounds, etc.) — large public-API surface. | Knip flagged many exports as unused (audit row 7) — kept as lib public API; candidates for narrowing per ADR 0008. |
| `packages/axoview-lib/src/utils/svgOptimizer.test.ts` | test | 222 | Unit tests for the SVG optimizer (note: test file lives outside `__tests__/` — only test in `utils/` doing this). | Test-file placement inconsistent — should arguably move to `utils/__tests__/svgOptimizer.test.ts` for consistency. |
| `packages/axoview-lib/src/utils/svgOptimizer.ts` | source | 352 | SVG-optimizer used by ExportImageDialog. | — |
| `packages/axoview-lib/src/utils/tooltipWithShortcut.ts` | source | 7 | Helper composing tooltip text with shortcut suffix. | — |

### 7.2 `packages/axoview-app`

The SPA application shell — owns storage providers (`StorageManager` + `LocalStorageProvider` + the Drive stub), the file explorer UI, the app toolbar, the notification stack, the diagram lifecycle (save / load / unsaved-changes guard / autosave), the share-URL handler, and the three error dialogs from [ADR 0011](adr/0011-error-ux-contract.md). Deploys as a static bundle to either Cloudflare Pages or nginx (inside the Docker compose stack).

| Path | Type | LOC | Purpose | Flags |
|---|---|---|---|---|
| `packages/axoview-app/LICENSE` | doc | — | License file mirrored from repo root; consumed by package publishing tooling. | Audit C.2 #4 — verify identical to root LICENSE; flagged in productization-audit. |
| `packages/axoview-app/jest.assetMock.js` | config | 1 | Jest moduleNameMapper stub returning empty string for SVG/PNG/JPG imports so component tests don't choke on asset URLs. | — |
| `packages/axoview-app/jest.axoviewMock.js` | config | 11 | Jest stub of the `axoview` lib (`stripDefaultIcons`/`mergeBundledFixtures`/`exportAsJSON`) so axoview-app unit tests skip the lib's CSS+SVG+react-quill bundle. | Manual mock — must be kept in sync with the lib's real exports. |
| `packages/axoview-app/jest.config.js` | config | 34 | ts-jest config pinned to root `node_modules` (works around React/jsdom hoist duplication) and wires the three mock modules; consumed by `npm test`. | Audit A.5.4: verbose absolute-path resolution is intentional twin of axoview-lib's pattern. |
| `packages/axoview-app/jest.cssMock.js` | config | 1 | Jest moduleNameMapper stub returning `{}` for `.css/.less/.scss/.sass` imports during component tests. | — |
| `packages/axoview-app/jest.setup.js` | config | 21 | Jest setup file: imports `@testing-library/jest-dom`, polyfills `crypto.randomUUID` and `AbortSignal.timeout` missing in jsdom@20. | — |
| `packages/axoview-app/package-lock.json` | lockfile | — | npm lockfile for the app workspace (auto-generated by `npm install`). | Auto-generated. |
| `packages/axoview-app/package.json` | config | — | Workspace manifest: declares the `axoview` lib dep, the rsbuild/i18next/MUI/react-arborist runtime deps, and the `start`/`build`/`prebuild`/`test` scripts. | `axoview: "*"` workspace pin; `prebuild` invokes both the icon-pack generator and a root lib build. |
| `packages/axoview-app/public/_headers` | config | — | Cloudflare Pages headers file: CSP, X-Frame-Options, Referrer-Policy, `Cache-Control: no-store` for `/api/*`. | Audit A.6.5 confirmed present; CSP includes Google + Cloudflare Access origins. |
| `packages/axoview-app/public/_routes.json` | config | — | Cloudflare Pages routing config — include `/api/*` so the worker handles backend calls, exclude nothing else. | Audit A.6.5. |
| `packages/axoview-app/public/apple-touch-icon.png` | asset | — | iOS touch icon referenced from `manifest.json`/HTML head. | — |
| `packages/axoview-app/public/favicon-96x96.png` | asset | — | Browser favicon. | — |
| `packages/axoview-app/public/index.html` | source | — | rsbuild HTML template; `assetPrefix` substituted by rsbuild.config. | — |
| `packages/axoview-app/public/manifest.json` | config | — | PWA web app manifest (name, icons, start_url) — kept even though service worker is unregistered. | Manifest is live; SW is intentionally disabled (`index.tsx` calls `unregister()`). |
| `packages/axoview-app/public/robots.txt` | config | — | Default crawler directives. | — |
| `packages/axoview-app/public/web-app-manifest-192x192.png` | asset | — | PWA manifest icon (192). | — |
| `packages/axoview-app/public/web-app-manifest-512x512.png` | asset | — | PWA manifest icon (512). | — |
| `packages/axoview-app/rsbuild.config.ts` | config | 47 | rsbuild build config: forces React/react-dom to root `node_modules` to avoid duplicate instances, copies `src/i18n` to `dist/i18n/app`, defines `PUBLIC_URL`/`REACT_APP_VERSION` constants. | — |
| `packages/axoview-app/scripts/__tests__/generateMaterialIconPack.test.ts` | test | 37 | Jest test exercising the icon-pack generator's pure `generatePack()` export (asserts > 1000 icons produced). | Requires `@mui/icons-material` on disk; runs in node env. |
| `packages/axoview-app/scripts/generateMaterialIconPack.js` | source | 87 | Prebuild script (CJS) — scans `@mui/icons-material` raw `.js` files, regex-extracts SVG paths, writes `material-icons-pack.json` in the isopacks format. | Duplicates `.ts` sibling — see flag on the `.ts` file. |
| `packages/axoview-app/scripts/generateMaterialIconPack.ts` | source | 114 | TypeScript twin of the prebuild script (header comments suggest ts-node usage). | Duplication smell: `package.json` `prebuild`/`prestart` actually run the `.js` file; `.ts` version may be dead. Audit follow-up. |
| `packages/axoview-app/src/App.css` | style | 81 | Top-level layout CSS (`.App` flex root, toolbar layout); consumed only by `App.tsx`. | — |
| `packages/axoview-app/src/App.tsx` | source | 373 | Top-level React component — wires the `BrowserRouter`/`AppStorageProvider`/`DiagramLifecycleProvider`/`Axoview` stack, share-URL handling, the project import/export dialog mounts, the LocalMode banner and the three error dialogs from ADR 0011. | No dedicated unit test — exercised only via integration; audit A.3 / Phase B trace targets here. |
| `packages/axoview-app/src/LocalStorageInspector.tsx` | source | 204 | Modal that introspects browser localStorage (diagram bytes vs other), with Clear-All confirm; used by the StorageManager dialog path. | No unit test; audit A.3 #5 — reachability uncertain in server-backed mode. |
| `packages/axoview-app/src/components/AppToolbar.tsx` | source | 333 | The top bar — brand, file-name input, Save/Share/Preview buttons, ExportPopover trigger, StatusCluster. Consumed by App.tsx. | No unit test; mode-conditional gates per audit Phase A.3 mapping rows 6-9. |
| `packages/axoview-app/src/components/ChangeLanguage/index.tsx` | source | 28 | Language picker dropdown bound to i18next; rendered by App.tsx. | No unit test. |
| `packages/axoview-app/src/components/ChangeLanguage/styles.css` | style | 41 | Styles for the language picker. | Imported only via `index.tsx`. |
| `packages/axoview-app/src/components/ConfirmDialog.tsx` | source | 77 | Reusable yes/no MUI dialog used by DiagramManager, fileExplorer delete flow, LocalStorageInspector, DiagramLifecycleProvider. | No unit test. |
| `packages/axoview-app/src/components/DiagnosticsOverlay.tsx` | source | 563 | Perf + scene telemetry panel — rAF sampling, PerformanceObserver wiring, event auto-detection, AI/Human download formats. Dev: always on; prod: gated by `axoview_perf_enabled`. | Large file (~560 LOC), no dedicated unit test; memory ceiling documented in header comment. |
| `packages/axoview-app/src/components/DiagnosticsToggleButton.tsx` | source | 44 | Bug-icon toggle for the BottomDock that opens/closes DiagnosticsOverlay; reads from `diagnosticsStore`. | No unit test. |
| `packages/axoview-app/src/components/DiagramManager.css` | style | 227 | Styles for the DiagramManager modal (list/grid + thumbnails). | Imported only by DiagramManager.tsx. |
| `packages/axoview-app/src/components/DiagramManager.tsx` | source | 182 | Ctrl+O modal listing server-backed diagrams (load/share/delete); not used in browser-only mode (FileExplorer is the primary). | Audit A.3 #7 — possibly redundant with FileExplorer; reachability needs Phase B trace. No unit test. |
| `packages/axoview-app/src/components/EmptyStateScreen.tsx` | source | 84 | "No diagram open" placeholder with iso/2D background and Create/Import CTAs; rendered when no diagram is loaded. | A/B-test constant `GRID_VARIANT` flagged inline — "delete the unused branch when decided"; no unit test. |
| `packages/axoview-app/src/components/ErrorBoundary.css` | style | 68 | Styles for the global ErrorBoundary fallback UI. | — |
| `packages/axoview-app/src/components/ErrorBoundary.tsx` | source | 108 | Fallback UI for `react-error-boundary`; offers reload + "report on GitHub" actions. | Hard-codes `github.com/stan-smith/Axoview/issues/new` — verify after rename / org change. No unit test. |
| `packages/axoview-app/src/components/ExportPopover.tsx` | source | 78 | Popover behind the AppToolbar Export button — choices for JSON/PNG/project-zip; delegates to DiagramLifecycleProvider handlers. | No unit test. |
| `packages/axoview-app/src/components/ExportSingleDiagramDialog.tsx` | source | 63 | Dialog for exporting a single diagram as JSON; opened from DiagramLifecycleProvider. | No unit test; audit A.3 #4 noted dual ExportDialog naming (one here, one in fileExplorer/). |
| `packages/axoview-app/src/components/LoadDialog.tsx` | source | 111 | Ctrl+O load picker for browser-only mode (lists localStorage diagrams). | Audit A.3 #6 — undocumented in HelpDialog; reachability needs Phase B. No unit test. |
| `packages/axoview-app/src/components/LocalModeBanner.tsx` | source | 52 | "Your work lives in this browser tab only" warning banner shown in browser-only mode; dismiss persisted to localStorage. | User-facing copy is hard-coded English (not via i18next); no unit test. |
| `packages/axoview-app/src/components/LocalModeShareErrorDialog.tsx` | source | 58 | ADR 0011 error dialog: surfaced when a share-link is opened while running in browser-only mode. | No unit test. |
| `packages/axoview-app/src/components/NotificationStack.tsx` | source | 49 | Stacked MUI snackbar renderer that subscribes to `notificationStore`; mounted once in App.tsx. | No unit test (store has one). |
| `packages/axoview-app/src/components/PublicShareLoadErrorDialog.tsx` | source | 52 | ADR 0011 error dialog: shown when `/display/p/:uuid` cannot resolve a public snapshot. | No unit test. |
| `packages/axoview-app/src/components/ReadonlyLoadErrorDialog.tsx` | source | 52 | ADR 0011 error dialog: shown when `/display/:id` (read-only direct URL) fails to load. | No unit test. |
| `packages/axoview-app/src/components/SaveDialog.tsx` | source | 68 | "Name your diagram" first-save dialog in browser-only mode. | Audit A.3 #6 — reachability needs Phase B; no unit test. |
| `packages/axoview-app/src/components/StatusCluster.tsx` | source | 116 | AppToolbar status group: save status chip, saved-at relative timestamp, SessionStorageGauge in browser-only mode. | No unit test. |
| `packages/axoview-app/src/components/fileExplorer/ContextMenuItems.tsx` | source | 93 | Right-click menu for FileTreeNode (Open/Rename/Duplicate/Share/Export-image/Export-json/Delete). | No unit test. |
| `packages/axoview-app/src/components/fileExplorer/ExportProjectZipDialog.tsx` | source | 107 | Modal that builds a project ZIP via `services/project/projectZip.ts` and downloads it. | No unit test (zip service has one). |
| `packages/axoview-app/src/components/fileExplorer/FileExplorer.tsx` | source | 667 | The left-pane file tree (react-arborist) — selection, expand/collapse, drag-drop, rename, context menu, thumbnails. | Largest component in package (~670 LOC); no unit test; key spot for audit Phase B trace. |
| `packages/axoview-app/src/components/fileExplorer/FileTreeNode.tsx` | source | 179 | Per-row renderer for react-arborist (folder/diagram icons, dirty dot, selection highlight). | No unit test. |
| `packages/axoview-app/src/components/fileExplorer/FileTreeToolbar.tsx` | source | 99 | Top bar of FileExplorer: New diagram / New folder / Refresh / Collapse-all / Import / Export. | No unit test. |
| `packages/axoview-app/src/components/fileExplorer/ImportDialog.tsx` | source | 312 | Project-ZIP import dialog (parse, conflict resolution, destination picker); calls `parseProject` + `importProject`. | Audit cluster 51 (MQA Bundle B 409 fix); no dedicated unit test (parseProject tested via projectZip.test). |
| `packages/axoview-app/src/components/fileExplorer/SessionStorageGauge.tsx` | source | 187 | Quota gauge shown in browser-only mode — measures `localStorage` use vs ~5MB cap; per-diagram delete popover. | No unit test. |
| `packages/axoview-app/src/components/fileExplorer/__tests__/delete.contract.test.ts` | test | 49 | Structural source-scan test: enforces both delete entry points (FileExplorer + DiagramManager) call `notifyDiagramDeletedFromTree` before storage delete (MQA #18). | Greps source — fragile to whitespace/comment changes, but intentionally cheap regression guard. |
| `packages/axoview-app/src/components/fileExplorer/useThumbnail.ts` | source | 27 | Generates a base64 PNG thumbnail of the canvas via dynamically-imported `dom-to-image-more`. | No unit test; `dom-to-image-more` not declared in package.json (relies on transitive resolution). |
| `packages/axoview-app/src/diagramUtils.ts` | source | 62 | `DiagramData` type + `mergeDiagramData`/`extractSavableData`/`validateDiagramData` helpers used by the lifecycle provider and auto-save. | Audit anomaly #8 — `validateDiagramData` may be dead (needs grep follow-up); no unit test. |
| `packages/axoview-app/src/env.d.ts` | source | 1 | rsbuild ambient type reference. | — |
| `packages/axoview-app/src/hooks/__tests__/useRuntimeConfig.test.ts` | test | 58 | Tests `fetchRuntimeConfig` defaults and `/api/config` fetch path. | — |
| `packages/axoview-app/src/hooks/useAutoSave.ts` | source | 90 | Debounced auto-save hook used by DiagramLifecycleProvider in server-backed mode; exposes `saveStatus`/`lastSaved`/`scheduleSave`/`saveNow`. | No unit test. |
| `packages/axoview-app/src/hooks/useFileTree.ts` | source | 255 | Builds `FileNode[]` for react-arborist from `StorageProvider` listings + tree manifest; subscribes to dirty-state propagation. | No unit test. |
| `packages/axoview-app/src/hooks/useRuntimeConfig.ts` | source | 61 | Fetches and caches `/api/config` (`googleClientId`, `driveScopes`, `authMode`, `serverStorage`). | Audit anomaly #31 — `serverStorage` field is plumbed through worker/backend but mode detection now reads `LocalStorageProvider.usingServer` instead; flagged as dead field. |
| `packages/axoview-app/src/i18n.ts` | source | 82 | i18next bootstrap — http backend loading `i18n/app/{lng}.json`, language detector, `supportedLanguages` list. | Some labels (e.g. "Italian") are English not native; minor smell. |
| `packages/axoview-app/src/i18n/bn-BD.json` | i18n | — | Bengali (Bangladesh) translations for the `app` namespace. | — |
| `packages/axoview-app/src/i18n/de-DE.json` | i18n | — | German translations. | — |
| `packages/axoview-app/src/i18n/en-US.json` | i18n | — | English (canonical) translations. | — |
| `packages/axoview-app/src/i18n/es-ES.json` | i18n | — | Spanish translations. | — |
| `packages/axoview-app/src/i18n/fr-FR.json` | i18n | — | French translations. | — |
| `packages/axoview-app/src/i18n/hi-IN.json` | i18n | — | Hindi translations. | — |
| `packages/axoview-app/src/i18n/id-ID.json` | i18n | — | Indonesian translations. | — |
| `packages/axoview-app/src/i18n/it-IT.json` | i18n | — | Italian translations. | — |
| `packages/axoview-app/src/i18n/pl-PL.json` | i18n | — | Polish translations. | Not listed in `supportedLanguages` — orphan locale candidate. |
| `packages/axoview-app/src/i18n/pt-BR.json` | i18n | — | Portuguese (Brazil) translations. | — |
| `packages/axoview-app/src/i18n/ru-RU.json` | i18n | — | Russian translations. | — |
| `packages/axoview-app/src/i18n/tr-TR.json` | i18n | — | Turkish translations. | — |
| `packages/axoview-app/src/i18n/zh-CN.json` | i18n | — | Chinese (Simplified) translations. | — |
| `packages/axoview-app/src/index.css` | style | 12 | Global resets (body margin, font smoothing). | — |
| `packages/axoview-app/src/index.tsx` | source | 33 | React entry point — runs `migrateFossflowStorageKeys()`, mounts ErrorBoundary + I18nextProvider + App, unregisters any active service worker, calls `reportWebVitals()`. | — |
| `packages/axoview-app/src/layout/FileExplorerLayout.tsx` | source | 25 | Trivial flex wrapper around the main canvas region — the file explorer itself now overlays absolutely (per inline comment). | Vestigial since the overlay change; could collapse into App.tsx. |
| `packages/axoview-app/src/providers/AppStorageContext.tsx` | source | 63 | Singleton StorageManager registered with LocalStorageProvider; calls `fetchRuntimeConfig()` once at boot and sets server-vs-browser-only mode (ADR 0009 D2). | Audit anomaly #5 — earlier dual-StorageManager is now resolved; only LocalStorageProvider is registered, GoogleDriveProvider is exported-but-unused. |
| `packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx` | source | 1333 | The diagram lifecycle/state god-provider — current diagram, dirty tracking, all save/load/import/export/share/delete flows, dialog visibility flags, icon-pack hydration, mode-aware autosave, route-based readonly handling. | **Largest file in the package by far (~1.3k LOC)**. Per audit, the Phase 0A decomposition that produced this still leaves it as the central bottleneck (ADR territory). No direct unit test. |
| `packages/axoview-app/src/providers/__tests__/AppStorageContext.test.tsx` | test | 62 | Tests the AppStorageProvider boot path (mode detection from `/api/config`). | — |
| `packages/axoview-app/src/reportWebVitals.ts` | source | 15 | web-vitals v5 wrapper (CLS/FCP/INP/LCP/TTFB) — called with no handler in `index.tsx`, so it's effectively a no-op. | Live module, dormant in practice; audit follow-up candidate (CRA boilerplate residue). |
| `packages/axoview-app/src/services/iconPackManager.ts` | source | 281 | Zustand store + React hooks that lazy-load icon packs (aws/gcp/azure/kubernetes/material) and merge them into the in-memory icon catalog. | Audit anomaly #10 — zustand exports look unused to knip but are consumed reactively. No dedicated unit test. |
| `packages/axoview-app/src/services/iconUsage.ts` | source | 69 | Workspace-wide scan: which diagrams reference an icon id and how many times; consumed by the imported-icon delete flow. | No unit test. |
| `packages/axoview-app/src/services/project/__tests__/projectZip.test.ts` | test | 420 | Comprehensive tests for `parseProject`/`importProject` (format detection, version, conflict resolution, legacy fossflow-project format). | — |
| `packages/axoview-app/src/services/project/projectZip.ts` | source | 341 | Project-ZIP packer/unpacker per ADR 0001; supports `axoview-project` and legacy `fossflow-project` formats. | Test coverage strong. |
| `packages/axoview-app/src/services/storage/StorageManager.ts` | source | 117 | Provider registry + StorageProvider delegator; tracks `serverStorageAvailable` (ADR 0009 D2). | Audit anomaly #5 root — name collision with old modal `StorageManager.tsx` (since removed). No direct unit test (covered via providers + AppStorageContext.test). |
| `packages/axoview-app/src/services/storage/__tests__/LocalStorageProvider.test.ts` | test | 262 | Unit tests for LocalStorageProvider: list/load/save/create/delete, lean-save behavior, soft-delete, manifest. | — |
| `packages/axoview-app/src/services/storage/__tests__/backendRoutes.contract.test.ts` | test | 45 | Contract test: client URLs LocalStorageProvider hits must match backend route shapes (greps both sides). | Structural grep test — useful but fragile. |
| `packages/axoview-app/src/services/storage/index.ts` | source | 10 | Barrel: re-exports types + StorageManager + the two providers. | Re-exports GoogleDriveProvider that is never instantiated (audit Section 7 reference; placeholder for Phase 3B). |
| `packages/axoview-app/src/services/storage/providers/GoogleDriveProvider.ts` | source | 61 | Placeholder GDrive provider — every method throws `NotImplementedError`. | Intentional placeholder for Phase 3B (audit anomaly catalogue: never registered, never instantiated). |
| `packages/axoview-app/src/services/storage/providers/LocalStorageProvider.ts` | source | 557 | Dual-mode storage provider — `usingServer=false` writes to `localStorage` (browser-only) and `usingServer=true` calls the backend HTTP API (server-backed). Includes ADR 0003 lean-save logic. | Largest source file after DiagramLifecycleProvider; tested. Branch divergence at ~L305+ is per-audit row 2/3. |
| `packages/axoview-app/src/services/storage/types.ts` | source | 71 | `DiagramMeta`/`FolderMeta`/`TreeManifest`/`StorageProvider` interface + `PublicSnapshot` + `NotImplementedError`. | — |
| `packages/axoview-app/src/serviceWorkerRegistration.ts` | source | 107 | CRA-template service-worker register/unregister scaffold; `index.tsx` only calls `unregister()`. | Audit anomaly: `service-worker.js` was deleted; only `unregister` is live, `register` export is dead. Candidate for slimming to a 5-line unregister-only helper. |
| `packages/axoview-app/src/stores/__tests__/notificationStore.test.ts` | test | 84 | Tests the zustand notification queue (push/dismiss/dedupe/autoDismiss). | — |
| `packages/axoview-app/src/stores/diagnosticsStore.ts` | source | 52 | Module-level store backing DiagnosticsOverlay + toggle button; persisted to `axoview_perf_enabled` in prod, forced-on in dev. | No unit test. |
| `packages/axoview-app/src/stores/notificationStore.ts` | source | 51 | Zustand store powering NotificationStack — push/dismiss API with action buttons and auto-dismiss. | — |
| `packages/axoview-app/src/utils/__tests__/fileOperations.test.ts` | test | 144 | Tests `sequentialName`, `copySuffix`, and `propagateDirty` helpers. | — |
| `packages/axoview-app/src/utils/__tests__/migrationShim.test.ts` | test | 67 | Tests one-shot rename migration: `fossflow_*` / `fossflow-*` keys → `axoview_*` / `axoview-*`, sentinel-gated. | — |
| `packages/axoview-app/src/utils/__tests__/shareUrl.test.ts` | test | 30 | Tests `shareUrlFromUuid` anchors links to the page origin (not backend port). | — |
| `packages/axoview-app/src/utils/apiBaseUrl.ts` | source | 14 | Returns `http://localhost:3001` only during `npm run dev` (SPA on :3000, backend on :3001); empty everywhere else. | No unit test. |
| `packages/axoview-app/src/utils/downloadBlob.ts` | source | 8 | Triggers a browser download for a `Blob`. | No unit test (trivial DOM call). |
| `packages/axoview-app/src/utils/fileOperations.ts` | source | 118 | Naming helpers (`sequentialName`/`copySuffix`) + tree dirty-state propagation (`propagateDirty`). | — |
| `packages/axoview-app/src/utils/migrationShim.ts` | source | 73 | One-shot `localStorage`/`sessionStorage` key migration `fossflow*` → `axoview*`, sentinel-gated, called from `index.tsx`. | — |
| `packages/axoview-app/src/utils/shareUrl.ts` | source | 15 | `shareUrlFromUuid(uuid)` → `${origin}/display/p/${uuid}` — anchors share links to the page origin. | — |
| `packages/axoview-app/tsconfig.json` | config | — | Extends `tsconfig.base.json`; `noEmit: true`, `target: es5`. | `target: es5` is unusually low and (per LocalStorageProvider comment) caused a ts-jest `Set` polyfill bug worked around in source code — candidate to raise once cause is verified. |

### 7.3 `packages/axoview-backend`

Node 22 + Express 5 + filesystem adapter. Owns the canonical `/api/*` HTTP contract (every route defined in [`routes.js`](../packages/axoview-backend/src/routes.js); the Worker imports the same file). Atomicity via tmp-file + rename per [ADR 0010 D3](adr/0010-session-backend-contract.md#3-atomicity--every-put-is-all-or-nothing); auth via `AUTH_MODE`; health probe at `/healthz`. Deploys behind nginx inside the server-backed Docker image.

| Path | Type | LOC | Purpose | Flags |
|---|---|---|---|---|
| `packages/axoview-backend/package.json` | config | 20 | Declares the `axoview-backend` Node 22 / Express 5 package manifest with `start`/`dev` scripts and runtime deps (express, cors, helmet, dotenv) for the server-backed deployment target; consumed by npm and Docker image build. | — |
| `packages/axoview-backend/server.js` | source | 165 | Express bootstrap entrypoint that wires helmet/cors/json middleware, the `AUTH_MODE=none\|shared-token` gate, the cached `/healthz` probe (ADR 0010 D8), the `STORAGE_PATH` fs-adapter init, and the Express→`routes.js` `adapt()` bridge mapping each `/api/*` route to the shared handler; consumed by `node server.js` / Docker entrypoint. | no-test-coverage (audit C.8 / P5 / F4 — no jest config in package); only Express bridge (not used by Cloudflare Worker) |
| `packages/axoview-backend/src/adapters/fs.js` | source | 95 | Implements the `StorageAdapter` contract over the Node filesystem: validates opaque keys against `KEY_PATTERN`, maps `diagrams/<id>`/`folders`/`tree-manifest`/`public/<uuid>` to `.json` files under `STORAGE_PATH`, performs tmp-file + rename atomic writes (ADR 0010 D3), and exposes `listDiagramMeta()` for the server-backed listing endpoint; consumed by `server.js` via `createFsAdapter()`. | no-test-coverage (audit C.8 / P5 / F4) |
| `packages/axoview-backend/src/adapters/types.ts` | source | 18 | TypeScript declaration of the `StorageAdapter`, `DiagramMeta`, and `FolderMeta` interfaces that the route layer relies on; consumed as a documentation/contract artifact (the runtime JS adapter conforms structurally — no compile step in this package). | type-only declaration in an otherwise-JS package — not imported at runtime, dead-code candidate as an import target (kept as contract doc) |
| `packages/axoview-backend/src/routes.js` | source | 325 | Framework-agnostic `(adapter, ctx) => {status, body}` handlers for the canonical `/api/*` HTTP contract — diagrams CRUD, folders CRUD, tree-manifest, share/unshare, public snapshot, `getConfig`, plus `HttpError` + id/uuid validators and share-UUID generation via `crypto.getRandomValues`; consumed by both `server.js` (Express) and the Cloudflare Worker (Hono) so the two runtimes share one implementation. | no-test-coverage (audit C.8 / P5 / F4) despite being the canonical contract surface shared with axoview-worker |

### 7.4 `packages/axoview-worker`

Hono on Cloudflare Pages Functions. Imports `routes.js` from `axoview-backend` (the cross-package import is the single source of truth) but short-circuits every storage route to 503 at [`app.ts`](../packages/axoview-worker/src/app.ts) per [ADR 0009 D1](adr/0009-deployment-topology.md) — Cloudflare deploys are storage-less today; end users land on the browser-only path. Implements `cf-access` auth (JWKS RS256 verify). Bundle-size budget <1 MB uncompressed (CI-enforced per [ADR 0009 D8](adr/0009-deployment-topology.md)).

| Path | Type | LOC | Purpose | Flags |
|---|---|---|---|---|
| `packages/axoview-worker/package.json` | config | 19 | Declares the `axoview-worker` package, its Hono runtime dependency, and `deploy`/`dev` scripts consumed by Wrangler and CI. | — |
| `packages/axoview-worker/src/app.ts` | source | 25 | Hono entry point that wires `secureHeaders`, body-limit, and `authMiddleware` onto `/api/*`, serves `/api/config` (advertising `serverStorage: false`), and short-circuits every other `/api/*` route to 503 per ADR 0009 D1 — making end users hit the browser-only path even with a Worker deploy. | No test coverage (no jest config; audit C.8 gap). |
| `packages/axoview-worker/src/auth.ts` | source | 132 | Auth middleware supporting `none` / `shared-token` / `cf-access` modes, with a public-namespace bypass for `GET /api/public/diagrams/:uuid` and full RS256 JWKS verification (Web Crypto) of Cloudflare Access JWTs, consumed by `app.ts`. | No test coverage (no jest config; audit C.8 gap); JWKS verify path is dead code until storage routes return (audit notes worker is storage-less today). |
| `packages/axoview-worker/tsconfig.json` | config | 16 | Worker-scoped TypeScript config (ES2022 + WebWorker libs, `@cloudflare/workers-types`) that also includes `../axoview-backend/src/**/*` so the shared `routes.js` typechecks against the worker build. | — |
| `packages/axoview-worker/wrangler.toml` | config | 11 | Standalone Wrangler config for local `wrangler pages dev`, kept in lockstep with the repo-root `wrangler.toml`; declares no R2 binding (storage-less) and defaults `AUTH_MODE=shared-token`. | Drift risk vs repo-root `wrangler.toml` flagged by ADR 0009 D5. |

### 7.5 `packages/axoview-e2e`

Playwright Chromium against the local dev server — 13 spec files / 33 tests covering canonical user journeys J1–J20 from [`docs/manual-test-baseline.md`](manual-test-baseline.md). Page Object Model per surface (AppToolbar, FileExplorer, Canvas, NodeInfoTab, LayersPanel, dialogs); per [ADR 0008 D5](adr/0008-naming-convention.md#5-data-axoview-id-attribute--selective-not-blanket-reserved-for-e2e-and-trace-harness-anchors) `data-axoview-id` is added lazily. Runs on PRs + master push.

<!-- E2E_TABLE_PLACEHOLDER -->

### 7.6 Repo shell — deployment artifacts, CI, root configuration

Everything outside the packages: deployment artifacts (Dockerfile, compose stacks, nginx, wrangler, docker-entrypoint), the `.github/` workflows + issue templates + Dependabot config, root build/lint/release tooling (ESLint, commitlint, semantic-release, tsconfig.base, prettier), and the root-level prose files (LICENSE, CHANGELOG, README, PLAN, known_issues).

<!-- INFRA_TABLE_PLACEHOLDER -->

### 7.7 `docs/`

The three-tier doc tree per [`docs/workflow.md`](workflow.md) design principle 4: ADRs in `docs/adr/` (durable, status-tracked), tacticals in `docs/tactical/` (short-lived, deleted at wrap), root-level living references (`architecture.md`, `workflow.md`, `testing.md`, `ux-principles.md`, `deployment.md`, `manual-test-baseline.md`, `perf-troubleshooting.md`), plus the frozen `upstream-changelog.md` and this artifact.

<!-- DOCS_TABLE_PLACEHOLDER -->

### 7.8 Cross-package observations

<!-- CROSS_PACKAGE_PLACEHOLDER -->

### 7.9 Inventory totals

<!-- TOTALS_PLACEHOLDER -->

---

## 8. Quality KPIs aggregate

<!-- TBD Session C — Will cover: test counts (1009 passing + 1 skipped across 93 jest suites monorepo-wide + 33 Playwright E2E specs; ~32% global statement coverage with 10% global minimum threshold), build outputs (axoview-app build, axoview-lib dist), bundle sizes (Worker <1 MB uncompressed per ADR 0009 D8), CI duration, lint findings, knip soft-fail surface, CodeQL findings. Cross-references: docs/testing.md, T2 git-automation tactical for the CI gate list. -->

---

## 9. Decisions catalog

### 9.1 ADRs

| ADR | Title | Status | Date | One-line decision | Key consequences |
|---|---|---|---|---|---|
| [0001](adr/0001-project-zip-format.md) | Project zip format | Accepted | 2026-04-30 | Workspace = single `.zip` with `manifest.json` + `diagrams/<id>.json` + optional `tree-manifest.json`; three scopes (project / folder / diagram); three import destinations (root / new folder / replace-all with typed confirm); ID rewriting always. | One symmetric format across browser-only + server-backed modes. Re-import preserves relative tree shape; share URLs don't survive a round-trip; `jszip` ~96 KB added to bundle. |
| [0002](adr/0002-icon-catalog-merge-on-load.md) | Icon catalog merge on load | Accepted | 2026-04-30 | Side-dock catalog = `bundledFixtures ∪ model.icons` (union by id; overrides win); merge runs at every load. **Plus 2026-05-18 lifecycle addendum:** imported-icon delete + workspace usage scan + `TOMBSTONE_ICON` for unresolved ids. | Side dock can't empty after load (paired with ADR 0003 strip). Catalog cannot bit-rot since merge runs on every load. Deleted bundled icons cannot be persisted-as-deleted (intentional). |
| [0003](adr/0003-session-storage-lean-icon-save.md) | Lean icon save | Accepted | 2026-04-30 | Strip default-catalog icons from every write path (session / server / export JSON / project zip); preserve custom + overrides; companion field `requiredPacks: string[]` signals lazy-load needs. | Workspaces hold materially more diagrams within sessionStorage's ~5 MB budget. Backward-compatible with older fat saves (the load-merge collapses duplicates harmlessly). |
| [0004](adr/0004-connector-name-and-details-panel.md) | Connector name + details panel parity | Accepted | 2026-05-03 | Add `name?` + `notes?` to `connectorSchema`; F2-rename works on connectors; tabbed Details/Style/Notes panel mirrors `NodePanel`. | Connectors become first-class peers of nodes. Two label surfaces (`name` + `labels[]`) coexist — visual overlap at position ~50 is explicitly accepted. Accepted 2026-05-05 (Session B bookkeeping flip; cluster 43 ship date). |
| [0005](adr/0005-toolbar-and-dock-layout-contract.md) | Toolbar + dock layout contract | Accepted | 2026-05-09 | Top toolbar = RIGHT-only with 4 groups (View modes reserved · Save group · Document actions · Sidebar toggle); left strip = 📁 → separator → ⊞ ≣ → spacer → ⚙; burger removed; SettingsDialog gains About + Diagnostics tabs. | Future toolbar additions route mechanically by class. Burger junk-drawer debt resolved. Accepted 2026-05-09 (Session B bookkeeping flip; matches cluster 46 ship date). |
| [0006](adr/0006-canvas-selection-contract.md) | Canvas selection contract (single + multi) | Accepted | 2026-05-16 | Two cooperating slices: `selectedIds: ItemReference[]` (multi) + `itemControls` (single, panel-driver). Invariant: when `selectedIds.length === 1`, `itemControls` mirrors it; otherwise null. Ctrl+click toggles, Ctrl+A selects-all, Esc clears. Locked/hidden items uniformly off-limits via `isItemInteractable`. | Single-item consumers unchanged (additive contract). Auto-hide on N>1 selection (no homogeneous-N special case). Bulk style / resize deferred. |
| 0007 | (Trace harness) | **Not authored** | — | Originally placeholder for the runtime trace harness (`?trace=1` gate, mount-anchor inventory, replay format). Per audit wrap-up: "Phase B's `?trace=1` work shipped operationally but the ADR was never authored." | Trace harness lives via commits, not a formal record. Gap acknowledged in [audit Wrap-up](tactical/productization-audit.md#wrap-up). |
| [0008](adr/0008-naming-convention.md) | Naming convention | Accepted | 2026-05-20 | 8 decisions: component name disambiguation (4 mandated renames); locked Modal/Dialog/Popover/Panel/Banner/Screen vocabulary; `// LIB-ONLY` marker (forward-looking); kebab-case provider IDs; selective `data-axoview-id` retrofit (E2E + trace anchors only); `axoview-<role>` package naming (4-set locked); skill naming (verb / verb-noun / `-check` suffix); boolean / render-gate / deploy-filename code hygiene. | Closes the audit's two name-collision bugs + one semantic-inversion bug. `data-axoview-id` is the *single* product-namespaced attribute (no parallel `data-testid`). |
| [0009](adr/0009-deployment-topology.md) | Deployment topology | Accepted | 2026-05-20 | 8 decisions: name the "one HTTP contract, one adapter, one Worker short-circuit" asymmetry; collapse dual probe → single `/api/config` (delete `/api/storage/status` + dead `RuntimeConfig.serverStorage` field); explicit browser-only share-link error dialog; env-var contract per target (self-host / Cloudflare / local-dev); authoritative `wrangler.toml` + mandatory `_routes.json` + canonical `_headers`; per-runtime observability boundary; TLS termination (operator-owned for self-host, CF for Pages); Worker bundle <1 MB uncompressed. | Boot-time cold-start latency on Cloudflare drops by ~100–200 ms. Frontend RuntimeConfig field deleted. ADR 0010 inherits the storage-adapter contract cleanly. Single-tenancy is explicit in ADR 0010 D4. |
| [0010](adr/0010-session-backend-contract.md) | Session backend contract | Accepted | 2026-05-20 | 9 decisions: 5-method `StorageAdapter` interface (`get/put/delete/list/listDiagramMeta`); opaque keys + `KEY_PATTERN` regex (path-traversal blocked at adapter boundary); atomicity (tmp-file + rename for fs); single-tenant-per-deploy lock (v1; multi-user explicitly deferred); reserved-key list (folders / tree-manifest / metadata / diagrams-index / public/<uuid>); snapshots + share-namespace cutout; last-writer-wins concurrency (conditional-write pattern dormant for Drive); `/healthz` shape; Drive (Phase 3B) extension contract. | Drive integration has a clear template; no re-litigation of decisions 1–8. Health endpoint unblocks Dockerfile HEALTHCHECK + compose healthcheck. Single-tenancy will surprise multi-collaborator self-hosters — deploy docs need a callout (open). |
| [0011](adr/0011-error-ux-contract.md) | Error UX contract | Accepted | 2026-05-22 | Every failure-of-intent renders an explicit Dialog (centred, focus-trapped, MUI Dialog primitives); `<Scenario>ErrorDialog.tsx` naming; `dialog.<scenario>.*` i18n namespace; dumb component / smart parent; carve-outs preserved (toasts for side-effect failures, in-dialog inline errors, boot-time fallbacks, form-field validation). | Codifies the latent contract that converged across `LocalModeShareErrorDialog` + `ReadonlyLoadErrorDialog`. B-9a S1 (`PublicShareLoadErrorDialog`) shipped under the new contract. S2–S20 enumerated as B-9b retrofit catalogue (deferred-by-design post-audit). |

### 9.2 Locked decisions (productization audit)

The audit doc's [Locked decisions table](tactical/productization-audit.md#locked-decisions-from-scoping-discussion-2026-05-19) — 17 rows. Distilled here for scan-ability; full rationale is in the audit doc.

| # | Decision | Date locked |
|---|---|---|
| 1 | No new PLAN.md phase row for the audit (cross-cutting tactical). | 2026-05-19 |
| 2 | Revive `__fftest__`-style instrumentation as the runtime trace harness (would-be ADR 0007). | 2026-05-19 |
| 3 | Naming convention locked after audit pass 1 (became ADR 0008). | 2026-05-19 |
| 4 | E2E plan: delete both prior suites (Python/Selenium + Playwright); rewrite from zero. | 2026-05-19 |
| 5 | Google Drive placeholder code is intentional (Phase 3B); not dead code. | 2026-05-19 |
| 6 | Cloudflare + Docker + session-backend deployment artifacts are IN scope. Productization = working public Cloudflare deploy in session mode + hardened CI/CD. | 2026-05-19 |
| 7 | `flare_plan.md` retired; durable decisions migrate to ADRs 0009 + 0010; file deleted at wrap. | 2026-05-19 |
| 8 | Git configuration + git-agent automation are IN scope (workstreams A.7 + A.8). | 2026-05-19 |
| 9 | Skills + session cadence are IN scope (workstream A.9). Output: `docs/workflow.md`. | 2026-05-19 |
| 10 | Rename tactical Phase 10 items absorbed into this audit (npm publish → M8; Docker Hub → M8; CF deploy → M10; cwd rename = note only). | 2026-05-19 |
| 11 | `axoview-lib` stays monorepo-only; **no npm publish**. Docker + Cloudflare are the productization surface. | 2026-05-20 |
| 12 | Docker Hub publish **deferred** to a future feature. Day-1 deploy = `git clone + docker compose up --build`. | 2026-05-21 |
| 13 | nginx HTTP Basic Auth **removed**. Single `AUTH_MODE` contract; deployers wanting auth use `shared-token` or `cf-access`. | 2026-05-21 |
| 14 | GitHub Pages workflow **removed**; Cloudflare Pages native git integration is canonical. `release.yml` rewired from `pages.yml` → `Run Tests`. | 2026-05-22 |
| 15 | Error UX contract codified as ADR 0011 (Accepted 2026-05-22). | 2026-05-22 |
| 16 | T2 (git-automation hardening) wraps 2026-05-22 — CI gates active (ESLint / coverage / build-output shape / commitlint / CodeQL / Worker bundle size / continuous knip soft-fail). **M8 met for in-repo scope.** | 2026-05-22 |
| 17 | **M10 ship gate met 2026-05-23 (v1.0.0).** Audit substantively complete. Closeout sequencing: cleanup → tech review artifact (this doc) → T4 external GitHub actions → `/feature wrap`. | 2026-05-23 |

---

## 10. Reviewer prompts

<!-- TBD Session C — Will split into two checklists per the dual-lens design: (A) general code-quality review (architecture coherence, test depth, performance contracts, known-issues impact); (B) productization-readiness review (deployment + auth + error UX + CI gates + LICENSE + docs). Each prompt cites the §3/§4/§9 location it grounds in so the reviewer can verify with one click. -->

---

## 11. Open known issues

<!-- TBD Session C — Will compose from known_issues.md + the deferred-by-design rows from the audit closeout. Notable categories: partial-coverage i18n locales (de-DE + id-ID); PWA install card is plain; preview-mode passive badge incomplete; page tabs hard cap of 5 with no overflow UX; pre-existing failing leanSave unit test (bundledFixtures[0] undefined); double-click rename in file tree; imported icons per-diagram (deferred); connector drag sustained-GC cliff (deferred); B-9b silent-failure retrofit catalogue (S2–S20); leanSave test seeding gap. -->
