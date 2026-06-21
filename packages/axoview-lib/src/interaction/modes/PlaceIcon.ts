import { produce } from 'immer';
import { ModeActions } from 'src/types';
import {
  generateId,
  getItemAtTile,
  findNearestUnoccupiedTile
} from 'src/utils';
import { resolvePlacement, cursorTileResidual } from 'src/utils/resolvePlacement';
import { VIEW_ITEM_DEFAULTS } from 'src/config';
import { exceedsTapSlop } from 'src/config/tapGesture';

export const PlaceIcon: ModeActions = {
  mousemove: () => {},
  mousedown: ({ uiState, scene, isRendererInteraction }) => {
    if (uiState.mode.type !== 'PLACE_ICON' || !isRendererInteraction) return;

    if (!uiState.mode.id) {
      const itemAtTile = getItemAtTile({
        tile: uiState.mouse.position.tile,
        scene
      });

      uiState.actions.setMode({
        type: 'CURSOR',
        mousedownItem: itemAtTile,
        showCursor: true
      });

      uiState.actions.setItemControls(null);
    }
  },
  mouseup: ({ uiState, scene, isRendererInteraction }) => {
    if (uiState.mode.type !== 'PLACE_ICON') return;

    // B1 / Decision #2: a plain TAP on an Elements-panel icon must only ARM
    // placement — it must NOT place a node (the old ungated mouseup placed one
    // at the panel-projected tile, then nulled mode.id, so the real canvas click
    // did nothing). Two gestures legitimately place; one must not:
    //   • canvas tap (after arming): its mousedown is on the canvas → captured →
    //     the release reports isRendererInteraction → place.
    //   • drag-from-panel: mouse capture makes the release target the panel icon
    //     (so isRendererInteraction can't see it), but a past-tap-slop move is
    //     the reliable "this was a drag onto the canvas" signal → place.
    //   • arming tap on the icon: neither a renderer release nor a move → arm only.
    // A hit-test can't help here: the panel overlays the renderer, and capture
    // makes both e.target AND elementFromPoint resolve to the icon mid-drag.
    const moved =
      !!uiState.mouse.mousedown &&
      exceedsTapSlop(
        uiState.mouse.mousedown.screen,
        uiState.mouse.position.screen
      );
    if (!isRendererInteraction && !moved) return;

    if (uiState.mode.id !== null) {
      const globalSnap = uiState.snapToGrid ?? true;
      const cursorTile = uiState.mouse.position.tile;
      // Snapped placement avoids occupied tiles (today's behaviour). Off-grid
      // placement (global snap off, ADR 0023 #12) lands exactly under the cursor
      // with a px residual — no collision search; route both through the one
      // resolvePlacement chokepoint.
      const targetTile = globalSnap
        ? findNearestUnoccupiedTile(cursorTile, scene)
        : cursorTile;

      if (targetTile) {
        const residual = globalSnap
          ? undefined
          : cursorTileResidual(
              uiState.canvasMode,
              uiState.mouse.position.screen,
              targetTile,
              uiState.zoom,
              uiState.scroll,
              uiState.rendererSize
            );
        const placement = resolvePlacement(
          targetTile,
          residual,
          undefined,
          globalSnap
        );
        const modelItemId = generateId();

        scene.placeIcon({
          modelItem: {
            id: modelItemId,
            name: 'Untitled',
            icon: uiState.mode.id
          },
          viewItem: {
            ...VIEW_ITEM_DEFAULTS,
            id: modelItemId,
            tile: placement.tile,
            offset: placement.offset
          }
        });
      }
    }

    uiState.actions.setMode(
      produce(uiState.mode, (draft) => {
        draft.id = null;
      })
    );
  }
};
