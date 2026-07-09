// CanvasCompositorOverlay — a permanent, empty, pointer-transparent full-area
// SVG kept mounted over the WebGL scene-layer canvases.
//
// WHY: on some GPUs/drivers Chrome fails to recomposite the stacked WebGL
// scene-layer canvases when a sibling DOM overlay ABOVE them toggles (the
// "session not saved" banner, the annotation panel, a dock). Chrome invalidates
// only the toggled overlay's rectangle and leaves the canvas UN-repainted there
// — a stale blank strip exactly the overlay's size, until a pan/resize forces a
// full recomposite. The drawing buffers are correct the whole time (image export
// is unaffected, and a forced repaint reveals the content), so this is a
// paint/composite bug, not a render or cull bug — which is why it reproduced on
// one machine's GPU and not another.
//
// THE FIX (found empirically): keeping a full-area SVG overlay present above the
// canvases forces Chrome to composite the whole region as a unit, so a sibling's
// partial invalidation can no longer leave a stale strip. This is exactly why
// the bug "disappeared" whenever the AnnotationLayer — itself a full-area SVG at
// the same z-index — happened to be open; this component is that overlay made
// permanent. A per-canvas `transform: translateZ(0)` layer promotion did NOT fix
// it; only the overlay does. See docs/canvas-rendering-guidelines.md.
//
// It draws nothing, captures no pointers (pointerEvents: none), and is aria-
// hidden, so it is inert to interaction and accessibility. Mounted next to the
// AnnotationLayer (same positioned ancestor + z-index) so it spans the canvas.
export const CanvasCompositorOverlay = () => (
  <div
    data-axoview-id="canvas-compositor-overlay"
    aria-hidden
    style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 6
    }}
  >
    <svg
      width="100%"
      height="100%"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'visible',
        pointerEvents: 'none'
      }}
    />
  </div>
);
