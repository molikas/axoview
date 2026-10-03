# ADR 0049 — View Rotation: Camera & Projection Model

**Status:** Proposed
**Date:** 2026-10-03
**Supersedes:** none
**Superseded by:** none

*(Non-supersession context: sibling of [ADR 0050](0050-view-rotation-render-and-legibility-policy.md) (how each element class renders under rotation) and [ADR 0051](0051-view-rotation-default-angle-sharing-and-export.md) (the persisted per-page default, viewers, export). Holds [ADR 0038 §5](0038-webgl-instanced-render-substrate.md) under rotation, extends the off-grid offset contract of [ADR 0023](0023-off-grid-positioning-and-collision.md), and amends [ADR 0022 §1](0022-canvas-pointer-interaction-model.md) with an Alt+left-drag orbit — that addendum lands with the implementation.)*

## Context

A proof of concept on branch `feat/view-rotation-poc` (uncommitted as of this date) rotates the isometric ground plane about the vertical axis. Every tile `(x, y)` is rotated about the tile origin by θ, `(x′, y′) = R(θ)·(x, y)`, before the unchanged iso map, and the inverse is applied on the way back. The model never changes, and θ = 0 is bit-identical to today. The POC proves the idea. A code investigation on 2026-10-03 found it is not shippable as built. The evidence, with `file:line` citations, was recorded in the productization tactical's findings register, which survives in git history after that tactical is wrapped.

