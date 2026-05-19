# Known Issues

## Preview-mode passive badge does not cover all clickable nodes

**Symptom:** In `EXPLORABLE_READONLY`, a node is clickable (opens the readOnly details panel) when it has any of: `link`, `headerLink`, `description`, or `notes`. But the passive visual indicators currently only cover two of these:

- Bottom-right OpenInNew badge → only when `link` is set
- Top-right blue dot → only when `notes` has visible content
- Nothing for `headerLink`-only or `description`-only nodes

The pointing-finger cursor on hover (added 2026-05-15) does cover all four cases, so the affordance is discoverable on hover — but at-a-glance scanning misses headerLink/description nodes.

**Workaround:** None. Users can still hover and click to discover the panel.

**Status:** Open. Decide on a unified badge story — either extend the existing badges to cover the missing cases, or replace both with one consolidated "more info" indicator that fires for any of the four content types.

## MQA #7: FPS drop dragging 6 elements (fixed 2026-05-16)

**Original symptom:** During a multi-element drag (≳6 nodes selected) FPS crashed from 60 → 9–13 for 12-19 seconds at a time, recovering only after a major GC; drag felt locked.

**Status:** Resolved. Three fixes shipped this session — each addressed a different layer.

1. **Fix A (commit `bba712c`)** — `DragItems` was the only drag mode not wrapped in `beginDragTransaction`/`commitDragTransaction`. Wired in matching the pattern shipped in `7164b3b` for connectors. Eliminates per-frame `saveToHistory` + `produceWithPatches` work and gives "one undo per drag" UX.

2. **Path 2 (commit `728b229`)** — Split `Node` into a thin position shell (re-renders per drag tick, trivial cost) and a memoized `NodeContent` (icon + label + badges, bails on drag-only changes). Replaced inline `sx={{left, top}}` with module-level sx constants + inline `style` (bypasses emotion per-tick). Swapped `useScene()` → `useSceneActions()` inside `NodeContent` to remove a `views`-array subscription that was forcing the memo gate to bypass on every tick.

3. **Path 4-true** — CSS-only drag preview. During an item drag the model is no longer touched per frame; DragItems mutates CSS variables (`--ff-drag-dx`, `--ff-drag-dy`) directly on each dragged Node's DOM element (`data-drag-id` attribute), and a new `scene.previewConnectorPaths(...)` action refreshes wire geometry by writing straight to `scene.connectors[].path` (no immer, no model touch). Final tiles commit to the model on `mouseup` via `scene.batchUpdateViewItemTiles(...)` — one history entry per drag. See [architecture.md §1 Drag Items](docs/architecture.md#1-feature-inventory) for the full invariant.

**Measured impact** (6 plain nodes + 3 connectors, all selected and dragged, fresh build):
| Metric | Pre-fix | Fix A | Path 2 | Path 4-true |
|---|---|---|---|---|
| Sub-13 fps cliff duration | 19 s | 12 s | 13 s | **0 s** |
| Sustained FPS during drag | 9–13 | 9–13 | 9–13 | **24–44** |
| Peak heap during drag | 167 MB | 203 MB | 163 MB | 199 MB |
| Major GCs during drag | ~5 | ~4 | ~3 | **1** |
| React commit total (flame chart) | 12.3 s | 7.4 s | 4.2 s | small tail |
| `NodeContent` re-renders per dragged node (5 s drag) | ~170 | ~170 | **2** | **2** |

**Trade-offs introduced:**
- The model lags reality during a multi-item drag — `view.items[].tile` is the pre-drag value until mouseup. Live position is in DOM CSS variables; live wire geometry is in `scene.connectors[].path`.
- `Recalculate style` went up slightly (494 ms vs 244 ms pre-Path-4-true) — the `setProperty` calls per frame trigger style recalcs. Net is still hugely positive.
- DragItems now uses a module-level `previewTiles` `Map`. Safe because uiState guarantees one drag at a time, but tests must reset it between cases via `DragItems.exit({...})`.

**Related fix (waypoint dragging):** discovered while validating Path 4-true. [Lasso.ts](packages/axoview-lib/src/interaction/modes/Lasso.ts) used to push only the `CONNECTOR` reference when both endpoints were in lasso bounds, orphaning intermediate waypoint anchors. They now also get pushed as `CONNECTOR_ANCHOR` items so DragItems' existing anchor path moves them with the group.

**Diagnostic harness** kept from earlier in the session: `useRenderProbe('Component', id)` hook + `window.__axoviewRenderProbe.start() / stop() / dump()` console API, gated behind `?perfprobe=1` URL flag. Zero cost in normal use; invaluable for the next round of perf work.

