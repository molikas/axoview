# Canvas Interaction Model — Pre-Refactor Baseline (Reference)

> **⚠️ Later change (2026-06-25 shake-out):** the floating `NodeActionBar`
> referenced below was **removed**; the right-click `CanvasContextMenu` (ADR 0027)
> is now the sole per-item command surface. Those references are historical.

> **Status:** Reference · **Owner:** molikas · **Created:** 2026-06-13
> **Purpose:** Document the *current* canvas interaction model **before** the
> Pointer-Events rewrite (ADR 0018 / `touch-pen-gesture-contract.md`), so the
> rewrite can be reviewed against a known-good contract. Nothing here proposes a
> change — it records how input works **today** and where the
> `window → canvas-subtree` listener migration could regress.
>
> Companion to: [ADR 0018](../adr/0018-touch-pen-gesture-contract.md) ·
> [tactical checklist](touch-pen-gesture-contract.md) · ADR 0006 (selection).
>
> **Behavioral / algorithmic / performance layer on top of this doc:**
> [canvas-interaction-behavior-map.md](canvas-interaction-behavior-map.md) —
> per-mode state tables (KR1), algorithm contracts (KR2), the performance dossier
> (KR3), the abort/undo divergence register (KR4), and the test coverage matrix +
> contract corrections (KR5). This baseline is the *mechanical* (DOM + routing)
> layer; the behavior-map is the *what-each-mode-does + what-must-stay-fast* layer.

---

## 1. Why this document exists

The rewrite moves the canvas input listeners **off `window`** onto the canvas
DOM subtree and switches `mouse/touch` events to **Pointer Events**. The single
highest-severity risk is that an interaction surface which *today* relies on the
`window` listener catching an event stops being reached once listeners are
scoped to a subtree. This doc enumerates every canvas surface, the exact DOM
fact each one depends on, and the check that proves it still works after the
migration.

The surfaces called out for extra scrutiny (per review): **connectors,
selection + lasso, rectangle (square), text, annotation** — plus **preview /
view modes**. Each has its own subsection in §6 and a row in the §9 matrix.

---

## 2. The load-bearing layout (DOM stacking)

