# Canvas Interaction Behavior Map — Pre-Rewrite Reference (KR1–KR5)

> **Status:** Reference · **Owner:** molikas · **Created:** 2026-06-13 ·
> **Updated:** 2026-06-14 (blind-spot closure: D-7 confirmed live bug w/ test;
> KR2 2D parity; KR3 undo vectors D-8/D-9; KR4 capture surfaces; KR5 floor +
> blocked-capture status. New divergences D-8…D-11.)
> **Purpose:** The behavioral, algorithmic, and **performance** contract of the
> canvas interaction layer **as it exists today**, mapped against the tests and
> the commit history, so the Pointer-Events rewrite (ADR 0018) starts from a
> complete known-good contract and its fragility + load-bearing perf invariants
> are visible.
>
> **Companion to** — read these first; this doc *extends* them and does not
> duplicate their content:
> - [canvas-interaction-baseline.md](canvas-interaction-baseline.md) — §1–§5 DOM
>   stacking + event routing + the `isRendererInteraction` gate + `usePanHandlers`
>   (the **mechanical** layer). This doc is the **behavioral / algorithmic /
>   perf** layer on top of it.
> - [ADR 0018](../adr/0018-touch-pen-gesture-contract.md) — the locked rewrite
>   contract. KR5 (§5) applies corrections to its impl notes and surfaces two
>   contract questions for review.
> - [ADR 0006](../adr/0006-canvas-selection-contract.md) — selection invariants.
> - [known_issues.md](../../known_issues.md) — the open connector-drag GC cliff.
> - [perf-troubleshooting.md](../perf-troubleshooting.md) — the MQA #7 playbook +
>   the architectural perf invariants (A-1…A-6).
>
> **Read-only audit.** No `packages/**` code was changed to produce this. Every
> claim carries a `file:line` or a commit hash. Claims I could not fully resolve
> statically are marked **⚠ RUNTIME-VERIFY** rather than guessed.

---

## 0. The dispatch spine (recap — full detail in baseline §3–§5)

Every canvas gesture flows: `window` mouse/touch (or `rendererEl` wheel) →
`onMouseEvent` → (`usePanHandlers` may consume) → `getMouse` (→ `screen`/`tile`)
→ `scheduleUpdate` (RAF-throttle on `mousemove` only) → `processMouseUpdate` →
`modes[uiState.mode.type].{mousedown|mousemove|mouseup}(State)`
([useInteractionManager.ts:696–832](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L696-L832)).

Three facts the whole behavior map hangs on:

1. **Mode change runs `exit`/`entry` lazily on the *next* event**, not at
   `setMode` time: `processMouseUpdate` compares `reducerTypeRef.current` to the
   live `uiState.mode.type` and, on mismatch, calls the previous reducer's
   `exit` then the new reducer's `entry`
   ([L753-768](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L753-L768)).
   So a mode's `exit` fires only when a **subsequent mouse event** observes the
   change — keyboard-only mode switches don't run `exit` until the next mouse
   event. This is load-bearing for the abort analysis in §4.
2. **`isRendererInteraction`** = `rendererRef.current === e.target ||
   isAnchorOverlay` ([L747-748](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L747-L748)).
   `mousedown`/`mouseup` handlers gate on it; **`mousemove` handlers do not**
   (so a drag survives the pointer straying over a node/anchor). The rewrite
   replaces the "move fires on `window`" property with `setPointerCapture`.