**Companion fix (also shipped this session):** the diag exporter's `ni`/`nc`/`ntb` counts used to read 0 because `window.__axoview__` was gated behind `enableDebugTools` (defaults to `false` in the app) AND `ni` was reading the icon catalog rather than placed nodes. Both fixed:
- [Isoflow.tsx](packages/axoview-lib/src/Isoflow.tsx) now exposes `__axoview__` whenever `process.env.NODE_ENV !== 'production'` OR `enableDebugTools` is set. The `NODE_ENV` literal tree-shakes the block from prod builds.
- [DiagnosticsOverlay.tsx `getSceneCounts`](packages/axoview-app/src/components/DiagnosticsOverlay.tsx) now reads the active view's `items.length` and `connectors.length` (resolved via `ui.view`) instead of the model item catalog.

## MQA diag exporter: element counts always read 0

**Symptom:** The perf-diag JSON exporter records `ni: 0, nc: 0, ntb: 0` on every snapshot regardless of scene size, breaking the FPS-vs-complexity correlation it was meant to enable.

**Workaround:** None. Other diag fields (heap, FPS, long-task budget) remain accurate.

**Status:** Open, parked alongside MQA #7.

## Page tabs: hard cap of 5, no overflow-scroll UX

**Symptom:** The ViewTabs strip ([`ViewTabs.tsx`](packages/axoview-lib/src/components/ViewTabs/ViewTabs.tsx)) renders all pages inline with no horizontal scroll, overflow indicator, or dropdown. Beyond ~15 pages the tabs grow past the viewport and the right-most ones become unreachable.

**Workaround:** Hard cap installed at `MAX_PAGES = 5`. The "+" button disables with a "Page limit reached (5)" tooltip beyond the cap. Sufficient for current usage; lifts trivially once a proper overflow UX exists.

**Status:** Open. Proper redesign deferred — needs a real overflow story (horizontal scroll + chevrons, dropdown-with-search, or pinned + drawer) before raising the cap. Filed for a future ViewTabs refresh.

## leanSave test: `bundledFixtures[0]` undefined → 1 failing unit test

**Symptom:** [`packages/axoview-lib/src/utils/__tests__/leanSave.test.ts`](packages/axoview-lib/src/utils/__tests__/leanSave.test.ts) — `mergeBundledFixtures (ADR 0002) › overridden default wins over bundled fixture` throws `TypeError: Cannot read properties of undefined (reading 'id')` because the bundled-fixtures source ([`packages/axoview-lib/src/fixtures/icons.ts`](packages/axoview-lib/src/fixtures/icons.ts)) is `export const icons: Model['icons'] = []` (empty), so `bundledFixtures[0]` is undefined.

**Workaround:** None for the test. The runtime path (App.tsx → iconPackManager) supplies real packs, so user-facing behavior is unaffected; only the unit assertion is wrong.

**Status:** Open, pre-existing — predates the 2026-05 shake-out. Either the test should be guarded with `if (bundledFixtures.length === 0) return;` or seeded with a stub fixture. Filed for a future test cleanup.


## File tree: double-click on a diagram does not enter rename mode

**Symptom:** Double-clicking a diagram row in the file tree does not enter inline rename mode.

**Workaround:** Select the diagram and press `F2`, or use the right-click context menu → Rename.

**Status:** Open. Rename via F2 and the context menu both work; only the double-click affordance is missing.

## Imported icons are scoped per-diagram, not per-project

**Symptom:** An icon imported while diagram A is open is not visible in the Elements panel when diagram B is open. Each diagram persists its own copy of every imported icon it places, so the same SVG can end up duplicated across N diagram blobs in storage. Deleting an imported icon removes it from the current diagram only — other diagrams that reference it keep their independent copies and continue rendering it (no tombstone there) until they're separately edited.

**Workaround:** Re-import the icon into each diagram that needs it. Or, on rare occasion, export → re-import a project zip; the round-trip carries icons across.

**Status:** Open, deferred. The MQA #26 delete + tombstone work (shipped 2026-05-18) is layered on top of the existing per-diagram `model.icons` contract — fixing the scope is a separate, larger piece of work than the delete UX. Considered and explicitly deferred during the MQA #26 session in favour of shipping the user-visible delete affordance first.

### Why this is not a one-day fix

The icon catalog conflates two concerns (see [ADR-0002](docs/adr/0002-icon-catalog-merge-on-load.md)): the side-dock catalog and the per-diagram persistence shape. Moving imports to project scope requires changes across:

