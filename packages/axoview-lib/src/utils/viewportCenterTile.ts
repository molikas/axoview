// viewportCenterTile — the tile currently under the centre of the renderer.
//
// Keyboard interactions have no cursor, so any "place here" gesture driven from
// the keyboard (C2 / Decision #7: Enter/Space on an Elements icon tile) needs a
// well-defined target tile. The viewport-centre is the natural choice: it is the
// tile the user is looking at, independent of where (if ever) the mouse last
// went. This is also the fallback B9 will reuse for the Text card / text hotkey
// when the pointer never entered the canvas (`mouse.position.tile` is still the
// {0,0} initial value), so the helper is intentionally generic.
//
// Derivation mirrors getMouse() in renderer.ts: getMouse converts a
// renderer-relative screen point to a tile via the injected `screenToTile`. The
// renderer centre in those same renderer-relative coords is simply
// { x: rendererSize.width / 2, y: rendererSize.height / 2 } (getMouse subtracts
// the element's bounding-rect origin, so its coordinate space is already
// renderer-relative). Feeding that centre through the same mode-aware
// `screenToTile` (from useCanvasMode) yields the centre tile in both ISOMETRIC
// and 2D modes.

import { Coords, Scroll, Size } from 'src/types';
import { ScreenToTileFn } from 'src/utils/renderer';

export interface ViewportCenterTileParams {
  /** Current renderer pixel size (uiState.rendererSize). */
  rendererSize: Size;
  /** Current canvas scroll (uiState.scroll). */
  scroll: Scroll;
  /** Current canvas zoom (uiState.zoom). */
  zoom: number;
  /**
   * Mode-aware screen→tile transform. Inject from `useCanvasMode().screenToTile`
   * (the same fn useInteractionManager threads into getMouse), so the result is
   * correct in both ISOMETRIC and 2D canvas modes. Defaults are deliberately
   * NOT provided — callers always have a CanvasMode in scope.
   */
  screenToTile: ScreenToTileFn;
}

/**
 * Returns the integer-ish tile at the centre of the renderer viewport.
 *
 * The result is whatever the supplied `screenToTile` returns for the centre
 * screen point — i.e. a fractional tile in the same convention as
 * `mouse.position.tile`. Callers that need a snapped/unoccupied tile should run
 * it through `findNearestUnoccupiedTile` / `resolvePlacement`, exactly as the
 * PlaceIcon mouseup path does for the cursor tile.
 *
 * @example
 * const { screenToTile } = useCanvasMode();
 * const { zoom, scroll, rendererSize } = uiStateApi.getState();
 * const tile = viewportCenterTile({ rendererSize, scroll, zoom, screenToTile });
 */
export const viewportCenterTile = ({
  rendererSize,
  scroll,
  zoom,
  screenToTile
}: ViewportCenterTileParams): Coords => {
  const center: Coords = {
    x: rendererSize.width / 2,
    y: rendererSize.height / 2
  };

  return screenToTile({ mouse: center, zoom, scroll, rendererSize });
};