1. **The angle is a module global** (the POC's `utils/viewRotation.ts`), and every `UiStateProvider` resets it to 0 when it creates its store. The app already runs two instances at once: [`ExportImageDialog`](../../packages/axoview-lib/src/components/ExportImageDialog/ExportImageDialog.tsx) mounts a hidden `NON_INTERACTIVE` `<Axoview>`. Opening the export dialog therefore exports at 0° into bounds sized for θ. It also silently zeroes the live canvas's projection and hit-testing while its `uiState` still says θ. Every other lib store is provider-scoped; the angle is the only global holding lasting render state.
2. **Off-grid offsets drift.** A stored `offset` is a post-projection residual composed in [`renderedGeometry.ts`](../../packages/axoview-lib/src/utils/renderedGeometry.ts) (ADR 0023 addendum). Under rotation it renders off by `(M(θ) − I)·offset`. At 180° an item is mirrored through its tile centre, and a floating label's unbounded offset drifts by several tiles. Three sites still compose offsets by hand: `connectorEmitter`, `Connector.tsx` and `ViewModeInfoPopover`.
3. **It rebuilds every frame.** Each angle step re-runs `buildInstances` for every bulk entity, re-uploads the whole instance buffer, and re-renders all 29 `useCanvasMode()` consumers. That breaches ADR 0038 §5 directly ("any change that rebuilds geometry per frame is a regression"). The estimate, inferred because no harness case exists, is uneven 30–60 fps at 1k nodes with labels and 120–250 ms frames at 20k.
4. **Orientation assumptions it missed:**
   - Arrow-key nudge uses fixed tile deltas ([`handleArrowKey.ts`](../../packages/axoview-lib/src/interaction/handleArrowKey.ts)), so every arrow is reversed at 180°.
   - Flat-icon resize uses fixed screen diagonals ([`TransformNode.ts`](../../packages/axoview-lib/src/interaction/modes/Node/TransformNode.ts)), so over wide angle ranges, dragging a handle outward shrinks the icon.
   - The DOUBLE connector's second-line label applies a tile-space perpendicular as screen px ([`ConnectorLabel.tsx`](../../packages/axoview-lib/src/components/SceneLayers/ConnectorLabels/ConnectorLabel.tsx)).
   - At multiples of 90°, depth ties are broken by float noise (cos 90° ≈ 6e-17), so the painter and the picker can disagree.
   - The hidden angle still reorders 2D paint and pick.
   - An iso→2D switch re-projects offsets with the *rotated* inverse ([`useCanvasModeToggle.ts`](../../packages/axoview-lib/src/hooks/useCanvasModeToggle.ts)).
   - Two memos are keyed on `projectionName` although they now depend on θ.
5. **Its Alt+drag hook swallows every Alt+left press** in the capture phase. ADR 0022's Alt+click waypoint removal therefore no longer works in iso, though the Help dialog still lists it. The hook also bypasses the single input pipeline ([ux-principles §9.5](../guidelines/ux-principles.md)).

Some things are already rotation-safe because they route through the strategy or `renderedGeometry`: lasso and freehand lasso, rectangle and text-box handles, isometric-icon resize, connector anchors and waypoints, library drop, paste, snapping and collision, creation tools, fit-to-view, and menus.

**Owner direction (2026-10-03):**
- **Free angle at rest.** This was chosen over a recommended 90°-step model, accepting non-diamond cells and sprite-footprint mismatch at in-between angles.
- **Controls:** dock buttons, Q/E keys, and Alt+drag on the canvas.
- **Viewers** get the controls.
- **Persistence:** the only persisted angle is an explicit per-page default ([ADR 0051](0051-view-rotation-default-angle-sharing-and-export.md)).

## Decision

### 1. θ is per-instance camera state

- **Units and sign.** θ is in degrees, normalised to (−180°, 180°]. A positive θ turns the floor counter-clockwise as seen from above, so dragging right brings the near side to the right.
- **Where it lives.** θ lives only in the instance's `uiState.viewRotation`, beside `zoom` and `scroll`. It is never module state and never model data; the persisted per-page default is ADR 0051's concern.
- **Isometric only.** In 2D, θ is retained but has no effect on projection, depth, offsets or input. The rotation controls stay visible but disabled, with a tooltip saying why ([ux-principles §2.5](../guidelines/ux-principles.md)). Switching back to iso restores θ with the viewport centre preserved.
- **Any angle can be a resting state.** The cardinal angles (0°, ±90°, 180°) are reachable exactly (§7). They use exact trigonometry (0, ±1), so they carry no float noise.

### 2. The projection strategy is a value built from (mode, θ)

- **A factory owns everything that depends on the angle.** `makeIsometricStrategy(θ)` returns a strategy holding `toScreen`, `fromScreen`, `fromCanvasPoint`, `projectionMatrix(orientation)`, `tileCorner`, `depth`, and the offset maps of §4.
  - At θ = 0 it returns today's shared `isometricStrategy` object, so 0° output stays bit-identical; a test keeps it that way.
  - `getStrategy(mode, θ)` replaces lookups by `canvasMode`.
- **Every consumer receives the strategy; nothing reads a global angle.**
  - React code gets it from [`CanvasModeContext`](../../packages/axoview-lib/src/contexts/CanvasModeContext.tsx).
  - Interaction modes get it on the injected `State`, next to `screenToTile` ([`types/interactions.ts`](../../packages/axoview-lib/src/types/interactions.ts)).
  - Pure utilities take it as a parameter instead of a `canvasMode`.
  - Memos key on the strategy's identity, not on `projectionName`.
- **The POC's leftovers go.** Its standalone rotation copies in `isoMath.ts` are reverted; no production code calls them. The `renderer.ts` default-parameter fallbacks become required parameters, so no caller can silently fall back to the unrotated projection.

### 3. The two meanings of "origin" stay distinct

- **Screen-space nudges.** `getTilePosition({ origin })` keeps returning offsets from the tile centre in screen space. That is right for anything that faces the screen: a sprite's base, popovers, drop ghosts.
- **Tile-space corners.** Anything whose local axes are the tile axes anchors at a tile-space corner through `getTileCorner` / `getRenderedTileCorner`. That covers a CSS-matrixed rectangle or text box, a selection frame and a flat icon. The corner swings around the centre as the plane turns; unrotated, the two meanings coincide.
- Both live in `renderedGeometry.ts`, and its source-scan contract test remains the gate.

### 4. Off-grid offsets are stored unrotated and transformed at render time

- **No format change, no migration.** A stored `offset` keeps exactly today's meaning: a residual in the projection's unrotated frame. Rendering applies `M(θ)·offset`, where P is the iso tile→screen map and

  `M(θ) = P·R(θ)·P⁻¹ = [[cos θ, κ·sin θ], [−sin θ / κ, cos θ]]`, with `κ = halfW / halfH ≈ 1.73`, `det M = 1` and `M(θ)⁻¹ = M(−θ)`.

  Equivalently, the offset is a fixed sub-tile vector that turns with its tile.
- **Writes.** The drag commit, the placement residual and the floating-label drag apply `M(−θ)` to the screen residual before storing it.
- **One composer.** Only `renderedGeometry.ts` composes offsets. The three hand-composed sites move into it, and the contract test is extended so a new one fails CI.
- **Rotation never writes the model.** The iso↔2D switch keeps its own model-writing re-projection (R1/PROJ-07, EDITABLE only), now computed between the two *unrotated* strategies.

### 5. One depth comparator for paint and pick

Depth is `−(x′ + y′)` with `(x′, y′) = R(θ)·(x, y)`, followed by a deterministic tiebreak (stable model order). [`SceneCanvas`](../../packages/axoview-lib/src/components/SceneLayers/SceneCanvas.tsx), [`hitDetection`](../../packages/axoview-lib/src/utils/hitDetection.ts) and the DOM node overlay all take the comparator from [`renderOrder.ts`](../../packages/axoview-lib/src/utils/renderOrder.ts). The item clicked is therefore always the item painted. In 2D, depth stays today's `−x − y`.

### 6. Motion is a GPU transform; geometry is rebuilt only when rotation settles

ADR 0038 §5 holds under rotation. Take geometry built at θ₀. The scene at θ is exactly `M(θ − θ₀)` applied to ground-plane positions and to billboard *anchors*, because `M(θ)·M(θ₀)⁻¹ = M(θ − θ₀)`. Billboard quads stay screen-aligned.

- **Uniforms only while moving.** While a rotation is in motion (a step animation or an Alt+drag), frames change uniforms only. `buildInstances` runs once when the rotation settles, which restores exact output. During a long gesture it may also run at bounded intervals, never per frame.
- **Accepted while moving:**
  - Stroke widths and dash spacing shear with `|θ − θ₀|`, about ±16 % at 15°.
  - Paint order stays frozen at θ₀.
  - Keep-upright flips ([ADR 0050](0050-view-rotation-render-and-legibility-policy.md)) apply at settle.
- **Content DOM layers follow the floor.** Text boxes, connector labels and the selected-item hybrids move through transform-only updates, never a per-frame React re-render of N components.
- **Interaction-only DOM layers pause.** Label hit proxies and transform handles are suspended during motion and re-synced at settle.
- **Pan and zoom** stay uniform-only at any θ.

### 7. How θ changes

All changes go through `uiState.actions.setViewRotation`, which keeps the tile under the viewport centre fixed.

| Route | Behaviour | Where |
|---|---|---|
| **Dock widget**, in the BottomDock right cluster, which is the viewport-state slot [ADR 0005 §4](0005-toolbar-and-dock-layout-contract.md) reserves | ⟲ / ⟳ step 15° to the next multiple of 15°. The angle readout is a button that returns to the page default (ADR 0051). Its icons are distinct from the per-item "Rotate 90°" handle ([ux-principles §2.2](../guidelines/ux-principles.md)). The POC's slider is dropped. | every interactive mode |
| **Q / E** | Step 15° counter-clockwise / clockwise on the same lattice. **Shift+Q / Shift+E** jump to the next cardinal angle. | every interactive mode; classified `viewer` in [`readonlyPolicy.ts`](../../packages/axoview-lib/src/interaction/readonlyPolicy.ts) |
| **Alt + left-drag** on the canvas | Continuous orbit, about 0.4° per horizontal px; holding Shift snaps to 15°. It is an interaction-manager mode, not a capture-phase hook. An Alt-press released before the drag threshold is still an Alt+click, so waypoint removal keeps working. | every interactive mode, iso only |

- **Step animations** ease along the shortest arc in about 220 ms, and are instant under `prefers-reduced-motion`. A canvas press during an animation completes it first.
- **Touch:** twist stays out of scope ([ADR 0018](0018-touch-pen-gesture-contract.md)). The dock buttons work on touch.

> **TODO (owner):** confirm the step size (15°, with Shift jumping to the next cardinal angle), dropping the POC's slider, and the drag sensitivity.

## Consequences

**Positive:**
- **Embedding-safe.** Two instances, the export dialog's included, rotate independently.
- **Exact output at rest at any angle**, and 0° stays bit-identical.
- **Orbit is O(1) per frame on the CPU at any diagram size**, as pan is (ADR 0038 §5).
- **Off-grid content stays put** without a migration, and one comparator ends painter/picker disagreement.

**Negative / risks:**
- **GPU visuals are invisible to CI.** The vertex shader gains instance classes, and chips and stalks must stop baking their screen offset into the anchor. CI is pixel-blind, so every step needs a real-browser check ([canvas-rendering-guidelines §11](../guidelines/canvas-rendering-guidelines.md)).
- **A settle rebuild costs about one spawn settle:** about 117 ms measured at 20k nodes, more with connectors. Huge diagrams take a one-off hitch at the end of a gesture.
- **Transient shear shows on long drags** if the re-baseline interval is too sparse.
- **Free resting angles look off-grid.** They show non-diamond cells with diamond-footed sprites standing on them; the owner accepted this.
- **Alt+drag is taken** by the window manager on some Linux desktops. Q/E and the dock remain.
- **Test doubles grow.** Every hand-written `useCanvasMode` mock gains the new fields; the POC already patched three.

## Implementation notes (non-binding)

- **Keep the POC's pure helpers, drop its state.** `rotateTile`, `normaliseDeg` and the matrix builder stay, now taking θ as an argument; the module-level angle goes.
- **`glSpriteBatch.ts`.** Add a `mat2` uniform. Instance-class bits in `i_misc.x` and the screen offset in `i_misc.z` keep the 80-byte stride.
- **`SceneCanvas.tsx`.** Take θ out of the geometry-effect dependencies, feed `M(θ − θ₀)` to the draw path, and key the sort cache on θ₀.
- **Perf harness.** Add `PERF_ROTATE` next to `PERF_PAN` in [`engine-perf.spec.ts`](../../packages/axoview-e2e/perf/engine-perf.spec.ts): a 13-step eased 15° turn and a sustained ±45° sine at N = 1k / 5k / 20k. Assert that `buildDelta` equals the settle count ([ADR 0020](0020-engine-perf-harness-and-measurement-protocol.md) protocol).
- **Arrow nudge.** Pick the ±x/±y tile unit whose rotated projection best matches the key's 0° on-screen direction.
- **Flat-icon resize.** Pass the handle's real screen direction (handle position minus centre) to `NODE.TRANSFORM` instead of `CORNER_SIGN`.

## Acceptance criteria

- **Unit tests:**
  - `makeIsometricStrategy(0)` returns the shared strategy, and every 0° output is unchanged.
  - `fromScreen ∘ toScreen` round-trips at seven angles.
  - `M(θ)` equals `P·R(θ)·P⁻¹`.
  - Writing then rendering an offset round-trips at 0°, 37°, 90° and 180°.
  - Two uiState stores with different θ project and pick independently.
  - Arrow nudge moves on screen in the key's direction at 0°, ±90°, 180° and 37°.
  - Dragging a flat-icon handle outward grows the icon at 0°, 90° and 180°.
  - Painter and picker agree on tied nodes at every cardinal angle.
  - θ has no effect in 2D.
  - The contract test fails on a hand-composed offset.
- **Perf (`PERF_ROTATE`):** no per-frame build during motion at 1k, 5k and 20k nodes, and p95 motion frame ≤ 16.7 ms at all three tiers on the reference GPU.

  > **TODO (owner):** confirm these thresholds.
- **Manual verification** (real browser, real GPU):
  - Orbit a 1k mixed-element diagram without stutter; geometry is exact after release.
  - Alt+click still removes a waypoint.
  - Opening and closing the export dialog leaves the live angle intact.
  - Round-trip to 2D and back at 37°.
- **E2E:** click-select, drag, handle resize and lasso at 37° and 90°.