| Layer | What changes |
|---|---|
| `StorageProvider` ([`types.ts`](packages/axoview-app/src/services/storage/types.ts)) | New `getProjectIcons()` / `saveProjectIcons()` API. `LocalStorageProvider` gets a new key; `GoogleDriveProvider` stays stubbed. |
| Migration | One-shot scan across every existing diagram to hoist `collection === 'imported'` icons into the project store. Idempotent + versioned flag. |
| Lib injection ([`Isoflow.tsx`](packages/axoview-lib/src/Isoflow.tsx), [`uiStateStore.tsx`](packages/axoview-lib/src/stores/uiStateStore.tsx)) | New `projectIcons` + `onProjectIconsChange` props mirroring the `iconPackManager` pattern. |
| [`ElementsPanel.tsx`](packages/axoview-lib/src/components/LeftDock/ElementsPanel.tsx) | Import + delete reroute from `modelActions.set` to the new callback. |
| [`DiagramLifecycleProvider.tsx`](packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx) | ~9 call sites currently filter `data.icons` for `collection === 'imported'` and concat into the diagram's model. All become `[...packIcons, ...projectIcons]` instead. |
| Lean-save ([`leanSave.ts`](packages/axoview-lib/src/utils/leanSave.ts)) | Strip imported icons from per-diagram saves, but **not** from single-diagram JSON exports (which must stay self-contained for the recipient). Needs an explicit `stripProjectIcons` param so each call site is unambiguous. |
| Project zip ([`projectZip.ts`](packages/axoview-app/src/services/project/projectZip.ts)) | Add `project.json` at the zip root carrying the project icon store. Older clients fall back to scanning per-diagram icons during the transition window. |
| ADRs | ADR-0002 lifecycle section + ADR-0003 strip-rule both extend. |

### Behavioural decisions a future implementer must take

1. **Undo for project ops.** Imports + deletes either become non-undoable (project ops are committed immediately — simplest), or get their own project-state history stack (significantly bigger). The MQA #26 delete dialog has a confirm step, so "irreversible after confirm" is defensible; but the contract change must be approved.
2. **`project.json` location in the zip** — root or under `meta/`. Either works; root is simpler.
3. **Single-PR vs phased rollout** — Phase 1 (storage + migration, no strip) is fully reversible and could ship ahead of Phase 2 (ElementsPanel rewire) to validate the migration in production before behavioral changes land. Phase 3 (strip + export adjustments) needs the export paths audited to make sure none accidentally strip on the wrong side.
4. **Public name in the API** — `projectIcons` (clearer scope) vs `importedIcons` (matches the existing `collection: 'imported'` tag).

### Risks

- **Migration partial failure** — mitigated by deferring the per-diagram strip until each diagram is independently saved post-migration (so original blobs stay intact until verified).
- **Race on import-then-switch** — `projectIcons` state propagates async; mitigated by recomputing `model.icons` on every `projectIcons` change via `useEffect` in `DiagramLifecycleProvider`.
- **Lean-save stripping on the wrong path** — exports must keep icons inline. The explicit `stripProjectIcons` boolean per call site is the safety net.
- **Older client reads newer save** — same as the existing ADR-0003 "catalog version drift": items reference ids that are no longer in the diagram's local icons → tombstones. Recoverable, not destructive. Single-user app for the foreseeable future, so rollback hazard is low.

## Connector drag still mutates the model on every tile

**Symptom:** A long sustained connector drag (or anchor reconnect) holds 60 fps for ~50 seconds on the perf-stress fixture (80 nodes / 120 connectors), then degrades over a few seconds and stalls at ~4 fps for ~5 seconds before recovering. The shipped fix (drag-transaction + closed-form router) eliminated the original symptom — sub-10fps within seconds of drag start. What remains is a sustained-drag GC cliff, not a per-tile slowdown.

**Workaround:** None needed for typical use. A drag from A to B on a real diagram lasts a few seconds and stays at 60 fps end-to-end. Only marathon drags (cursor circling, no commit, ≳50 s) trip the cliff.

**Status:** Open, deferred. Filed for a future refactor session.

### Empirical findings (2026-05-10)

Captured from the perf overlay using [packages/axoview-e2e/fixtures/perf-stress-diagram.json](packages/axoview-e2e/fixtures/perf-stress-diagram.json):

| Window | FPS | Heap pattern |
|---|---|---|
| 0–50 s of drag | steady 60 | flat ~80–110 MB, no GC |
| 50–55 s | 60 → 41 → 35 → 16 → 4 | climbs 175 → 211 → 253 → 294 → **336 MB**, no GC |
| 55–56 s | 4 → 4 → 4 (5 s sustained) | held at 336 MB |
| 56 s | 26 → 19 → 25 → 14 → 59 | one big GC drops 336 → 104 MB |
| `lt` (cumulative long tasks) | grows from 9 → 85 across the cliff | 12, 9, 8, 8 long-task bursts in successive 1 s windows |

