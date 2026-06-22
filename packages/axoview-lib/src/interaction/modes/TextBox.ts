import { setWindowCursor } from 'src/utils';
import { resolvePlacement, cursorTileResidual } from 'src/utils/resolvePlacement';
import { ModeActions } from 'src/types';

export const TextBox: ModeActions = {
  entry: () => {
    setWindowCursor('crosshair');
  },
  exit: () => {
    setWindowCursor('default');
  },
  mousemove: ({ uiState, scene }) => {
    if (uiState.mode.type !== 'TEXTBOX' || !uiState.mode.id) return;

    // Route placement through the one chokepoint: off-grid (global snap off,
    // ADR 0023) lands the text box under the cursor with a px residual.
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

    scene.updateTextBox(uiState.mode.id, {
      tile: placement.tile,
      offset: placement.offset
    });
  },
  mouseup: ({ uiState, scene, isRendererInteraction }) => {
    if (uiState.mode.type !== 'TEXTBOX' || !uiState.mode.id) return;

    if (!isRendererInteraction) {
      scene.deleteTextBox(uiState.mode.id);
    } else {
      uiState.actions.setItemControls({
        type: 'TEXTBOX',
        id: uiState.mode.id
      });
    }

    uiState.actions.setMode({
      type: 'CURSOR',
      showCursor: true,
      mousedownItem: null
    });
  }
};
