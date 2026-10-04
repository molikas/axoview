# ADR 0050 — View Rotation: Render & Legibility Policy

**Status:** Proposed
**Date:** 2026-10-03
**Supersedes:** none
**Superseded by:** none

*(Non-supersession context: governs how each element class renders under the rotation of [ADR 0049](0049-view-rotation-camera-and-projection-model.md); sibling of [ADR 0051](0051-view-rotation-default-angle-sharing-and-export.md). Adds a background pass to the single WebGL2 context of [ADR 0038](0038-webgl-instanced-render-substrate.md), changes how image export ([ADR 0025](0025-image-export-robustness-and-presets.md)) captures GPU content, and keeps annotation ink ([ADR 0014](0014-ephemeral-annotation-overlay.md)) on what it marks. Generalises the ground-plane-versus-billboard test of [canvas-rendering-guidelines §13](../guidelines/canvas-rendering-guidelines.md).)*

## Context

Rotating the floor raises five visual questions that the POC answered only in part.

**Text and logos lying on the floor turn upside-down.**
- Text boxes are the only text drawn flat on the floor. Each is a DOM element placed at a tile corner and mapped onto the plane by a CSS matrix ([`useIsoProjection.ts`](../../packages/axoview-lib/src/hooks/useIsoProjection.ts), [`TextBox.tsx`](../../packages/axoview-lib/src/components/SceneLayers/TextBoxes/TextBox.tsx)). The in-place editor ([`TextBoxInlineEditor.tsx`](../../packages/axoview-lib/src/components/SceneLayers/TextBoxes/TextBoxInlineEditor.tsx), ADR 0034) lives inside that projected container.
- Flat icons are mapped onto the floor the same way ([`nodeEmitter.ts`](../../packages/axoview-lib/src/webgl/scene/nodeEmitter.ts)). That covers every AWS, GCP, Azure, Kubernetes and Material icon; the isoflow pack's 37 icons are the only upright sprites.
- Worked from the matrices, the reading direction points leftward at these angles:

| Orientation | Reads leftward / upside-down for θ in | Reads vertically at |
|---|---|---|
| X (and flat icons) | (45°, 180°] ∪ (−180°, −135°) | 45°, −135° |
| Y | (135°, 180°] ∪ (−180°, −45°) | −45°, 135° |

- Both orientations read correctly only for |θ| < 45°, and both are upside-down past 135°.
- The matrix determinant stays positive, so text is rotated but never mirrored.
- No flip-for-legibility logic exists anywhere today.
- Everything else that carries text is already a billboard: node name chips and stalks, floating labels, connector labels, the view-mode popover, link cards and menus.

**The grid shimmers and pops.**
- Today's grid is a repeating SVG background (`Grid.tsx`, removed by §5 below — see git history): black at 15 % opacity, one SVG unit wide and scaled by zoom, so lines thin and fade as you zoom out.
- An SVG tile cannot represent a rotated lattice. The POC therefore hides it when θ ≠ 0 and strokes every line on a Canvas2D instead: 1.5 px at 11 %, capped at 600 lines per axis, with a full redraw on every pan and zoom.
- Measured on the POC, peak alpha per line varies up to ~4× at ~38° because each line lands at a different sub-pixel phase.
- Switching back to the SVG at exactly 0° is a visible jump. With free resting angles, that happens every time a user drags across 0°.
- The substrate's analytic-AA line quads are no substitute: they are built on the CPU, so a grid made of them would rebuild as the view moves (forbidden by ADR 0038 §5) and would drop out at zoom 0.1.

**Export captures GPU content soft.**
- Export renders a hidden `NON_INTERACTIVE` instance and captures it with `dom-to-image-more`, which swaps the WebGL canvas for its `toDataURL()` bitmap at screen dpr ([`ExportImageDialog.tsx`](../../packages/axoview-lib/src/components/ExportImageDialog/ExportImageDialog.tsx)).
- DOM content, today's SVG grid included, renders at the export scale. GPU content is upscaled instead, and looks soft at 2–4×.

**Sprites have one view.** Each icon is one bitmap. Mirroring would be a trivial UV flip, but it would be wrong for three reasons: `dns` has lettering, lighting is baked in (a mirror swaps the lit face), and directional icons would face away.

**Annotation ink** is stored in canvas px. It is re-projected on the iso↔2D switch but not on rotation, so it detaches from what it marked.