Pattern: **allocation-rate-limited GC pressure**, not a CPU bottleneck. V8 holds off on full GC during sustained synchronous work; allocations accumulate to ~336 MB; one stop-the-world collection then recovers.

### Why the shipped fix doesn't cover this

- `beginDragTransaction` / `commitDragTransaction` (in [useSceneActions.ts](packages/axoview-lib/src/hooks/useSceneActions.ts)) freezes `pendingPre` so per-tick `set()` calls skip `produceWithPatches`. That eliminated the patch-generation cost.
- The closed-form router in [pathfinder.ts](packages/axoview-lib/src/utils/pathfinder.ts) eliminated A\* + `PF.Grid` allocation per tick.
- **What still happens per tick:** the anchor is mutated on the model. [`reducers/connector.updateConnector`](packages/axoview-lib/src/stores/reducers/connector.ts#L62) runs `produce(state, ...)` over the entire `state` (model + scene), and a nested `produce` inside `syncConnector`. Each clone is ~100–200 KB on the stress fixture. At 60 fps that's ~12 MB/sec of fresh state objects. V8 catches up eventually, but on a long enough drag the heap outpaces it.

### Refactor design context (for a future session)

**Approach (deferred #3):** keep the in-progress connector preview in `scene.connectors[id].path` only. Don't touch `view.connectors[].anchors` until mouseup / second-click commit. The per-tick model clone goes away; only the small `scene.connectors[id]` slice needs updating per tick.

**Files in the hot path that the refactor would touch:**

| File | Role | What changes |
|---|---|---|
| [`interaction/modes/Connector.ts`](packages/axoview-lib/src/interaction/modes/Connector.ts) | Drives the drag | mousemove must update only the preview path, not call `scene.updateConnector` (which writes the model). On commit: write final anchors once. |
| [`interaction/modes/ReconnectAnchor.ts`](packages/axoview-lib/src/interaction/modes/ReconnectAnchor.ts) | Anchor reconnect | Same pattern. |
| [`stores/reducers/connector.ts`](packages/axoview-lib/src/stores/reducers/connector.ts) | `updateConnector` reducer | Currently does both: writes anchors AND runs `syncConnector`. Needs a sibling reducer that updates `scene.connectors[id].path` only (no model clone). |
| [`hooks/useSceneActions.ts`](packages/axoview-lib/src/hooks/useSceneActions.ts) | Action API | Add `previewConnectorPath(id, anchors)` that bypasses the reducer's model write. |
| [`components/SceneLayers/Connectors/Connector.tsx`](packages/axoview-lib/src/components/SceneLayers/Connectors/Connector.tsx) | Renders the connector | Already reads `scenePath` from sceneStore — likely no change needed if preview lands there. |
| [`components/ConnectorAnchorOverlay/ConnectorAnchorOverlay.tsx`](packages/axoview-lib/src/components/ConnectorAnchorOverlay/ConnectorAnchorOverlay.tsx) | Endpoint hit-targets | Reads anchor refs from model. During drag the model anchors are stale until commit — the overlay needs a "preview anchor" override or to hide during drag. |
| [`components/SceneLayers/ConnectorLabels/ConnectorLabel.tsx`](packages/axoview-lib/src/components/SceneLayers/ConnectorLabels/ConnectorLabel.tsx) | Label positioning | Same concern: reads anchor positions from model. |

**Invariant change.** Today: `view.connectors[].anchors` is the source of truth, scene path is derived. After the refactor: during a drag, model anchors are *committed-state-as-of-mousedown*; scene path is *current preview*. Two readers (overlay, label) need to know which to consult while a drag is open.

**Test before/after.** The perf-stress fixture is wired into [`connector.dragPerf.test.tsx`](packages/axoview-lib/src/__perf_refactor_regression__/connector.dragPerf.test.tsx) and validated against `modelSchema` on load. Use the same fixture for manual before/after comparison; the fix should hold 60 fps for an arbitrarily long drag (no GC cliff). Add an explicit perf assertion (e.g. 500-tick drag under N ms) once the refactor lands so this can't regress silently.

**Risk register.** The hardest part is the two-reader invariant. Anchor refs on the model can be `{ item }` or `{ tile }`; the preview must produce the same shape so downstream code (label positioning, anchor hit-testing, item-control panel) doesn't branch on "is a drag in progress". One option: extend `scene.connectors[id]` with `previewAnchors?: ConnectorAnchor[]`; readers fall back to model anchors when absent. That keeps the contract local to the scene store rather than leaking into UI state.
