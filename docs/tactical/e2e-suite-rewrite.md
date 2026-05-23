# Tactical — E2E Suite Rewrite (T1 / C.5)

> **Read first:**
> - [docs/workflow.md](../workflow.md) — canonical session cadence + skill decision table + design principles.
> - [docs/manual-test-baseline.md](../manual-test-baseline.md) — **scenario catalog source of truth.** J1–J20 + per-mode observations are the load-bearing input.
> - [ADR 0008 — Naming convention](../adr/0008-naming-convention.md), Decision 5 (`data-axoview-id` selective retrofit) — the selector contract this suite executes against.
> - [ADR 0011 — Error UX contract](../adr/0011-error-ux-contract.md) — every failure-of-intent surface this suite exercises.
> - [docs/tactical/productization-audit.md § C.2 Section 4 row T1](productization-audit.md#section-4--spawned-tacticals-separate-work-units) — the spawn entry that authorised this tactical.
> - [docs/tactical/productization-audit.md § C.2 Section 3 row I9](productization-audit.md#section-3--cleanups--renames--deletions) — the bundled-deletion row for the existing `packages/axoview-e2e/` and `e2e-tests/` directories; both delete together with this suite landing in CI.
>
> **Status:** All 13 spec files complete (Sessions 2 + 3 + 4 + 5 + 6 done 2026-05-23) · **Owner:** Igor · **Last updated:** 2026-05-23
>
> This is a **short-lived working doc.** Delete it after M9 (suite green in CI) lands; ADRs 0008 + 0011 + the productization-audit C.2 ledger are the durable record. PLAN.md gets a one-line entry under Phase 2D once the suite is green — see "Wrap-up" below.

## Session startup checklist

1. Read this file fully.
2. Read [docs/manual-test-baseline.md](../manual-test-baseline.md) end-to-end — the scenario catalog (Section 3) and per-mode observations (Section 4) are the load-bearing input.
3. Read ADR 0008 Decision 5 and ADR 0011.
4. Skim `PLAN.md` Phase Status Dashboard **for context only** — do not modify it during this work.
5. Use `TodoWrite` to track the session's sub-tasks.
6. Mark `[x]` as work completes; cross-reference the closing commit SHA in the relevant row.
7. On Session 8 (debug pass green), follow the "Wrap-up" section to append the PLAN.md Phase 2D entry and delete this file.

## Goal

Rewrite the E2E suite from zero against the locked surface vocabulary (ADR 0008) and locked error UX contract (ADR 0011). The existing [`packages/axoview-e2e/`](../../packages/axoview-e2e/) and root [`e2e-tests/`](../../e2e-tests/) directories are deleted as part of this work (per audit C.2 row I9 — "bundled with the new E2E workflow landing"). The output is a Playwright suite that:

- Mirrors the canonical user journeys J1–J20 from the manual-test baseline, one spec file per journey (or coherent journey-pair);
- Uses a Page Object Model per surface so selectors live with the surface, not in the test;
- Adds `data-axoview-id` attributes lazily, as scenarios reach the surfaces that need them (per ADR 0008 Decision 5);
- Runs green in CI via a new `.github/workflows/e2e-playwright.yml` that replaces the dropped `e2e-tests.yml.backup`.

**Explicitly NOT a goal:**

- No new ADR. T1 is execution against ADR 0008 Decision 5 + ADR 0011. If a sub-decision surfaces during execution (e.g. "do we keep Selenium-suite test parity or rewrite scenarios from scratch?"), pause and flag to the user; don't pre-decide.
- No backend / worker jest scaffolding. Out of scope — separate productization-audit follow-up.
- No test-parity with either deleted suite (Selenium or current Playwright). The scenario catalog (J1–J20) is the source; both prior suites are artifacts.

## Scope

### In scope

- New `packages/axoview-e2e/` directory (rebuilt from zero in Session 2 after wholesale deletion of the existing one).
- New Playwright config, fixtures, POM files, and spec files per the inventories below.
- New `.github/workflows/e2e-playwright.yml`.
- Surgical `data-axoview-id` retrofits in `packages/axoview-app/src/components/` and `packages/axoview-lib/src/components/`, added the moment a spec needs them — never as a sweep.
- Deletion of the legacy [`e2e-tests/`](../../e2e-tests/) Python/Selenium root directory and any reference to it in `release.yml`'s workflow chain (per audit I9 bundle).

### Out of scope

- Visual regression / screenshot tests — future feature with its own ADR if wanted.
- Accessibility / a11y checks — future feature.
- Performance benchmarks — future feature.
- Test-parity with the deleted Python/Selenium suite — abandoned per locked decision #4 (clean slate).
- Test-parity with the deleted current Playwright suite — its scenarios are an artifact, not a spec; the J1–J20 catalog is the source.
- Cross-browser fan-out beyond Chromium for the initial green. Firefox/WebKit may follow once Chromium is stable; not gated on M9.

## Locked decisions (from spawn 2026-05-22)

| # | Decision |
|---|---|
| 1 | **Scenario catalog is closed.** [docs/manual-test-baseline.md](../manual-test-baseline.md) J1–J20 is the exclusive source of scope. If a behaviour isn't in the baseline, it's not in T1. New scenarios get filed as audit findings, not added to T1 inline. |
| 2 | **One spec file per journey (or coherent journey-pair).** No mega-files. Target ~10–13 spec files total. |
| 3 | **Page Object Model per surface.** Selectors live in POM files, not in tests. Target ~6–8 POM files (AppToolbar, FileExplorer, Canvas, NodeInfoTab, LayersPanel, SettingsDialog, HelpDialog, dialogs). |
| 4 | **`data-axoview-id` retrofit lazily.** Per ADR 0008 D5: add the attribute the moment a test needs it, never as a separate sweep. POM files document which attributes they expect; tests add them as scenarios are written. |
| 5 | **Smoke first, then deep.** J1–J10 (canonical journeys) cover ~80% of productization value. Edge cases come after. M9 (in-repo) can be partially-met before T1 finishes if J1–J10 are green. |
| 6 | **Out of scope (re-stated for emphasis):** visual regression, accessibility checks, performance benchmarks. Each can become its own future feature with own ADR if wanted. Keep `@playwright/test` bare. |
| 7 | **No new ADR.** T1 is execution against ADRs 0008 D5 + 0011. Sub-decisions surfacing mid-row → flag to user; don't pre-decide. |
| 8 | **Tactical doc is the source of execution truth.** The baseline doc stays the discovery artifact; this doc is the closure ledger. Token-spend is tracked per session against the budget below; drift flagged in user-visible checkpoints. |
| 9 | **PLAN.md phase = 2D.** Wrap-up line appends under Phase 2D when M9 (suite green in CI) lands. |

## Scenario catalog — journey → spec file mapping

13 spec files, each bounded. Each row cites the baseline's journey definition + the per-mode notes that constrain it.

| Journey(s) | Spec file | Baseline source |
|---|---|---|
| J1 (new diagram → place icons → save → reopen) + J20 (empty state → New/Import buttons) | `smoke.spec.ts` | baseline §3 J1 + J20 |
| J2 (connector + undo/redo) | `connector.spec.ts` | baseline §3 J2 |
| J3 (rectangle + textbox + save) | `shapes.spec.ts` | baseline §3 J3 |
| J4 (F2 rename in file explorer) | `rename.spec.ts` | baseline §3 J4 |
| J5 (diagram-to-diagram link, preview, navigation) | `multi-diagram.spec.ts` | baseline §3 J5 + §5 B-1 (post-fix surface) |
| J6 (layers: assign / hide / lock) | `layers.spec.ts` | baseline §3 J6 |
| J7 + J8 (JSON import / export) | `import-export-json.spec.ts` | baseline §3 J7 + J8 |
| J9 + J10 (project ZIP import / export) | `import-export-zip.spec.ts` | baseline §3 J9 + J10 |
| J11 + J12 (custom icon import / remove with usage warning) | `icons.spec.ts` | baseline §3 J11 + J12 |
| J13 (Local-mode share-uuid error) + J14 (Session share link) | `share.spec.ts` | baseline §3 J13 + J14 + §5 B-3 (popover focus management) |
| J15 (hotkey sanity: Ctrl+S/Z/Y/A/C/X/V/Del) | `hotkeys.spec.ts` | baseline §3 J15 |
| J16 + J17 + J18 (Settings, Help, Diagnostics dialogs) | `dialogs.spec.ts` | baseline §3 J16 + J17 + J18 |
| J19 (2D canvas mode toggle) | `canvas-modes.spec.ts` | baseline §3 J19 |

**Smoke set:** J1 + J20 (`smoke.spec.ts`). First deliverable; everything else follows.

## POM inventory

8 page-object files, one per surface. Each POM owns its selectors and documents which `data-axoview-id` attributes it expects (per locked decision #4, attributes get added to source the moment a POM declares them and a spec exercises that path).

| POM | Surface | Notes |
|---|---|---|
| `AppToolbarPOM` | top toolbar | Save, Open, Share, Preview, Export, brand mark. ADR 0005 Decision 1 (4-group RIGHT zone) shape. |
| `FileExplorerPOM` | left dock — file explorer | tree rows, context menu, rename inline editor, dialogs. ADR 0008 Decision 1 (Modal/Dialog/Popover vocabulary). |
| `CanvasPOM` | iso canvas | place icon, draw connector, drag items, lasso, hover affordances. ADR 0006 (canvas selection contract) shape. |
| `NodeInfoTabPOM` | right sidebar — Node Info tab | link picker, name field, notes textarea. Exercises the B-1 fix (open-linked-diagram IconButton). |
| `LayersPanelPOM` | left dock — Layers panel | layer rows, visibility / lock toggles, layer assignment. |
| `SettingsDialogPOM` | Settings dialog | tabs, controls. ADR 0005 Decision 1 (About + Diagnostics tabs). |
| `HelpDialogPOM` | Help dialog | shortcut list. Exercises J17 (and the B-4 follow-up that added Ctrl+A / Alt+click / Ctrl+click). |
| `DialogsPOM` | generic dialog primitives | Confirm, ADR 0011 error dialogs (`LocalModeShareErrorDialog`, `ReadonlyLoadErrorDialog`, `PublicShareLoadErrorDialog`), etc. |

## Sub-tasks (session budget)

Eight sessions, ~270K tokens total. Tactical doc tracks actual cost per session against the estimate; drift gets flagged in user-visible checkpoints.

| # | Session | Deliverable | Tokens (est.) | Tokens (actual) | Status |
|---|---|---|---|---|---|
| 1 | Scope (this session) | tactical doc | ~30K | _(record at session end)_ | **[~] scaffolded 2026-05-22** |
| 2 | Skeleton | delete old `packages/axoview-e2e/`, scaffold new, Playwright config, fixtures, POM stubs, `smoke.spec.ts` (J1 only); verify locally | ~50K | ~65K (mid-context-window estimate) | **[x] done 2026-05-22 (5 commits: `3ff4110` delete, `3f087c8` skeleton, `62d9705` fixtures+helpers, `cce1dda` AppToolbarPOM+J1 smoke green locally in ~13s, this commit doc-sync). Lazy data-axoview-id retrofits landed: `toolbar-save` (AppToolbar) · `screen-empty-create` (EmptyStateScreen) · `dock-elements-toggle` + `dock-layers-toggle` (LeftDock) · `canvas-icon-grid-item` (IconSelectionControls/Icon). Pending POMs/attributes tracked in `packages/axoview-e2e/pom/_pending.md`.** |
| 3 | Smoke complete | finish `smoke.spec.ts` (J20) + `connector.spec.ts` + `hotkeys.spec.ts` | ~30K | ~55K (overran ~25K) | **[x] done 2026-05-22 (4 commits: `ddb14d7` J20 + EmptyStateScreenPOM + workers=1 pin, `f611aa2` J2 connector + `canvas-interactions` lib retrofit + getModelConnectorCount, `67571c4` J15 7-hotkey spec + getViewItemCount, this commit doc-sync). 11/11 tests green locally in ~2.6 min. Lazy retrofits this session: `screen-empty-import` (app, no rebuild) + `canvas-interactions` (lib, 1 rebuild cycle). One Playwright config pin: `workers: 1` + `fullyParallel: false` — two parallel contexts against the shared rsbuild dev server stalled the Loading-Axoview path once the suite grew past one spec.** |
| 4 | File ops | `import-export-json.spec.ts` + `import-export-zip.spec.ts` + `icons.spec.ts` | ~30K | ~75K (overran ~45K) | **[x] done 2026-05-22 (4 commits: `4014e59` J7+J8 JSON spec + ExportPopover retrofits, `d92aeee` J9+J10 ZIP spec + DialogsPOM + ExportProjectZipDialog retrofit + programmatic JSZip fixture, `88242dc` J11+J12 icons spec + 4 lib-side retrofits + J10 wipe-and-reload stability fix, this commit doc-sync). 17/17 tests green locally in ~4.4 min. Eight lazy retrofits this session: 4 app-side (`toolbar-export`, `toolbar-export-json`, `toolbar-export-project-zip`, `dialog-export-project-zip-confirm`) + 4 lib-side (`dock-elements-import-icons`, `dialog-import-icons-confirm`, `dialog-delete-icon-confirm`, `canvas-icon-grid-delete`). Lib rebuild cycles this session: 1 (all four icons retrofits batched).** |
| 5 | Editor surfaces | `shapes.spec.ts` + `rename.spec.ts` + `layers.spec.ts` | ~30K (revised ~35K) | ~38K (overran ~3K vs revised, ~8K vs original) | **[x] done 2026-05-23 (4 commits: `d11bc8e` J3 shapes spec + CanvasPOM debut + getViewRectangleCount/getViewTextBoxCount, `d0ffc3e` J4 rename spec + FileExplorerPOM debut + 3 retrofits, `f502a62` J6 layers spec + LayersPanelPOM debut + 5 lib retrofits + drag-detection RAF finding, this commit doc-sync). 22/22 tests green locally in ~5.1 min. Six lazy retrofits this session: 1 rename-commit (dock-file-explorer-toggle lib + file-explorer-row app + file-explorer-rename-input app — split per ADR 0008 D5's "retrofit with the consuming spec" rule) + 5 layers-commit (layers-panel-add + layer-row + layer-toggle-visibility + layer-toggle-lock + layer-item-row, all lib, batched). J3 path used keyboard hotkeys (r + t) so it cost 0 retrofits.** |
| 6 | Diagram-link + dialogs | `multi-diagram.spec.ts` + `dialogs.spec.ts` + `share.spec.ts` + `canvas-modes.spec.ts` | ~45K (revised, was ~40K) | ~55K (overran ~10K vs revised) | **[x] done 2026-05-23 (5 commits: `d0cfd78` J5 multi-diagram, `943d10c` J16/J17/J18 dialogs, `ad2a6b2` J13/J14 share, `e5927e6` J19 canvas-modes, this commit doc-sync). 33/33 tests green locally in ~5.3 min. Four POMs authored: NodeInfoTabPOM, SettingsDialogPOM, HelpDialogPOM (+ DialogsPOM + AppToolbarPOM + CanvasPOM extended). 13 spec files now exist — milestone reached. Lib rebuild cycles this session: 3 (one per commit with lib retrofits).** |
| 7 | CI wiring | `.github/workflows/e2e-playwright.yml`; replace dropped `e2e-tests.yml.backup`; delete old `packages/axoview-e2e/` per I9 bundle; delete `e2e-tests/` root directory; remove from `release.yml` workflow chain if needed | ~30K | ~50K (overran ~20K) | **[x] done 2026-05-23 (3 commits: `213b492` add `.github/workflows/e2e-playwright.yml` (Shape A), `f45e677` delete `e2e-tests/` + `.github/workflows/e2e-tests.yml` (I9), this commit doc-sync). CI shape pick: **A** — webServer block was already configured in `playwright.config.ts` to spawn `npm run dev`, so the workflow stays small (no explicit serve / wait-on lifecycle). Spec count unchanged at 13 files / 33 tests, all green locally. CI first-trigger pending (first PR or push to master). Release chain verified clean — `release.yml` already pinned to `workflow_run: ["Run Tests"]` (commit `71a4b32`); E2E is not a Release prerequisite. Knip baseline post-deletion: roughly flat (the Python suite wasn't in knip's JS/TS scope; one new unlisted-binary entry for `playwright` in the new workflow). Lib rebuild cycles this session: 0 (pure workflow + deletion + doc work; no code retrofits). Running total to date: **8** (Sessions 2 / 3 / 4 / 5J4 / 5J6 / 6J5 / 6dialogs / 6J19). Session 8 = debug pass for J10 wipe-and-reload race + any CI-only flakes that surface on first trigger.** |
| 8 | Debug pass | User runs locally + on CI; agent fixes flakes | ~30K | _(record)_ | not started |

**Budget total: ~270K tokens.**

**Session 2 actual-vs-estimate note (2026-05-22):** Session 2 ran ~30% over the
50K estimate primarily because the I-am-a-fresh-suite world had to (a) discover
that the dev server consumes `axoview-lib` via its built `dist/`, not source,
so the first lib-attribute retrofit required a full `npm run build:lib` + dev
restart before the spec could see the attribute; (b) absorb three runtime
surprises that the deleted suite had pre-amortised — the welcome notification
intercepts the empty-state click, the icon tile's MUI Tooltip portals over the
drag path, and `addInitScript`-based storage clearing wipes the reload-leg
diagram before the assertion runs. Each is documented in the commit body (`cce1dda`)
so Sessions 3-6 don't re-discover them. Adjusting Sessions 3-6 estimates: **+5K
per session** for the "second spec in the file" patterns to stabilise — bringing
the running total from ~270K to ~290K. No change to session ordering or scope.

**Session 4 actual-vs-estimate note (2026-05-22):** Session 4 ran ~45K over the
30K estimate (~75K actual) for three durable reasons worth carrying into
Sessions 5/6:

1. **Playwright `download.path()` strips the original filename.** The downloaded
   bytes are written to a UUID-named tempfile without the `.zip` (or any)
   extension; feeding that path back into a file picker that routes by
   extension (App.tsx#handleDirectImportFile uses `/\.zip$/i`) mis-routes
   the second leg of any round-trip spec. Resolution: copy the bytes to a
   `${os.tmpdir()}/.../${download.suggestedFilename()}` before re-feeding.
   Documented inline in `tests/import-export-zip.spec.ts` and in the
   commit body of `d92aeee`. Sessions 5/6 share-link + export-image specs
   inherit the same gotcha — the pattern is reusable as-is.

2. **`clearAllStorage()` between in-test legs needs a double clear-and-reload.**
   The J10 round-trip leg (export → wipe → reload → re-import in the same
   context) showed an intermittent rehydration race: addInitScript runs
   before every navigation, and DiagramLifecycleProvider can re-pick state
   between our clear and the next assertion. Single clear + reload was
   sometimes enough (passed in isolation in Commit 2) but not under
   parallel-spec pressure from the icons rebuild (broke in the full-suite
   run after Commit 3). Resolution: clear, reload, clear, reload. Pattern
   only required for specs that wipe and re-import in the same context;
   independent `beforeEach` paths don't trigger the race.

3. **Imported icons land below the bundled fixtures in the panel scroll
   container, often off-screen.** `placeIcon` works for bundled icons
   because the first tile is always in-viewport, but a name-specific tile
   lookup needs `scrollIntoViewIfNeeded` before the boundingBox read — an
   off-screen tile's `boundingBox()` returns valid coords, but the mouse
   events at those coords land on whatever element actually occupies that
   viewport pixel, not the tile. First run of `icons.spec.ts` hit exactly
   that (model item count 0 after the drag). Documented inline in
   `tests/icons.spec.ts#dragIconToCanvas`.

Beyond those three, the ZIP-fixture choice fell to **programmatic** —
`helpers/projectZip.ts` builds the project zip in-process with JSZip
(hoisted to the repo root by workspaces, no local devDependency entry
required). The static-vs-programmatic trade-off was about ~80 LOC of
helper code vs an opaque binary fixture; programmatic keeps the fixture
in lockstep with ADR 0001's format and tracks future format-version
bumps alongside the lib. The static JSON fixture for J7 stayed static
because a single-diagram fixture doesn't benefit from in-sync round-
tripping. Sessions 5/6 spec-pair fixtures (rename, layers, multi-diagram
preview) inherit the same rule of thumb: programmatic where round-trip
benefits, static where the assertion shape is fixed.

Lib rebuild cycles this session: **1** (four icons retrofits batched into
one `npm run build:lib` + dev-server restart — under the 5-cycle warning
threshold called out in Session 3). Running total to date: **3**
(Session 2: 1, Session 3: 1, Session 4: 1).

Sessions 5–6 estimate revision: **+5K per session** for the wipe-and-
reload pattern and the download-filename copy pattern to become muscle
memory. Bringing the running total from ~290K to ~300K. No change to
session ordering or scope.

**Session 5 actual-vs-estimate note (2026-05-23):** Session 5 ran ~38K
(revised estimate ~35K, original ~30K — overran ~3K vs revised, ~8K vs
original) for one durable reason and one cheap surprise:

1. **Synthetic mouse drags MUST dispatch each MouseEvent in a separate
   `page.evaluate` call.** The lib's RAF-throttled mouse-update scheduler
   (`interaction/useRAFThrottle.ts`) only flushes once per RAF tick — so
   bundling `mousemove → mousedown → mousemove → mousemove → mouseup`
   into one `page.evaluate` block dispatches the events synchronously
   without RAF ticks between them. `processMouseUpdate` snapshots
   `uiStateApi.getState()` BEFORE calling `setMouse(nextMouse)`, so
   `baseState.uiState` is the OLD state. With no intervening RAF tick,
   Cursor.mousemove reads `uiState.mouse.position.tile === uiState.mouse
   .mousedown.tile` (both = `from`), `hasDragged` stays false, no
   transition to DRAG_ITEMS, model item tile stays unchanged. The fix is
   to dispatch each event in its own evaluate (CanvasPOM.dragFromTo does
   this). Carries forward as the canonical pattern for any future
   synthetic-drag spec — Session 6's diagram-link drag and Session 7's
   canvas-modes drag both inherit the rule. Documented in
   `pom/CanvasPOM.ts#dragFromTo` and in the layers-spec commit body
   (`f502a62`).

2. **Model items don't carry a `tile` field — only view items do.**
   `placeIcon` (modes/PlaceIcon.ts) writes the tile onto the view-item
   only; the model-level catalogue entry has `{id, name, icon}` and that's
   it. The first lock-test draft read `model.items[0].tile` and got
   `undefined`, falsely making the lock assertion pass. Specs asserting
   drag / move semantics must read `model.views[*].items[*].tile` via
   the view-items array. The two new helpers `getViewRectangleCount` and
   `getViewTextBoxCount` follow the same view-vs-model rule for J3.

Six lazy retrofits this session, split across two commits:

- `d0ffc3e` (rename): **3 retrofits — 1 lib + 2 app.** Lib:
  `dock-file-explorer-toggle` (LeftDock.tsx). App: `file-explorer-row`
  + `data-diagram-name` + `data-diagram-type` (FileTreeNode.tsx label
  Box) and `file-explorer-rename-input` (FileTreeNode.tsx inline
  input). Lib rebuild cycles: 1.
- `f502a62` (layers): **5 retrofits — all lib, batched.**
  `layers-panel-add` (LayersPanel.tsx Add IconButton), `layer-row` +
  `data-layer-name` (LayerRow.tsx outer Box),
  `layer-toggle-visibility` + `layer-toggle-lock` (LayerRow.tsx
  IconButtons), `layer-item-row` + `data-layer-item-id` +
  `data-layer-item-type` (LayerItemRow.tsx outer Box). Lib rebuild
  cycles: 1.
- `d11bc8e` (shapes / J3): **0 retrofits.** Hotkey-driven mode
  switches (`r` for rectangle, `t` for textbox) avoid the lib's
  ToolMenu button retrofit ('canvas-tool-rectangle' / 'canvas-tool-
  textbox' stay deferred). The bound binding `t` in `smnrct` profile
  doesn't even render a ToolMenu button — rectangle + textbox are
  keyboard-only today.

Lib rebuild cycles this session: **2** (one per commit; rename's
file-explorer-toggle landed independently of layers' five batched
attributes). Running total to date: **5** (Session 2: 1, Session 3: 1,
Session 4: 1, Session 5J4: 1, Session 5J6: 1).

Approach pick for J6 layer assignment: **drag-drop** (sole UX path —
LayersPanel.tsx exposes no context menu). The drag-drop flow uses
ordinary `page.mouse.{down,move,up}` because the panel's pointer
handlers don't gate on `isRendererInteraction` (no rendererRef gate at
the panel level).

Approach pick for J6 drag-lock assertion: **model.views[*].items[*]
.tile poll**, not DOM. Cursor.mousedown's isItemInteractable filter
rejects the locked item entirely — `mousedownItem` stays null,
DRAG_ITEMS mode is never entered, no tile write fires. The pre-lock
"sanity-check drag actually moves the item" leg keeps the post-lock
"tile unchanged" assertion from being a false positive.

Sessions 6–7 estimate revision: **no further adjustment** — both
findings amortise. Running total stays at ~300K.

**Session 6 actual-vs-estimate note (2026-05-23):** Session 6 ran ~55K
(revised estimate ~45K, original ~40K — overran ~10K vs revised, ~15K
vs original) for three durable reasons worth carrying forward:

1. **The lib's IconButton wrapper does NOT pass through arbitrary
   props.** `src/components/IconButton/IconButton.tsx` defines a tight
   `Props` interface (name, Icon, isActive, onClick, tooltipPosition,
   disabled). Any spec needing a `data-axoview-id` on a ToolMenu button
   (J19 hit this first via the canvas-mode toggle) must either wrap the
   IconButton in a Box-with-attribute or extend the IconButton API.
   Session 6 took the second route — added an optional `dataAxoviewId`
   prop forwarded to the underlying `<Button>`. Existing call sites stay
   untouched; new specs opt in per ADR 0008 D5. Sessions 7+ that need a
   `canvas-tool-*` retrofit (drag-mode buttons, undo/redo etc.) inherit
   this opt-in pattern with zero further IconButton edits.

2. **Bridge-driven zustand action calls return silently across
   page.evaluate.** J5.3 (multi-diagram readonly NodePanel) needed to
   open the right sidebar programmatically in readonly mode because the
   seeded icon was a placeholder (`isoflow:cube` doesn't resolve to a
   real pack icon → tombstone img → unclickable). Calling
   `ui.getState().actions.setItemControls({type:'ITEM', id})` across the
   bridge had no observable effect — the action function executes inside
   the page context but the `set` it closes over isn't wired to the
   subscribers React mounted against. Direct `ui.setState({itemControls,
   rightSidebarOpen, selectedIds})` writes through the store API the
   subscribers ARE bound to. Documented inline in `tests/multi-diagram.spec.ts`
   (J5.3) so Sessions 7+ that need bridge writes use the same pattern.

3. **Mocked-backend share flows (J14) need per-context route
   installation.** `browser.newContext()` creates an isolated request
   pipeline; `page.route()` registered on context A does NOT apply to
   context B. The J14 incognito leg installs the same mocks on the
   second context separately. Combined with `permissions:
   ['clipboard-read', 'clipboard-write']` on context options, this
   pattern lets server-mode specs run fully under the local dev server
   without docker / wrangler. Sessions 7+ that touch readonly /
   public-share routes inherit the same recipe.

Bonus carry-forward: **MUI's `Dialog` and `Popover` `PaperProps`
typing doesn't expose `data-*`, but the runtime forwards them onto
the underlying `<Paper>`.** Stamp via `PaperProps={{ ..., 'data-axoview-id':
'...' } as any}`. Used in Session 6 for SettingsDialog, HelpDialog,
LocalModeShareErrorDialog, and the AppToolbar share Popover.

Three new POMs authored this session: `NodeInfoTabPOM`,
`SettingsDialogPOM`, `HelpDialogPOM`. Existing POMs extended:
`AppToolbarPOM` (Preview / Back-to-editing / Share methods),
`DialogsPOM` (LocalModeShareErrorDialog methods), `CanvasPOM`
(canvas-mode toggle).

Lib rebuild cycles this session: **3** (one per commit that touched
lib source — multi-diagram commit batched 3 NodeInfoTab retrofits;
dialogs commit batched 8 retrofits across LeftDock + BottomDock +
HelpDialog + SettingsDialog; canvas-modes commit batched the
IconButton prop + ToolMenu retrofit). Running total to date: **8**
(Sessions 2 / 3 / 4 / 5J4 / 5J6 / 6J5 / 6dialogs / 6J19).

Sessions 7–8 estimate revision: **no further adjustment** — all
three findings amortise into recipes future specs can copy. Running
total stays at ~300K.

**All 13 spec files now exist:** smoke + connector + hotkeys +
shapes + rename + layers + import-export-json + import-export-zip +
icons + multi-diagram + dialogs + share + canvas-modes. M9 (in-repo)
is met for the spec-authoring half; Session 7 wires CI + deletes the
legacy directories, Session 8 closes flakes (J10 wipe-and-reload
race is the only known pre-existing flake).

**Session 3 actual-vs-estimate note (2026-05-22):** Session 3 ran ~25K over the
30K estimate (~55K actual) for one durable reason — the connector spec exposed
that `useInteractionManager` gates canvas-mode handlers on
`rendererRef.current === e.target`, and Playwright's `page.mouse.down` at a
canvas-relative coord lands on whichever SceneLayer child is topmost in the
zIndex stack, not on the renderer ref itself. Resolution: lazy-retrofit
`data-axoview-id="canvas-interactions"` onto the lib's interactionsRef Box and
dispatch synthetic MouseEvents directly at that element via `evaluate` (event
still bubbles to the window listener, but `e.target` is now deterministic).
Documented in `f611aa2` so Sessions 5/6 (Canvas-mode + drag-mode specs) can
adopt the same pattern. Two other learnings worth carrying forward:
(1) `model.items` ≠ `model.views[*].items` — the lib's `deleteViewItem`
reducer removes only the view-item, leaving the model-level catalogue intact;
spec assertions that exercise Delete / Ctrl+X must poll
`getViewItemCount`, not `getModelItemCount`. (2) The shared rsbuild dev
server can't keep up with parallel Playwright contexts — `workers: 1` +
`fullyParallel: false` are the safe defaults until CI serves a precompiled
bundle (Session 8 may revisit). Lib rebuild cycles this session: **1**
(`canvas-interactions` retrofit). Sessions 4–6 estimate revision: **no
further adjustment** — the deep-dive on rendererRef gating amortises;
file-ops + editor surfaces don't re-cross that boundary.

## Wrap-up

When Session 8 closes (suite green locally + green in CI = M9 met):

1. Add a single line under `PLAN.md` Phase 2D:
   ```
   - E2E suite rewrite (T1) shipped — see docs/adr/0008 D5, docs/adr/0011, and (this file's git history). M9 met.
   ```
2. Delete this file. ADRs 0008 + 0011 are the durable record; the productization-audit C.2 ledger captures the row-level closure.
3. Update memory pointer in `project_docs_convention.md`: remove the `**Active tactical docs:**` bullet for `e2e-suite-rewrite.md`.
4. The audit's Section 4 T1 row gets its closing commit SHA appended; audit row I9 gets marked closed in the same wrap.

## Notes for Claude

- **Scenario catalog is closed (locked decision #1).** If a session-2-through-7 sub-agent surfaces a behaviour that isn't in J1–J20, do **not** add it to T1. File it as a baseline-doc finding (Section 5 row, fresh `B-N` number) and continue.
- **POMs own the selector contract.** Tests should read like prose; if you find yourself writing a CSS selector inside a spec, that's a missing POM method. Stop and add the method.
- **`data-axoview-id` retrofit is surgical, not prophylactic** (ADR 0008 D5). Add the attribute the moment a POM declares it AND a spec actually exercises it. Don't pre-stub attributes "in case." Each retrofit commit cites the POM file + the spec method that motivated it.
- **Smoke is the first deliverable.** Sessions 2 + 3 ship `smoke.spec.ts` + `connector.spec.ts` + `hotkeys.spec.ts` green before touching anything else. If those three flake, sessions 4–6 don't start.
- **Subagent leverage (sessions 3–6 only):** when the main session writes spec A, a general-purpose subagent can be spawned to write spec B in parallel against fresh context. Subagent reads: baseline doc + the relevant POM + the previously-written specs as pattern reference. Main session reviews + integrates the diff before commit. Each subagent saves ~30K main-context tokens. Use sparingly — only when the main session approaches ~50K and there's a clean spec-pair to fan out (e.g. `shapes.spec.ts` + `rename.spec.ts` in Session 5). Never fan out the smoke set.
- **CI workflow lands with the deletion.** Session 7 is atomic: new `e2e-playwright.yml` + delete the legacy `e2e-tests/` Python suite + delete the existing `packages/axoview-e2e/` artifact directories in the same commit. The audit's I9 row explicitly forbids a window where both suites are absent — so the CI workflow MUST be wired and passing locally before the deletes land.
- **Verification scope per session:** locally `npm run dev` + `npx playwright test --project=chromium` for whichever specs ship in the session. CI verification waits for Session 7 + 8.
- **Anti-pattern guard (memory: [feedback_be_serious_not_eager](../../../Users/isidenica/.claude/projects/c--myTemp-FossFLOW/memory/feedback_be_serious_not_eager.md)):** don't bundle "extra moves" with a session deliverable. If a session ships its named spec files green, that's the deliverable. Refactors, rename suggestions, and "while we're here…" tidying are out of scope unless they unblock the spec itself.
