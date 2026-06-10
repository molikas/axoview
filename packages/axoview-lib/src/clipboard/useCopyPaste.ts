import { useCallback, startTransition } from 'react';
import { useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useModelStoreApi } from 'src/stores/modelStore';
import { useScene } from 'src/hooks/useScene';
import { Connector, Coords, Rectangle, TextBox, UiState } from 'src/types';
import { generateId } from 'src/utils';
import { findNearestUnoccupiedTilesForGroup } from 'src/utils/findNearestUnoccupiedTile';
import { ClipboardItem, ClipboardPayload } from './clipboard';
import { useClipboard } from './ClipboardContext';

interface SelectionIds {
  itemIds: string[];
  connectorIds: string[];
  rectangleIds: string[];
  textBoxIds: string[];
}

const EMPTY_SELECTION: SelectionIds = {
  itemIds: [],
  connectorIds: [],
  rectangleIds: [],
  textBoxIds: []
};

// Resolve the current selection (lasso/freehand multi-select, or the single
// itemControls target) into per-kind id lists.
function resolveSelectionIds(uiState: UiState): SelectionIds {
  const mode = uiState.mode;
  if (
    (mode.type === 'LASSO' || mode.type === 'FREEHAND_LASSO') &&
    mode.selection?.items?.length
  ) {
    const refs = mode.selection.items;
    return {
      itemIds: refs.filter((r) => r.type === 'ITEM').map((r) => r.id),
      connectorIds: refs.filter((r) => r.type === 'CONNECTOR').map((r) => r.id),
      rectangleIds: refs
        .filter((r) => r.type === 'RECTANGLE')
        .map((r) => r.id),
      textBoxIds: refs.filter((r) => r.type === 'TEXTBOX').map((r) => r.id)
    };
  }

  const ctrl = uiState.itemControls;
  if (!ctrl) return EMPTY_SELECTION;
  switch (ctrl.type) {
    case 'ITEM':
      return { ...EMPTY_SELECTION, itemIds: [ctrl.id] };
    case 'TEXTBOX':
      return { ...EMPTY_SELECTION, textBoxIds: [ctrl.id] };
    case 'RECTANGLE':
      return { ...EMPTY_SELECTION, rectangleIds: [ctrl.id] };
    case 'CONNECTOR':
      return { ...EMPTY_SELECTION, connectorIds: [ctrl.id] };
    default:
      return EMPTY_SELECTION;
  }
}

// Connectors to copy: explicitly selected, OR both item-anchors are in the
// selected-item set (so a connector between two copied nodes travels with them).
function collectClipboardConnectors(
  rawConnectors: Connector[],
  selectedConnectorIds: string[],
  selectedIdSet: Set<string>
): Connector[] {
  const selectedConnectorIdSet = new Set(selectedConnectorIds);
  return rawConnectors.filter((connector) => {
    if (selectedConnectorIdSet.has(connector.id)) return true;
    const anchorsWithItem = connector.anchors.filter((a) => a.ref?.item);
    return (
      anchorsWithItem.length >= 2 &&
      anchorsWithItem.every((a) => selectedIdSet.has(a.ref!.item!))
    );
  });
}

const computeCentroid = (points: Coords[]): Coords => {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce(
    (acc, t) => ({ x: acc.x + t.x, y: acc.y + t.y }),
    { x: 0, y: 0 }
  );
  return {
    x: Math.round(sum.x / points.length),
    y: Math.round(sum.y / points.length)
  };
};

