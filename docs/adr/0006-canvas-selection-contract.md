# ADR 0006 — Canvas Selection Contract (single + multi)

**Status:** Accepted
**Date:** 2026-05-16
**Supersedes:** implicit single-selection assumption baked into [`ItemControls`](../../packages/axoview-lib/src/types/ui.ts)
**Superseded by:** none

## Context

Two MQA items (#8 and #9) asked for behaviour the existing selection model couldn't express:

- **#8** — Ctrl+click adds/removes an item from the selection; Ctrl+A selects everything.
- **#9** — The properties panel auto-hides when more than one item is selected (since per-item fields can't be applied meaningfully to a heterogeneous selection).

Until this ADR, canvas selection lived in `uiState.itemControls: ItemControls | null` — single-item by construction. Multi-select existed only **inside** the `LASSO` / `FREEHAND_LASSO` modes via `mode.selection.items: ItemReference[]`, and was wiped when the user switched tools. There was no way to ask "what is selected" from outside a lasso mode.

The plan considered three architectures (see `docs/tactical/mqa-design-shakeout.md`): convert `itemControls` to an array, add a separate `selectedIds`, or repurpose lasso mode for everything. The first sprays branching across every consumer of `itemControls`; the third has bad UX (Ctrl+click silently changes the active tool). We chose the second.

## Decision

### 1. Two cooperating slices, one invariant

`uiState` gains a new slice:

```ts
selectedIds: ItemReference[];   // persistent multi-selection on the canvas
```

`itemControls` keeps its existing shape and continues to drive the right-side properties panel.

**Invariant:** when `selectedIds.length === 1`, `itemControls` mirrors that single item. When the length is 0 or > 1, `itemControls` is `null`. The store actions enforce this in both directions — callers that already use `setItemControls` (e.g. layer-row clicks) keep working; multi-select callers go through `setSelectedIds` / `toggleSelected` / `clearSelection`.

This means the panel-mounting code, the rename helpers, the F2 binding, NodeActionBar, and every existing consumer of `itemControls` is **unchanged**. Only multi-select-aware code reads `selectedIds`.

### 2. Gesture matrix

| Gesture | Outcome |
|---|---|
| Left-click an item | replaces selection with `[item]` |
| Ctrl/⌘+click an item | toggles `item` in/out of `selectedIds` |
| Left-click empty canvas | clears selection |
| Ctrl/⌘+A | selects every visible + unlocked item in the active view |
| Esc (no panel, no in-flight connector) | clears selection |
| Lasso / freehand lasso (mouseup) | mirrors `mode.selection.items` into `selectedIds` |
| Drag any item already in `selectedIds` (len > 1) | drags the whole selection |
| Delete / Backspace (selection len > 1) | deletes every selected item |

### 3. Locked / hidden items are off-limits — across every path

Ctrl+A and lasso both consult `isItemInteractable` (built from `layerContext.lockedIds` + `visibleIds`). This is the same gate already documented in [ux-principles §4.3](../ux-principles.md#43-locked--hidden-layer-items-are-non-interactive--across-every-selection-path). Multi-selection adds **no new bypass** — selectedIds can only ever contain interactable refs.

### 4. Properties panel auto-hide

`selectedIds.length === 1` → panel mounts for that item. Anything else → panel closes. There's no special case for "homogeneous N > 1" (e.g. three nodes): bulk editing isn't in scope and showing one item's values for many would mislead. A future enhancement may add a slim bulk-action bar; this ADR doesn't commit to one.

### 5. Visual contract

- **Single selection** continues to render `TransformControls` (resize handles + dashed outline). Unchanged.
- **Multi-selection** renders the same dashed outline around **each** selected node / rectangle / text box — but without resize anchors (no bulk transform in this commit). Connectors don't get a transform-box; they were never selectable via transform handles.
- The **lasso marquee** still shows its dashed rectangle while a lasso is active. The post-lasso state is now redundantly visualised by the per-item outlines; both can coexist.
- **BottomDock left zone** shows a quiet `"N selected"` label (body2 / secondary) when `length > 1`. This anchors any future bulk-action UI (delete all, group, align, etc.) without committing to one now.

### 6. Modifier-key threading

Mode actions don't currently receive the raw `SlimMouseEvent`. To branch on Ctrl-click inside `Cursor.mouseup` without changing the `ModeActionsAction` signature for every mode, we attach the latest modifiers to `uiState.mouse.modifiers` (optional field, set on every canvas mouse event by `useInteractionManager`). Mode actions read `uiState.mouse.modifiers?.ctrl ?? false`.

This is the only widening of the `Mouse` type from this change. Existing tests that construct mock `Mouse` objects continue to compile because the field is optional.

### 7. 2026-06-18 addendum — lasso hit-testing, endpoint capture, panel mirror, and the open/select split

Four refinements from the canvas-UX overhaul (`docs/tactical/canvas-ux-overhaul.md`):

- **Lasso intersection semantics (#16).** Rectangles are selected on **any overlap** with the marquee, not only when all four corners are enclosed ([Lasso.ts:48-65](../../packages/axoview-lib/src/interaction/modes/Lasso.ts#L48)); textboxes are hit on their **full bounds**, not just the origin tile ([Lasso.ts:68-75](../../packages/axoview-lib/src/interaction/modes/Lasso.ts#L68)). The old all-corners-enclosed rule is replaced because users read marquee-touch as selection (a lasso through the middle of a long rectangle or text body must select it).
- **Endpoint/start-anchor capture (#2).** A connector's endpoint (start/end) anchors become lasso-capturable for **movement** (not splicing — splicing an endpoint still corrupts the path), so a free-floating start anchor can be selected.
- **Panel ↔ canvas multi-select mirror (#13).** The [LayersPanel](../../packages/axoview-lib/src/components/LayersPanel/LayersPanel.tsx) reads `uiState.selectedIds` (not only LASSO-mode selection at [LayersPanel.tsx:122](../../packages/axoview-lib/src/components/LayersPanel/LayersPanel.tsx#L122)), so a canvas Ctrl-multi-select highlights the matching rows. Dragging any row that is part of a multi-selection assigns the **whole** selection to the target layer (bulk `assignLayerToItems`, not just the dragged item at [LayersPanel.tsx:348](../../packages/axoview-lib/src/components/LayersPanel/LayersPanel.tsx#L348)).
- **Open/select split (refines §4).** Per [ADR 0022](0022-canvas-pointer-interaction-model.md), `selectedIds.length === 1` no longer auto-opens the details panel — selection drives **highlight + action bar** only; the panel opens on explicit **double-click**. The §4 invariant (`itemControls` mirrors a single selection) still holds for *deriving* the panel target; it just no longer *mounts* the panel on single-click. **LayersPanel mirrors this** (§4.1 two-way sync): a row's single-click selects (highlight + canvas sync + action bar), double-click opens the details panel — so the panel-open gesture is consistent across canvas and panel. (View mode is intentionally exempt — its click-to-pin `ViewModeInfoPopover`, ADR 0012, is a presentation read surface, not selection.)
- **Lasso select-through (accepted trade-off).** Intersection semantics mean a marquee dragged *across* a large background rectangle now also selects it. This is intended — the complaint was the inverse (a lasso through a rectangle's middle failing to select). Figma-style **directional** lasso (drag-right = contain, drag-left = intersect) is a deferred refinement, not shipped here.

New acceptance criteria: lasso through the middle of a long rectangle / over a text body selects it; canvas Ctrl-multi-select highlights LayersPanel rows; dragging a multi-selected row assigns every selected item to the layer; single-click does not mount the Properties panel; LayersPanel row double-click opens the panel (single-click only selects).

## Consequences

### Positive

- Existing single-item consumers (NodePanel, ConnectorControls, RectangleControls, TextBoxControls, NodeActionBar, two-way layer-row sync) need **zero changes**. The contract is additive.
- Lasso modes become a richer producer (they mirror into `selectedIds`), but the lasso *modes themselves* are unchanged — same in-mode visuals, same drag-from-selection behaviour.
- Bulk delete works uniformly: the keyboard handler now has one path for "many items selected" regardless of whether they came from Ctrl+click, Ctrl+A, or a finished lasso.
- The auto-hide rule for the panel is a pure derivation. There's no "should panel close?" decision scattered across call sites.

### Negative / open

- **No bulk style / resize affordance** yet. Multi-select-aware bulk actions are intentionally deferred (per the MQA plan). The BottomDock badge is the placeholder anchor when we're ready.
- **Single-item selection currently triggers two store writes** when reached via `setSelectedIds([ref])`: one for `selectedIds`, one for the auto-derived `itemControls`. Acceptable; both are in the same `set(...)` call so React renders once.
- **Mode-driven selection (lasso) and persistent selection can momentarily disagree** if the user starts a new lasso while a Ctrl+click selection is active. The lasso's mouseup overwrites `selectedIds`, which matches user expectations (a new lasso replaces the prior selection).

## Files changed by this ADR's adoption

- [`types/ui.ts`](../../packages/axoview-lib/src/types/ui.ts) — new `selectedIds`, new actions, optional `Mouse.modifiers`.
- [`stores/uiStateStore.tsx`](../../packages/axoview-lib/src/stores/uiStateStore.tsx) — `setSelectedIds` / `toggleSelected` / `clearSelection`; `setItemControls` keeps `selectedIds` coherent for single-item updates.
- [`interaction/modes/Cursor.ts`](../../packages/axoview-lib/src/interaction/modes/Cursor.ts) — Ctrl+click branch; multi-drag from `selectedIds`.
- [`interaction/modes/Lasso.ts`](../../packages/axoview-lib/src/interaction/modes/Lasso.ts) + [`FreehandLasso.ts`](../../packages/axoview-lib/src/interaction/modes/FreehandLasso.ts) — mirror selection into `selectedIds` on finalise.
- [`interaction/useInteractionManager.ts`](../../packages/axoview-lib/src/interaction/useInteractionManager.ts) — modifier capture, Ctrl+A, Esc extension, Delete extension.
- [`components/TransformControlsManager/TransformControlsManager.tsx`](../../packages/axoview-lib/src/components/TransformControlsManager/TransformControlsManager.tsx) — render outline per selected item when `length > 1`.
- [`components/BottomDock/BottomDock.tsx`](../../packages/axoview-lib/src/components/BottomDock/BottomDock.tsx) — `"N selected"` badge.

## See also

- [MQA tactical plan](../tactical/mqa-design-shakeout.md) — items #8 + #9, where the user-facing requirements were captured.
- [ux-principles §4](../ux-principles.md#4-selection-model) — sets the panel ↔ canvas sync rule and the locked/hidden invariant this ADR inherits.
- ADR-0005 — toolbar layout contract; the BottomDock badge is one example of a "named region" gaining a new owner.