3. **`hasMovedTile(mouse)` is delta-based and one RAF frame stale**
   ([isoMath.ts:374-377](../../packages/axoview-lib/src/utils/isoMath.ts#L374-L377)):
   `mouse.delta.tile !== {0,0}`. `Cursor.mousemove` deliberately bypasses it for
   drag-start, comparing `position.tile` vs `mousedown.tile` directly to avoid a
   half-tile lag ([Cursor.ts:498-505](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L498-L505));
   every **other** move handler still gates on `hasMovedTile`, inheriting the
   one-frame staleness.

`SlimMouseEvent` ([common.ts](../../packages/axoview-lib/src/types/common.ts)) is
the internal adapter every mode is written against. Keeping `PointerEvent →
SlimMouseEvent` mouse-shaped is what keeps the mode unit-tests green.

---

## 1. (KR1) Mode registry + per-mode state-transition tables

### 1.0 The registry

`modes` maps 11 reducer keys to `ModeActions`
([useInteractionManager.ts:43-55](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L43-L55)).
`INTERACTIONS_DISABLED` is a **12th** state with no reducer — the input effect
early-returns and binds **no** listeners
([L865](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L865)).

| Mode key | File | `entry`/`exit` | Drag-txn? | Commits on |
|---|---|---|---|---|
| `CURSOR` | [Cursor.ts](../../packages/axoview-lib/src/interaction/modes/Cursor.ts) | entry only (replays mousedown) | n/a (delegates) | mouseup (selection) |
| `DRAG_ITEMS` | [DragItems.ts](../../packages/axoview-lib/src/interaction/modes/DragItems.ts) | both | **yes** (entry/exit) | mouseup |
| `RECTANGLE.DRAW` | [DrawRectangle.ts](../../packages/axoview-lib/src/interaction/modes/Rectangle/DrawRectangle.ts) | both (cursor) | **NO** ⚠ | per-frame (mousemove) |
| `RECTANGLE.TRANSFORM` | [TransformRectangle.ts](../../packages/axoview-lib/src/interaction/modes/Rectangle/TransformRectangle.ts) | both (no-op) | **NO** ⚠ | per-frame (mousemove) |
| `CONNECTOR` | [Connector.ts](../../packages/axoview-lib/src/interaction/modes/Connector.ts) | both (cursor) | **yes** (mousedown/commit) | 2nd click or mouseup |
| `PAN` | [Pan.ts](../../packages/axoview-lib/src/interaction/modes/Pan.ts) | both (cursor) | n/a (scroll only) | n/a |
| `PLACE_ICON` | [PlaceIcon.ts](../../packages/axoview-lib/src/interaction/modes/PlaceIcon.ts) | none | n/a (one `transaction`) | mouseup |
| `TEXTBOX` | [TextBox.ts](../../packages/axoview-lib/src/interaction/modes/TextBox.ts) | both (cursor) | **NO** ⚠ | per-frame (mousemove) |
| `LASSO` | [Lasso.ts](../../packages/axoview-lib/src/interaction/modes/Lasso.ts) | none | n/a | mouseup (mirrors selectedIds) |
| `FREEHAND_LASSO` | [FreehandLasso.ts](../../packages/axoview-lib/src/interaction/modes/FreehandLasso.ts) | none | n/a | mouseup |
| `RECONNECT_ANCHOR` | [ReconnectAnchor.ts](../../packages/axoview-lib/src/interaction/modes/ReconnectAnchor.ts) | both | **yes** (entry/exit) | per-frame preview, commit on mouseup |
| `INTERACTIONS_DISABLED` | — (no reducer) | — | — | no listeners bound |

The **⚠ NO drag-txn** rows are the undo-grouping + per-frame-immer divergence —
see §3.6 and §4 register **D-3**.

### 1.1 CURSOR — select / drag-start / lasso-start dispatcher

The hub mode. Entry trigger: default `EDITABLE` start mode, the `select` hotkey,
post-drag/lasso/connector return, or Ctrl+A.

| Event | Guard | Rule | Cite |
|---|---|---|---|
| `entry` | mode CURSOR | If `mode.mousedownItem` is set, replay `mousedown(state)` (used when another mode hands off a pressed item). | [Cursor.ts:477-485](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L477-L485) |
| `mousedown` | CURSOR **and** `isRendererInteraction` | (a) If a CONNECTOR is selected and the click resolves to one of its anchors → claim it first (`handleSelectedConnectorMousedown`): **endpoint → enter `RECONNECT_ANCHOR`**; **waypoint + Alt → splice it** (`scene.updateConnector`, set module `altSpliceConsumed=true`); **waypoint plain → arm a `CONNECTOR_ANCHOR` drag**. (b) Else `selectItemAtTileMousedown`: record `mousedownItem`/`mousedownHandled`; if no interactable item, `setItemControls(null)`. | [L264-271](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L264-L271), [L172-262](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L172-L262) |
| `mousemove` | CURSOR | **No mousedown** → hover cursor (`grab` over selected-connector anchor, `pointer` over any item, else `default`), gated by `hasMovedTile`. **Mousedown + tile moved** (`position.tile !== mousedown.tile`, *not* `hasMovedTile`) → promote: pressed CONNECTOR body becomes a `CONNECTOR_ANCHOR` (via `getAnchor`, which **creates** a waypoint if none at the tile); pressed item → `resolveDragItems` (whole multi-selection if len>1 and contains it) + `collectDragInitialPositions` → **`DRAG_ITEMS`**; no item but `mousedownHandled` → **`LASSO`**. | [L486-538](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L486-L538) |
| `mouseup` | CURSOR **and** `isRendererInteraction` | `altSpliceConsumed` → reset, keep selection, return. No-mousedown-no-handled → MQA #16 ignore (text-drag from a panel ended over canvas). Else if `mousedownItem && !hasMovedTile` → `resolveClickSelection` (left = replace via `setSelectedIds([ref])`; Ctrl/⌘ = `toggleSelected`; connector = `setItemControls` or Ctrl group-toggle of connector **+ waypoints**). Else → `clearSelection`. Always reset bookkeeping. | [L540-574](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L540-L574) |

Notes: `mousedownItem` and `mousedownHandled` are CURSOR-mode-state, set via
`setMode(produce(...))` ([L116-128](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L116-L128)).
**Left-click never opens the NodeActionBar** — it only selects (the bar is
right-click-only; §4 / [UiOverlay.tsx:303-317](../../packages/axoview-lib/src/components/UiOverlay/UiOverlay.tsx#L303-L317)).

### 1.2 DRAG_ITEMS — the CSS-preview move (perf-critical, §3.4)

Entry trigger: `Cursor.mousemove` or `Lasso`/`FreehandLasso.mousemove` (dragging
an existing selection). Carries `items`, `initialTiles`, `initialRectangles`.

| Event | Rule | Cite |
|---|---|---|
| `entry` | `rendererRef.userSelect='none'`; cursor `grabbing`; clear `previewTiles`+`previewAnchorTiles`; **`beginDragTransaction`** (one history entry for the whole drag). | [DragItems.ts:276-286](../../packages/axoview-lib/src/interaction/modes/DragItems.ts#L276-L286) |
| `mousemove` | `mouseOffset = position.tile − mousedown.tile`. Cursor → `not-allowed` if a dragged **node**'s cursor sits on a non-dragged ITEM. `dragItems()`: **nodes** via CSS vars (collision-gated, all-or-nothing — §2.2); **waypoint anchors** accumulate into `previewAnchorTiles`; **one** `previewConnectorPaths(previewTiles, previewAnchorTiles)` per frame (`flushSync`); **textboxes/rectangles/anchor-reconnect** via `scene.transaction` reducer path. | [L297-330](../../packages/axoview-lib/src/interaction/modes/DragItems.ts#L297-L330) |
| `mouseup` | Commit node `previewTiles` via `batchUpdateViewItemTiles`; commit `previewAnchorTiles` grouped one `updateConnector` per connector; **`commitDragTransaction`**; `setItemControls(null)`; → `CURSOR`. | [L331-380](../../packages/axoview-lib/src/interaction/modes/DragItems.ts#L331-L380) |
| `exit` | `userSelect='auto'`; cursor `default`; **`clearAllCssOffsets` + clear preview maps WITHOUT committing node tiles**; `commitDragTransaction`. | [L287-296](../../packages/axoview-lib/src/interaction/modes/DragItems.ts#L287-L296) |

**Split abort semantics (important, §4 D-2):** `exit` discards the CSS node
preview (nodes were never written to the model → they **snap back to origin**)
but `commitDragTransaction` **commits** any textbox/rectangle/anchor moves
already written per-frame. So a programmatic mode change mid-drag aborts node
moves but keeps non-node moves. There is **no `mousedown`** handler; the only
exits are `mouseup` (→ CURSOR) or a mode change (→ `exit`).

### 1.3 LASSO — marquee select + drag-from-selection

| Event | Rule | Cite |
|---|---|---|
| `mousemove` | If `isDragging && selection` → seed `initialTiles`/`initialRectangles` from the selection, switch to **`DRAG_ITEMS`**. Else (building) gated by `hasMovedTile`: `getItemsInBounds(start,end)` → write `selection` into mode. | [Lasso.ts:148-214](../../packages/axoview-lib/src/interaction/modes/Lasso.ts#L148-L214) |
| `mousedown` | If click is **inside** an existing selection → set `isDragging=true` (allowed even when `!isRendererInteraction`, so pressing on a node inside the box still drags). Else if `isRendererInteraction` and a selection exists → clear it (fresh start). No selection → do nothing (mousemove builds the box). | [L216-256](../../packages/axoview-lib/src/interaction/modes/Lasso.ts#L216-L256) |
| `mouseup` | No `mouse.mousedown` (toolbar click) → skip. No selection items → back to `CURSOR`. Else reset `isDragging`, mirror `selection.items` into **`setSelectedIds`** (ADR 0006). | [L258-289](../../packages/axoview-lib/src/interaction/modes/Lasso.ts#L258-L289) |

`getItemsInBounds`: nodes/textboxes by center-in-box; rectangles need **all 4
corners** inside; connectors by **path-segment intersection** (regression-fixed
2026-05-25, [#6](../../packages/axoview-lib/src/interaction/modes/Lasso.ts#L77-L142))
and pull their `getConnectorWaypointRefs` along. Every branch consults
`isItemInteractable` (§4 invariant I-1). No `entry`/`exit`.

### 1.4 FREEHAND_LASSO — polygon select

Same shape as LASSO but the in-progress state is a **screen-space path** built in
`mousemove` (≥5px throttle, [FreehandLasso.ts:178-195](../../packages/axoview-lib/src/interaction/modes/FreehandLasso.ts#L178-L195)),
converted to tiles on `mouseup` via the injected `screenToTile`
([L253-292](../../packages/axoview-lib/src/interaction/modes/FreehandLasso.ts#L253-L292)).
Containment uses `isPointInPolygon` / `segmentIntersectsPolygon`. Needs ≥3 points
to select. Same `isItemInteractable` + `getConnectorWaypointRefs` discipline.
**⚠ Migration:** `mouseup` reads `uiState.rendererEl.getBoundingClientRect()`
for the path conversion ([L259](../../packages/axoview-lib/src/interaction/modes/FreehandLasso.ts#L259)) —
unaffected by where listeners bind, but the path is in `screen` coords from
`getMouse`, which the rewrite must keep producing identically.

### 1.5 CONNECTOR — create (click-mode default, drag-mode optional)

`uiState.connectorInteractionMode` defaults to **`'click'`**
([uiStateStore.tsx:68](../../packages/axoview-lib/src/stores/uiStateStore.tsx#L68));
`'drag'` is opt-in via ConnectorSettings. Internal sub-state lives in the mode:
`id` (null = idle / set = in-flight), `startAnchor`, `isConnecting`,
`returnToCursor`.

| Event | click-mode | drag-mode | Cite |
|---|---|---|---|
| `entry`/`exit` | cursor `crosshair` / `default` | same | [Connector.ts:142-147](../../packages/axoview-lib/src/interaction/modes/Connector.ts#L142-L147) |
| `mousedown` | 1st click → `handleClickFirst`: `beginDragTransaction` + `createConnector` (both anchors on target), arm `isConnecting`. 2nd click → `handleClickSecond`: set anchor[1] to target, `commitDragTransaction`, return to CURSOR or reset. | `handleDragStart`: `beginDragTransaction` + `createConnector`, hold `id`. | [L197-218](../../packages/axoview-lib/src/interaction/modes/Connector.ts#L197-L218) |
| `mousemove` | while `isConnecting`, gated by `hasMovedTile`: rewrite anchor[1] to the hovered ITEM or raw tile via `scene.updateConnector` (per-frame model write — the GC-cliff path, §3.5). | same (`connectorInteractionMode==='drag'`). | [L148-196](../../packages/axoview-lib/src/interaction/modes/Connector.ts#L148-L196) |
| `mouseup` | no-op (completion is the 2nd click). | `commitDragTransaction`; return to CURSOR (if `returnToCursor`) or reset to idle CONNECTOR. | [L219-240](../../packages/axoview-lib/src/interaction/modes/Connector.ts#L219-L240) |

`returnToCursor` is set by the NodeActionBar "Add connection" path
([NodeActionBar.tsx:106-133](../../packages/axoview-lib/src/components/NodeActionBar/NodeActionBar.tsx#L106-L133)),
which **also** opens the drag-txn bracket so the create+drag collapses to one
undo (MQA #5).

### 1.6 RECONNECT_ANCHOR — click-to-reconnect an endpoint (per-frame model write)

Entry trigger: `Cursor.mousedown` on a selected connector's **endpoint** anchor
([Cursor.ts:180-190](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L180-L190)).
Click-to-reconnect (not drag) "much more reliable on a discrete tile grid".

| Event | Rule | Cite |
|---|---|---|
| `entry` | cursor `crosshair`; **`beginDragTransaction`**. | [ReconnectAnchor.ts:5-9](../../packages/axoview-lib/src/interaction/modes/ReconnectAnchor.ts#L5-L9) |
| `mousemove` | gated by `hasMovedTile`: set the dragged anchor's `ref` to the hovered ITEM or raw tile; **`scene.updateConnector` every frame** (full model write → the same GC-cliff path as CONNECTOR, §3.5). | [L16-33](../../packages/axoview-lib/src/interaction/modes/ReconnectAnchor.ts#L16-L33) |
| `mouseup` | `isRendererInteraction` gate; `commitDragTransaction`; reselect connector; → `CURSOR`. | [L34-53](../../packages/axoview-lib/src/interaction/modes/ReconnectAnchor.ts#L34-L53) |
| `exit` | cursor `default`; `commitDragTransaction` (safety-net **commit**, not rollback). | [L10-15](../../packages/axoview-lib/src/interaction/modes/ReconnectAnchor.ts#L10-L15) |

Because the model is mutated **every frame**, there is no preserved origin to
restore — abort would require undo. See §4 D-2.

### 1.7 PLACE_ICON — click-to-place a new node

Entry trigger: ElementsPanel icon selection (`setMode PLACE_ICON`, `id=icon`).

| Event | Rule | Cite |
|---|---|---|
| `mousemove` | no-op. | [PlaceIcon.ts:11](../../packages/axoview-lib/src/interaction/modes/PlaceIcon.ts#L11) |
| `mousedown` | `isRendererInteraction` gate; only when `id` is **null**: resolve item at tile, hand off to `CURSOR` with it as `mousedownItem`, clear controls (lets the user select an existing item without placing). | [L12-29](../../packages/axoview-lib/src/interaction/modes/PlaceIcon.ts#L12-L29) |
| `mouseup` | when `id` set: `findNearestUnoccupiedTile(position.tile)` → `scene.placeIcon` (one `transaction` = createModelItem + createViewItem). Then `id=null`. | [L30-64](../../packages/axoview-lib/src/interaction/modes/PlaceIcon.ts#L30-L64) |

Boundary: placement **never overlaps** (spiral to nearest free, §2.1) — unlike
DRAG_ITEMS which refuses to preview onto a collision but has no nearest-free
fallback (§2.2). After a place, mode stays `PLACE_ICON/id=null` (next click →
CURSOR). Both `mousedown` paths are `isRendererInteraction`-gated at the top
([L13](../../packages/axoview-lib/src/interaction/modes/PlaceIcon.ts#L13)).

### 1.8 RECTANGLE.DRAW — draw a rectangle (no drag-txn ⚠)

Entry trigger: `rectangle` hotkey (`r`) → `setMode RECTANGLE.DRAW, id=null`.

| Event | Rule | Cite |
|---|---|---|
| `entry`/`exit` | cursor `crosshair` / `default`. | [DrawRectangle.ts:6-11](../../packages/axoview-lib/src/interaction/modes/Rectangle/DrawRectangle.ts#L6-L11) |
| `mousedown` | `isRendererInteraction` gate; `createRectangle({from=to=tile})`; store new id in mode. | [L25-43](../../packages/axoview-lib/src/interaction/modes/Rectangle/DrawRectangle.ts#L25-L43) |
| `mousemove` | gated by `hasMovedTile` **and** `mouse.mousedown` **and** `mode.id`: `updateRectangle(id, {to: tile})`. **No drag-txn → one history entry + one full-state immer clone per tile crossed.** | [L12-24](../../packages/axoview-lib/src/interaction/modes/Rectangle/DrawRectangle.ts#L12-L24) |
| `mouseup` | → `CURSOR`. **No min-size / no zero-area discard** — a press with no move leaves a 1×1-tile rectangle (`from===to`). | [L44-52](../../packages/axoview-lib/src/interaction/modes/Rectangle/DrawRectangle.ts#L44-L52) |

### 1.9 RECTANGLE.TRANSFORM — resize via corner anchors (no drag-txn ⚠)

Entry trigger: pressing a `TransformControls` anchor (the anchor element raises
`mousedown`; the mode itself has an empty `mousedown` —
[TransformRectangle.ts:63-65](../../packages/axoview-lib/src/interaction/modes/Rectangle/TransformRectangle.ts#L63-L65)).

| Event | Rule | Cite |
|---|---|---|
| `mousemove` | gated by `hasMovedTile`; with `selectedAnchor`, rebuild bounds from the **opposite** named corner + cursor tile via `getBoundingBox`+`convertBoundsToNamedAnchors`, `updateRectangle`. **No drag-txn → per-tile history + immer.** | [TransformRectangle.ts:12-62](../../packages/axoview-lib/src/interaction/modes/Rectangle/TransformRectangle.ts#L12-L62) |
| `mouseup` | → `CURSOR`. | [L66-74](../../packages/axoview-lib/src/interaction/modes/Rectangle/TransformRectangle.ts#L66-L74) |

Boundary: `getBoundingBox` **normalises**, so dragging a corner past the opposite
one **inverts cleanly** (no negative-size state). **No minimum size** — a
rectangle can collapse to 1×1. Anchor hit-testing is by the anchor DOM element,
not tile math (so it is screen-pixel precise, unlike connector anchors).

### 1.10 TEXTBOX — create + position (no drag-txn ⚠)

Entry trigger: `text` hotkey → `createTextBox` at `mouse.position.tile` + `setMode
TEXTBOX, id=new` ([useInteractionManager.ts:449-462](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L449-L462)).

| Event | Rule | Cite |
|---|---|---|
| `mousemove` | `updateTextBox(id, {tile})` **every move** (no `hasMovedTile` gate, no drag-txn). | [TextBox.ts:11-17](../../packages/axoview-lib/src/interaction/modes/TextBox.ts#L11-L17) |
| `mouseup` | `isRendererInteraction` → select it; **else delete it** (clicked off-canvas = cancel); → `CURSOR`. | [L18-35](../../packages/axoview-lib/src/interaction/modes/TextBox.ts#L18-L35) |

Inline edit (double-click → contentEditable) is owned by the TextBox component,
not this mode (baseline §6.5).

### 1.11 PAN — scroll; doubles as the EXPLORABLE_READONLY click surface

Entry trigger: `pan` hotkey, `usePanHandlers.startPan` (middle/right/modifier),
or `EXPLORABLE_READONLY` start mode.

| Event | Rule | Cite |
|---|---|---|
| `entry`/`exit` | cursor = `grab` (EDITABLE) / `default` (READONLY) / `default`. | [Pan.ts:65-71](../../packages/axoview-lib/src/interaction/modes/Pan.ts#L65-L71) |
| `mousemove` | if `mouse.mousedown`, add `delta.screen` to `scroll.position` (`setScroll`). | [L72-84](../../packages/axoview-lib/src/interaction/modes/Pan.ts#L72-L84) |
| `mousedown` | `isRendererInteraction`; flip cursor `grabbing` (EDITABLE only). | [L85-93](../../packages/axoview-lib/src/interaction/modes/Pan.ts#L85-L93) |
| `mouseup` | restore cursor; in `EXPLORABLE_READONLY`, **click-without-drag opens the read-only details panel** for a node with content (`handleReadonlyClick`). | [L94-104](../../packages/axoview-lib/src/interaction/modes/Pan.ts#L94-L104) |

### 1.12 INTERACTIONS_DISABLED — `NON_INTERACTIVE`

No reducer. The input effect returns before binding any mouse/touch/wheel
listener ([useInteractionManager.ts:864-865](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L864-L865)).
The rewrite **must preserve this guard** (bind no pointer listeners when
disabled).

### 1.13 Keybinding matrix (window `keydown`, [useInteractionManager.ts:647-671](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L647-L671))

Dispatch order matters — earlier handlers `return` and consume.

| Key | Action | Editable-target guard? | Cite |
|---|---|---|---|
| `Escape` | panel-clear → multi-selection-clear → connector-abort (delete in-flight). Always consumes. | runs **before** the guard | [L139-161](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L139-L161) |
| `Delete`/`Backspace` | lasso-selection → multi-selection → single `itemControls`. Lasso branch ignores the text-field guard; the other two respect it. | partial | [L186-233](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L186-L233) |
| *(all below)* | — | **skipped on INPUT/TEXTAREA/contentEditable/`.ql-editor`** | [L652](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L652) |
| Ctrl/⌘+Z / +Y / +Shift+Z | undo / redo | yes | [L289-310](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L289-L310) |
| Ctrl/⌘+X / +C / +V | cut / copy / paste | yes | [L313-335](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L313-L335) |
| Ctrl/⌘+A | select-all interactable (+ waypoints), force `CURSOR` | yes | [L660-665](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L660-L665) |
| F1 / F2 | help dialog / canvas inline-rename (F2 only `cameFromRenderer`, MQA #13) | yes | [L340-377](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L340-L377) |
| tool hotkeys `s m n r c t` (+ lasso/freehand, profile-dependent) | switch mode / open Elements / create textbox | yes | [L379-481](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L379-L481) |
| Ctrl/⌘+`]` / `[` | z-order forward / back (ITEM only) | yes | [L484-507](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L484-L507) |
| arrows / wasd / ijkl | keyboard pan (per `panSettings`) | yes | [L509-567](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L509-L567) |

The keydown effect's **dep array is a perf invariant (M-1)** — scene/layer are
read through refs to keep it stable; guarded by
[interactionManager.depStability.test.tsx](../../packages/axoview-lib/src/__perf_refactor_regression__/interactionManager.depStability.test.tsx).

---

## 2. (KR2) Algorithm contracts — rules, boundaries, per-frame cost

### 2.1 screen→tile snapping (`screenToIso` / `getMouse`)

`getMouse` derives `position.screen` = `clientX/Y − rendererEl.left/top`
(zoom-independent CSS px), then `position.tile` via the injected
`screenToTileFn` ([renderer.ts:60-100](../../packages/axoview-lib/src/utils/renderer.ts#L60-L100)).
`screenToIso` does the iso inverse with `Math.floor`, so a tile owns the
half-open region toward +x/−y ([isoMath.ts:52-77](../../packages/axoview-lib/src/utils/isoMath.ts#L52-L77)).
`mousedown` is captured on the `mousedown` event and **carried** through
`mousemove` (cleared on `mouseup`) ([renderer.ts:88-97](../../packages/axoview-lib/src/utils/renderer.ts#L88-L97)).
**Cost:** O(1) pure math, once per (RAF-throttled) event. **Boundary:** the
`getBoundingClientRect()` call per event reads layout — cheap but forces a layout
read; the rewrite keeps this.

### 2.2 Node-drag occupancy / collision (`computeNodeUpdates`)

Per `DragItems.mousemove` frame, for the dragged nodes
([DragItems.ts:81-129](../../packages/axoview-lib/src/interaction/modes/DragItems.ts#L81-L129)):

1. `target = initialTile + mouseOffset` for each dragged node (rigid translate;
   `initialTiles` captured once at drag start).
2. Build `externalOccupied` = a `Set` of `"x,y"` for every **non-dragged** model
   item (the model is stale during drag, but non-dragged items haven't moved, so
   their tiles are authoritative).
3. If **any** target hits `externalOccupied` **or** collides with another dragged
   node → **return `null` ⇒ no node moves this frame** (all-or-nothing). Cursor
   shows `not-allowed`.

**Boundary behavior:** dropping onto an occupied tile freezes the **whole group**
at its last valid preview until the cursor moves clear — there is **no
nearest-free fallback** (contrast PLACE_ICON §2.3). **Preview == committed
tile:** collision frames are skipped, so `previewTiles` always holds the last
non-colliding position, and `mouseup` commits exactly that via
`batchUpdateViewItemTiles` — never the raw cursor tile when it is over a
collision. **Cost:** O(D + E) per frame (D dragged, E external) — a fresh `Set`
of size E built every frame (≈74 entries on the 80-node stress fixture). Cheap
vs. the immer path it replaced, but a per-frame allocation the rewrite inherits.

### 2.3 `findNearestUnoccupiedTile` (PLACE_ICON commit)

Builds an occupied `Set` once (O(N)) then spirals right/down/left/up out to
`maxDistance=10`, returning the first free tile (or `null`)
([findNearestUnoccupiedTile.ts:10-56](../../packages/axoview-lib/src/utils/findNearestUnoccupiedTile.ts#L10-L56)).
A group variant (`findNearestUnoccupiedTilesForGroup`,
[L97-127](../../packages/axoview-lib/src/utils/findNearestUnoccupiedTile.ts#L97-L127))
reserves each found tile so a batch can't self-collide — **but it is currently
unused by DRAG_ITEMS** (which uses the all-or-nothing gate instead). **Cost:**
O(N + maxDistance²) ≈ O(N + 100), once per place — not a hot path.

### 2.4 Multi-select group-drag math

`resolveDragItems` returns the whole `selectedIds` when the pressed item is in a
len>1 selection, else just `[item]` ([Cursor.ts:319-328](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L319-L328)).
`collectDragInitialPositions` snapshots each member's starting tile/bounds once
([L376-390](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L376-L390));
free-floating `CONNECTOR_ANCHOR` members are seeded from their `ref.tile`
([seedAnchorTile, L335-347](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L335-L347)) —
**omitting this seed is what pinched the path** when Ctrl+A pulled waypoints in
(the inversion bug the comment records). Every member translates by the **same**
`mouseOffset`, so the group moves rigidly. **Asymmetry:** node members are
collision-gated; textbox/rectangle/anchor members are **not** — they translate
through occupied tiles freely.

### 2.5 Rectangle draw + transform constraints

Draw: `from=to` at mousedown, `to=cursor` per move; final rect is
`getBoundingBox([from,to])` at render. **No min size, no zero-area discard**
(§1.8). Transform: rebuild from the opposite named corner + cursor via
`getBoundingBox`→`convertBoundsToNamedAnchors`; **inversion normalises cleanly,
no min size** (§1.9). **Cost:** one full-state immer `produce` **per tile
crossed** (no drag-txn) — see §3.6.

### 2.6 Connector router (`getConnectorPath` + `findPath`) + anchor model

**Router** ([isoMath.ts:278-315](../../packages/axoview-lib/src/utils/isoMath.ts#L278-L315)):
resolve each anchor → tile (`getAnchorTile`), bound them
(`getBoundingBox`+`CONNECTOR_SEARCH_OFFSET`), normalise to the search-area
origin, then for each consecutive pair call `findPath`. **`findPath` is
closed-form** ([pathfinder.ts:19-34](../../packages/axoview-lib/src/utils/pathfinder.ts#L19-L34)):
step diagonally until one axis matches, then orthogonally — the A*-equivalent
answer on an obstacle-free grid, **with zero per-call allocation** (the
load-bearing §3.2 fix). `gridSize` is retained only for signature compat and
**ignored**. **Cost:** O(Σ manhattan-distance between anchors) per connector, no
heap churn.

**`getAnchorTile`** ([isoMath.ts:231-245](../../packages/axoview-lib/src/utils/isoMath.ts#L231-L245)):
`ref.item` → that item's tile (O(1) via `getItemByIdOrThrow`); `ref.anchor` →
**recurses** through `getAllAnchors` (O(total anchors), allocates a flattened
array — a sharp edge if anchor-to-anchor refs ever proliferate); `ref.tile` →
literal. **Throws** if none resolve — callers `try/catch` and mark the connector
`unroutable` ([connector.ts:37-52](../../packages/axoview-lib/src/stores/reducers/connector.ts#L37-L52)).

**Anchor hit-testing — by-id vs by-tile** ([Cursor.ts:143-168](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L143-L168)):
the overlay sets `data-anchor-id`; `processMouseUpdate` lifts it to
`mouse.targetAnchorId` ([useInteractionManager.ts:739-740](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L739-L740)).
`findClickedConnectorAnchor` prefers the **DOM id** (hit ring exceeds one tile at
low zoom) and **falls back to tile-equality** (`getAnchorHitTile`, which for
node-attached endpoints uses the path-junction tile, not the node tile, so the
handle is reachable). **Endpoint vs waypoint:** index 0 / length−1 = endpoint →
`RECONNECT_ANCHOR`; middle = waypoint → Alt-splice or drag.

**Waypoint splice (Alt+click)** ([Cursor.ts:196-212](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L196-L212)):
filter the anchor out, `updateConnector`, set module-level `altSpliceConsumed` so
the following `mouseup` skips its selection-clearing branches. Endpoints are
**never** spliceable (would drop the connector below 2 anchors and corrupt the
scene — the 2026-05-25 regression).

**Waypoint grouping:** `getConnectorWaypointRefs` returns the **middle,
tile-bound** anchors that must accompany a connector in any selection
([connectorSelection.ts:36-48](../../packages/axoview-lib/src/utils/connectorSelection.ts#L36-L48)) —
endpoints ride their nodes automatically; tile-bound waypoints don't, so omitting
them pinches multi-drag and orphans on delete (§4 invariant I-2).

### 2.7 Hit detection (`getItemAtTile`)

WeakMap tile-index keyed on the `scene.items` **array identity** — built O(N)
once per identity, O(1) lookups, GC'd when the array is replaced
([hitDetection.ts:26-95](../../packages/axoview-lib/src/utils/hitDetection.ts#L26-L95)).
Items hit via the index; **textboxes/connectors/rectangles fall through to O(N)
scans** (connectors check every path tile; rectangles scan reversed = top-most
first). **Drag interaction:** during a CSS-preview **node** drag the items array
identity is **stable** (model not written until mouseup) → the index stays warm.
During reducer-path drags (rectangle/textbox/connector/reconnect) the array is
**replaced every frame** → the index is **rebuilt O(N) per frame**, compounding
the §3.6 cost.

### 2.8 2D-vs-ISOMETRIC interaction parity (KR2 closure, added 2026-06-14)

Every mode-specific math path was traced against both projections. **Parity
holds across all interaction surfaces** — the canvas-mode split is implemented
once, in the `CoordinateTransformStrategy` pair
([coordinateTransforms.ts](../../packages/axoview-lib/src/utils/coordinateTransforms.ts)),
selected by `CanvasModeProvider` from `uiState.canvasMode`
([CanvasModeContext.tsx:60-88](../../packages/axoview-lib/src/contexts/CanvasModeContext.tsx#L60-L88)),
and both the **interaction** layer (`getMouse` ← injected mode-aware
`screenToTile`) and the **render** layer (`useIsoProjection` ← `useCanvasMode`)
consume the same strategy. Connectors route in **tile space**
(projection-independent) and are projected only at render. So a node placed/
dragged in 2D snaps and renders consistently with its hit math.

| Surface | ISO rule | 2D rule | Parity? | Cite |
|---|---|---|---|---|
| **screen→tile snap** | iso diamond inverse, whole-expr `floor` | cartesian inverse, per-axis `floor`, `+half` boundary, inverted-Y | ✅ (mode-aware via injected `screenToTile`) | [coordinateTransforms.ts:129-142 / 169-182](../../packages/axoview-lib/src/utils/coordinateTransforms.ts#L129-L182); injected at [useInteractionManager.ts:593,787,805](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L593) |
| **node drag preview (tile→px)** | `halfW(dx−dy), −halfH(dx+dy)` | `dx·T, −dy·T` | ✅ (DragItems 2D branch; fed `uiState.canvasMode`) | [DragItems.ts:44-56,328](../../packages/axoview-lib/src/interaction/modes/DragItems.ts#L44-L56) |
| **node collision** | tile-space `Set` of `"x,y"` | identical | ✅ (projection-independent) | [DragItems.ts:81-111](../../packages/axoview-lib/src/interaction/modes/DragItems.ts#L81-L111) |
| **group-drag delta** | rigid `mouseOffset` (tile) per member | identical | ✅ | [Cursor.ts:376-390](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L376-L390) |
| **rectangle draw / transform** | tile-space bounds; projected at render | same; render adds 2D top-left origin + MQA #11 Y-rotation | ✅ (mode-aware render branches) | [useIsoProjection.ts:42-88](../../packages/axoview-lib/src/hooks/useIsoProjection.ts#L42-L88) |
| **connector routing** | tile-space `findPath`; `getAnchorTile` tile-space | identical | ✅ (projection-independent) | [isoMath.ts:231-245,278-315](../../packages/axoview-lib/src/utils/isoMath.ts#L231-L315) |
| **anchor hit-testing** | DOM `data-anchor-id` first, tile-equality fallback | identical (overlay positioned mode-aware) | ✅ | [Cursor.ts:143-168](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L143-L168); [ConnectorAnchorOverlay.tsx:192,230](../../packages/axoview-lib/src/components/ConnectorAnchorOverlay/ConnectorAnchorOverlay.tsx#L192) |
| **freehand-lasso path→tiles** | injected mode-aware `screenToTile` | identical | ✅ | [FreehandLasso.ts:253-264](../../packages/axoview-lib/src/interaction/modes/FreehandLasso.ts#L253-L264) |

**Latent (non-behavioral) divergence risks for the rewrite:**
- **D-10 — duplicated tile→pixel projection math.** `DragItems.tileDeltaToPixels`
  ([DragItems.ts:44-56](../../packages/axoview-lib/src/interaction/modes/DragItems.ts#L44-L56))
  reimplements both projections' delta math instead of deriving from
  `{iso,cartesian}Strategy.toScreen`. It matches **today**, but a strategy change
  wouldn't propagate → drag preview would diverge from rendering in one mode. The
  rewrite should derive the preview delta from the active strategy.
- **D-11 — `getMouse` default `screenToTileFn = screenToIso`.**
  ([renderer.ts:67](../../packages/axoview-lib/src/utils/renderer.ts#L67)) is
  **ISO-hardcoded**; only safe because `useInteractionManager` always injects the
  mode-aware fn. Any pointer-rewrite move handler that calls `getMouse` without
  injecting silently snaps via ISO in 2D. **Rewrite invariant:** always inject
  `useCanvasMode().screenToTile`.

---

## 3. (KR3) Performance dossier — every load-bearing fix the rewrite must preserve

PERFORMANCE IS THE PRODUCT. This section catalogues, from **both** the commit
history and the code, every perf fix in the interaction/scene hot paths, the
invariant each established, the precise way a Pointer-Events rewrite of the
dispatcher could silently undo it, and the regression guard.

### 3.0 Two waves of perf work (history framing)

| Wave | Commit(s) | Date | What it produced |
|---|---|---|---|
| **A — arch-review hotspots** | `7a554ba` "perf: fix CPU/memory hotspots identified in arch review" | 2026-03-18 | `useRAFThrottle`, the direct-DOM `SceneLayer` zoom/scroll subscription, and the `__perf_refactor_regression__` suite (written *before* the refactor to lock behavior). |
| **B1 — connector drag** | `7164b3b` "connector drag transactions + closed-form router" | 2026-05-09 | `begin/commitDragTransaction` + `freezePendingPre`; the closed-form `pathfinder.ts`. |
| **B2 — MQA #7 multi-drag cliff** | `bba712c` → `728b229` → `7e09fba` → `f66d7be` | 2026-05-16 | DragItems drag-txn; Node split + `useSceneActions`; CSS-preview (`--ff-drag-*`, `previewConnectorPaths`, `batchUpdateViewItemTiles`); waypoint preview (two-writer fix). |

The `SceneLayer`/`pathfinder` files report only the 2026-05-19 folder-rename in
`git log` without `--follow` because the rename broke path continuity; `--follow`
recovers the true origins above.

### 3.1 Drag transaction (`begin`/`commitDragTransaction` + `freezePendingPre`)

- **What:** opens one history bracket and **freezes `pendingPre`** on both stores
  so per-tick `set()` calls skip `produceWithPatches`; commit consumes
  `pendingPre` and pushes **one** entry ([useSceneActions.ts:92-110](../../packages/axoview-lib/src/hooks/useSceneActions.ts#L92-L110)).
  `saveToHistoryBeforeChange` short-circuits while `dragInProgress`
  ([L77-84](../../packages/axoview-lib/src/hooks/useSceneActions.ts#L77-L84)).
- **Commit(s):** `7164b3b` (connectors + reconnect), `bba712c` (DragItems).
- **Invariant:** N per-tick model writes → **1** undo entry + **0**
  patch-generation cost mid-drag.
- **Rewrite regression risk:** if the rewrite re-enters `DRAG_ITEMS.entry` or
  fails to pair `entry`/`exit` exactly once (e.g. a pointer model that opens the
  bracket on `pointerdown` but the abort path doesn't reach `exit`), the bracket
  leaks open → `saveToHistoryBeforeChange` stays suppressed for **subsequent**
  edits, silently dropping their undo history. The **right-click-during-connector
  ⚠** path (§4 D-2) may already leak it.
- **Guard:** [connector.dragPerf.test.tsx](../../packages/axoview-lib/src/__perf_refactor_regression__/connector.dragPerf.test.tsx)
  asserts "40 ticks → exactly 1 history entry", the inverse "no txn → 40
  entries", and "pendingPre not consumed mid-drag". `DragItems.modes.test.ts`
  asserts entry-opens / exit-commits / mouseup-commits-before-setMode. **NEW
  assertion to add:** "no open drag transaction survives a mode abort"
  (`dragInProgress === false` after every exit path).

### 3.2 Closed-form connector router (`pathfinder.ts`)

- **What:** replaced A* over a freshly-allocated `PF.Grid` (W×H `Node` objects)
  **per tick** with the deterministic diagonal-then-orthogonal walker
  ([pathfinder.ts:19-34](../../packages/axoview-lib/src/utils/pathfinder.ts#L19-L34)).
- **Commit:** `7164b3b`.
- **Invariant:** connector routing allocates **nothing** per tick; cost is
  O(path length), not O(grid area) + a grid allocation.
- **Rewrite regression risk:** indirect — the rewrite doesn't touch the router,
  but if it changes drag throttling such that `getConnectorPath` runs more often
  per frame (e.g. losing the single `previewConnectorPaths` call, §3.4), the
  per-call cost compounds. Do **not** reintroduce a pathfinding library.
- **Guard:** the `< 1500ms / 40 ticks` bound in `connector.dragPerf.test.tsx`
  ([L235-257](../../packages/axoview-lib/src/__perf_refactor_regression__/connector.dragPerf.test.tsx#L235-L257))
  catches an order-of-magnitude regression (A* put this in the multi-second
  range on the same fixture).

### 3.3 Node split (position shell + memoized `NodeContent`) + `useSceneActions`

- **What:** `Node` is a thin position shell (inline `style`, module-level `sx`);
  the heavy tree is `NodeContent`, memoized on **stable primitive props**.
  Critically, `NodeContent` uses `useSceneActions()` **not** `useScene()` —
  `useScene()` subscribes shallow to `{views,…}` which **ticks every drag frame**
  and defeats the memo gate (anti-pattern A-1).
- **Commit:** `728b229`. (NodeContent renders dropped ~170 → 2 per drag.)
- **Invariant:** only the dragged nodes re-render; per-frame React commit stays
  flat. **"Don't pass `useScene()` to hot-path components"** (perf-troubleshooting
  hard rule 5).
- **Rewrite regression risk:** low directly, but if a new pointer-state field is
  threaded through a context/store that the Node subtree subscribes to, every
  Node re-renders per frame again. Keep `pointerType` etc. **out** of any slice
  the SceneLayers subscribe to.
- **Guard:** [connector.renderIsolation.test.tsx](../../packages/axoview-lib/src/__perf_refactor_regression__/connector.renderIsolation.test.tsx),
  [useScene.referenceStability.test.tsx](../../packages/axoview-lib/src/__perf_refactor_regression__/useScene.referenceStability.test.tsx),
  [expandableLabel.selectorConsolidation.test.tsx](../../packages/axoview-lib/src/__perf_refactor_regression__/expandableLabel.selectorConsolidation.test.tsx).
  The `?perfprobe=1` render-count probe ([renderProbe.ts](../../packages/axoview-lib/src/utils/renderProbe.ts))
  is the manual check.

### 3.4 CSS-only drag preview (`--ff-drag-dx/dy`, `previewConnectorPaths`, `batchUpdateViewItemTiles`)

- **What:** during a node drag the **model is not written**. Node position moves
  via CSS variables on `[data-drag-id]` elements (compositor-only — no React, no
  immer, no layout); connector geometry is recomputed against a **synthetic
  view** and written straight to `scene.connectors[].path` via
  `previewConnectorPaths`, wrapped in **`flushSync`** so wires don't lag the nodes
  by a frame (anti-pattern A-5). Node tiles commit once on `mouseup` via
  `batchUpdateViewItemTiles` ([DragItems.ts:58-129](../../packages/axoview-lib/src/interaction/modes/DragItems.ts#L58-L129),
  [useSceneActions.ts:130-290](../../packages/axoview-lib/src/hooks/useSceneActions.ts#L130-L290)).
- **Commit:** `7e09fba` (Path 4-true — cliff 19s → **0s**).
- **Invariants (contract — perf-troubleshooting §"Key invariants"):**
  (a) `view.items[].tile` + `view.connectors[].anchors[].ref.tile` are **stale
  until mouseup**; (b) live node position lives **only** in the
  `--ff-drag-dx/dy` DOM vars; (c) live connector geometry lives **only** in
  `scene.connectors[].path`; (d) `data-drag-id` **is part of the contract** —
  removing it breaks DOM targeting; (e) **one** `previewConnectorPaths` call per
  frame covering items **and** waypoints.
- **Rewrite regression risk (HIGH):** this is the most fragile invariant set.
  - The rewrite **must keep writing `--ff-drag-dx/dy` to `[data-drag-id]`** for
    the `mouse` branch **and** reuse it for the touch "carrying" affordance
    (ADR 0018 Decision 4 explicitly reuses this path). A naive rewrite that moves
    nodes by writing the model per pointermove **reinstates the cliff**.
  - `flushSync` must stay around the preview write; dropping it brings back the
    one-frame connector lag (A-5).
  - If touch drag routes through a **different** code path than `DragItems`, it
    must replicate (b)–(e) or it won't get the perf — and worse, two writers to
    `scene.connectors[].path` per frame reintroduce the A-4 flicker.
- **Guard:** **GAP — no unit/e2e perf test asserts the CSS-preview path.**
  `drag-collision.spec.ts` / `multi-select-drag*.spec.ts` assert **final**
  positions, not that the model stayed unwritten mid-drag. **NEW assertion to
  add:** a test that, mid-drag, `view.items[].tile` is unchanged while
  `[data-drag-id]` carries non-zero `--ff-drag-*` (proves the model isn't being
  written per frame).

### 3.5 Waypoint preview — one source of truth per frame (two-writer fix)

- **What:** waypoint-anchor drags route through `previewConnectorPaths`' synthetic
  view (a second `Map` arg) instead of `scene.updateConnector`, eliminating the
  race where `updateConnector → syncConnector` recomputed the path from **stale
  model items** and stomped the preview (anti-pattern A-4)
  ([DragItems.ts:135-150,242-244](../../packages/axoview-lib/src/interaction/modes/DragItems.ts#L135-L150),
  [useSceneActions.ts:202-290](../../packages/axoview-lib/src/hooks/useSceneActions.ts#L202-L290)).
- **Commit:** `f66d7be`.
- **Invariant:** exactly **one** writer to `scene.connectors[id].path` per frame
  (perf-troubleshooting hard rule 3).
- **Rewrite regression risk:** if the touch/pen path drags a waypoint via the
  reducer (`updateConnector`) while the preview path also runs, the flicker
  returns. Keep waypoint moves on the preview path.
- **Guard:** **GAP — no automated test for the two-writer race** (it was caught
  by manual diagnostics). Visual-only today.

### 3.6 The drag-txn **gap** modes (rectangle / transform / textbox) ⚠

- **What (a perf liability the rewrite should NOT widen):** `RECTANGLE.DRAW`,
  `RECTANGLE.TRANSFORM`, and `TEXTBOX` move call `updateRectangle`/`updateTextBox`
  **per tile-crossing with no `beginDragTransaction`** (§1.8–§1.10). Each call
  runs `saveToHistoryBeforeChange` (a full-graph `saveToHistory`) **and** a
  full-state immer `produce` ([useSceneActions.ts:531-543](../../packages/axoview-lib/src/hooks/useSceneActions.ts#L531-L543)).
  So drawing/resizing across K tiles = **K history entries + K full-state
  clones**, and (via §2.7) **K rebuilds of the hit-index**.
- **Why it hasn't bitten:** these are single-item gestures; the DragItems comment
  calls their per-tick cost "negligible" vs. the 6-node case. True per-frame,
  false for undo: dragging a rectangle 10 tiles leaves ~10 undo steps (§4 D-3).
- **Rewrite obligation:** the px-slop threshold (ADR 0018 Decision 5) will make
  these gestures emit **more** intermediate updates than the whole-tile gate did
  (sub-tile moves now count). Without wrapping them in a drag-txn the history
  bloat and per-frame immer get **worse**. The rewrite should bring these into
  the drag-transaction set.
- **Guard:** **GAP** — no perf test; `rectangle-*`/`textbox-*` specs assert final
  geometry only.

### 3.7 RAF throttle (`useRAFThrottle`)

- **What:** coalesces `mousemove` to **one** processed update per animation frame
  (latest-wins); `mousedown`/`mouseup` flush immediately
  ([useRAFThrottle.ts](../../packages/axoview-lib/src/interaction/useRAFThrottle.ts),
  wired at [useInteractionManager.ts:808-819](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L808-L819)).
- **Commit:** wave A (`7a554ba`).
- **Invariant:** mode `mousemove` reducers run **≤ once per frame**, no matter the
  device's pointermove rate (a 1000Hz pen would otherwise run the router 1000×/s).
- **Rewrite regression risk (HIGH):** `pointermove` can fire far denser than
  `mousemove` (coalesced native events, high-rate pens). The rewrite **must keep
  every `pointermove` on the RAF throttle** and **flush on `pointerdown`/`up`/
  `cancel`**. Dropping the throttle uncaps the per-frame work and re-opens the
  cliff regardless of §3.4. The e2e harness's per-event `requestAnimationFrame`
  await ([CanvasPOM.ts:82-106](../../packages/axoview-e2e/pom/CanvasPOM.ts#L82-L106))
  **depends** on this throttle existing — it must be preserved for pointer
  dispatch.
- **Guard:** [useRAFThrottle.cleanup.test.ts](../../packages/axoview-lib/src/__perf_refactor_regression__/useRAFThrottle.cleanup.test.ts)
  (RAF cancelled + no stale callback after cleanup). **GAP:** no test asserts
  `pointermove` is actually throttled (the unit test covers cleanup, not the
  coalescing-under-load contract). **NEW assertion to add** once pointer lands.

### 3.8 Direct-DOM zoom/scroll subscriptions (bypass React render)

- **What:** `SceneLayer` subscribes to `uiStateStore` and writes
  `transform: translate(...) scale(zoom)` **directly to the DOM ref**, never
  re-rendering React on pan/zoom ([SceneLayer.tsx:16-37](../../packages/axoview-lib/src/components/SceneLayer/SceneLayer.tsx#L16-L37)).
  Two dependents copy the pattern: **NodeActionBar §8.8** counter-scales
  `scale(1/zoom)` so the bar stays screen-pixel-stable
  ([NodeActionBar.tsx:75-88](../../packages/axoview-lib/src/components/NodeActionBar/NodeActionBar.tsx#L75-L88));
  **ExpandableLabel §8.9** publishes `--axoview-label-scale`
  (`computeLabelCounterScale`, [labelScale.ts](../../packages/axoview-lib/src/utils/labelScale.ts)).
- **Commit:** wave A (`7a554ba`) for `SceneLayer`; §8.8/§8.9 layered later
  (NodeActionBar in the v1.1 window; label-scale in `e5844e1` Phase 6).
- **Invariant:** **pan and zoom never trigger a React render of the scene tree.**
  At 60fps a wheel-zoom or momentum-pan would otherwise re-render every node.
- **Rewrite regression risk:** the rewrite owns **touch pan** (ADR 0018 — the
  canvas must pan itself once `touch-action:none` is set). If touch-pan updates
  `scroll` via a path that **also** triggers React render (e.g. routing scroll
  through a component's state instead of `setScroll` → the store subscription),
  it bypasses this optimization. Touch-pan **must** drive `uiState.scroll`
  through the same store the `SceneLayer` subscription reads, exactly as
  `Pan.mousemove` does ([Pan.ts:72-84](../../packages/axoview-lib/src/interaction/modes/Pan.ts#L72-L84)).
  Likewise pinch-zoom (deferred) must go through `setZoom`/`setScroll`.
- **Guard:** [rendererSize.sharedObserver.test.tsx](../../packages/axoview-lib/src/__perf_refactor_regression__/rendererSize.sharedObserver.test.tsx),
  [labelScale.test.ts](../../packages/axoview-lib/src/utils/__tests__/labelScale.test.ts),
  [readable-labels.spec.ts](../../packages/axoview-e2e/tests/readable-labels.spec.ts).
  **GAP:** no test asserts "pan/zoom causes zero scene re-renders" — it's a
  render-probe manual check.

### 3.9 Hit-index + occupied-set micro-optimizations

`getItemAtTile`'s WeakMap index (§2.7) and `findNearestUnoccupiedTile`'s
occupied-`Set` (§2.3) both replaced O(N)-per-probe scans. **Rewrite risk:** none
directly; just don't add a per-pointermove caller that defeats the index by
re-deriving items. **Guard:** [findNearestUnoccupiedTile.test.ts](../../packages/axoview-lib/src/utils/__tests__/findNearestUnoccupiedTile.test.ts).

### 3.10 The OPEN GC cliff — must not be worsened (known_issues.md)

A sustained (≥50s, no commit) connector drag / anchor reconnect still climbs to
~336MB and stalls ~5s at ~4fps before a stop-the-world GC
([known_issues.md "Connector drag still mutates the model on every tile"](../../known_issues.md)).
Root cause: `CONNECTOR.mousemove` and `RECONNECT_ANCHOR.mousemove` call
`scene.updateConnector` **every frame**, which runs `produce(state)` over the
whole model + a nested `produce` in `syncConnector`
([connector.ts:58-84](../../packages/axoview-lib/src/stores/reducers/connector.ts#L58-L84)) —
~100–200KB/clone, ~12MB/s at 60fps. The drag-txn (§3.1) removed the *patch* cost
but not the *clone* cost. **The rewrite must not worsen this:** keep these two
modes' per-frame writes no more frequent than today (RAF-throttled, §3.7), and
ideally route them through the §3.4 preview path (the deferred refactor #3 design
in known_issues.md) — but that is a **separate** session, not the Pointer-Events
work. If the rewrite changes throttling or adds a second per-frame writer, the
cliff arrives sooner.

### 3.11 How to measure the rewrite against the existing baseline

The existing perf baseline is
[connector.dragPerf.test.tsx](../../packages/axoview-lib/src/__perf_refactor_regression__/connector.dragPerf.test.tsx)
+ the 80-node/120-connector
[perf-stress-diagram.json](../../packages/axoview-lib/src/__perf_refactor_regression__/fixtures/perf-stress-diagram.json)
fixture (schema-validated on load). It exercises the **scene-action layer
directly** (no DOM), so it is **device-agnostic and survives the pointer
rewrite unchanged** — run it before/after as the correctness+timing anchor for
§3.1/§3.2. For the §3.4/§3.7 invariants there is **no automated perf test**;
measure them with the `DiagnosticsOverlay` (`localStorage axoview_perf_enabled`)
+ `?perfprobe=1` render probe on the same fixture, per the
[perf-troubleshooting diagnostic pyramid](../perf-troubleshooting.md). Flag for a
**runtime** measurement, not a fabricated number: drive a real
`page.mouse`/pointer drag of 6 nodes + 3 connectors for 5s and confirm sustained
FPS ≥ the 24–44 band `7e09fba` established, with ≤1 Major GC.

### 3.12 (KR5) Live perf-baseline capture — status + the documented floor (2026-06-14)

**Live FPS capture: BLOCKED — two independent reasons, recorded honestly rather
than fabricated (per session guardrail).**

1. **Environment.** The running dev server (`:3000`) fails module resolution —
   `Cannot find module 'axoview'` (rsbuild's resolver desynced; the
   build:lib→restart friction). It serves only the HTML shell; the app never
   mounts, so `window.__axoview__` / the `DiagnosticsOverlay` are unreachable.
   **Unblock:** `npm run build:lib && npm run dev` (restart — rebuild alone does
   not re-sync rsbuild). Not done here: restarting the user's running server is an
   intrusive change to their environment, made only on request.
2. **Methodology (the deeper limit).** Even with the app up, an **interactive FPS
   floor cannot be authentically captured headlessly.** Synthetic
   `page.mouse`/dispatch drags await a `requestAnimationFrame` per event and are
   paced by the Playwright IPC roundtrip
   ([CanvasPOM.ts:82-106](../../packages/axoview-e2e/pom/CanvasPOM.ts#L82-L106)),
   so the overlay's FPS reflects the **automation cadence**, not interactive
   rendering. Presenting that as a "perf floor" would mislead. An authentic FPS
   floor needs a **human** interactive drag + DevTools — outside this session.
   *(Heap/peak/GC during a sustained driven drag **is** real signal — each
   processed move does the real per-frame allocation — but it requires the
   fixture loaded with a proper scene sync, which reason (1) blocks.)*

**The documented pre-rewrite floor (real, dated, provenance-cited).** Until an
interactive capture is taken, the rewrite is measured against these existing
**real** numbers, not a fresh headless one:

| Metric | Value | Source / provenance |
|---|---|---|
| Multi-drag FPS band (6-node, CSS-preview path) | **24–44 fps sustained** | commit `7e09fba` "Path 4-true" manual measurement (cliff 19s→0s) — §3.4 |
| Connector-drag / anchor-reconnect GC cliff (≥50s, no commit) | **~336 MB peak, ~5 s stop-the-world stall, ~4 fps** before GC | [known_issues.md](../../known_issues.md) — the OPEN cliff (§3.10) |
| Scene-action drag timing (device-agnostic, survives the rewrite) | **<1500 ms / 40 ticks** | [connector.dragPerf.test.tsx:235-257](../../packages/axoview-lib/src/__perf_refactor_regression__/connector.dragPerf.test.tsx#L235-L257) — §3.2 |
| Fixture under test | **80 nodes / 120 connectors / 0 textboxes** | [perf-stress-diagram.json](../../packages/axoview-lib/src/__perf_refactor_regression__/fixtures/perf-stress-diagram.json) (verified counts) |

**Capture method when the app is up (for whoever takes the interactive reading):**
dev auto-enables the overlay (`IS_DEV` → always on,
[DiagnosticsOverlay.tsx:32,685](../../packages/axoview-app/src/components/DiagnosticsOverlay.tsx#L32));
load the fixture via the app's normal load path (so `SYNC_SCENE` computes
connector paths — injecting `model` via `window.__axoview__` alone leaves
`scene.connectors[].path` empty); run the three canonical drags (6-node multi-
drag, long connector drag, anchor reconnect); export **↓ AI**
(`buildAi`, compact arrays) and read `fps`/`hu`(heap MB)/`gc` events. Launch
Chromium with `--enable-precise-memory-info` for accurate `hu`.

**Pinch-zoom (deferred) + the §3.8 direct-DOM invariant — CONFIRMED.** Wheel-zoom
already routes through `setZoom`/`setScroll` so the `SceneLayer` direct-DOM
subscription updates without a React render. **Pinch-zoom is absent today** (no
`gesturestart`/two-pointer handler in the interaction layer; grep-confirmed).
When added, it **must** route through `setZoom`/`setScroll` exactly like
wheel-zoom and `Pan.mousemove` ([Pan.ts:72-84](../../packages/axoview-lib/src/interaction/modes/Pan.ts#L72-L84)) —
**no implementation in this session**, only the invariant recorded.

---

## 4. (KR4) Cross-mode consistency + invariants register

### 4.1 Selection invariants (checked against every mode)

- **I-1 `isItemInteractable`** (locked/hidden = non-interactive, ux-principles
  §4.3). Built in `processMouseUpdate` ([useInteractionManager.ts:723-725](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L723-L725))
  and consulted by: `Cursor.mousedown` (✓), `Lasso`/`FreehandLasso` bounds (✓),
  `onContextMenu` (✓ [L843-848](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L843-L848)),
  Ctrl+A (✓ `makeInteractableCheck`). **Every new selection path the rewrite adds
  (tap-to-select) MUST consult it** — a path that skips it is the bug.
- **I-2 `getConnectorWaypointRefs`** (a connector carries its tile-bound
  waypoints, ux-principles §4.4 / ADR 0006). Consulted by Lasso, FreehandLasso,
  Ctrl+A, and Cursor's Ctrl+click group-toggle. Tap-to-select of a connector on
  touch **must** pull waypoints too, or multi-drag pinches the path.
- **I-3 single-source selection** (ADR 0006): `selectedIds.length===1 ⇔
  itemControls` mirrors it. Touch SELECT must go through `setSelectedIds` /
  `setItemControls`, not a new slice.

### 4.2 Abort / cancel — the prime divergence surface

What happens to an **in-flight** gesture on Escape, right-click-under-threshold,
and (today: absent) pointercancel. **Confirmed from code; transaction-leak items
are ⚠ RUNTIME-VERIFY.**

| In-flight mode | Escape | Right-click < threshold | "Restore origin"? |
|---|---|---|---|
| `CONNECTOR` draw | **aborts** — `deleteConnector` + reset ([useInteractionManager.ts:111-135](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L111-L135)) | switches to CURSOR (`restoreModeAfterRightClick`) but **does NOT delete** the half-made connector and **⚠ leaves the drag-txn open** ([usePanHandlers.ts:212-238](../../packages/axoview-lib/src/interaction/usePanHandlers.ts#L212-L238)) | partial (Esc only) |
| `DRAG_ITEMS` | **does NOT abort** — Esc clears panel/selection; mode persists; next mouseup commits the move | **does NOT abort** — right button consumed by pan handler, drag continues | only via the `exit` path (mode change), and only for **nodes** (CSS preview discarded); textbox/rect/anchor **commit** (D-2) |
| `RECONNECT_ANCHOR` | **does NOT abort** — model already mutated per frame; stuck in mode until a mouseup | **does NOT abort** cleanly (`restoreModeAfterRightClick` has no branch → stays in mode) | **no** — origin overwritten each frame; only undo restores |
| `RECTANGLE.DRAW` | **does NOT abort** — rectangle persists | **does NOT abort** (under-threshold has no RECTANGLE.DRAW branch) | **no** |
| `RECTANGLE.TRANSFORM` | **does NOT abort** | **does NOT abort** | **no** |
| `LASSO`/`FREEHAND` | clears `selectedIds` if set; mode persists | resets the lasso to a clean state | n/a (no item moved) |
| `PLACE_ICON` | no effect | stays in PLACE_ICON | n/a |
| `TEXTBOX` | no effect on the mode | no specific handling | n/a |

**Register entries:**

- **D-1 — Only `CONNECTOR` draw has a real Escape-abort.** Every other mutating
  mode ignores Escape. This is the "right-click-to-cancel-drag (and Escape)"
  inconsistency the brief flagged: confirmed, broad.
- **D-2 — There is no `rollbackDragTransaction`.** `useSceneActions` exposes only
  `begin`/`commit` ([L92-110](../../packages/axoview-lib/src/hooks/useSceneActions.ts#L92-L110));
  every `exit` safety-net **commits**. Node CSS-preview drags abort-to-origin
  *by accident* (preview discarded, model never written); reducer-path drags
  (reconnect/rectangle/textbox) **commit in place** on the same exit. So ADR 0018
  Decision 6 ("pointercancel / 2nd finger → node stays at origin") is satisfiable
  **only** for the CSS-preview node carry; a uniform "cancel restores origin"
  needs a **new rollback primitive** the codebase lacks. Surfaced in §5.
- **D-3 — Undo grouping diverges by mode.** Grouped (1 entry): `DRAG_ITEMS`,
  `CONNECTOR`, `RECONNECT_ANCHOR`, NodeActionBar "Add connection". **Not grouped
  (N entries, one per tile)**: `RECTANGLE.DRAW`, `RECTANGLE.TRANSFORM`, `TEXTBOX`
  move (§3.6). User-visible: undo after a rectangle resize steps one tile at a
  time. The px-slop threshold (Decision 5) makes this worse.
- **D-4 — ⚠ Right-click during `CONNECTOR`/`RECONNECT` may leak the drag
  transaction** (D-2 + §3.1). RUNTIME-VERIFY: confirm `dragInProgress` after a
  right-click-cancel of an in-flight connector. If it leaks, subsequent edits
  lose undo history until the next `commit`.
- **D-5 — Mid-drag tool-hotkey is an undocumented partial-abort.** Pressing a
  tool key (e.g. `r`) during a `DRAG_ITEMS` node drag calls `setMode`, whose next
  mouse event runs `DragItems.exit` → nodes snap back, rectangles/textboxes
  commit (same split as D-2). Not a designed gesture; works by side effect.

### 4.3 Context-menu (NodeActionBar) — invocation + dismissal + the touch gap

- **Single opener.** `setItemActionBarOpen(true)` is called from **exactly one
  site**: `onContextMenu` ([useInteractionManager.ts:857](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L857)),
  i.e. a **`contextmenu` (right-click) on an interactable item**. The render gate
  is `EDITABLE && itemActionBarOpen && itemControls && type∉{ADD_ITEM,
  CONNECTOR_ANCHOR} && mode≠DRAG_ITEMS`
  ([UiOverlay.tsx:306-317](../../packages/axoview-lib/src/components/UiOverlay/UiOverlay.tsx#L306-L317)).
- **Right-click sequencing** (browser order down→up→contextmenu): rmousedown is
  consumed and arms `rightDownRef`/`previousModeTypeRef`
  ([usePanHandlers.ts:160-172](../../packages/axoview-lib/src/interaction/usePanHandlers.ts#L160-L172));
  rmouseup `handleRightButtonUp` — **item under cursor → do NOT deselect** (let
  `contextmenu` open the bar); **empty → deselect** + restore mode
  ([L240-278](../../packages/axoview-lib/src/interaction/usePanHandlers.ts#L240-L278)).
  `RIGHT_DRAG_THRESHOLD=4px` distinguishes deselect (under) from pan (over).
- **Dismissal:** Escape (panel-clear branch), left-click elsewhere
  (`setItemControls(null)`), or entering `DRAG_ITEMS` (render gate). The bar is
  per-item; multi-selection (`length≠1`) closes it (ADR 0006 I-3).
- **D-6 — TOUCH HAS NO PATH TO THE ACTION BAR.** Touch/pen have **no right-click**
  → no `contextmenu` → `setItemActionBarOpen(true)` is unreachable. ADR 0018
  Decision 6 **rejects** long-press-to-grab and Decision 7.3 **`preventDefault`s
  `contextmenu`** (incl. during grab) — so even the long-press `contextmenu` some
  platforms emit is suppressed. The bar is the **only** affordance for: assign
  layer, bring-forward/send-back (also `Ctrl+]`/`[` — keyboard-only),
  start-connector-from-node (also click-mode connector tool), and the
  edit-name/style/notes/link shortcuts. **On a touch-only device these canvas
  actions are unreachable.** This is a **Decision-level gap**, not an impl-note
  one → surfaced for review in §5, **not resolved here**.

### 4.4 Commit-vs-discard summary

| Mode | Commit trigger | Discard trigger |
|---|---|---|
| CURSOR | mouseup (selection write) | — |
| DRAG_ITEMS | mouseup (`batchUpdate` + `commitDragTransaction`) | `exit` discards **node** preview (not committed); textbox/rect/anchor already committed |
| RECTANGLE.DRAW/TRANSFORM | per-frame `updateRectangle` | none (no discard; abort leaves last state) |
| CONNECTOR | 2nd click / drag mouseup | Escape (`deleteConnector`) |
| RECONNECT_ANCHOR | per-frame + mouseup commit | none (per-frame writes stick) |
| PLACE_ICON | mouseup (`placeIcon`) | mousedown with `id` null (hand-off, no place) |
| TEXTBOX | per-frame; select on mouseup | mouseup off-canvas → `deleteTextBox` |
| LASSO/FREEHAND | mouseup (mirror selectedIds) | empty drag → CURSOR |

### 4.5 Undo/redo is TWO independent patch stacks — the dual-stack contract (added 2026-06-14)

Node and connector drags do not write one history stack — they write **two**:
`modelStore.history` (node tiles, connector **anchors**, rectangles, textbox
model) and `sceneStore.history` (connector **paths** + scene textboxes). Each is
an immer patch stack ([modelStore.tsx:74-116](../../packages/axoview-lib/src/stores/modelStore.tsx#L74-L116),
[sceneStore.tsx:72-116](../../packages/axoview-lib/src/stores/sceneStore.tsx#L72-L116)).
`useHistory.undo/redo` drives **both**, "model first then scene", each
**independently gated** by its own `canUndo/canRedo`
([useHistory.ts:66-96](../../packages/axoview-lib/src/hooks/useHistory.ts#L66-L96));
`canUndo = modelCanUndo || sceneCanUndo`. A drag transaction calls
`saveToHistory`+`freezePendingPre` on **both** at `begin` and `set({},true)` on
**both** at `commit`, so a gesture that changes both stores pushes one paired
entry per stack ([useSceneActions.ts:92-110](../../packages/axoview-lib/src/hooks/useSceneActions.ts#L92-L110)).

**Two historical bugs this caused (both FIXED, both guarded):**

- **MQA #5 — scene undo/redo *direction*** (`0a8869a`, 2026-05-15). The scene
  store recomputed future-stack patches with
  `produceWithPatches(current, applyPatches(current, inversePatches))` — patches
  in the **wrong direction** (B→A, not A→B). `model.redo` restored
  `views[].connectors` but `scene.redo` never re-populated `scene.connectors[id]`
  → **connector present in the model but with an empty path = invisible, and the
  redo button disabled.** Fixed by mirroring the model store: undo pushes the
  **original** entry to `future`, `entry.patches` always travel pre→post
  ([sceneStore.tsx:60-116](../../packages/axoview-lib/src/stores/sceneStore.tsx#L60-L116)).
  Guarded by [connector.createUndoRedo.test.tsx](../../packages/axoview-lib/src/__perf_refactor_regression__/connector.createUndoRedo.test.tsx)
  (asserts `canRedo()===true` and the connector reappears on **both** stores).
- **Connector drag-mode redo** (`1f823f8`, 2026-05-15). NodeActionBar
  "Add connection" created the connector **without** `beginDragTransaction`, so
  every tile crossed became its own entry. Fixed by opening the bracket in
  `handleStartConnector` ([NodeActionBar.tsx:115-122](../../packages/axoview-lib/src/components/NodeActionBar/NodeActionBar.tsx#L115-L122)).

**D-7 — ✅ CONFIRMED LIVE BUG (2026-06-14): stack-depth SKEW re-creates the
MQA #5 *symptom* class via a different mechanism.** On `commit`, if a store didn't actually change,
`produceWithPatches` yields **0 patches** and the no-op branch returns **without
pushing an entry and without clearing `future`**
([sceneStore.tsx:160-162](../../packages/axoview-lib/src/stores/sceneStore.tsx#L160-L162),
[modelStore.tsx:168-170](../../packages/axoview-lib/src/stores/modelStore.tsx#L168-L170)).
So a **lone-node drag or a place-icon (model-only)** pushes a **model** entry but
**no scene** entry → the two stacks drift to different depths. Because
`useHistory` steps them in lockstep with independent gating, after the stacks
skew an undo/redo keystroke can pop a **scene** entry that does **not** correspond
to the **model** entry popped by the same keystroke. Worked example:

```
draw connector   → model.past=[c]   scene.past=[c']      (both changed)
place icon        → model.past=[c,p] scene.past=[c']      (model-only; scene no-op)
Ctrl+Z (one undo) → model.undo pops p (icon reverts)
                    scene.canUndo? yes(1) → scene.undo pops c'  ← reverts the
                    connector PATH, while model still holds connector c's anchors
result: connector in model, scene.connectors[c].path stale/empty = MQA #5 symptom
```

The shipped e2e ([undo-redo-cross-cutting.spec.ts:59](../../packages/axoview-e2e/tests/undo-redo-cross-cutting.spec.ts#L59))
only exercises the **aligned** order (`place → place → connector → undo×3`, both-store
op **last**), where the skew is benign. The hazardous order (**both-store op, then
model-only op, then undo**) is **unguarded**. A sibling vector: after an undo
populates `future`, a model-only commit clears **model** `future` but a no-op
**scene** commit leaves **scene** `future` populated → a later redo can replay a
stale scene entry.

**VERDICT — reproduced on real stores.** The committed refute-test
([undo.dualStackSkew.test.tsx](../../packages/axoview-lib/src/__perf_refactor_regression__/undo.dualStackSkew.test.tsx))
drives the hazardous order through the **real** `useHistory` coordinator (the
actual Ctrl+Z path) and confirms both legs:
1. *Skew source* — `placeIcon` (model-only) pushes a model entry but the scene
   `set` hits the no-op branch and pushes **nothing** → `model.past=2,
   scene.past=1` (asserted).
2. *Incoherence* — after **one** `useHistory.undo()`, the icon reverts (model
   pops `p`) **and the same keystroke pops the scene connector entry** (`scene`
   pops `c'`), leaving `new-conn` in `model.views[].connectors` while
   `scene.connectors['new-conn']` is `undefined` = the MQA #5 invisible-connector
   symptom (asserted). A second undo and the redos heal, so the broken window is
   the **intermediate** state after the first of two undos — exactly where a user
   stops and sees an orphaned/invisible connector.

**Severity:** P0 undo-coherence bug, independent of (and pre-dating) the
Pointer-Events rewrite — but the rewrite makes drags (hence paired commits) the
hot path, so it raises the odds of hitting the hazardous interleave.

**Why it is NOT fixed in this session:** the fix is **not store-local** (both
stores are individually correct — `connector.createUndoRedo.test.tsx` still
passes). The bug is in the *coordination*: `useHistory.undo/redo` steps the top
of each stack independently, but the stacks have skewed to different depths, so
one keystroke pops two entries that belong to **different** logical actions. Per
the session guardrail (store-local fix only), it is documented and locked behind
a characterization test; the corrected-behavior assertion ships **`it.skip`**ped
in the same file, ready to unskip when the fix lands.

**Minimal-fix design (for authorization — do NOT implement without sign-off):**
*logical-action sequence stamping.* All writes converge on each store's `set()`,
which is the natural stamping point. (a) Add a monotonic counter shared by both
stores; every history entry a `set()` pushes is stamped with the current logical
sequence. (b) A logical action allocates **one** sequence at its boundary
(`beginDragTransaction` / `transaction` start / a standalone `set`), and both
stores' commits for that action stamp the **same** value. (c) `useHistory.undo`
computes `target = max(modelTopSeq, sceneTopSeq)` and undoes **only** the
stack(s) whose top equals `target` (redo symmetric with `min` of future tops).
This guarantees one keystroke reverts exactly one logical action across whichever
store(s) participated, eliminating the skew pop. It spans `useHistory` + both
stores + `useSceneActions` (seq allocation) → cross-cutting, hence the
authorization gate. The doc's long-term "unify into one transaction log"
(§4.5 rewrite invariants) subsumes this but is a larger change; the stamping
design is the minimal coherent fix.

**KR3 residual undo/redo vectors (closed 2026-06-14):**
- **(a) `MAX_HISTORY_SIZE=50` trim × skew — HAZARD (sub-case of D-7, same fix).**
  Each store trims independently (`newPast.shift()` at 50,
  [modelStore.tsx:176-177](../../packages/axoview-lib/src/stores/modelStore.tsx#L176-L177),
  [sceneStore.tsx:168-169](../../packages/axoview-lib/src/stores/sceneStore.tsx#L168-L169)).
  With D-7 skew the two stacks reach 50 at different times, so they trim
  **different oldest entries** — the same model/scene desync can therefore also
  manifest at the **bottom** of a >50-entry session, not only at the top. No new
  mechanism; the sequence-stamping fix resolves it. Repro = D-7's, at depth.
- **(b) paste `computePathsAsync` grouping — COHERENT grouping, but a DISTINCT
  HAZARD (D-8).** Grouping is correct: the whole paste is one `transaction` → one
  entry per store ([useSceneActions.ts:814-828](../../packages/axoview-lib/src/hooks/useSceneActions.ts#L814-L828)),
  and the async path writes with `skipHistory=true` → **no** extra entry
  ([L794](../../packages/axoview-lib/src/hooks/useSceneActions.ts#L794)). BUT
  `createConnector(…, skipPathfinding=true)` records a **provisional empty path**
  in the scene history entry
  ([connector.ts:101-108](../../packages/axoview-lib/src/stores/reducers/connector.ts#L101-L108)),
  and `computePathsAsync` fills real paths **outside** history. So **paste → undo
  → redo** re-applies the recorded patch and restores connectors with **empty
  paths** — nothing recomputes on redo → invisible pasted connectors until a
  later edit touches them. **D-8.** Repro: paste a selection containing
  connectors, `Ctrl+Z`, `Ctrl+Y` → pasted connectors render pathless.
- **(c) cross-view (page-switch) undo/redo — HAZARD (D-9).** `changeView` rebuilds
  the scene **per current view** via `SYNC_SCENE` + `set(scene, true)`
  (skipHistory) and **does not clear or scope history**
  ([useView.ts:17-29](../../packages/axoview-lib/src/hooks/useView.ts#L17-L29);
  `clearHistory` runs only on initial data load,
  [useInitialDataManager.ts:150](../../packages/axoview-lib/src/hooks/useInitialDataManager.ts#L150)).
  The scene store holds only the current view, but the scene **history stack is
  global**. Undoing after a page switch applies the previous view's scene patches
  to the **current** view's scene: a `replace` patch for a connector absent from
  the current view injects a **phantom/stale** `scene.connectors[id]`, while the
  model undo reverts an **off-screen** view. Code-traced (not test-confirmed).
  Repro: edit a connector on page 1 → switch to page 2 → `Ctrl+Z` → page 2 shows
  a phantom connector and page 1's model silently reverts.

**Rewrite invariants (load-bearing):**
- **Symmetry on every path.** `begin`/`commit` (and any new abort/rollback) must
  touch **both** stores or **neither** — a leaked `freezePendingPre` or a
  one-store commit reintroduces MQA #5 *directly* (ties to **D-4** txn-leak). The
  pointer rewrite's abort branch is the new risk surface.
- **Don't desync the gating.** If the rewrite changes how a gesture decides which
  store(s) to write, it widens or narrows the D-7 skew. Ideally the rewrite (or a
  follow-on) unifies the two stacks behind one transaction log so undo/redo can't
  skew — but that is **out of scope** for the Pointer-Events work; flag it, don't
  fold it in.

### 4.6 (KR4) Pointer-capture-sensitive surfaces (added 2026-06-14)

These are the surfaces the future `setPointerCapture` (ADR 0018) must not
conflict with. **Live-pointer confirmation was BLOCKED** (the dev server fails
`Cannot find module 'axoview'`, §3.12) — but each is a **deterministic
event-handling contract verified at the code level**, which is authoritative for
`stopPropagation` / capture semantics (a click dispatch only re-confirms what the
handler already decides). Each holds today; each note flags the rewrite risk.

| Surface | Mechanism (cite) | Works because | Breaks under X (rewrite watch) |
|---|---|---|---|
| **Inline text-edit** (TextBox `contentEditable`) | `onMouseDown`/`onClick`/`onDoubleClick` all `stopPropagation()` ([TextBox.tsx:118-125](../../packages/axoview-lib/src/components/SceneLayers/TextBoxes/TextBox.tsx#L118-L125)) | editing pointer events never bubble to the window-level dispatcher → no mode fires while typing | a rewrite that captures the pointer on `rendererEl` at `pointerdown` **before** the contentEditable child handles it would steal focus; keep capture off the typing path or let `stopPropagation` win first |
| **Connector linked-label** (auto onClick) | `stopPropagation` on down/click/dblclick; linked-label `onClick` → `window.open(url)` ([ConnectorLabel.tsx:54-59,120-124](../../packages/axoview-lib/src/components/SceneLayers/ConnectorLabels/ConnectorLabel.tsx#L54-L124)); `pointerEvents:auto` sibling subtree | the label is a descendant of `rendererEl` (not the inner box, §5.3a) with its own handlers; clicks open the link instead of selecting | binding capture to the **inner box** drops the label (correction §5.3a); the link click must still fire before any canvas tap-select |
| **Waypoint anchor overlay** | `data-anchor-id` on **waypoints only**; `pointerEvents: isEndpoint ? 'none' : 'auto'` ([ConnectorAnchorOverlay.tsx:141,152,230-235](../../packages/axoview-lib/src/components/ConnectorAnchorOverlay/ConnectorAnchorOverlay.tsx#L141-L235)) | reached via the `isAnchorOverlay` exception in `isRendererInteraction` (§0); endpoints ride their nodes so they opt out of hit-testing | the rewrite's `isRendererInteraction` replacement must keep the `data-anchor-id` exception, or waypoint drag/splice dies |
| **Annotation overlay** (the EXISTING pointer-events precedent) | `touchAction:'none'`, `onPointerDown/Move/Up/Cancel`, **`rootRef.setPointerCapture(e.pointerId)`** on stroke start + `stopPropagation` ([AnnotationLayer.tsx:303-315,405-411](../../packages/axoview-lib/src/components/AnnotationLayer/AnnotationLayer.tsx#L303-L411)) | already owns the pointer for the stroke's duration; `stopPropagation` keeps the window mouse dispatcher (pan/select) from firing underneath | this is the **template** for the rewrite (capture on down, release/end on up+cancel, `touch-action:none`); two capturers on the same `pointerId` is the conflict to avoid |

**`getAnchorTile` `ref.anchor` recursion edge (documented).**
`getAnchorTile` recurses on anchor→anchor refs, calling `getAllAnchors` **at each
level** ([isoMath.ts:231-245](../../packages/axoview-lib/src/utils/isoMath.ts#L231-L245)).
`getAllAnchors` is `reduce` with array spread → **O(A²)** in total anchors A
([isoMath.ts:225-229](../../packages/axoview-lib/src/utils/isoMath.ts#L225-L229)).
**Where `ref.anchor` is created:** only the **reconnect-onto-another-anchor** drop
path (`resolveAnchorRef` → `{ anchor: id }`,
[DragItems.ts:154-166](../../packages/axoview-lib/src/interaction/modes/DragItems.ts#L154-L166); also `ReconnectAnchor`).
**How common:** rare — no UI affordance creates anchor chains directly; they only
arise from that specific drop. **Cost when hit:** the router calls `getAnchorTile`
for **every** anchor per frame ([isoMath.ts:287](../../packages/axoview-lib/src/utils/isoMath.ts#L287)),
so a connector drag over a diagram with anchor→anchor chains pays
O(frames · anchors · A²). Not on the common path, but a sharp edge the rewrite
must not amplify (e.g. don't add a per-`pointermove` caller that resolves all
anchors). Triage: **catalogue only** — no forcing function today (chains are
rare); revisit if anchor-to-anchor linking ever gets a UI.

---

## 5. (KR5) Coverage matrix, gap list, and contract corrections

### 5.1 Behavior ↔ test coverage matrix

Priority = regression-likelihood × user-visibility (P0 highest). "Unit" =
`__perf_refactor_regression__` / `utils/__tests__`; "e2e" = `axoview-e2e/tests`.

| Behavior (KR ref) | Unit | e2e | Status | Pri |
|---|---|---|---|---|
| CURSOR select / Ctrl-toggle / empty-clear (§1.1) | `Cursor.modes.test.ts`, `multiSelect.contract.test.ts` | `multi-select-drag.spec` | **covered** | P1 |
| Drag-start tile threshold (§1.1) | `Cursor.modes.test.ts` (DRAG_ITEMS transition) | `multi-select-drag.spec` | covered (whole-tile; **Decision 5 changes it** → re-point) | P0 |
| Connector endpoint→RECONNECT, waypoint Alt-splice, Ctrl-group (§1.1/§2.6) | `Cursor.modes.test.ts`, `Cursor.waypointGestures.test.ts` | `connector-deep.spec` | **covered** | P1 |
| DRAG_ITEMS drag-txn open/commit (§3.1) | `DragItems.modes.test.ts`, `connector.dragPerf.test.tsx` | — | **covered** | P0 |
| CSS-preview node path / no model write mid-drag (§3.4) | — | `drag-collision.spec`, `multi-select-drag*.spec` (final pos only) | **GAP** (no mid-drag invariant test) | **P0** |
| Node collision all-or-nothing (§2.2) | — | `drag-collision.spec` | covered (final) | P1 |
| `previewConnectorPaths` two-writer (§3.5) | — | — | **GAP** | P1 |
| Closed-form router timing (§3.2) | `connector.dragPerf.test.tsx` | — | **covered** | P0 |
| RAF throttle coalescing under load (§3.7) | `useRAFThrottle.cleanup.test.ts` (cleanup only) | — | **GAP** (no load test) | P1 |
| Direct-DOM zoom / counter-scale (§3.8) | `labelScale.test.ts`, `rendererSize.sharedObserver.test.tsx` | `readable-labels.spec`, `canvas-mode-zoom-preserve.spec` | partial (no "zero re-render" assert) | P1 |
| Connector create (click + drag mode) (§1.5) | `Connector.modes.test.ts`, `connector.createUndoRedo.test.tsx` | `connector-creation.spec`, `connector.spec` | **covered** | P1 |
| RECONNECT_ANCHOR (§1.6) | `ReconnectAnchor.modes.test.ts` | `connector-deep.spec` | covered (no abort case) | P1 |
| Rectangle draw / transform (§1.8/§1.9) | `DrawRectangle.test.ts`, `TransformRectangle.test.ts` | `rectangle-move-resize.spec`, `rectangle-ops.spec`, `shapes.spec` | covered (no min-size/zero-area assert) | P2 |
| Rectangle/textbox **undo grouping** (§3.6 / D-3) | — | `undo-redo-cross-cutting.spec` (final state) | **GAP** (N-entry divergence unguarded) | P2 |
| Connector create → undo → redo, both stacks (§4.5) | `connector.createUndoRedo.test.tsx` | `undo-redo-cross-cutting.spec` (aligned order only) | **covered** (MQA #5 direction) | P0 |
| Dual-stack **skew** — both-store op then model-only op then undo (§4.5 / D-7) | `undo.dualStackSkew.test.tsx` | — | **covered** (test CONFIRMS D-7 = live bug; skew-source + first-undo-orphan characterized; corrected-behavior assert `it.skip`ped pending fix authorization) | **P0** |
| Paste→undo→redo restores empty connector paths (§4.5 / D-8) | — | — | **GAP** (documented hazard, untested, unfixed) | P1 |
| Cross-view (page-switch) undo applies scene patches to wrong view (§4.5 / D-9) | — | — | **GAP** (documented hazard, code-traced, untested) | P1 |
| 2D-vs-ISO interaction parity (§2.8) | strategy unit tests (`coordinateTransforms`) | `canvas-modes*.spec` | **covered** (parity holds; D-10/D-11 latent risks noted) | P1 |
| TextBox create / move / off-canvas-cancel (§1.10) | — | `textbox-ops.spec`, `textbox-text-edit-move.spec` | covered | P2 |
| Lasso / freehand select + drag-from-selection (§1.3/§1.4) | `Lasso.modes.test.ts` | `multi-select-drag-lasso.spec`, `lasso-connector-delete.spec` | **covered** | P1 |
| PLACE_ICON nearest-free (§1.7/§2.3) | `findNearestUnoccupiedTile.test.ts` | `icons.spec`, `drag-collision.spec` | covered | P2 |
| PAN + readonly click panel (§1.11) | `Pan.modes.test.ts` | `viewport.spec`, `view-mode-info-popover.spec` | covered | P2 |
| Keybindings (§1.13) | `keyboard.dispatch.test.tsx`, `shortcuts.test.ts`, `f2.rendererScope.test.ts` | `hotkeys.spec` | **covered** | P1 |
| Escape semantics per mode (§4 D-1) | partial (connector abort) | `mode-transitions.spec` | **GAP** (no per-mode abort matrix) | P1 |
| Context menu invocation/dismissal (§4.3) | — | — (manual per baseline §9) | **GAP** (no e2e for NodeActionBar) | P1 |
| **Touch tap-to-place / pan / pointercancel (ADR 0018)** | — | — (single Chromium project, **no `hasTouch`/`pointerType`**) | **GAP — total** | **P0** |
| `isRendererInteraction` / mode dep-stability (§0) | `interactionManager.depStability.test.tsx` | — | covered (source-grep; re-tune after pointer effects) | P1 |
| `dragstart` preventDefault (§0 / [L944](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L944)) | `dragStart.prevention.test.ts` | — | covered | P2 |
| INTERACTIONS_DISABLED binds nothing (§1.12) | `uiOverlay.editorModes.test.ts` | — | partial | P1 |

### 5.2 Prioritized gap list (what to add, in order)

> **✅ DONE (2026-06-14): D-7 refute test written → reproduced.** D-7 is a
> **CONFIRMED LIVE P0 undo bug**, not a masked hazard
> ([undo.dualStackSkew.test.tsx](../../packages/axoview-lib/src/__perf_refactor_regression__/undo.dualStackSkew.test.tsx),
> verdict + minimal-fix design in §4.5). The fix is **not store-local**, so it is
> documented and locked (characterization test green; corrected-behavior assert
> `it.skip`ped) and **awaits authorization** — it is the top pre-rewrite item.

> **▶ OPEN P0 — fix D-7 (authorization-gated).** Implement the sequence-stamping
> coordination fix (§4.5 minimal-fix design) in `useHistory` + both stores +
> `useSceneActions`; unskip the corrected-behavior test. Do **before** the
> Pointer-Events rewrite (which makes paired drag commits the hot path).

1. **P0 — Touch coverage is zero.** No `hasTouch` project, no `pointerType`/
   `page.touchscreen`/`PointerEvent` anywhere in `axoview-e2e` (verified). The
   entire ADR 0018 behavior is unguarded. Add the `hasTouch` project + the
   tap-to-select/place/pan/pointercancel specs (tactical sub-task D) and the
   tap-to-place unit tests.
2. **P0 — CSS-preview invariant (§3.4) has no test.** Add a mid-drag assertion:
   model tiles unchanged + `--ff-drag-*` non-zero. This is the single most
   fragile, highest-value perf invariant and the easiest for a rewrite to break.
3. **P0 — Drag-start threshold (§1.1) flips from whole-tile to px-slop.** The
   existing test pins the old behavior; it must be re-pointed, not deleted, when
   Decision 5 lands.
4. **P1 — RAF throttle under load (§3.7), two-writer race (§3.5), per-mode
   Escape-abort matrix (D-1), NodeActionBar invocation/dismissal (§4.3).** None
   guarded today.
5. **P1 — "pan/zoom causes zero scene re-renders" (§3.8).** Render-probe-style
   assertion to lock the direct-DOM subscription.
6. **P2 — Undo-grouping divergence (D-3), rectangle min-size/zero-area (§2.5).**
   Lower visibility; catalogue, fix opportunistically.
7. **P1 — paste→undo→redo empty paths (D-8), cross-view undo (D-9).** New this
   session (§4.5). Both documented + repro'd by reasoning/code; neither guarded
   nor fixed (read-only session). Forcing function: both are invisible-connector
   variants of the same family as D-7 — fold into the undo-coherence work.

**Still BLOCKED (not gaps — environment/methodology, §3.12 / §4.6):**
- **KR4 live-pointer confirmation** — dev server down (`Cannot find module
  'axoview'`); surfaces verified at code level instead. Unblock: build:lib +
  restart dev, then dispatch the four gestures.
- **KR5 interactive FPS floor** — not authentically capturable headless
  (automation-paced); needs a human DevTools session. Existing real floor
  recorded in §3.12.

### 5.3 Contract corrections — APPLIED

**(a) ADR 0018 impl notes + tactical: listener surface is `rendererEl`, not the
inner box.** Baseline §6.2/§8 proves connector-anchor reconnect, waypoint drag,
and linked-label clicks live in **sibling** subtrees (ConnectorAnchorOverlay /
ConnectorLabels) of the `canvas-interactions` Box, so binding pointer listeners
to that Box alone **breaks** them; they are descendants of the **Renderer
container (`rendererEl`)**. Applied to ADR 0018 Implementation notes and the
tactical checklist (the four CSS guardrails go on the container too, so they
cover the `auto` anchor/label elements). The locked **Decisions** are not
rewritten — see §5.4 for the wording note raised for review.

**(b) New findings folded into the tactical test strategy:** the perf invariants
the harness migration must preserve are now enumerated (§3) with the specific
regression each rewrite step risks; the §5.1 matrix replaces baseline §9's
"~21 specs" estimate with the current 40-spec inventory.

### 5.4 Contract questions — SURFACED FOR REVIEW (not resolved)

Per the session guardrail, these touch ADR 0018 **Decisions**; I am flagging,
not rewriting them.

1. **Touch has no path to the NodeActionBar (D-6).** Decisions 6 + 7.3 together
   close every touch route to the right-click action bar, and tap-to-place
   (Decision 4) doesn't open it. **Question for the ADR owner:** what raises the
   per-item action bar (delete / assign-layer / start-connector / z-order /
   edit-shortcuts) on touch? Options to weigh (do **not** pick here): a
   tap-on-already-selected variant that opens the bar instead of GRAB; a toolbar
   affordance; a two-finger tap; or accept the bar as desktop-only and route the
   actions through the Properties panel on touch. This is a **decision gap**, not
   an oversight — it must be answered before implementation.
2. **"Cancel restores origin" needs a rollback primitive (D-2).** Decision 6's
   abort ("node stays at origin") is satisfiable for the **CSS-preview node
   carry** (the natural touch case) but **not** uniformly — reconnect / rectangle
   / textbox mutate per frame and have no rollback (only commit). **Question:**
   is Decision 6 scoped to the node carry only (then it's fine as written), or
   should the rewrite add a `rollbackDragTransaction` (discard `pendingPre`,
   restore the pre-snapshot) so abort is uniform across modes? The wording
   currently implies uniformity the code can't deliver.
3. **Wording nit (impl-level, applied):** Decision 1 / 7.1 say listeners + CSS
   guardrails attach to "the `canvas-interactions` Box". Read literally that
   breaks connector anchors/labels (correction (a)). The impl notes now say
   `rendererEl` container; recommend the ADR owner reword Decision 1/7.1 to
   "the Renderer container (`rendererEl`)" at next revision. Left as a note,
   not edited into the Decision text.

---

## 6. One-screen rewrite checklist (derived from §1–§5)

The Pointer-Events rewrite is **correct** iff it preserves all of:

- [ ] `PointerEvent → SlimMouseEvent` stays mouse-shaped; mode reducers untouched
      (every §1 table + the mode unit tests stay green).
- [ ] Listeners bind to **`rendererEl`**, not the inner box (§5.3a); guardrails
      on the container; `setPointerCapture` replaces "moves fire on `window`".
- [ ] **Every `pointermove` stays RAF-throttled; flush on down/up/cancel** (§3.7).
- [ ] Node drag keeps the **CSS-preview path** (`--ff-drag-*` on `[data-drag-id]`,
      single `previewConnectorPaths` with `flushSync`, commit on up) for `mouse`
      **and** reuses it for the touch carry (§3.4/§3.5).
- [ ] Exactly one `beginDragTransaction`↔`commitDragTransaction` per gesture; no
      open-txn leak on any abort path (§3.1, D-4).
- [ ] Drag begin/commit/abort stays **symmetric across both the model and scene
      history stacks** — never one without the other, or the MQA #5
      invisible-connector symptom returns (§4.5, D-7). **D-7 is now a CONFIRMED
      live bug (test reproduced); fix the dual-stack skew (sequence-stamping,
      §4.5) BEFORE this rewrite, since drags become the hot path.**
- [ ] Touch pan drives `setScroll`/`setZoom` through the store the `SceneLayer`
      subscription reads — **no React render on pan/zoom** (§3.8).
- [ ] New tap-to-select path consults `isItemInteractable` + pulls
      `getConnectorWaypointRefs` (§4.1 I-1/I-2).
- [ ] `INTERACTIONS_DISABLED` binds no pointer listeners (§1.12).
- [ ] Does **not** worsen the open connector GC cliff (§3.10).
- [ ] Answers the two surfaced contract questions (§5.4) before coding the touch
      branch.
