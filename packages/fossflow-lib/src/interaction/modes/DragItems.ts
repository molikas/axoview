import { produce } from 'immer';
import { ModeActions, Coords, ItemReference } from 'src/types';
import { useScene } from 'src/hooks/useScene';
import {
  getItemByIdOrThrow,
  CoordsUtils,
  getAnchorParent,
  getItemAtTile,
  setWindowCursor
} from 'src/utils';
import { UNPROJECTED_TILE_SIZE, PROJECTED_TILE_SIZE } from 'src/config';

// =============================================================================
// MQA #7 Path 4-true (EXPERIMENTAL)
// =============================================================================
//
// CSS-only drag preview for item moves. During drag:
//   - Item tiles are NOT written to the model. The drag visual is applied via
//     CSS variable mutation on the dragged Node DOM elements (compositor-only:
//     no layout, no React reconciliation, no immer reducer chain).
//   - Connector path data is refreshed in the scene store via
//     `previewConnectorPaths` so wires visually follow their endpoints. No
//     model touch; one direct sceneStore set() per frame.
//   - The drag transaction is still open (beginDragTransaction on entry), so
//     when the model finally commits on mouseup, one history entry covers
//     the whole drag for undo.
//
// On mouseup: read the final preview tiles, commit them to the model via the
// existing batchUpdateViewItemTiles, then commitDragTransaction.
//
// Textboxes / rectangles / connector-anchor drags keep the existing reducer
// path — they're rarely the multi-element case and don't justify the rewrite.
// =============================================================================

// Module-level drag preview state. Cleared by entry/exit. Single-drag-at-a-
// time invariant matches uiStateStore.mode === 'DRAG_ITEMS'.
const previewTiles = new Map<string, Coords>();

function tileDeltaToPixels(
  dx: number,
  dy: number,
  canvasMode: 'ISOMETRIC' | '2D'
): { x: number; y: number } {
  if (canvasMode === '2D') {
    return { x: dx * UNPROJECTED_TILE_SIZE, y: -dy * UNPROJECTED_TILE_SIZE };
  }
  // Isometric — matches isometricStrategy.toScreen() delta math.
  const halfW = PROJECTED_TILE_SIZE.width / 2;
  const halfH = PROJECTED_TILE_SIZE.height / 2;
  return { x: halfW * (dx - dy), y: -halfH * (dx + dy) };
}

function applyCssOffset(id: string, dx: number, dy: number) {
  const el = document.querySelector<HTMLElement>(`[data-drag-id="${id}"]`);
  if (!el) return;
  el.style.setProperty('--ff-drag-dx', `${dx}px`);
  el.style.setProperty('--ff-drag-dy', `${dy}px`);
}

function clearAllCssOffsets() {
  for (const id of previewTiles.keys()) {
    const el = document.querySelector<HTMLElement>(`[data-drag-id="${id}"]`);
    if (el) {
      el.style.removeProperty('--ff-drag-dx');
      el.style.removeProperty('--ff-drag-dy');
    }
  }
}

