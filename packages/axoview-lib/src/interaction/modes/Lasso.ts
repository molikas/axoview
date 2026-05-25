import { produce } from 'immer';
import {
  ModeActions,
  ItemReference,
  Coords,
  ViewItem,
  Rectangle,
  TextBox,
  Connector,
  ConnectorAnchor
} from 'src/types';
import {
  isWithinBounds,
  hasMovedTile,
  getItemByIdOrThrow,
  segmentIntersectsRect
} from 'src/utils';
import { getConnectorWaypointRefs } from 'src/utils/connectorSelection';

interface LassoScene {
  items: ViewItem[];
  rectangles: Rectangle[];
  textBoxes: TextBox[];
  connectors: Connector[];
}

// Helper to find all items within the lasso bounds. Items on locked or hidden
// layers are excluded via isItemInteractable (mqa-results.md #2).
const getItemsInBounds = (
  startTile: Coords,
  endTile: Coords,
  scene: LassoScene,
  isItemInteractable: (ref: ItemReference) => boolean
): ItemReference[] => {
  const items: ItemReference[] = [];

  // Check all nodes/items
  scene.items.forEach((item: ViewItem) => {
    if (
      isWithinBounds(item.tile, [startTile, endTile]) &&
      isItemInteractable({ type: 'ITEM', id: item.id })
    ) {
      items.push({ type: 'ITEM', id: item.id });
    }
  });

  // Check all rectangles - they must be FULLY enclosed (all 4 corners inside)
  scene.rectangles.forEach((rectangle: Rectangle) => {
    if (!isItemInteractable({ type: 'RECTANGLE', id: rectangle.id })) return;
    const corners = [
      rectangle.from,
      { x: rectangle.to.x, y: rectangle.from.y },
      rectangle.to,
      { x: rectangle.from.x, y: rectangle.to.y }
    ];

    // Rectangle is only selected if ALL corners are inside the bounds
    const allCornersInside = corners.every((corner) =>
      isWithinBounds(corner, [startTile, endTile])
    );

    if (allCornersInside) {
      items.push({ type: 'RECTANGLE', id: rectangle.id });
    }
  });

  // Check all text boxes
  scene.textBoxes.forEach((textBox: TextBox) => {
    if (
      isWithinBounds(textBox.tile, [startTile, endTile]) &&
      isItemInteractable({ type: 'TEXTBOX', id: textBox.id })
    ) {
      items.push({ type: 'TEXTBOX', id: textBox.id });
    }
  });

  // Include a connector if any segment of its path intersects the lasso
  // rectangle (path-hit semantics — mirrors click selection). A "segment"
  // is the straight line between consecutive anchors after resolving each
  // anchor to its current tile position. This covers:
  //   - Both endpoints inside (first segment trivially intersects)
  //   - Endpoints outside but the connector crosses through the lasso
  //     (regression 2026-05-25: previously missed)
  //   - One endpoint inside, the other out
  //   - Sub-paths that loop in and out via waypoints
  // Routing decoration (Manhattan bends, curve smoothing) is a render
  // concern; selection works on the anchor-defined path.
  const anchorToTile = (
    anchor: ConnectorAnchor,
    nodeItems: ViewItem[]
  ): Coords | null => {
    if (anchor.ref?.item) {
      const item = nodeItems.find((it) => it.id === anchor.ref.item);
      return item ? item.tile : null;
    }
    if (anchor.ref?.tile) return anchor.ref.tile;
    return null;
  };

  scene.connectors.forEach((connector: Connector) => {
    if (!connector.anchors || connector.anchors.length < 2) return;
    if (!isItemInteractable({ type: 'CONNECTOR', id: connector.id })) return;

    const tiles = connector.anchors.map((a) => anchorToTile(a, scene.items));

    let pathHits = false;
    for (let i = 0; i < tiles.length - 1; i += 1) {
      const a = tiles[i];
      const b = tiles[i + 1];
      if (!a || !b) continue; // anchor with unresolvable ref — skip that segment
      if (segmentIntersectsRect(a, b, [startTile, endTile])) {
        pathHits = true;
        break;
      }
    }

    if (pathHits) {
      items.push({ type: 'CONNECTOR', id: connector.id });
      items.push(...getConnectorWaypointRefs(connector));
      return;
    }

    // Connector path doesn't intersect the lasso. Still capture any free-
    // floating MIDDLE waypoint anchors inside the rect (a user could lasso
    // just a waypoint to drag it independently). Endpoints (index 0 and
    // length-1) are skipped per the contract in connectorSelection.ts —
    // splicing an endpoint would leave the connector with <2 anchors and
    // corrupt the scene (regression 2026-05-25). NOTE: with path-hit
    // semantics this branch is largely defensive; a tile-bound middle
    // waypoint inside the rect makes at least one adjacent segment touch
    // the rect, so pathHits is true and we never reach here. Kept as a
    // belt-and-suspenders fallback for edge cases.
    for (let i = 1; i < connector.anchors.length - 1; i += 1) {
      const anchor = connector.anchors[i];
      if (
        anchor.ref?.tile &&
        isWithinBounds(anchor.ref.tile, [startTile, endTile])
      ) {
        items.push({ type: 'CONNECTOR_ANCHOR', id: anchor.id });
      }
    }
  });

  return items;
};

