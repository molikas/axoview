import { setWindowCursor, generateId } from 'src/utils';
import { resolvePlacement, cursorTileResidual } from 'src/utils/resolvePlacement';
import { TEXTBOX_DEFAULTS } from 'src/config';
import { exceedsTapSlop } from 'src/config/tapGesture';
import { ModeActions } from 'src/types';

// Point-and-click placement (mirrors PlaceIcon): the Elements deck ARMS this
// mode with no element created; the next canvas click drops a text box at the
// cursor and returns to CURSOR. A right-click cancels (handled in usePanHandlers
// — the armed tool aborts to CURSOR without placing). The floating Label has its
// own mode (modes/Label.ts) — this mode is text-only (ADR 0031).
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
    scene.createTextBox({
      ...TEXTBOX_DEFAULTS,
      id,
      tile: placement.tile,
      offset: placement.offset
    });

    // Place-and-type (owner 2026-07-02): select the box so the top strip targets
    // it, but DON'T open the Details deck; drop straight into inline edit on the
    // canvas next frame (once the box has mounted + attached its inline-edit
    // listener). Text is edited on-canvas and formatted from the strip — the deck
    // no longer carries a text editor. Matches Figma / draw.io.
    uiState.actions.setItemControls({ type: 'TEXTBOX', id }, { openPanel: false });
    uiState.actions.setMode({
      type: 'CURSOR',
      showCursor: true,
      mousedownItem: null
    });
    requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent('inlineEditNodeName', { detail: { id } })
      );
    });
  }
};
