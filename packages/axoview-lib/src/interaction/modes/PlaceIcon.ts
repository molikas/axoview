import { produce } from 'immer';
import { ModeActions } from 'src/types';
import {
  generateId,
  getItemAtTile,
  findNearestUnoccupiedTile
} from 'src/utils';
import { resolvePlacement, cursorTileResidual } from 'src/utils/resolvePlacement';
import { VIEW_ITEM_DEFAULTS } from 'src/config';

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
  mouseup: ({ uiState, scene }) => {
    if (uiState.mode.type !== 'PLACE_ICON') return;

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