**Prior art.**
- Map renderers distinguish map-aligned from viewport-aligned text, and flip map-aligned text so it is never rendered upside-down (Mapbox's `text-rotation-alignment` and `text-keep-upright`).
- The standard way to draw a grid without shimmer or moiré is a procedural shader with `fwidth` coverage and a frequency fade.

## Decision

### 1. Three element classes

| Class | Members | Under rotation |
|---|---|---|
| **Ground plane** | grid, rectangles (fill + border), connectors (strands, arrowheads, rings), footprints, selection frames, hover outlines, lasso marquee, cursor tile, annotation ink | Turns with the floor. Strokes keep a constant screen width: the mean of the two rotated axis scales, which is today's value at 0°. |
| **Billboard** | isometric sprites, node name chips and stalks, floating labels, connector labels, popovers, link cards, menus, transform handles | The anchor follows the floor. The quad stays upright and screen-aligned, and is never sheared. |
| **Floor-readable** | text boxes (with their inline editor), flat icons | Turns with the floor, then keep-upright (§2) applies. |

### 2. Keep-upright for floor-readable content

- **The flip.** When an element's reading direction (its local +u axis, taken through the rotated plane) points leftward on screen, the element is drawn rotated 180° within its own plane, about the centre of its footprint. Its footprint, hit area and selection frame do not change, and nothing is ever mirrored.
- **When it applies.** The flip windows are those in the table above. A hysteresis band of about 10° around each boundary keeps an element resting near a boundary from flickering. During motion the flip applies at settle (ADR 0049 §6).
- **One predicate drives every path:** the DOM matrix, the WebGL quad and UV, the inline editor, and export.
- **Rejected alternatives:**
  - Drawing text upright over the rotated footprint. That loses the painted-on-the-floor look and makes X/Y orientation meaningless.
  - Snapping to four in-plane orientations. Width and height would swap, so text would reflow.

### 3. Billboards keep their single bitmap

There is no per-angle art and no mirroring. A diamond-footed sprite standing on a non-diamond cell at an in-between angle is accepted (owner, 2026-10-03, with the free-angle choice).

### 4. Annotation ink follows the floor

Strokes are stored in the unrotated frame and drawn through `M(θ)` with non-scaling strokes. This applies the offset idea of ADR 0049 §4 to uiState only, so viewers get it and nothing is saved.

### 5. One procedural grid at every angle

- **What it is.** The grid becomes a full-screen pass inside SceneCanvas's existing WebGL2 context ([`glSpriteBatch.ts`](../../packages/axoview-lib/src/webgl/glSpriteBatch.ts)), drawn after the clear and before the instanced bulk. Its fragment shader:
  - maps each pixel back to tile space through the inverse of the current view (pan, zoom, θ);
  - draws the half-integer lines with `fwidth` coverage at a constant screen width;
  - fades the lines out as cells shrink towards a pixel.
- **It replaces both SVG grid tiles** (iso and 2D) and the POC's Canvas2D path. One implementation runs at every angle and in both projections, so nothing switches path at 0° and nothing pops.
- **0° fidelity.** At 0° it reproduces today's look to the eye: black at 15 %, line width ≈ zoom px, fading on zoom-out. That is checked by side-by-side screenshots. Its exact pixels are not covered by the 0° bit-identity rule.
- **Cost and compatibility.**
  - Pan, zoom and rotation change uniforms only.
  - Colour is a uniform, ready for a dark theme.
  - Z-order is unchanged: above the container background, below every DOM layer.
  - `renderer.showGrid` and the export checkbox keep working.

### 6. Export renders GPU content at export resolution

The hidden export instance renders its SceneCanvas at `dpr = export scale`, within the existing backing-store and atlas clamps. A WebGL grid then exports as crisply as today's SVG one, and icons and chips get sharper too. This ships together with §5; without it, §5 makes exported grids softer than today's.

**2026-10-04 (shake-out):** the backing-store clamp alone did not hold. At 2× a large diagram asks for a ~120 MP buffer, the browser allocated a smaller one, and the export lost every GPU element outside the scene's lower-left. The scene now renders at the dpr of the buffer the browser actually allocated ([canvas-rendering guideline §9](../guidelines/canvas-rendering-guidelines.md)), so on such a machine exported GPU content is softer than the export scale, never cropped. ADR 0025 §4's Screenshot pixel budget keeps the default export well inside that range.

## Consequences

**Positive:**
- **Legible at every angle.** Floor text and logos are never upside-down.
- **No grid shimmer, moiré or pop**, and grid cost does not grow with zoom-out line count.
- **One grid implementation.** The two SVG assets, the CSS background code and the POC's Canvas2D path all go.
- **Sharper exports** for all GPU content, not just the grid.
- **Annotation ink stays** on what it marks.

**Negative / risks:**
- **The grid becomes pixel-invisible to CI.** It needs real-browser screenshots at several angles and zooms ([canvas-rendering-guidelines §11](../guidelines/canvas-rendering-guidelines.md)), and its 0° pixels change slightly.
- **The flip is a visible jump** at its boundaries. Hysteresis bounds flicker, not the jump itself.
- **Exporting at a higher dpr costs memory and time**, within the existing clamps.
- **Pre-existing, unchanged:** Quill's link tooltip is already misplaced inside the projected text-box container.

## Implementation notes (non-binding)

- **Grid program.** A second small program in `glSpriteBatch.ts`. It draws one full-screen triangle from `gl_VertexID` and takes these uniforms: `u_view`, `u_resolution`, the inverse tile→scene 2×2 matrix with θ folded in, colour, alpha and a fade band.
- **Removals.** Delete `grid-tile-bg.svg`, `grid-tile-2d.svg`, and the CSS-background and Canvas2D paths in `Grid.tsx`.
- **Keep-upright wiring.**
  - DOM: compose the flip into the matrix built by `useIsoProjection`.
  - WebGL: flip the flat-icon quad origin and basis (or UV) in `nodeEmitter.ts`.
  - The text-box editor inherits the flip from its container.
- **Annotation ink.** Apply a group `matrix(M(θ))` in `AnnotationLayer.tsx` with `vector-effect: non-scaling-stroke`, and store new strokes through `M(−θ)`.
- **Guidelines.** Add entries to canvas-rendering-guidelines for the grid pass, keep-upright, and the motion-time transform.

## Acceptance criteria

- **Unit tests:**
  - The flip predicate is correct per orientation at each boundary ± the hysteresis band.
  - The flip preserves the footprint corners.
  - The grid's inverse-view matrix round-trips with `toScreen`.
  - Ink round-trips through `M(θ)·M(−θ)`.
- **Manual verification** (real browser, real GPU):
  - Screenshots at 0°, 37°, 90° and 180°, at zoom 0.1, 0.5 and 1, show no shimmer and no moiré, and no pop while dragging across 0°.
  - X and Y text boxes read left-to-right at 0°, ±60°, ±120° and 180°, including while editing.
  - Pack logos are never upside-down.
  - A rotated PNG at 1× and 4× has a crisp grid.
- **E2E:** a non-zero-angle export produces the rotated image (a pixel probe at a known element position).
