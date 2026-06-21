// useKeyboardIconPlacement — keyboard equivalent of the Elements-panel icon
// click/drag-to-place flow (C2 / Decision #7).
//
// The mouse flow arms PLACE_ICON (ElementsPanel.handleIconMouseDown /
// IconSelectionControls.onMouseDown) and the PlaceIcon mode reducer then calls
// scene.placeIcon at the cursor tile on release. The keyboard has no cursor, so
// Enter/Space on a focused tile must both ARM and PLACE in one step, dropping
// the node at the viewport-centre tile (viewportCenterTile helper). This hook
// returns that single "place this icon now" callback; it reuses the exact same
// scene.placeIcon + resolvePlacement chokepoint the mouse path ends in, so snap/
// off-grid/collision behaviour stays identical.

import { useCallback } from 'react';
import { useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import {
  generateId,
  findNearestUnoccupiedTile,
  viewportCenterTile
} from 'src/utils';
import { resolvePlacement, cursorTileResidual } from 'src/utils/resolvePlacement';
import { VIEW_ITEM_DEFAULTS } from 'src/config';
import { Icon } from 'src/types';

export const useKeyboardIconPlacement = () => {
  const uiStateApi = useUiStateStoreApi();
  const scene = useScene();
  const { screenToTile } = useCanvasMode();

  return useCallback(
    (icon: Icon) => {
      const uiState = uiStateApi.getState();

      // Respect the edit-only contract: placement only makes sense while the
      // diagram is editable (the disabled-panel convention already keeps the
      // Elements panel itself shut in non-edit / no-diagram states — UX §8.3).
      if (uiState.editorMode !== 'EDITABLE') return;

      // Keyboard has no cursor → target the tile under the viewport centre,
      // derived the same way getMouse derives the cursor tile (renderer-centre
      // screen point → mode-aware screenToTile). Generic helper shared with B9.
      const cursorTile = viewportCenterTile({
        rendererSize: uiState.rendererSize,
        scroll: uiState.scroll,
        zoom: uiState.zoom,
        screenToTile
      });

      // From here down this mirrors PlaceIcon.mouseup exactly (the single mouse
      // chokepoint), so snap / off-grid (ADR 0023) / collision behaviour match.
      const globalSnap = uiState.snapToGrid ?? true;
      const targetTile = globalSnap
        ? findNearestUnoccupiedTile(cursorTile, scene)
        : cursorTile;
      if (!targetTile) return;

      const residual = globalSnap
        ? undefined
        : cursorTileResidual(
            uiState.canvasMode,
            // No real screen cursor — use the renderer centre as the screen
            // point so the off-grid residual is measured against the same tile.
            {
              x: uiState.rendererSize.width / 2,
              y: uiState.rendererSize.height / 2
            },
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
          icon: icon.id
        },
        viewItem: {
          ...VIEW_ITEM_DEFAULTS,
          id: modelItemId,
          tile: placement.tile,
          offset: placement.offset
        }
      });
    },
    [uiStateApi, scene, screenToTile]
  );
};