const dragItems = (
  items: ItemReference[],
  tile: Coords,
  mouseOffset: Coords,
  initialTiles: Record<string, Coords>,
  initialRectangles: Record<string, { from: Coords; to: Coords }>,
  scene: ReturnType<typeof useScene>,
  canvasMode: 'ISOMETRIC' | '2D'
) => {
  const itemRefs = items.filter((item) => item.type === 'ITEM');
  const textBoxRefs = items.filter((item) => item.type === 'TEXTBOX');
  const rectangleRefs = items.filter((item) => item.type === 'RECTANGLE');
  const anchorRefs = items.filter((item) => item.type === 'CONNECTOR_ANCHOR');

  // Nodes — collision check against external items (model is stale during
  // drag, but external items haven't moved so their tiles are authoritative).
  let nodeUpdates: Array<{ id: string; tile: Coords }> | null = null;
  if (itemRefs.length > 0) {
    const draggedIdSet = new Set(itemRefs.map((i) => i.id));

    const targets = itemRefs.map((item) => ({
      id: item.id,
      targetTile: initialTiles[item.id]
        ? CoordsUtils.add(initialTiles[item.id], mouseOffset)
        : getItemByIdOrThrow(scene.items, item.id).value.tile
    }));

    const externalOccupied = new Set(
      scene.items
        .filter((si) => !draggedIdSet.has(si.id))
        .map((si) => `${si.tile.x},${si.tile.y}`)
    );

    const targetKeys = new Set<string>();
    let hasCollision = false;
    for (const t of targets) {
      const key = `${t.targetTile.x},${t.targetTile.y}`;
      if (externalOccupied.has(key) || targetKeys.has(key)) {
        hasCollision = true;
        break;
      }
      targetKeys.add(key);
    }

    if (!hasCollision) {
      nodeUpdates = targets.map((t) => ({ id: t.id, tile: t.targetTile }));
    }
  }

  // Apply CSS preview for nodes (no model write, no React, no immer).
  if (nodeUpdates && nodeUpdates.length > 0) {
    for (const u of nodeUpdates) {
      const initial = initialTiles[u.id];
      if (!initial) continue;
      const dx = u.tile.x - initial.x;
      const dy = u.tile.y - initial.y;
      const pixels = tileDeltaToPixels(dx, dy, canvasMode);
      applyCssOffset(u.id, pixels.x, pixels.y);
      previewTiles.set(u.id, u.tile);
    }
    // Refresh connector paths so wires visually follow the dragged endpoints.
    // Direct scene-store write, no immer.
    scene.previewConnectorPaths(previewTiles);
  }

  // Textboxes / rectangles / connector anchors — existing path. Wrap only the
  // ones that actually have updates.
  const textBoxUpdates = textBoxRefs.map((item) => ({
    id: item.id,
    tile: initialTiles[item.id]
      ? CoordsUtils.add(initialTiles[item.id], mouseOffset)
      : getItemByIdOrThrow(scene.textBoxes, item.id).value.tile
  }));

  const rectangleUpdates = rectangleRefs.map((item) => {
    const init = initialRectangles[item.id];
    if (init) {
      return {
        id: item.id,
        from: CoordsUtils.add(init.from, mouseOffset),
        to: CoordsUtils.add(init.to, mouseOffset)
      };
    }
    const r = getItemByIdOrThrow(scene.rectangles, item.id).value;
    return { id: item.id, from: r.from, to: r.to };
  });

  if (
    textBoxUpdates.length > 0 ||
    rectangleUpdates.length > 0 ||
    anchorRefs.length > 0
  ) {
    scene.transaction(() => {
      textBoxUpdates.forEach(({ id, tile: newTile }) => {
        scene.updateTextBox(id, { tile: newTile });
      });

      rectangleUpdates.forEach(({ id, from, to }) => {
        scene.updateRectangle(id, { from, to });
      });

      anchorRefs.forEach((item) => {
        const connector = getAnchorParent(item.id, scene.connectors);
        const newConnector = produce(connector, (draft) => {
          const anchor = getItemByIdOrThrow(connector.anchors, item.id);
          if (initialTiles[item.id]) {
            const newTile = CoordsUtils.add(initialTiles[item.id], mouseOffset);
            draft.anchors[anchor.index] = {
              ...anchor.value,
              ref: { tile: newTile }
            };
          } else {
            const itemAtTile = getItemAtTile({ tile, scene });
            switch (itemAtTile?.type) {
              case 'ITEM':
                draft.anchors[anchor.index] = {
                  ...anchor.value,
                  ref: { item: itemAtTile.id }
                };
                break;
              case 'CONNECTOR_ANCHOR':
                draft.anchors[anchor.index] = {
                  ...anchor.value,
                  ref: { anchor: itemAtTile.id }
                };
                break;
              default:
                draft.anchors[anchor.index] = {
                  ...anchor.value,
                  ref: { tile }
                };
                break;
            }
          }
        });
        scene.updateConnector(connector.id, newConnector);
      });
    });
  }
};

export const DragItems: ModeActions = {
  entry: ({ uiState, rendererRef, scene }) => {
    if (uiState.mode.type !== 'DRAG_ITEMS' || !uiState.mouse.mousedown) return;
    rendererRef.style.userSelect = 'none';
    setWindowCursor('grabbing');
    previewTiles.clear();
    // One history entry covers the whole drag; per-tick model writes (only
    // textboxes/rectangles/anchors in the CSS-preview path) skip
    // produceWithPatches while pendingPre is frozen.
    scene.beginDragTransaction();
  },
  exit: ({ rendererRef, scene }) => {
    rendererRef.style.userSelect = 'auto';
    setWindowCursor('default');
    // Safety net for escape / programmatic mode change. If exit fires without
    // a normal mouseup, clear the preview without committing.
    clearAllCssOffsets();
    previewTiles.clear();
    scene.commitDragTransaction();
  },
  mousemove: ({ uiState, scene }) => {
    if (uiState.mode.type !== 'DRAG_ITEMS' || !uiState.mouse.mousedown) return;

    const mouseOffset = CoordsUtils.subtract(
      uiState.mouse.position.tile,
      uiState.mouse.mousedown.tile
    );

    const hasDraggedNode = uiState.mode.items.some((i) => i.type === 'ITEM');
    const draggedIds = new Set(uiState.mode.items.map((i) => i.id));
    const itemAtCursor = getItemAtTile({
      tile: uiState.mouse.position.tile,
      scene
    });
    if (
      hasDraggedNode &&
      itemAtCursor?.type === 'ITEM' &&
      !draggedIds.has(itemAtCursor.id)
    ) {
      setWindowCursor('not-allowed');
    } else {
      setWindowCursor('grabbing');
    }

    dragItems(
      uiState.mode.items,
      uiState.mouse.position.tile,
      mouseOffset,
      uiState.mode.initialTiles,
      uiState.mode.initialRectangles,
      scene,
      uiState.canvasMode
    );
  },
  mouseup: ({ uiState, scene }) => {
    // Commit any deferred CSS-preview node moves to the model BEFORE closing
    // the drag transaction — that way commitDragTransaction captures one
    // history entry covering the whole drag.
    if (previewTiles.size > 0) {
      const updates = Array.from(previewTiles, ([id, tile]) => ({ id, tile }));
      scene.batchUpdateViewItemTiles(updates);
      clearAllCssOffsets();
      previewTiles.clear();
    }

    scene.commitDragTransaction();
    uiState.actions.setItemControls(null);
    uiState.actions.setMode({
      type: 'CURSOR',
      showCursor: true,
      mousedownItem: null
    });
  }
};
