import { setWindowCursor, generateId } from 'src/utils';
import { resolvePlacement, cursorTileResidual } from 'src/utils/resolvePlacement';
import { TEXTBOX_DEFAULTS, LABEL_DEFAULTS } from 'src/config';
import { exceedsTapSlop } from 'src/config/tapGesture';
import { ModeActions } from 'src/types';

// Point-and-click placement (mirrors PlaceIcon): the Elements deck ARMS this
// mode with no element created; the next canvas click drops a text box / label
// at the cursor and returns to CURSOR. A right-click cancels (handled in
// usePanHandlers — the armed tool aborts to CURSOR without placing).
export const TextBox: ModeActions = {
  entry: () => {
    setWindowCursor('crosshair');
  },
  exit: () => {
    setWindowCursor('default');
  },
  mousemove: () => {},
  mouseup: ({ uiState, scene, isRendererInteraction }) => {
    if (uiState.mode.type !== 'TEXTBOX') return;

    // Distinguish the arming tap on the deck card (no renderer release, no move →
    // just arm) from a real placement: a canvas tap (renderer release) or a
    // drag from the panel onto the canvas (past tap-slop). Same gating PlaceIcon
    // uses so the panel click only arms.
    const moved =
      !!uiState.mouse.mousedown &&
      exceedsTapSlop(
        uiState.mouse.mousedown.screen,
        uiState.mouse.position.screen
      );
    if (!isRendererInteraction && !moved) return;

    const globalSnap = uiState.snapToGrid ?? true;
    const tile = uiState.mouse.position.tile;
    const residual = globalSnap
      ? undefined
      : cursorTileResidual(
          uiState.canvasMode,
          uiState.mouse.position.screen,
          tile,
          uiState.zoom,
          uiState.scroll,
          uiState.rendererSize
        );
    const placement = resolvePlacement(tile, residual, undefined, globalSnap);

    const id = generateId();
    const defaults =
      uiState.mode.variant === 'label' ? LABEL_DEFAULTS : TEXTBOX_DEFAULTS;
    scene.createTextBox({
      ...defaults,
      id,
      tile: placement.tile,
      offset: placement.offset
    });

    uiState.actions.setItemControls({ type: 'TEXTBOX', id });
    uiState.actions.setMode({
      type: 'CURSOR',
      showCursor: true,
      mousedownItem: null
    });
  }
};
