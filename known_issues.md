# Known Issues

**Last pruned:** 2026-06-10 (v1.1 close-out). Open items below cross-checked against [technical-review-2026-06.md §11](docs/technical-review-2026-06.md); resolved entries removed (durable records live in the relevant ADR / perf-troubleshooting.md / git history).

## Partial-coverage i18n locales (de-DE + id-ID)

**Symptom:** German (de-DE) and Indonesian (id-ID) have stub translations covering only the initial pre-rename string set. Newer strings (added since 2026-04) fall through to English. Users selecting these locales see mixed German/English or Indonesian/English UI.

**Workaround:** None at the locale level. Switch back to English (en-US) for a fully translated experience, or to one of the fully-covered locales (zh-CN, es-ES, pt-BR, fr-FR, hi-IN, bn-BD, ru-RU, it-IT, tr-TR).

**Status:** Open, deferred. Resolve when translators refresh those locales. Not a productization-blocker — locale switching itself works correctly; the stubs were preserved (rather than dropped from `supportedLanguages`) so the existing user choice keeps working. Filed alongside B-13 closure (productization audit Section 5).

## PWA install card is plain (cosmetic; install still works)

**Symptom:** Chrome's richer install card requires `form_factor: "wide"` + mobile screenshots in [manifest.json](packages/axoview-app/public/manifest.json); safe-zone-padded maskable icons (192×192 + 512×512) would also polish the installed app's home-screen presence. All three are cosmetic — install still works with the current manifest, and the deprecated combined `"any maskable"` purpose flag was already cleaned up in B-8 commit `f38d0b4`.

**Workaround:** None needed. PWA install proceeds normally; just shows a plain card.

**Status:** Open, deferred. Resolve when there's a marketing push for PWA installs. Filed alongside B-8 closure (productization audit Section 5).

## Preview-mode passive badge does not cover all clickable nodes

**Symptom:** In `EXPLORABLE_READONLY`, a node is clickable (opens the readOnly details panel) when it has any of: `link`, `headerLink`, `description`, or `notes`. But the passive visual indicators currently only cover two of these:

- Bottom-right OpenInNew badge → only when `link` is set
- Top-right blue dot → only when `notes` has visible content
- Nothing for `headerLink`-only or `description`-only nodes

The pointing-finger cursor on hover (added 2026-05-15) does cover all four cases, so the affordance is discoverable on hover — but at-a-glance scanning misses headerLink/description nodes.

**Workaround:** None. Users can still hover and click to discover the panel.

**Status:** Open. Decide on a unified badge story — either extend the existing badges to cover the missing cases, or replace both with one consolidated "more info" indicator that fires for any of the four content types.

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
| Lib injection ([`Axoview.tsx`](packages/axoview-lib/src/Axoview.tsx), [`uiStateStore.tsx`](packages/axoview-lib/src/stores/uiStateStore.tsx)) | New `projectIcons` + `onProjectIconsChange` props mirroring the `iconPackManager` pattern. |
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

## Undo desync: dual history stacks skew on interleaved model-only + both-store ops (D-7) — FIXED