export const useCopyPaste = () => {
  const uiStateApi = useUiStateStoreApi();
  const modelStoreApi = useModelStoreApi();
  const scene = useScene();
  const clipboard = useClipboard();

  const showNotification = useCallback(
    (message: string, severity: 'info' | 'success' | 'warning') => {
      uiStateApi.getState().actions.setNotification({ message, severity });
    },
    [uiStateApi]
  );

  // Shared helper: gather the current selection into a clipboard payload.
  // Returns null if nothing is selected or nothing resolves to canvas items.
  const buildPayload = useCallback((): {
    payload: ClipboardPayload;
    count: number;
  } | null => {
    const uiState = uiStateApi.getState();
    const model = modelStoreApi.getState();

    const { itemIds, connectorIds, rectangleIds, textBoxIds } =
      resolveSelectionIds(uiState);

    if (
      itemIds.length === 0 &&
      connectorIds.length === 0 &&
      rectangleIds.length === 0 &&
      textBoxIds.length === 0
    ) {
      return null;
    }

    const selectedIdSet = new Set(itemIds);
    const currentView = scene.currentView;

    // Collect items (modelItem + viewItem pairs)
    const clipboardItems: ClipboardItem[] = [];
    for (const viewItem of currentView.items ?? []) {
      if (selectedIdSet.has(viewItem.id)) {
        const modelItem = model.items.find((mi) => mi.id === viewItem.id);
        if (modelItem) {
          clipboardItems.push({ modelItem, viewItem });
        }
      }
    }

    const clipboardConnectors = collectClipboardConnectors(
      currentView.connectors ?? [],
      connectorIds,
      selectedIdSet
    );

    const selectedRectIdSet = new Set(rectangleIds);
    const selectedTextIdSet = new Set(textBoxIds);
    const clipboardRectangles = (currentView.rectangles ?? []).filter((r) =>
      selectedRectIdSet.has(r.id)
    );
    const clipboardTextBoxes = (currentView.textBoxes ?? []).filter((tb) =>
      selectedTextIdSet.has(tb.id)
    );

    const count =
      clipboardItems.length +
      clipboardConnectors.length +
      clipboardRectangles.length +
      clipboardTextBoxes.length;

    if (count === 0) return null;

    // Centroid across all item positions
    const allPoints = [
      ...clipboardItems.map((ci) => ci.viewItem.tile),
      ...clipboardRectangles.map((r) => ({
        x: Math.round((r.from.x + r.to.x) / 2),
        y: Math.round((r.from.y + r.to.y) / 2)
      })),
      ...clipboardTextBoxes.map((tb) => tb.tile)
    ];
    const centroid = computeCentroid(allPoints);

    return {
      payload: {
        items: clipboardItems,
        connectors: clipboardConnectors,
        rectangles: clipboardRectangles,
        textBoxes: clipboardTextBoxes,
        centroid
      },
      count
    };
  }, [uiStateApi, modelStoreApi, scene]);

  const handleCopy = useCallback(() => {
    const result = buildPayload();
    if (!result) return;
    clipboard.set(result.payload);
    showNotification(
      `Copied ${result.count} item${result.count !== 1 ? 's' : ''}`,
      'info'
    );
  }, [buildPayload, uiStateApi, clipboard]);

  const handleCut = useCallback(() => {
    const result = buildPayload();
    if (!result) return;

    clipboard.set(result.payload);

    // Delete the cut items — mirrors the Delete key logic in useInteractionManager
    const uiState = uiStateApi.getState();
    const mode = uiState.mode;

    if (
      (mode.type === 'LASSO' || mode.type === 'FREEHAND_LASSO') &&
      mode.selection?.items?.length
    ) {
      scene.deleteSelectedItems(mode.selection.items);
      uiState.actions.setMode({
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: null
      });
      uiState.actions.setItemControls(null);
    } else if (uiState.itemControls) {
      const ctrl = uiState.itemControls;
      if (ctrl.type === 'ITEM') scene.deleteViewItem(ctrl.id);
      else if (ctrl.type === 'CONNECTOR') scene.deleteConnector(ctrl.id);
      else if (ctrl.type === 'TEXTBOX') scene.deleteTextBox(ctrl.id);
      else if (ctrl.type === 'RECTANGLE') scene.deleteRectangle(ctrl.id);
      uiState.actions.setItemControls(null);
    }

    showNotification(
      `Cut ${result.count} item${result.count !== 1 ? 's' : ''}`,
      'success'
    );
  }, [buildPayload, uiStateApi, scene, clipboard]);

  const handlePaste = useCallback(() => {
    const clipboardData = clipboard.get();
    if (!clipboardData) {
      showNotification('Nothing to paste', 'warning');
      return;
    }

    const uiState = uiStateApi.getState();
    const mouseTile = uiState.mouse.position.tile;

    const offset = {
      x: mouseTile.x - clipboardData.centroid.x,
      y: mouseTile.y - clipboardData.centroid.y
    };

    // Target tiles for items (before collision avoidance)
    const targetItems = clipboardData.items.map((ci) => ({
      id: ci.viewItem.id,
      targetTile: {
        x: ci.viewItem.tile.x + offset.x,
        y: ci.viewItem.tile.y + offset.y
      }
    }));

    // Collision avoidance
    let finalTiles = targetItems.map((t) => t.targetTile);
    if (targetItems.length > 0) {
      const resolved = findNearestUnoccupiedTilesForGroup(targetItems, scene);
      if (resolved) finalTiles = resolved;
    }

    // New IDs map (old id -> new id)
    const idMap = new Map<string, string>();
    clipboardData.items.forEach((ci) =>
      idMap.set(ci.viewItem.id, generateId())
    );
    clipboardData.connectors.forEach((c) => idMap.set(c.id, generateId()));
    clipboardData.rectangles.forEach((r) => idMap.set(r.id, generateId()));
    clipboardData.textBoxes.forEach((tb) => idMap.set(tb.id, generateId()));

    // Build remapped items
    const newItems: ClipboardItem[] = clipboardData.items.map((ci, i) => {
      const newId = idMap.get(ci.viewItem.id)!;
      return {
        modelItem: { ...ci.modelItem, id: newId },
        viewItem: { ...ci.viewItem, id: newId, tile: finalTiles[i] }
      };
    });

    // Build a map of original item id -> pasted tile (for detach-to-tile conversion)
    const originalTileMap = new Map<string, { x: number; y: number }>();
    clipboardData.items.forEach((ci) => {
      originalTileMap.set(ci.viewItem.id, ci.viewItem.tile);
    });
    // Also include existing scene items so detached anchors can use their current tile
    for (const vi of scene.currentView.items ?? []) {
      if (!originalTileMap.has(vi.id)) originalTileMap.set(vi.id, vi.tile);
    }

    // Remap connector anchors — remap known items, detach anchors pointing at items not in clipboard
    const newConnectors: Connector[] = clipboardData.connectors.map((c) => ({
      ...c,
      id: idMap.get(c.id) ?? generateId(),
      anchors: c.anchors.map((anchor) => {
        if (anchor.ref?.item) {
          if (idMap.has(anchor.ref.item)) {
            return { ...anchor, ref: { item: idMap.get(anchor.ref.item)! } };
          }
          // Detach anchor: convert to tile ref using the item's known position
          const tile = originalTileMap.get(anchor.ref.item) ?? mouseTile;
          return { ...anchor, ref: { tile } };
        }
        // Tile waypoint: apply paste offset so intermediate points move with the connector
        if (anchor.ref?.tile) {
          return {
            ...anchor,
            ref: {
              tile: {
                x: anchor.ref.tile.x + offset.x,
                y: anchor.ref.tile.y + offset.y
              }
            }
          };
        }
        return anchor;
      })
    }));

    // Offset rectangles
    const newRectangles: Rectangle[] = clipboardData.rectangles.map((r) => ({
      ...r,
      id: idMap.get(r.id) ?? generateId(),
      from: { x: r.from.x + offset.x, y: r.from.y + offset.y },
      to: { x: r.to.x + offset.x, y: r.to.y + offset.y }
    }));

    // Offset text boxes
    const newTextBoxes: TextBox[] = clipboardData.textBoxes.map((tb) => ({
      ...tb,
      id: idMap.get(tb.id) ?? generateId(),
      tile: { x: tb.tile.x + offset.x, y: tb.tile.y + offset.y }
    }));

    const pastedCount =
      newItems.length +
      newConnectors.length +
      newRectangles.length +
      newTextBoxes.length;
    const LARGE_PASTE_THRESHOLD = 500;
    const isLargePaste = newConnectors.length >= LARGE_PASTE_THRESHOLD;

    // Build the progress callback — only used for large pastes.
    const onPathProgress = isLargePaste
      ? (done: number, total: number) => {
          if (done >= total) {
            showNotification(
              `Pasted ${pastedCount} item${pastedCount !== 1 ? 's' : ''}`,
              'success'
            );
          } else {
            const pct = Math.round((done / total) * 100);
            showNotification(`Pasting… routing connectors (${pct}%)`, 'info');
          }
        }
      : undefined;

    // Wrap the store write in startTransition so React can deprioritize the resulting
    // render and remain responsive to user input during large paste operations.
    startTransition(() => {
      scene.pasteItems(
        {
          items: newItems,
          connectors: newConnectors,
          rectangles: newRectangles,
          textBoxes: newTextBoxes
        },
        onPathProgress
      );
    });

    uiState.actions.setMode({
      type: 'CURSOR',
      showCursor: true,
      mousedownItem: null
    });
    uiState.actions.setItemControls(null);

    if (!isLargePaste) {
      showNotification(
        `Pasted ${pastedCount} item${pastedCount !== 1 ? 's' : ''}`,
        'success'
      );
    } else {
      showNotification('Pasting… routing connectors (0%)', 'info');
    }
  }, [uiStateApi, scene, clipboard]);

  return { handleCopy, handleCut, handlePaste };
};
