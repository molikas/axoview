# ADR 0022 — Canvas Pointer-Interaction Model (click semantics + customization removal)

**Status:** Proposed
**Date:** 2026-06-18
**Supersedes:** none (refines [ADR 0006](0006-canvas-selection-contract.md) §2/§4 and the MQA-#1 "right-click opens the action bar" decision; interacts with [ADR 0018](0018-touch-pen-gesture-contract.md))
**Superseded by:** none

## Context

Three reported issues share one root: the canvas has no single, opinionated open/select/pan contract, and the parts that exist contradict each other.

- **#4** — Details should open on **double-click**, not single-click. Today a single left-click selects an item, and because `selectedIds.length === 1` auto-mirrors into `itemControls` ([ADR 0006](0006-canvas-selection-contract.md) §4; [Cursor.ts:575](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L575)), the details panel opens on every single click.
- **#7** — Right-click opens the details panel + floating action bar ([useInteractionManager.ts:960-970](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L960)). Users expect right-drag to **pan** the canvas; right-click-to-pan is currently an opt-in setting (`panSettings.rightClickPan`) that collides with the action-bar path.
- **#6** — Selecting the name text in the details panel by click-dragging closes the panel when the cursor crosses the panel bounds (window-bound pointer listeners per ADR 0018 + a dismiss path the existing MQA-#16 guard at [Cursor.ts:559](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L559) doesn't cover).

The user also asked to **remove the canvas-interaction customization surface and its code debt**, and to re-verify touch ("TAP") behavior. That surface is:

- [`PanSettings`](../../packages/axoview-lib/src/components/PanSettings/PanSettings.tsx) (Settings → "Canvas" tab) — `emptyAreaClickPan`, `middleClickPan`, `rightClickPan`, `ctrlClickPan`, `altClickPan`, `arrowKeysPan`, `wasdPan`, `ijklPan`, `keyboardPanSpeed`. Several toggles **conflict** with the fixed model below (`ctrlClickPan` vs Ctrl+click multi-select; `altClickPan` vs Alt+click waypoint removal; `emptyAreaClickPan` vs lasso/empty-clear).
- The hotkey-profile selector in [`HotkeySettings`](../../packages/axoview-lib/src/components/HotkeySettings/HotkeySettings.tsx) — the default `smnrct` profile maps `connector: 'c'`, the source of the Ctrl+C collision (#17).
- [`HelpDialog`](../../packages/axoview-lib/src/components/HelpDialog/HelpDialog.tsx) documents the old mouse model and must be rewritten.

**Coherence note (workflow.md Principle 7):** there is **no context-menu component** in the codebase (the PLAN snapshot lists one that doesn't exist). Reassigning right-click to pan therefore removes the only right-click affordance and strands every per-item command that isn't a top-bar shortcut. That gap is filled by [ADR 0027](0027-canvas-context-menu.md), spawned from this decision; the two are mutually load-bearing.

## Decision

### 1. One fixed mouse model (EDITABLE)

| Gesture | Outcome |
|---|---|
| Single left-click on item | **Select only** — highlight + open the floating action bar. Does **not** open the details panel. |
| Double left-click on item | **Open the details panel** (`itemControls`). |
| Single left-click empty canvas | Clear selection. |
| Double-click empty canvas | QuickAdd popover (unchanged). |
| Right-click press + drag | **Pan** — always, no setting. |
| Right-click tap (no drag) on an item | Open the **context menu** ([ADR 0027](0027-canvas-context-menu.md)) — full per-item command list. **Never** the details panel. |
| Right-click tap (no drag) on empty canvas | Open the **canvas context menu** (Add · Paste · Select all · Snap toggle), or clear selection if none applies. |
| Ctrl/⌘+click | Toggle multi-selection (ADR 0006, unchanged). |
| Alt+click a connector waypoint | Remove the waypoint — **without** requiring the connector to be selected first (relax `handleSelectedConnectorMousedown`). |

### 2. Action bar opens on selection

The floating `NodeActionBar` is opened by **selection** (single-click / tap), not by right-click. It carries the 3–4 most-frequent quick actions; the **full** command list lives in the context menu ([ADR 0027](0027-canvas-context-menu.md)), and full editing in the details panel. Division of labor — bar = curated shortcuts · menu = catch-all · panel = editing — is the [ADR 0027 §4](0027-canvas-context-menu.md) invariant: **no command is reachable only via a removed gesture.**

### 3. Selection no longer auto-opens the details panel

Refines [ADR 0006](0006-canvas-selection-contract.md) §4: `selectedIds.length === 1` drives **highlight + action bar only**. The details panel (`itemControls` → right Properties dock) opens on explicit **double-click** (and the existing panel-action events). The LayersPanel mirrors this: row single-click selects; double-click opens the panel. See the [ADR 0006 addendum](0006-canvas-selection-contract.md).

### 4. The details panel survives an in-panel text-drag (#6)

A text-selection drag that **originates inside editing chrome** (the panel's name field) must not dismiss the panel when it crosses the canvas/panel boundary. Panel dismissal is decoupled from any window-level pointerup whose gesture started outside the renderer. Reproduce + instrument before fixing (the window-bound listeners from ADR 0018 make this subtle).

### 5. Touch parity (ADR 0018)

| Touch gesture | Outcome |
|---|---|
| Tap on item | Select (+ action bar) |
| Double-tap on item | Open the details panel |
| Long-press | **Context menu** ([ADR 0027](0027-canvas-context-menu.md)) — full command list (reassigned from the action bar, which now opens on tap-select) |

The synthetic-mouse forwarding must **not** re-trigger the removed right-click=details path. Verify single-tap vs double-tap debounce on a real touch device.

### 6. Remove the canvas-interaction customization surface + debt

- Delete `PanSettings` and the Settings → "Canvas" tab pan section; bake fixed pan behavior into the engine: **right-click pan on, middle-click pan on, arrow-keys pan on**; drop `ctrl/alt/emptyArea` click-pan, `wasd/ijkl` pan, and the speed slider.
- Remove the `panSettings` `uiState` slice, `setPanSettings` action, persisted key, `AxoviewProps` prop, the 14× `settings.pan.*` i18n keys, and the `usePanHandlers` branching on removed flags. Persisted `panSettings` keys become dead — ignore on load.
- Collapse the hotkey-profile machinery to a **single fixed default scheme** (remove the `qwerty`/`smnrct`/`none` selector + `hotkeyProfile` state). Tool keys stay **visible but read-only**: `HotkeySettings` becomes a reference table and `HelpDialog` lists them, so users can *learn* the keys without rebinding. **Customization deferred (resolved 2026-06-18):** the only persistence available is per-browser `localStorage` — a rebind wouldn't follow the user across devices, so it's not worth the surface now; revisit when proper user-account storage exists. The `isCtrlOrCmd` guard for #17 ships regardless. **Locked default keys:** `S` select · `M` pan · `N` add-item · `R` rectangle · `C` connector · `T` text · `L` lasso · `F` freehand (the current mnemonic set; the exact bindings are a later shake-out concern, not a feature).
- Rewrite the `HelpDialog` mouse-interaction table to this model. Keep **Zoom + Labels** settings (display prefs, not interaction-model customization).

### 7. Cross-surface ripple (the experience-level pass)

What this change makes **redundant**, **contradicts**, or **orphans**, and how each is reconciled:

- **Redundant** → `PanSettings` (right/ctrl/alt/empty-area click-pan toggles all become contradictory or dead) and the hotkey-profile selector → removed in §6.
- **Contradicts** → right-click was both "open details/bar" and (optionally) "pan." Resolved: right-**drag** pans, right-**tap** opens the context menu, double-click opens the panel.
- **Orphaned** → per-item commands lost their right-click home, and #20's commands had none → [ADR 0027](0027-canvas-context-menu.md) builds the menu and defines bar/menu/panel labor.
- **Mirror surfaces** → the LayersPanel must match the open/select split (row single-click = select, double-click = open) per [ADR 0006 addendum](0006-canvas-selection-contract.md) (§4.1 two-way sync). **View mode is intentionally different**, not an oversight: `EXPLORABLE_READONLY` keeps its click-to-pin [`ViewModeInfoPopover`](0012-view-mode-node-info-popover.md) (a presentation read surface), because there is no editing/selection there to disambiguate.

**2026-06-21 (UX re-test addendum):** The two 2026-06-21 journey-test runs (ADR 0028) hardened the click/keyboard semantics:

- **Double-click-to-add is removed for good.** Right-click → "Add item" (the [ADR 0027](0027-canvas-context-menu.md) menu) is the single canonical add affordance; a second trigger was redundant. This strikes the earlier "double-click → QuickAdd" promise in §3 — double-click now only opens Details (on an item) or no-ops (empty canvas).
- **Icon placement is gesture-gated.** A plain tap on an Elements-panel icon only *arms* placement; a node is placed by a subsequent canvas click or a drag-onto-canvas (a past-tap-slop "moved" signal), because pointer capture makes both `e.target` and `elementFromPoint` resolve to the panel icon mid-drag. An off-canvas no-move release keeps the arm — it never drops a stray node. After one placement the tool returns to CURSOR (no lingering placement cursor; the preview cursor is an outline diamond).
- **Esc returns from any persistent tool mode to Select** (CONNECTOR, PLACE_ICON, RECTANGLE.DRAW, TEXTBOX, LASSO, PAN), after first aborting an in-progress connector. This generalises the connector-abort-priority fix; transient modes (DRAG_ITEMS, RECTANGLE.TRANSFORM, RECONNECT_ANCHOR) keep their own abort logic.
- **Connector on empty canvas: a stray CLICK is a no-op, a deliberate DRAG draws a free-floating line.** A lone click that starts on empty canvas arms a provisional connector that is **reverted on release** (so no free-floating tile-anchored connector is left from a stray click); a **press-drag-release from empty draws a free line** (a tile→tile connector). Starting on a node is unchanged (click-then-click, or drag-to-connect). *(Refined 2026-06-22: the original rule blocked the empty start entirely, which also silently removed the legitimate "draw a line on the canvas" gesture — free-floating connectors remained supported only in drag interaction mode. The guard is now scoped to the stray click, not the drag gesture.)*
- **Arrow keys are selection-aware** (amending the §6 "arrows = pan only" choice): a selected ITEM/RECTANGLE/TEXTBOX is nudged one tile per press (single-undo transaction); with nothing selected, arrows pan.
- **`NodeActionBar` is screen-space** with edge flip/clamp (mirroring `ViewModeInfoPopover`) and renders above the LeftDock stacking context, so the start-connector affordance stays reachable near viewport edges.
- **Mode clarity:** an active CONNECTOR tool shows a click-through hint pill ("Drag between items to connect • Esc to cancel") so the mode and its exit are discoverable.

## Consequences

**Positive:** predictable, opinionated model; right-click freed for panning; less surface area and dead code; one place to reason about open-vs-select.

**Negative / risks:** removes user customization (accepted per decision); touch double-tap must be debounced against single-tap; the #6 panel-dismiss decoupling is subtle given window-bound listeners; migration leaves dead persisted `panSettings` keys (clean on load).

## Implementation notes (non-binding)

- `resolveClickSelection` ([Cursor.ts:465](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L465)) stops opening `itemControls`; a new double-click path opens it.
- `onContextMenu` ([useInteractionManager.ts:926](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L926)) no longer calls `setItemControls`/`setItemActionBarOpen` for mouse.
- Tool-hotkey resolution guarded by `!isCtrlOrCmd` ([useInteractionManager.ts:750](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L750)).

## Acceptance criteria

- **Unit:** `resolveToolHotkey` is not consulted when `isCtrlOrCmd` (Ctrl+C/V/X never switch tool).
- **e2e (new `details-interaction.spec`):** single-click selects + no panel; double-click opens panel; right-click press-drag pans; right-click **tap opens the context menu** (item) / canvas menu (empty), never the panel ([ADR 0027](0027-canvas-context-menu.md)); name-field text-drag crossing the panel keeps it open.
- **Manual + touch device:** tap = select, double-tap = details, long-press = bar; no double-open.
- **Build clean;** `grep -r panSettings packages/` returns nothing; `HelpDialog` reflects the new model.