**Symptom (historical):** Undo/redo are two independent patch stacks (model + scene). A model-only op (place icon, lone-node drag) pushes a model entry but no scene entry, so the stacks skew to different depths. After `draw connector → place icon → Ctrl+Z`, the single undo popped the top of *each* stack — which then belonged to different actions — leaving the connector in `model.views[].connectors` with no `scene.connectors[id]` path = an invisible connector (the MQA #5 symptom, different mechanism).

**Status:** **FIXED 2026-06-14** (commit 1 of the ADR 0018 Pointer-Events branch). Logical-action sequence-stamping ([historySequence.ts](packages/axoview-lib/src/stores/historySequence.ts)): every history entry both stores push is stamped with a shared monotonic sequence allocated once at each logical-action boundary (standalone `set`, `transaction`, `beginDragTransaction`). `useHistory.undo/redo` reverts only the stack(s) whose top carries the most-recent (undo) / least-future (redo) sequence, so one keystroke reverts exactly one logical action across whichever store(s) participated. Guarded by the now-unskipped coherence spec in [undo.dualStackSkew.test.tsx](packages/axoview-lib/src/__perf_refactor_regression__/undo.dualStackSkew.test.tsx) (the skew-source characterization stays green too). The `MAX_HISTORY_SIZE=50` trim-skew sub-case (behavior-map §4.5(a)) is resolved by the same fix.

### Residual follow-ups (NOT covered by the D-7 sequence-stamping fix)

These are distinct mechanisms, not stack-skew, so the sequence-stamping work does not address them. Filed explicitly so they are not lost:

- **D-8 — paste→undo→redo restores empty connector paths.** Paste records a provisional empty path in the scene history entry (`createConnector(..., skipPathfinding=true)`), and `computePathsAsync` fills the real paths *outside* history (`skipHistory=true`). So paste → `Ctrl+Z` → `Ctrl+Y` re-applies the recorded patch with empty paths → pasted connectors render pathless until a later edit touches them. **Fix sketch:** on redo of a paste, re-run pathfinding for the restored connectors (or record the computed paths into the history entry rather than the provisional empty ones). e2e repro to be added under the canvas-interaction coverage work.
- **D-9 — cross-view (page-switch) undo applies scene patches to the wrong view.** The scene store holds only the current view but its history stack is global and unscoped; `changeView` rebuilds the scene with `skipHistory=true` and does not clear/scope history. Undoing after a page switch applies the previous view's scene patches to the current view (phantom/stale `scene.connectors[id]`) while the model undo reverts an off-screen view. **Fix sketch:** scope scene history per-view, or clear/snapshot on `changeView`. Larger change; deferred. Code-traced, e2e repro to be added.

## Touch: delete + z-order per-item actions have no Properties-panel route (D-6 follow-up)

**Symptom:** ADR 0018 D-6 routes per-item actions on touch through the right-hand Properties panel (the floating NodeActionBar stays desktop/right-click-only). Auditing the NodeActionBar actions against touch-reachable surfaces (2026-06-14):

| NodeActionBar action | Touch route | Status |
|---|---|---|
| edit name / style / notes / link | Properties panel (NodePanel Info/Style tabs, auto-opens on selection) | ✅ covered |
| assign-layer | LayersPanel (left dock) / LassoLayerBar | ✅ covered |
| start-connector ("Add connection") | Connector tool in the ToolMenu → tap source, tap target | ✅ covered (different route) |
| **delete** | — (NodeActionBar right-click or `Delete` key only) | ❌ **gap on pure touch** |
| **z-order (bring forward / send back)** | — (NodeActionBar right-click or `Ctrl+]`/`[` only) | ❌ **gap on pure touch** |

**Workaround:** Use a device with a keyboard, or right-click (mouse/trackpad). On a pure touchscreen these two actions are currently unreachable.

**Status:** Open follow-up filed during the ADR 0018 touch/pen implementation. **Fix sketch:** add a small action row to the Properties panel header (delete + bring-forward/send-back) shown for a single ITEM selection — reuses `deleteViewItem`/`deleteSelectedItems` and the existing z-order actions; no new gesture or canvas chrome (consistent with D-6). Deferred as a panel-UX change separate from the gesture contract.

## Rectangle / textbox drag perf (move + draw + resize) — FIXED (D-3 resolved)

**Fixed 2026-06-14.** Manipulating a rectangle/textbox dropped to ~7 fps with a GC sawtooth (perf-diag capture). `DragItems` moved nodes via the CSS-preview path but routed textbox/rectangle **moves** through `updateRectangle`/`updateTextBox`, and the rectangle **DRAW**/**TRANSFORM** modes did the same per tile — each a full-state immer `produce` **every frame** (and, for draw/resize, no drag transaction → one undo entry per tile).

- **Move:** routed through immer-free `batchUpdateRectangles`/`batchUpdateTextBoxTiles` (one structural array copy, model-only) inside the existing drag transaction → one undo entry.
- **Draw / Resize (D-3, supersedes the earlier deferral):** `DrawRectangle`/`TransformRectangle` now open a `beginDragTransaction` (draw: before `createRectangle`; resize: on entry) and write per-frame via `batchUpdateRectangles`, committing on mouseup (+ exit safety-net). Result: smooth, immer-free, and one undo entry per draw/resize.

Guarded by `DragItems.modes.test.ts` + `rectangleTextbox.dragPerf.test.tsx` (move) and `DrawRectangle.test.ts` / `TransformRectangle.test.ts` / `rectangleDrawTransform.modes.test.ts` (draw/resize routing + begin/commit). Note: textbox *create* (the `t`-hotkey one-shot) still uses the reducer once — not a hot path.

The connector-drag GC cliff below is a separate, still-open item (per-frame model write through the reducer; needs a connector preview path).

## Connector drag still mutates the model on every tile

**Symptom:** A long sustained connector drag (or anchor reconnect) holds 60 fps for ~50 seconds on the perf-stress fixture (80 nodes / 120 connectors), then degrades over a few seconds and stalls at ~4 fps for ~5 seconds before recovering. The shipped fix (drag-transaction + closed-form router) eliminated the original symptom — sub-10fps within seconds of drag start. What remains is a sustained-drag GC cliff, not a per-tile slowdown.

**Workaround:** None needed for typical use. A drag from A to B on a real diagram lasts a few seconds and stays at 60 fps end-to-end. Only marathon drags (cursor circling, no commit, ≳50 s) trip the cliff.

**Status:** Open, deferred. Filed for a future refactor session.

### Empirical findings (2026-05-10)

Captured from the perf overlay using [packages/axoview-lib/src/__perf_refactor_regression__/fixtures/perf-stress-diagram.json](packages/axoview-lib/src/__perf_refactor_regression__/fixtures/perf-stress-diagram.json):

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

## Touch/touchpad node placement — SHIPPED (ADR 0018)

**Resolved 2026-06-14.** The press-drag-release-only model is replaced by the touch/pen gesture contract ([ADR 0018](docs/adr/0018-touch-pen-gesture-contract.md), Accepted): one Pointer Events layer branches on `pointerType` — mouse/trackpad keep press-drag-release (with a px-based tap-vs-pan threshold that fixes the precision-trackpad sub-tile drag), touch/pen get tap-to-select / tap-to-place (SELECT→GRAB→PLACE), one-finger pan, and two-finger pinch-zoom. The `window` mouse + touch-synthesis path (and the `(0,0)` drop bug) are gone. Remaining touch follow-up: the D-6 "delete + z-order have no Properties-panel route" entry above.

### §5.1 e2e coverage follow-ups (P1, deferred — not introduced by this work)

Closed in the ADR 0018 e2e revision: touch tap-select/place/pan/pinch/abort, the D-7 dual-stack undo repro, and the CSS-preview-mid-drag P0 invariant. Still open as P1 (pre-existing canvas-interaction gaps): a NodeActionBar invocation/dismissal e2e, a per-mode Escape-abort matrix e2e, a RAF-throttle-under-load unit assertion, and a pan/zoom zero-scene-re-render render-probe. Filed so they aren't lost; lower priority than the shipped touch coverage.
