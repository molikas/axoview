# Tactical — Canvas UX Overhaul (interaction, selection, grid, labels, export)

> **Read first:**
> - [docs/workflow.md](../workflow.md) — session cadence + design principles (every claim cites `file:line`)
> - [docs/ux-principles.md](../ux-principles.md) — design language (§2 affordances, §4 selection, §8.8 canvas-anchored chrome)
> - **New ADRs:** [0022 interaction model](../adr/0022-canvas-pointer-interaction-model.md) · [0023 off-grid + collision](../adr/0023-off-grid-positioning-and-collision.md) · [0024 label positioning](../adr/0024-node-label-positioning-and-sizing.md) · [0025 export robustness](../adr/0025-image-export-robustness-and-presets.md) · [0026 rectangle handles](../adr/0026-rectangle-edge-transform-handles.md) · [0027 context menu](../adr/0027-canvas-context-menu.md)
> - **Extended ADRs:** [0006 selection contract](../adr/0006-canvas-selection-contract.md) (2026-06-18 addendum) · [0013 present mode](../adr/0013-preview-mode-layer-switcher.md) (2026-06-18 addendum)
> - **Inherited:** [0018 touch/pen](../adr/0018-touch-pen-gesture-contract.md) · [0020 perf protocol](../adr/0020-engine-perf-harness-and-measurement-protocol.md) · [0021 paste perf / TileIndex](../adr/0021-paste-algorithmic-perf-and-spatial-index.md)
>
> **Status:** T1 + T2 shipped (integration) · **Owner:** molikas · **Last updated:** 2026-06-18
>
> Short-lived working doc. Delete at `/feature wrap` once every track has shipped + smoke-passed; the ADRs are the durable record and PLAN.md gets one line.

## Session startup checklist

1. Read this file fully, then the ADRs for the track you're picking.
2. Skim PLAN.md Phase Status Dashboard **for context only** — do not edit it during this work.
3. `TodoWrite` the picked track's sub-tasks.
4. Mark `[x]` as work completes; commit per-track (one coherent commit per bundle).
5. Verify per the cadence table below before committing.
6. On completion of the whole program, run **Track P** then follow Wrap-up.

## Goal

Resolve 20 reported canvas issues/improvements as a coherent program, grouped so each track maps to one durable decision or one bug bundle. Tighten the interaction model into a single opinionated contract (and remove the customization debt behind it), make selection/lasso correct, add off-grid placement, label direct-manipulation, edge-resize handles, and robust export — **without** regressing the engine perf budget. Explicitly **not** a goal: bulk style editing, S3/Drive, anything in the deferred PLAN phases.

## Scope

### In scope
20 items across 9 feature tracks + 1 perf gate (see Sub-tasks).

### Out of scope
- Bulk multi-item style/resize editing (ADR 0006 §4 defers it).
- Fractional tile coordinates across the engine (ADR 0023 chose per-item offset instead).
- T3 simulation engine (separate initiative).

## Locked decisions (design discussion 2026-06-18)

