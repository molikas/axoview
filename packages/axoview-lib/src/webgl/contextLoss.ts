// ---------------------------------------------------------------------------
// contextLoss — WebGL2 context-loss recovery wiring shared by the four GPU
// SceneLayer canvases (Nodes / Labels / Connectors / Rectangles).
//
// WebGL2 is the sole render substrate (ADR 0038): there is no Canvas2D/DOM bulk
// fallback, so a lost GPU context (tab reclaim, driver reset, GPU switch, or the
// browser force-losing the oldest context when a session nears the ~16-context
// cap) would otherwise blank every bulk layer PERMANENTLY — the default
// `webglcontextlost` behaviour is to refuse restoration unless `preventDefault`
// is called, and the memoised `isWebGL2Supported` gate never re-fires.
//
// This helper closes that gap with the minimal contract each layer needs:
//   • on loss   → preventDefault (so the browser is allowed to restore) + let the
//                 layer stop drawing into a dead context;
//   • on restore→ the layer rebuilds its SpriteBatch on the (fresh) context and
//                 repaints.
// It is DRAW-side only; scene/model state is untouched, so no user work is lost.
// Full unit coverage waits on the webgl/ ts-jest transform fix (ADR 0038
// §Deferred); this path can't be exercised in jsdom (no WebGL2) — verify with a
// manual `WEBGL_lose_context` smoke.
// ---------------------------------------------------------------------------

export interface ContextLossHandlers {
  /** Fired after `webglcontextlost` (already `preventDefault`ed). Stop drawing. */
  onLost: () => void;
  /** Fired on `webglcontextrestored`. Rebuild GL resources + repaint. */
  onRestored: () => void;
}

/**
 * Attach context-loss/restore listeners to a WebGL canvas. Returns a detach
 * function for the effect cleanup. `preventDefault` on loss is what makes the
 * subsequent `webglcontextrestored` event possible at all.
 */
export const attachContextLossRecovery = (
  canvas: HTMLCanvasElement,
  handlers: ContextLossHandlers
): (() => void) => {
  const onLost = (e: Event) => {
    // Without this the context is gone for good — restoration never fires.
    e.preventDefault();
    handlers.onLost();
  };
  const onRestored = () => handlers.onRestored();
  canvas.addEventListener('webglcontextlost', onLost as EventListener);
  canvas.addEventListener('webglcontextrestored', onRestored);
  return () => {
    canvas.removeEventListener('webglcontextlost', onLost as EventListener);
    canvas.removeEventListener('webglcontextrestored', onRestored);
  };
};