export const Lasso: ModeActions = {
  mousemove: ({ uiState, scene, isItemInteractable }) => {
    if (uiState.mode.type !== 'LASSO' || !uiState.mouse.mousedown) return;

    if (!hasMovedTile(uiState.mouse)) return;

    if (uiState.mode.isDragging && uiState.mode.selection) {
      // User is dragging an existing selection - switch to DRAG_ITEMS mode
      const initialTiles: Record<string, Coords> = {};
      const initialRectangles: Record<string, { from: Coords; to: Coords }> =
        {};
      uiState.mode.selection.items.forEach((item) => {
        try {
          if (item.type === 'ITEM') {
            initialTiles[item.id] = getItemByIdOrThrow(
              scene.items,
              item.id
            ).value.tile;
          } else if (item.type === 'TEXTBOX') {
            initialTiles[item.id] = getItemByIdOrThrow(
              scene.textBoxes,
              item.id
            ).value.tile;
          } else if (item.type === 'RECTANGLE') {
            const r = getItemByIdOrThrow(scene.rectangles, item.id).value;
            initialRectangles[item.id] = { from: r.from, to: r.to };
          } else if (item.type === 'CONNECTOR_ANCHOR') {
            for (const connector of scene.connectors) {
              const anchor = connector.anchors.find(
                (a: ConnectorAnchor) => a.id === item.id
              );
              if (anchor?.ref?.tile) {
                initialTiles[item.id] = anchor.ref.tile;
                break;
              }
            }
          }
        } catch {}
      });
      uiState.actions.setMode({
        type: 'DRAG_ITEMS',
        showCursor: true,
        items: uiState.mode.selection.items,
        initialTiles,
        initialRectangles
      });
      return;
    }

    // User is creating/updating the selection box
    const startTile = uiState.mouse.mousedown.tile;
    const endTile = uiState.mouse.position.tile;
    // Tolerate undefined in tests that bypass the State type via `as any`.
    const gate = isItemInteractable ?? (() => true);
    const items = getItemsInBounds(startTile, endTile, scene, gate);

    uiState.actions.setMode(
      produce(uiState.mode, (draft) => {
        if (draft.type === 'LASSO') {
          draft.selection = {
            startTile,
            endTile,
            items
          };
        }
      })
    );
  },

  mousedown: ({ uiState, isRendererInteraction }) => {
    if (uiState.mode.type !== 'LASSO') return;

    // If there's an existing selection, check if click is within it.
    // Allow this even for non-renderer clicks (e.g. clicking on a node element within
    // the selection) so the drag still starts correctly.
    if (uiState.mode.selection) {
      const isWithinSelection = isWithinBounds(uiState.mouse.position.tile, [
        uiState.mode.selection.startTile,
        uiState.mode.selection.endTile
      ]);

      if (isWithinSelection) {
        // Clicked within selection - prepare to drag
        uiState.actions.setMode(
          produce(uiState.mode, (draft) => {
            if (draft.type === 'LASSO') {
              draft.isDragging = true;
            }
          })
        );
        return;
      }
    }

    // Clicked outside an existing selection — clear it and start a new drag.
    // If there's no selection yet, do nothing: mousemove will build the selection box.
    // Only act on genuine canvas interactions; UI panel clicks leave lasso mode unchanged.
    if (!isRendererInteraction) return;

    if (uiState.mode.selection) {
      // Clear the old selection so the next drag starts fresh
      uiState.actions.setMode({
        type: 'LASSO',
        showCursor: true,
        selection: null,
        isDragging: false
      });
    }
    // No selection yet — do nothing, let mousemove handle the drag
  },

  mouseup: ({ uiState }) => {
    if (uiState.mode.type !== 'LASSO') return;
    if (!uiState.mouse.mousedown) return; // toolbar click — mousedown was stopped, skip

    const hasSelection =
      uiState.mode.selection && uiState.mode.selection.items.length > 0;

    if (!hasSelection) {
      // Dragged but caught nothing — exit back to cursor
      uiState.actions.setMode({
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: null
      });
      return;
    }

    // Keep the selection visible, reset dragging flag
    uiState.actions.setMode(
      produce(uiState.mode, (draft) => {
        if (draft.type === 'LASSO') {
          draft.isDragging = false;
        }
      })
    );

    // Mirror the lasso selection into the persistent multi-selection slice so
    // tools that read selectedIds (delete, Ctrl+A, panel auto-hide, the
    // BottomDock "N selected" badge) see the same set. ADR-0006. Optional-call
    // so mode-action unit tests with a minimal actions mock keep working.
    uiState.actions.setSelectedIds?.(uiState.mode.selection!.items);
  }
};