| # | Decision |
|---|---|
| 1 | **Off-grid model** = per-item **pixel offset** (`offset`), not fractional tile coords. Integer tile stays the engine base; one `resolvePlacement` chokepoint. (ADR 0023) |
| 2 | **Unsnapped ⇒ no collision.** Collision is a **per-item** opt-out (`collides`); global "snap to grid" toggle + per-item context-menu override. Primary use: nudge a few items between tiles to save space. (ADR 0023) |
| 3 | **Action bar opens on selection** (single-click), not right-click. (ADR 0022 §2) |
| 4 | **Single-click = select only; double-click = open details. Right-click DRAG = pan; right-click TAP = context menu** (item) / canvas menu (empty) — never the details panel; **Alt+click waypoint** removal no longer needs the connector pre-selected. (ADR 0022 §1 + ADR 0027) |
| 5 | **Remove the canvas-interaction customization surface** (`PanSettings` + Settings "Canvas" pan section + `panSettings` slice/prop/i18n/consumers) and **collapse hotkeys to one fixed default**, shown **read-only** in `HotkeySettings` + `HelpDialog`. **No rebinding** until proper user storage exists (localStorage-only would be per-browser, not per-user — resolved 2026-06-18). Locked keys: S/M/N/R/C/T + L/F. Rewrite `HelpDialog`. (ADR 0022 §6) |
| 6 | **Touch parity:** tap=select, double-tap=details, long-press=bar; re-verify TAP behavior on a device. (ADR 0022 §5) |
| 7 | **Lasso = intersection** for rectangles + full-bounds for text; capture connector endpoints for movement. (ADR 0006 addendum) |
| 8 | **"Present"** is the locked name for the read-only presentation surface (was "Preview"); + hide-labels control. (ADR 0013 addendum) |
| 9 | **Export "Screenshot" preset** default = 2× · fit-to-content · labels on · PNG; respect browser max-canvas dimension. (ADR 0025) |
| 10 | **Rigorous perf gate at the end** following ADR 0020 (same-session A/B + guardrails + anti-cheat + decision-log). The layers-panel fix (#14) carries its own measured before/after. |
| 11 | **Build a canvas context menu** ([ADR 0027](../adr/0027-canvas-context-menu.md)) as the per-item command home (unsnap/collision/z-order/layer/…). Division of labor: NodeActionBar = quick shortcuts on selection · context menu = full list on right-tap/long-press · details panel = editing on double-click; **no command reachable only via a removed gesture.** There is **no** context-menu component today. |

## Cross-surface reconciliation (experience-level pass)

The 2026-06-18 review ([workflow.md Principle 7](../workflow.md)) found these cross-issue consequences. Each is resolved here, not left drifting:

| Ripple | Resolution |
|---|---|
| Right-click → pan **removes** the only right-click affordance and **orphans** every per-item command; #20's commands had no home; **no context-menu component exists** | Build the context menu (ADR 0027); right-drag pans, right-tap opens it; long-press opens it on touch (reassigned from the action bar). |
| `PanSettings` toggles (right/ctrl/alt/empty-area click-pan) become **contradictory or dead** once the model is fixed | Remove `PanSettings` + the Settings "Canvas" pan section (T4 / ADR 0022 §6). |
| Canvas single-click = select-only, but LayersPanel row single-click **opens** the panel — breaks §4.1 two-way sync | LayersPanel: row single-click = select, double-click = open (ADR 0006 addendum; T2/T4). |
| Action bar + context menu + details panel risk **duplicating** | Locked division of labor (ADR 0027 §4): bar = quick shortcuts · menu = full list · panel = editing. |
| Lasso intersection makes every marquee **also grab** background rectangles | Accepted (complaint was the inverse); directional lasso deferred (ADR 0006 addendum). |
| Touch long-press currently opens the action bar — **collides** with the new menu | Long-press → context menu; action bar opens on tap-select (ADR 0022 §5 / ADR 0027). |
| View-mode `ViewModeInfoPopover` (click-to-pin) vs edit-mode double-click-details | Intentionally distinct — view mode is a read surface, no selection to disambiguate (documented, not an oversight). |

## Sub-tasks

Sequence (low-risk → high-risk): **T1 → T2 → T3 → T4 → T9 → T5 → T6 → T7 → T8 → Track P.**

### T1 — Quick bug wins (no ADR) — **SHIPPED** (commit 9375689)
- [x] **#17 Ctrl+C tool switch** — guarded via `resolveToolHotkey(isCtrlOrCmd, …)` extracted to `toolHotkeys.ts` (+ unit test); `handleToolHotkeys` passes the flag through ([useInteractionManager.ts:750](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L750)).
- [x] **#10 caption link cut off** — `wordBreak`/`overflowWrap` on the node + connector canvas labels (the `<a>` wraps inside the label chip's `overflow:hidden`). Parity is node + connector only; rect/textbox carry no link field (UX §5.2).
- [x] **#5 line style/type icon picker** — replaced the two `<Select>`s with icon `ToggleButtonGroup`s rendering SVG line previews ([ConnectorControls.tsx](../../packages/axoview-lib/src/components/ItemControls/ConnectorControls/ConnectorControls.tsx)); sentence-case tooltips/aria (UX §1.2).
- [x] **#1 alt-click anchor hitbox** — counter-scaled the anchor handles by `1/zoom` via a zoom subscription wrapper `AnchorScale` (UX §8.8); Alt+click removal no longer needs the connector pre-selected (`handleAltClickWaypointRemoval` in [Cursor.ts](../../packages/axoview-lib/src/interaction/modes/Cursor.ts), + regression test).
- [x] **#8 Preview → Present** — Slideshow icon + tooltip; i18n keys renamed/retranslated (`preview`→`present`, `saveAndPreview`→`saveAndPresent`, `previewSaveFirst`→`presentSaveFirst`) across the 11 locales that carried them (de-DE/id-ID fall back to the new English default). ADR 0013 vocabulary lock.

### T2 — Selection contract (extend ADR 0006) — **SHIPPED** (integration)
- [x] **#16 lasso intersection** — rectangles select on any overlap, textboxes on full bounds via the new allocation-free `doBoundsOverlap` + `getTextBoxEndTile` ([Lasso.ts](../../packages/axoview-lib/src/interaction/modes/Lasso.ts)). Select-through of background rectangles is accepted; directional lasso deferred (ADR 0006 addendum). Unit-pinned in `Lasso.intersection.test.ts` + `isoMath.test.ts`; browser-verified in `multi-select-drag-lasso.spec`.
- [x] **#2 endpoint capture** — free-floating (tile-bound) connector endpoints are captured by the lasso's path-hit branch via `getConnectorMovementAnchorRefs` (movement only; never spliced — they travel with their parent CONNECTOR, which delete removes wholesale). Mirrored in `FreehandLasso.ts`. Browser-verified in `connector.spec` (capture + rigid drag, anchors intact).
- [x] **#13 panel↔canvas mirror + bulk assign** — LayersPanel now reads `uiState.selectedIds` for the row highlight (not only LASSO-mode), and a drag of any row that's part of the multi-selection bulk-assigns the whole selection via `filterUserFacingRefs` ([LayersPanel.tsx](../../packages/axoview-lib/src/components/LayersPanel/LayersPanel.tsx)). Browser-verified in `layers-multiselect.spec` (KR3 highlight + KR4 bulk).

### T3 — Layers panel perf (no ADR; perf-noted) — **SHIPPED** (commit c875b652)
- [x] **#14 slow selection @1000** — chose **memoize + decouple highlight** (not virtualization): `LayerItemRow` was already `memo()`-wrapped, but `handleItemClick` churned identity every selection (its `applyCtrlToggleSelect` dep reads `itemControls`/`mode`), defeating the memo → all N rows re-rendered per click. Fix reads those closures from a ref (empty-dep `onClick`) + memoizes `sortedLayers` ([LayersPanel.tsx](../../packages/axoview-lib/src/components/LayersPanel/LayersPanel.tsx)). **Same-session A/B (ADR 0020, calibration-matched):** renders/click 1000→2, longest click frame 2866→33 ms (~86×), canvas spawn draw-count flat; jest 1128 green; decision-log row added. Authored **without ADRs 0022–0027 on the machine** — reconciled 2026-06-20: no ADR contradicted; the only forward-coupling (T4 edits this handler) is captured in the T4 task + the [ADR 0006 addendum](../adr/0006-canvas-selection-contract.md).

### T4 — Interaction model (ADR 0022 + ADR 0027) — **code complete**

All sub-tasks shipped across commits 7f01645 (open/select split), 9f2437d (context menu + invocation), ef427ad (hotkey collapse), 640a966 (pan-customization removal), f9a0cb4 (HelpDialog). Unit-pinned (multiSelect.contract, usePanHandlers, toolHotkeys, settings.defaults); `grep -r panSettings packages/*/src` clean. **Owed before promotion:** the two new e2e specs (details-interaction, context-menu — see Test additions) + a **browser + touch-device walkthrough** of every gesture.

- [x] **#4** single-click selects only; double-click opens the Properties panel — store select-only path (`setSelectedIds(len 1)` + `setItemControls(…, {openPanel:false})`), mouse body `dblclick` + touch double-tap open the dock.
- [x] **#7** right-click **drag** = pan; right-click **tap** = context menu (item / empty-canvas); `onContextMenu` only swallows the OS menu (never mounts the panel/bar). In a tool mode right-tap still aborts the tool.
- [x] **Context menu (ADR 0027)** — [CanvasContextMenu](../../packages/axoview-lib/src/components/CanvasContextMenu/CanvasContextMenu.tsx) (MUI Menu, portal). Item + empty variants; catalogue = details/rename/cut-copy-paste/duplicate/z-order/assign-layer/delete + **disabled** unsnap+collision placeholders (T8 wires the ADR 0023 fields); right-tap + long-press invocation; ADR 0027 §4 division of labor.
- [x] **#6** panel no longer closes during an in-panel name text-drag — `Cursor.mouseup` gates the clear on `mousedownHandled` (renderer-side press), not the `mouse.mousedown` snapshot `getMouse` records for any press.
- [x] **action bar on selection** (single-click/tap via the store select-only path); **Alt+click** without pre-select shipped in T1 (#1).
- [x] **LayersPanel open/select** — row single-click selects, double-click opens the panel; rename stays F2; T3 identity-stable handler pattern preserved.
- [x] **Remove customization surface** — `PanSettings` + Settings "Canvas" pan section + `panSettings` slice/action/persist + PanSettings type + 13-key `settings.pan` i18n (all locales + AxoviewProps type) deleted; `usePanHandlers` baked to a fixed model; hotkeys collapsed to one fixed read-only `TOOL_HOTKEYS` (HotkeySettings is a reference table); `HelpDialog` rewritten; dead persisted keys ignored on load.
- [x] **Touch** — tap=select, **double-tap=details** (`DOUBLE_TAP_MS`), **long-press=context menu** (reassigned off the action bar). Device verification still owed (ADR 0018).

### T9 — Present mode (extend ADR 0013) — **code complete**
- [x] **#15 hide-labels control** — ephemeral UI-only flag `uiState.previewHideLabels` + `setPreviewHideLabels`, cleared on view/mode switch alongside `previewLayerOverrides`. Merged at one documented point ([`isLabelVisibleInPreview`](../../packages/axoview-lib/src/utils/previewLabelVisibility.ts) — forced-hidden only in EXPLORABLE_READONLY) consulted by all three name-label render paths: DOM [`Node`](../../packages/axoview-lib/src/components/SceneLayers/Nodes/Node/Node.tsx) + [`ConnectorLabel`](../../packages/axoview-lib/src/components/SceneLayers/ConnectorLabels/ConnectorLabel.tsx) and the bulk canvas [`NodesCanvas`](../../packages/axoview-lib/src/components/SceneLayers/Nodes/NodesCanvas.tsx) (ADR 0019 default renderer — gated + a `data-labels-drawn` probe). Toggle surfaced in the top-left present chrome ([`PreviewLabelsToggle`](../../packages/axoview-lib/src/components/PreviewLabelsToggle/PreviewLabelsToggle.tsx), `previewLabelsToggle` i18n × 14). Never writes the model / dirties save — pinned by `previewLabelVisibility.test.ts` + the extended `preview-layer-switcher.spec` (model `showLabel` + `isDirty` unchanged; flag clears on leaving present).

### T5 — Export robustness & presets (ADR 0025)
- [ ] **#9 SVG throws** — reproduce, fix root cause, surface failures as a Dialog (ADR 0011).
- [ ] **#18 4× canvas limit** — one shared render-target-size calculator with max-dimension clamp; warn + still produce an image.
- [ ] **#19 labels + Screenshot preset** — name labels render in export and stay **legible** (ADR 0015 intent — not shrunk); "Screenshot" preset (2× · fit · labels on · PNG) default. Mirrors the user's real workflow (Chrome F11 → screenshot with readable labels), so the in-app path should match that quality without leaving the app.

### T6 — Label positioning & sizing (ADR 0024)
- [ ] **#3** drag label up/down/below the node + resize height on canvas; signed offset model; stalk re-anchors.

### T7 — Rectangle edge handles (ADR 0026)
- [ ] **#11** add TOP/RIGHT/BOTTOM/LEFT midpoint anchors to `TransformRectangle` ([TransformRectangle.ts:37](../../packages/axoview-lib/src/interaction/modes/Rectangle/TransformRectangle.ts#L37)); correct iso + 2D projection; counter-scaled (UX §8.8).

### T8 — Off-grid positioning & collision (ADR 0023) — **highest risk, last**
- [ ] **#12** global snap-to-grid toggle (persisted `uiState.snapToGrid`).
- [ ] **#20** per-item context-menu "Unsnap / Snap" + "Enable / Disable collision".
- [ ] Additive schema (`offset` / `snap` / `collides`), `resolvePlacement` chokepoint, renderer applies offset post-projection, connector endpoints resolve to rendered position, export honors offset in both projections.

### Track P — Performance validation gate (ADR 0020) — **after all tracks**
- [ ] Run `npm run perf` (full) and confirm **KR1 noise band < 10%** on the load-bearing range before drawing any conclusion.
- [ ] **Same-session A/B** with a matching calibration index: program-tip vs the pre-program commit (git stash / worktree). Discard + re-run any mismatched calibration pair. A result inside the noise band is **not** a regression and is accepted.
- [ ] **Guardrails green:** idle heap flat ±5%/60s @ 0 entities; zero frames > 50 ms during a 1,000-paste; bulk-spawn 1,000 no fps < 30; memory/entity < 5 KB.
- [ ] **Anti-cheat:** the correctness suite (selection, occupancy/collision, undo/redo, drag visual-position parity) stays GREEN; renderer draw/work counter == N.
- [ ] Append `perf-results/decision-log.md` rows; only a clean full idle run updates `perf-results/baseline.md` (restore it via `git checkout` after any partial/diagnostic run).
- [ ] **Focus the A/B on the paths this program touches:** lasso hit-test per drag frame (T2 — runs every marquee frame; must not regress the `getItemsInBounds` cost), layers-panel @1000 (T3 — **already measured + KEPT**: c875b652, 1000→2 renders/click, ~86×; the gate only re-confirms canvas-spawn-flat), grid offset render + drag CSS-preview (T8), label drag (T6). One variable per iteration; never bundle.

#### Pointed hypotheses (state the prediction *before* measuring — ADR 0020 §2: "one variable, predict direction/size")

Each is a decision-log row in waiting. "Noise band" = the run's reported CV on the headline metric. The **anti-cheat** binds all of them: a change may not get faster by removing work the real app does (lasso must still test every item; the renderer must still draw N nodes).

| Change | Predicted effect | The one variable | Falsifier / watch |
|---|---|---|---|
| T1 + T4 event-routing + hotkey-profile collapse | **Neutral** (maybe a sub-noise keydown win — fewer branches) | fewer branches in keydown / `onContextMenu` | any spawn/drag/idle move **> noise** is unexpected → investigate (event routing shouldn't touch the frame budget) |
| T2 lasso intersection (#16) — runs **every marquee-drag frame** | **Neutral (≤ noise)** — rect-intersection + textbox full-bounds add a few comparisons per item, same O(N)/frame, **no new allocation** | corner-enclosure → rectangle-intersection; textbox `.tile` → full-bounds | lasso-drag p95 @ N=1000 rising **> noise** falsifies it — almost always means a per-frame allocation crept into `getItemsInBounds` |
| T3 layers panel @1000 (#14) — **SHIPPED c875b652** | **Validated** — same-session A/B (calibration-matched): renders/click 1000→2, longest frame 2866→33 ms (~86×), canvas spawn flat | ref-stable `onClick` + `sortedLayers` memo (NOT virtualization) | gate only re-confirms **canvas spawn p95 stays flat** (panel is a separate tree); latency win already in decision-log |
| T6 label drag (#3) | **Neutral** — drag is CSS-preview, single commit on drop (mirrors rectangle transform) | label drag handle | a per-frame **model write** during label drag would regress drag p95 — must not happen |
| T7 rectangle edge handles (#11) | **Neutral** — 8 vs 4 handles render only for the one selected rectangle | midpoint anchors added | handle cost scaling with **N** in the spawn harness means they were wired per-node (wrong) |
| T8 offset render (#12/#20) — **zero-offset common case** | **Neutral** — `offset` undefined ⇒ no-op branch; integer-tile base path unchanged | optional `offset` read in the renderer | any cost with **zero** offset items = the no-op branch isn't guarded |
| T8 offset render — **all-N offset + `collides:false`** | **Neutral-to-slight-gain** — one extra transform compose per node (no new React work), and non-colliding items **shrink the `TileIndex`** so drag collision can be marginally *faster* | offset translate + `TileIndex` exclusion | extra **React** work per offset node (it should be a pure transform compose) → drag p95 rises |
| Guardrails (all tracks) | **Unchanged green** — nothing above adds idle work | — | idle heap ±5%/60s, zero >50 ms frames during a 1,000-paste, mem/entity < 5 KB must all hold |

## Test additions (identify + write alongside each track)

**Unit (Jest, `__tests__/` adjacent):**
- T1 keydown: Ctrl+C/V/X don't resolve a tool hotkey.
- T2 lasso: rectangle any-overlap select; textbox full-bounds; endpoint capture.
- T5: render-target-size clamp math; `svgOptimizer` Unicode round-trip.
- T6: label-position math (above/below/height-clamp).
- T8: `resolvePlacement` snap on/off; save→load round-trip of `offset`/`snap`/`collides`; lean-save omits defaults.
- T7: `TransformRectangle` edge-anchor axis math.

**E2E (Playwright POM, `packages/axoview-e2e/tests/`):**
- Extend `hotkeys.spec` — Ctrl+C/V/X keep the current tool.
- Extend `multi-select-drag-lasso.spec` — lasso through a long rectangle's middle; over a text body; mixed rect+text.
- Extend `connector.spec` — lasso captures endpoints.
- **New** `layers-multiselect.spec` — canvas Ctrl-select highlights rows; drag a multi-selection assigns all.
- **New** `details-interaction.spec` — single=select (no panel); double=details; right-drag=pan; name-drag keeps panel open; LayersPanel row double-click opens panel.
- **New** `context-menu.spec` — right-tap opens the item menu; right-drag pans (no menu); empty right-tap opens the canvas menu; unsnap/collision entries present; long-press opens it on touch (ADR 0027).
- Extend `import-export-*` — SVG valid; 4× large-diagram outcome; screenshot preset with labels.
- **New** `label-drag.spec` — drag below node + resize height persist.
- Extend `rectangle-ops.spec` — edge handle resizes one axis in iso + 2D.
- **New** `snap-grid.spec` — global toggle, per-item unsnap, collision-off overlap, persistence.
- Present mode: hide-labels toggle (extend the relevant view-mode spec).

## Verify cadence (per [workflow.md](../workflow.md))

| Change class | Required before commit |
|---|---|
| `axoview-lib/src/` | `npm test --workspace=packages/axoview-lib` + `npm run build` (both libs) |
| `axoview-app/src/` | `npm run build` + dev server + **browser walkthrough** (mandatory for any `components/` change) |
| Cross-package | both builds + full test suite |
| Whole program done | **Track P** perf gate |

## Wrap-up

When every track + Track P passes:
1. Add one line under the relevant `PLAN.md` phase:
   `- Canvas UX overhaul shipped — see docs/adr/0022..0027 + ADR 0006/0013 addenda (this file's git history).`
2. Delete this file. ADRs are the durable record.
3. Update memory `project_docs_convention.md` (ADR list + drop the active-tactical bullet) and `MEMORY.md` pointer.
4. `/notes` for CHANGELOG + docs sync; `/ship` to promote.

## Deferred (later shake-out — not blocking this program)

- **On-canvas view-control placement for clean screenshots (raised 2026-06-18).** `ViewTabs` (bottom-center) + `ZoomControls` (bottom-right) read as clutter when capturing a full-screen (F11) screenshot. Relocate them to a cleaner spot so a fullscreen capture is uncluttered. UX-sensitive; revisit via `/shake-out` after this program. The in-app Screenshot preset (T5 #19) partly addresses the underlying need (clean export without F11).

## Notes for Claude

- **Two packages** — build both libs after lib edits; rsbuild dev server desyncs from `dist/` after `build:lib` (restart it). See [[project_dev_lib_rebuild]].
- **Selection paths are contract-bound:** any new selection path must consult `isItemInteractable` (UX §4.3) and include connector waypoints via `getConnectorWaypointRefs` (UX §4.4). The T2 panel-mirror and T8 placement are new paths — route them through these.
- **Order matters:** T4 changes the open/select split that T2's panel-mirror depends on — land T2's `selectedIds` read first, then T4's double-click open, or they fight over `itemControls`.
- **T8 is the data-model risk** — keep the integer-tile invariant; everything off-grid flows through the one `resolvePlacement` chokepoint and a post-projection render translate. Do it last, behind the perf gate.
- **i18n discipline (UX §7):** every new/renamed string lands in all 14 locales; never `Set-Content -Encoding utf8` on locale files (BOM/mojibake) — see [[feedback_powershell_encoding_hazard]].
- **Don't bundle in Track P** — one variable per iteration; the correctness suite is the anti-cheat (ADR 0020 §6).