`Axoview.tsx` renders the canvas and the overlay as **siblings** inside a
`position:relative` wrapper ([Axoview.tsx:294-302](../../packages/axoview-lib/src/Axoview.tsx#L294-L302)):

```
<Box position:absolute inset:0>            ← wrapper
  <Renderer/>          ← containerRef === uiState.rendererEl  (the canvas subtree)
  <UiOverlay/>         ← sibling, painted ON TOP of Renderer
</Box>
```

- **`rendererEl`** = the `Renderer` container `Box`
  (`data-testid="axoview-canvas"`, [Renderer.tsx:167-181](../../packages/axoview-lib/src/components/Renderer/Renderer.tsx#L167-L181)).
  Everything that draws the diagram is a **descendant** of this element.
- **`UiOverlay`** is a later sibling → painted above the canvas. Its **root is
  `pointerEvents:'none'`** ([UiOverlay.tsx:165](../../packages/axoview-lib/src/components/UiOverlay/UiOverlay.tsx#L165)),
  re-enabling `auto` only on specific interactive children (NodeActionBar,
  ViewTabs, AnnotationLayer-while-capturing, docks). So canvas-area pointers
  **fall through the overlay** to the Renderer subtree.

**Key invariant:** every diagram-interaction element lives inside the
`rendererEl` subtree; every piece of *chrome* (action bar, annotation layer,
tabs, docks) lives in `UiOverlay`, a separate subtree. The current code uses
`window` listeners + an `isRendererInteraction` gate (§5) to tell these apart;
the rewrite can instead rely on **subtree separation** (bind inside
`rendererEl`), which is strictly cleaner.

### 2.1 Child paint order inside `Renderer` (DOM order = z within equal zIndex)

[Renderer.tsx:182-240](../../packages/axoview-lib/src/components/Renderer/Renderer.tsx#L182-L240):

| # | Layer | `pointer-events` | Note |
|---|---|---|---|
| 1 | Rectangles `SceneLayer` | element default `auto`, painted **below** box | hit via tile, not its own DOM |
| 2 | Lasso `SceneLayer` | `none` | visual only |
| 3 | FreehandLasso | `none` | visual only |
| 4 | Grid `Box` | `none` | visual only |
| 5 | Cursor `SceneLayer` | `none` | visual only |
| 6 | Connectors `SceneLayer` | path SVG (see §6.2) | hit via tile |
| 7 | TextBoxes `SceneLayer` | `inherit`/`auto` when editable | painted **below** box |
| 8 | ConnectorLabels `SceneLayer` | label chip `auto` (link) | above box? see §6.2 |
| — | (debug SizeIndicator) | — | dev only |
| 9 | **`canvas-interactions` Box** | `auto` (default) | **the hit surface** |
| 10 | Nodes `SceneLayer` | icon/label `none` | painted **above** box, click-through |
| 11 | ConnectorAnchorOverlay | waypoint `auto`, endpoint `none` | painted **above** box |
| 12 | TransformControlsManager | anchors — see §6.4 | painted **above** box |

The `canvas-interactions` Box (#9) is the **only** full-area `pointer-events:auto`
surface. Layers below it (1-8) are click-through *to it* because their content is
either `none` or painted underneath. Layers above it (10-12) are mostly `none`
(click-through to the box) **except** non-endpoint connector anchors
(`auto`) and connector labels (`auto`), which intercept pointers themselves.

---

## 3. The event pipeline (today)

[useInteractionManager.ts:864-978](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L864-L978):

```
window 'mousedown'/'mousemove'/'mouseup' ─┐
window 'touchstart'/'move'/'end' ─(synth)─┤→ onMouseEvent(SlimMouseEvent)
window 'contextmenu' ─────────────────────┘   │
rendererEl 'wheel' → onScroll (zoom)           │
rendererEl 'dragstart' → preventDefault        │
                                               ▼
                          usePanHandlers (button 1/2, ctrl/alt/empty-area)
                                               │ (not consumed)
                                               ▼
                          getMouse(clientX/Y → screen → tile)  [renderer.ts:60]
                                               │  (mousemove RAF-throttled)
                                               ▼
                          processMouseUpdate → builds State → mode.entry/exit
                                               │
                                               ▼
                   modes[uiState.mode.type].{mousedown|mousemove|mouseup}(State)
```

- **`SlimMouseEvent`** ([common.ts:23-35](../../packages/axoview-lib/src/types/common.ts#L23-L35))
  is the internal adapter: a `Pick` of `MouseEvent` (`clientX/Y`, `target`,
  `type`, `button`, modifier keys, `preventDefault`). **Every mode reducer is
  written against this**, branching on `e.type ∈ {mousedown,mousemove,mouseup}`
  ([useInteractionManager.ts:57-68](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L57-L68)).
  Keeping this shape stable is what keeps the mode-reducer unit tests green.
- **Touch today** is synthesized into mouse events
  ([L869-897](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L869-L897)):
  `touchstart/move` copy `touches[0].clientX/Y`; **`touchend` hardcodes
  `(0,0)`** → the corner-jump bug. There is no `pointercancel`/multitouch path.
- **`getMouse`** derives `position.screen` (`clientX − elementLeft`, zoom-
  independent CSS px), `position.tile` (via `screenToTile`), `delta`, and
  `mousedown` (set on `mousedown`, carried through `mousemove`, cleared on
  `mouseup`) — [renderer.ts:60-100](../../packages/axoview-lib/src/utils/renderer.ts#L60-L100).

---

## 4. The `isRendererInteraction` gate

`processMouseUpdate` computes
([useInteractionManager.ts:730-751](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L730-L751)):

```ts
isRendererInteraction: rendererRef.current === e.target || isAnchorOverlay
```

where `rendererRef.current` is the **`canvas-interactions` Box** (set via
`setInteractionsElement`, [Renderer.tsx:120-124](../../packages/axoview-lib/src/components/Renderer/Renderer.tsx#L120-L124)),
and `isAnchorOverlay` is true when `e.target.closest('[data-anchor-id]')` hits a
waypoint anchor.

- `Cursor.mousedown`, `Cursor.mouseup`, `PlaceIcon.mousedown`, etc. **early-return
  unless `isRendererInteraction`** — this is how clicks on overlay chrome (action
  bar, etc.) that bubble to `window` are ignored.
- **`mousemove` handlers do NOT check the gate** (`Cursor.mousemove`,
  `DragItems.mousemove`) — that is why a drag keeps working while the pointer
  strays over a node/anchor mid-drag: the move fires on `window` regardless of
  target. After migration this free "moves anywhere" property must be replaced
  by **`setPointerCapture`**.

**How each surface satisfies the gate today** (target must be the box, or an
anchor): nodes/rectangles/textboxes are `none`/painted-below, so a click on them
hit-tests to the **interactions box** → `e.target === box` ✓. Waypoint anchors
are `auto` → `e.target === anchor` but `isAnchorOverlay` ✓. Connector labels are
`auto` → handled by their own `onClick` (links), not the canvas gate.

---

## 5. Pan / zoom / context-menu (mouse) — `usePanHandlers`

[usePanHandlers.ts](../../packages/axoview-lib/src/interaction/usePanHandlers.ts):

- **Middle button** (`e.button === 1`, `middleClickPan`) → pan.
- **Right button** (`e.button === 2`, `rightClickPan`) → *deferred* pan: arms on
  down, starts only after `RIGHT_DRAG_THRESHOLD = 4px`; a release under
  threshold becomes a **deselect** (and lets `contextmenu` open the item bar).
- **Left button** (`e.button === 0`) → `ctrlClickPan` / `altClickPan` /
  `emptyAreaClickPan` modifier pans.
- **Wheel** → `onScroll` zoom (zoom-to-cursor math), bound on `rendererEl`,
  `passive:true`.
- **`contextmenu`** → `preventDefault` + open the NodeActionBar for an
  interactable item under the cursor ([L834-862](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L834-L862)).

**Touch implication (migration):** `handleMouseDown` reads `e.button`. A
synthetic touch is `button:0`, so today touch can accidentally trip
`emptyAreaClickPan`. The Pointer-Events path must **route touch/pen around
`usePanHandlers`** (it is button-shaped, mouse-only) and own touch pan itself.

---

## 6. Per-surface interaction contracts

### 6.1 Node — select / drag (mouse)

- **Hit-test:** by **tile** (`getItemAtTile`) in `Cursor.mousedown`, not by DOM
  target — node icons/labels are `pointer-events:none`
  ([Node.tsx:318/339/349](../../packages/axoview-lib/src/components/SceneLayers/Nodes/Node/Node.tsx#L315-L350)),
  so the click hit-tests to the interactions box.
- **Select:** `mousedown` records `mousedownItem`; `mouseup` with no tile
  movement → `resolveClickSelection` (replace, or Ctrl+toggle) — ADR 0006.
- **Drag:** `Cursor.mousemove` promotes to `DRAG_ITEMS` once the **tile changes**
  ([Cursor.ts:501-505](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L501-L505)).
  `DragItems` runs the CSS-preview hot path (`--ff-drag-dx/dy` on
  `[data-drag-id]`, [DragItems.ts](../../packages/axoview-lib/src/interaction/modes/DragItems.ts)),
  commits to the model on `mouseup` inside one history txn.
- **`data-drag-id`** is on the Node outer Box ([Node.tsx:67](../../packages/axoview-lib/src/components/SceneLayers/Nodes/Node/Node.tsx#L67));
  `INNER_SX` reads the drag CSS vars — this is the reuse target for the touch
  "carrying" affordance.
- **Whole-tile threshold = the trackpad bug:** a sub-tile drag never crosses a
  tile boundary, so it is read as a click. Decision 5 replaces this with a px
  slop applied to **all** pointer types.

### 6.2 Connectors

- **Draw:** `Connector` mode; e2e drives it through `page.mouse.*` (real pointer
  events) and the `clickCanvasAt` synthetic-dispatch helper.
- **Body select:** by **tile** (`getItemAtTile` → connector) → `setItemControls`.
- **Anchor overlay** ([ConnectorAnchorOverlay.tsx:152](../../packages/axoview-lib/src/components/ConnectorAnchorOverlay/ConnectorAnchorOverlay.tsx#L152)):
  - **Endpoint anchors** = `pointer-events:none` → hit-tested by tile; clicking
    one enters `RECONNECT_ANCHOR` (click-to-reconnect).
  - **Waypoint anchors** = `pointer-events:auto` + `data-anchor-id` → intercept
    the pointer; `processMouseUpdate` flags `isAnchorOverlay`,
    `nextMouse.targetAnchorId = dataset.anchorId`, and
    `Cursor`/`DragItems` resolve the anchor by **id**, not tile
    ([Cursor.ts:143-168](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L143-L168)) —
    deliberately, because the hit ring exceeds one tile at low zoom.
  - **Alt+click waypoint** = remove (module-level `altSpliceConsumed` flag).
- **Waypoint grouping:** `getConnectorWaypointRefs` keeps a connector's
  waypoints selected/moved together (ux-principles §4.4) — every new touch
  selection/move path must honor this too.
- **Connector labels** ([ConnectorLabel.tsx:46/112](../../packages/axoview-lib/src/components/SceneLayers/ConnectorLabels/ConnectorLabel.tsx#L46)):
  `pointer-events:auto` only when they carry a link `url`; the `onClick` opens
  the link and is self-contained (not a canvas-gate path).
- **⚠ Migration-critical:** waypoint anchors + linked labels are `auto`
  elements that intercept pointers. They are **inside the `rendererEl` subtree**
  (ConnectorAnchorOverlay / ConnectorLabels SceneLayers), so binding listeners
  to `rendererEl` still reaches them. Binding to **only the
  `canvas-interactions` Box would NOT** (siblings, not descendants) → anchor
  reconnect + waypoint drag + linked-label clicks would break. **This is the
  reason the listeners must bind to the container, not the inner box.**

### 6.3 Selection & lasso / freehand lasso

- **Marquee lasso** (`LASSO`) and **freehand lasso** (`FREEHAND_LASSO`) layers
  are `pointer-events:none` ([FreehandLasso.tsx:36](../../packages/axoview-lib/src/components/FreehandLasso/FreehandLasso.tsx#L36)) —
  visual only; all hit-testing is tile/path math in the mode reducers.
- **Empty-area drag → lasso:** `Cursor.mousemove` with `mousedownItem === null`
  and `mousedownHandled` promotes to `LASSO`
  ([Cursor.ts:529-537](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L529-L537)).
  Gated by `emptyAreaClickPan` being **off** (else `usePanHandlers` pans first).
- **Multi-select drag:** `resolveDragItems` drags the whole persistent selection
  if the pressed item is part of it (ADR 0006).
- **Delete:** keydown handler (lasso selection → multi-selection → single).
- **⚠ Migration:** lasso start depends on `Cursor.mousemove` firing for moves
  anywhere on the surface — provided by `setPointerCapture` post-migration. For
  **touch**, an empty-area one-finger drag must **pan**, not lasso (Decision 5 /
  tactical D), so the touch path diverges here.

### 6.4 Rectangle (square)

- **Draw:** `RECTANGLE.DRAW` via the `r` hotkey + drag; `DrawRectangle.mousemove`
  gates on `hasMovedTile` **and** `uiState.mouse.mousedown` (e2e `dragFromTo`
  walks intermediate points so the tile gate trips).
- **Select / move:** by **tile** like a node (Rectangle DOM has no explicit
  `pointer-events`, but the Rectangles `SceneLayer` is painted **below** the
  interactions box, so clicks hit-test to the box → tile lookup).
- **Transform:** `RECTANGLE.TRANSFORM`; `TransformControls` visual is
  `pointer-events:none` ([TransformControls.tsx:69](../../packages/axoview-lib/src/components/TransformControlsManager/TransformControls.tsx#L69)).
  Transform-anchor hit-testing is tile-based in the mode reducer.
- **⚠ Migration:** all rectangle interaction is tile-based via the interactions
  box → `e.target === box` holds → safe under both container and box binding.
  Lowest risk surface.

### 6.5 TextBox (text)

- **Create:** `t` hotkey creates a textbox at `uiState.mouse.position.tile` then
  enters `TEXTBOX` mode; committed by a `mouseup` on the interactions box.
- **Select / move:** by **tile** (TextBoxes `SceneLayer` painted **below** the
  interactions box → hit-tests to box).
- **Inline edit:** `onDoubleClick` → contentEditable; while editing the inner
  Box is `pointer-events:'auto'` ([TextBox.tsx:113](../../packages/axoview-lib/src/components/SceneLayers/TextBoxes/TextBox.tsx#L113))
  and its `onMouseDown` calls `stopPropagation` so the canvas does not also
  react. Editable textbox content is inside the `rendererEl` subtree.
- **⚠ Migration:** selection is tile-based (safe). Inline-edit relies on
  `stopPropagation` on the textbox's own handler — unaffected by where the
  *canvas* listeners live, but the editable surface is `auto`: confirm a
  pointerdown on a textbox-in-edit does not get captured by the canvas
  `setPointerCapture`. (The canvas only captures when **it** handles the
  pointerdown; a `stopPropagation`'d edit pointerdown never reaches it.)

### 6.6 Annotation overlay — the Pointer-Events precedent

[AnnotationLayer.tsx:391-411](../../packages/axoview-lib/src/components/AnnotationLayer/AnnotationLayer.tsx#L391-L411):

- Already **Pointer-Events based** (`onPointerDown/Move/Up/Cancel`), already sets
  **`touchAction:'none'`**, already uses **`setPointerCapture(e.pointerId)`** on
  draw/erase start. This is the in-repo pattern the canvas rewrite mirrors.
- Lives in `UiOverlay` (zIndex 6), **outside** `rendererEl`. Root is
  `pointerEvents: capturing||eraserActive ? 'auto' : 'none'`:
  - **Draw/erase mode** → `auto` → it intercepts pointers and `stopPropagation`s;
    the canvas never sees them.
  - **Select mode** → `none` → pass-through; pointers reach the canvas subtree
    below for normal canvas interaction.
- **⚠ Migration (called out by review):** because annotation is a **separate
  subtree** from `rendererEl`, binding canvas listeners inside `rendererEl`
  means annotation and canvas can **never double-handle** the same pointer
  (today they nominally could via `window`, but the `isRendererInteraction` gate
  + `stopPropagation` prevented it). Post-migration this is structurally
  guaranteed. **Regression check:** with the annotation tool active, canvas must
  stay inert; with annotation in select mode, canvas pointers must still work
  (pass-through). Both are covered by the existing `annotation-overlay` e2e.

### 6.7 Preview / view / editor modes

- **`editorMode` prop → starting mode** ([common.ts:62-75](../../packages/axoview-lib/src/utils/common.ts#L62-L75)):
  - `EDITABLE` → `CURSOR` (full editing).
  - `EXPLORABLE_READONLY` → `PAN` (pan/zoom only; LeftDock hidden,
    [Axoview.tsx:303](../../packages/axoview-lib/src/Axoview.tsx#L303)).
  - `NON_INTERACTIVE` → `INTERACTIONS_DISABLED`.
- **`INTERACTIONS_DISABLED`** → the input effect **early-returns**
  ([useInteractionManager.ts:865](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L865)),
  so **no mouse/touch/wheel listeners are bound at all**. The migration must
  preserve this guard (no pointer listeners bound when interactions are
  disabled).
- **In-app "view mode" / presentation** (Phase 6): layered via annotation +
  `PreviewLayerSwitcher` + `ViewModeInfoPopover`; canvas navigation still flows
  through the same manager. Pan/zoom must remain available in view mode.
- **⚠ Migration regression checks:** (1) `EXPLORABLE_READONLY` pan + wheel-zoom
  still work; (2) `NON_INTERACTIVE` binds nothing; (3) view-mode pan/zoom +
  annotation pass-through unaffected; (4) `touch-action:none` does not block
  page scroll outside the canvas (it is scoped to `rendererEl`).

---

## 7. Touch / trackpad today (the broken state being replaced)

- **Touchscreen:** `touchstart/move` synthesize `mousedown/move`; `touchend`
  commits at **`(0,0)`** → node jumps to the corner.
- **Trackpad:** emits *mouse/pointer*, not `TouchEvent` → a tap is `down+up`
  with no tile change → read as click; a sub-tile drag is swallowed by the
  whole-tile threshold. "Tap, lift, move, tap" just clears the selection.
- **No `pointercancel`/multitouch** → an OS-reclaimed gesture leaves the canvas
  mid-drag.
- **No `touch-action`/`user-select`/`-webkit-touch-callout`** on the surface →
  native pan/zoom/callout fight the canvas.

---

## 8. Migration regression matrix

For each surface: the DOM fact it depends on, whether it is inside the
`rendererEl` subtree (so a container-scoped listener reaches it), the risk, and
the verification.

| Surface | Depends on | In `rendererEl` subtree? | Risk if bound to **box only** | Risk if bound to **container** | Verify |
|---|---|---|---|---|---|
| Node select/drag | tile hit-test, `e.target===box` | yes (interactions box) | OK | OK | e2e node drag/select; mode unit tests |
| **Connector reconnect / waypoint drag** | waypoint anchor `auto` + `data-anchor-id` | yes (AnchorOverlay) | **BREAKS** (anchors are siblings of box) | OK | connector-deep / connector specs |
| **Connector linked label click** | label `auto` `onClick` | yes (ConnectorLabels) | **BREAKS** | OK (self-contained) | manual: linked label opens URL |
| **Lasso / freehand** | `Cursor.mousemove` fires for moves anywhere | n/a (tile/path math) | needs `setPointerCapture` | needs `setPointerCapture` | lasso specs |
| **Rectangle draw/select/transform** | tile hit-test via box | yes | OK | OK | shapes spec |
| **TextBox select / create** | tile hit-test via box | yes | OK | OK | shapes/textbox spec |
| TextBox inline edit | own `auto` + `stopPropagation` | yes | OK | OK | manual: dbl-click edit |
| **Annotation** | separate subtree, own pointer + capture | **no** (UiOverlay) | OK (isolated) | OK (isolated) | annotation-overlay spec |
| Pan (mid/right/modifier) | `e.button` in `usePanHandlers` | n/a | OK | OK | pan specs |
| Wheel zoom | `rendererEl` wheel listener | yes | OK | OK | zoom specs |
| Context menu | `contextmenu` + tile item | n/a | OK | OK | action-bar manual |
| Preview `EXPLORABLE_READONLY` | starting mode PAN | n/a | OK | OK | readonly example |
| Preview `NON_INTERACTIVE` | effect early-return | n/a | OK | OK | confirm no listeners |

**Conclusion the matrix forces:** the listeners must bind to the **Renderer
container (`rendererEl`)** — the common ancestor of the interactions box, the
connector-anchor overlay, and the connector labels — **not** the inner
`canvas-interactions` Box alone (which the tactical's shorthand suggests).
Binding to the box alone breaks connector reconnect, waypoint drag, and linked
labels. `setPointerCapture` (on the interactions box, to keep the
`isRendererInteraction` gate true mid-gesture) replaces the old "moves fire on
`window`" property. The four CSS guardrails (`touch-action`/`user-select`/
`-webkit-touch-callout`) go on the **container** so they cover the whole canvas
including the `auto` anchor/label elements.

---

## 9. Tests that guard these paths today

- **Mode reducers (unit):**
  [`Cursor.modes.test.ts`](../../packages/axoview-lib/src/__perf_refactor_regression__/Cursor.modes.test.ts)
  calls `Cursor.mousedown/move/up({...State})` directly — decoupled from the
  event family; stays green iff `SlimMouseEvent` remains the internal contract.
- **Dep stability (source-grep):**
  [`interactionManager.depStability.test.tsx`](../../packages/axoview-lib/src/__perf_refactor_regression__/interactionManager.depStability.test.tsx)
  regex-matches the keydown effect's dep array; re-tune after pointer effects
  land.
- **e2e harness:** `CanvasPOM.dispatchAt` + `connector.spec.ts#clickCanvasAt`
  dispatch synthetic `MouseEvent`s onto the interactions box to satisfy the
  gate — both migrate to `PointerEvent` (with `pointerId/pointerType/isPrimary/
  button/buttons`); ~21 specs revive with **zero assertion changes** (= proof
  the mouse path is unchanged). `page.mouse.*` specs (connector-creation/-deep,
  annotation-overlay) emit real Chromium pointer events — likely survive, but
  verify.

---

## 10. Open verification items before/after the rewrite

1. Confirm the connector-anchor overlay + linked labels reach the container
   listener (they break under box-only binding — §6.2/§8).
2. Confirm `setPointerCapture(interactions box)` keeps `isRendererInteraction`
   true through a drag while leaving hover (no capture) untouched (§4).
3. Confirm touch/pen bypass `usePanHandlers` (button-shaped) and own touch pan
   (§5).
4. Confirm `INTERACTIONS_DISABLED` binds nothing and `EXPLORABLE_READONLY`
   pan+zoom survive (§6.7).
5. Confirm annotation draw/select pass-through unchanged (§6.6).
6. Confirm `touch-action:none` is scoped to `rendererEl` and does not block page
   scroll elsewhere.
</content>
</invoke>
