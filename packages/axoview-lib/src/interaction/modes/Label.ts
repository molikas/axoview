import { setWindowCursor, generateId } from 'src/utils';
import { resolvePlacement, cursorTileResidual } from 'src/utils/resolvePlacement';
import { LABEL_DEFAULTS } from 'src/config';
import { exceedsTapSlop } from 'src/config/tapGesture';
import { ModeActions } from 'src/types';

// Point-and-click placement for the floating Label (ADR 0031), mirroring the
// TextBox / PlaceIcon arm-then-drop flow: the Common deck ARMS this mode with no
// element created; the next canvas click drops a Label at the cursor and returns
// to CURSOR. A right-click cancels (usePanHandlers aborts the armed tool to
// CURSOR without placing). Its own mode — not a TextBox variant.
export const Label: ModeActions = {
  entry: () => {
    setWindowCursor('crosshair');
  },
  exit: () => {
    setWindowCursor('default');
  },
  mousemove: () => {},
  mouseup: ({ uiState, scene, isRendererInteraction }) => {
    if (uiState.mode.type !== 'LABEL') return;

    // Distinguish the arming tap on the deck card (no renderer release, no move)
    // from a real placement: a canvas tap (renderer release) or a drag from the
    // panel onto the canvas (past tap-slop). Same gating as TextBox / PlaceIcon.
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
    scene.createLabel({
      ...LABEL_DEFAULTS,
      id,
      tile: placement.tile,
      offset: placement.offset
    });

    // Select the freshly-placed label (selection ring + top-bar style target)
    // but DON'T auto-open the Details deck (owner 2026-07-02) — placement should
    // keep the canvas clear; the user opens the panel deliberately if they want
    // it. Mirrors ADR 0022 §3 select-only (openPanel:false).
    uiState.actions.setItemControls({ type: 'LABEL', id }, { openPanel: false });
    uiState.actions.setMode({
      type: 'CURSOR',
      showCursor: true,
      mousedownItem: null
    });
  }
};
