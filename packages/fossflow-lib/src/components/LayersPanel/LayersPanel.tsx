import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  Stack
} from '@mui/material';
import { AddOutlined, DeleteOutlineOutlined } from '@mui/icons-material';
import { useLayerContext, LayerItem } from 'src/hooks/useLayerContext';
import { useLayerActions } from 'src/hooks/useLayerActions';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { useSceneData } from 'src/hooks/useSceneData';
import { ItemReference, Coords } from 'src/types';
import { LayerRow } from './LayerRow';
import { LayerItemRow } from './LayerItemRow';

// Compute the tile bounding box that contains every passed-in item.
// Used so the LASSO action bar (LassoLayerBar) can position itself above
// a panel-driven multi-selection the same way it does for canvas-drag selection.
const computeBoundingTiles = (
  items: ItemReference[],
  scene: {
    items: { id: string; tile: Coords }[];
    textBoxes: { id: string; tile: Coords }[];
    rectangles: { id: string; from: Coords; to: Coords }[];
    connectors: { id: string }[];
  },
  connectorPaths: Record<string, { tiles?: Coords[] } | undefined>
): { startTile: Coords; endTile: Coords } | null => {
  const tiles: Coords[] = [];
  for (const ref of items) {
    if (ref.type === 'ITEM') {
      const it = scene.items.find((i) => i.id === ref.id);
      if (it) tiles.push(it.tile);
    } else if (ref.type === 'TEXTBOX') {
      const tb = scene.textBoxes.find((t) => t.id === ref.id);
      if (tb) tiles.push(tb.tile);
    } else if (ref.type === 'RECTANGLE') {
      const r = scene.rectangles.find((rr) => rr.id === ref.id);
      if (r) {
        tiles.push(r.from);
        tiles.push(r.to);
      }
    } else if (ref.type === 'CONNECTOR') {
      const path = connectorPaths[ref.id]?.tiles;
      if (path && path.length > 0) tiles.push(...path);
    }
  }
  if (tiles.length === 0) return null;
  const xs = tiles.map((t) => t.x);
  const ys = tiles.map((t) => t.y);
  return {
    startTile: { x: Math.min(...xs), y: Math.min(...ys) },
    endTile: { x: Math.max(...xs), y: Math.max(...ys) }
  };
};

export const LayersPanel = () => {
  const { layers, itemCountByLayerId, unassignedCount, itemsByLayerId } =
    useLayerContext();
  const {
    createLayer,
    updateLayer,
    deleteLayer,
    reorderLayers,
    assignLayerToItems
  } = useLayerActions();
  const { updateModelItem, updateConnector, updateViewItem, updateTextBox, updateRectangle } = useScene();
  const sceneData = useSceneData();
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [expandedLayerIds, setExpandedLayerIds] = useState<Set<string>>(
    new Set()
  );

  // Bidirectional: read current canvas selection
  const itemControls = useUiStateStore((s) => s.itemControls);
  const mode = useUiStateStore((s) => s.mode);
  const uiStateActions = useUiStateStore((s) => s.actions);

  const selectedItemId =
    itemControls && itemControls.type !== 'ADD_ITEM' ? itemControls.id : null;

  // IDs in the current LASSO multi-selection (if any) — used for row highlight.
  const lassoSelectedIds = useMemo(() => {
    if (mode.type === 'LASSO' && mode.selection) {
      return new Set(mode.selection.items.map((i) => i.id));
    }
    return new Set<string>();
  }, [mode]);

  // Anchor for shift-click range selection — id of the last plain-clicked row.
  const anchorIdRef = useRef<string | null>(null);

  // Layers displayed top-to-bottom = highest order first
  const sortedLayers = [...layers].sort((a, b) => b.order - a.order);

  const handleAddLayer = useCallback(() => {
    createLayer({ name: `Layer ${layers.length + 1}` });
  }, [createLayer, layers.length]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedLayerId) return;
    deleteLayer(selectedLayerId);
    setSelectedLayerId(null);
  }, [deleteLayer, selectedLayerId]);

  const handleToggleVisible = useCallback(
    (id: string) => {
      const layer = layers.find((l) => l.id === id);
      if (layer) updateLayer({ id, visible: !layer.visible });
    },
    [layers, updateLayer]
  );

  const handleToggleLocked = useCallback(
    (id: string) => {
      const layer = layers.find((l) => l.id === id);
      if (layer) updateLayer({ id, locked: !layer.locked });
    },
    [layers, updateLayer]
  );

  const handleRename = useCallback(
    (id: string, name: string) => {
      updateLayer({ id, name });
    },
    [updateLayer]
  );

  const handleToggleExpand = useCallback((layerId: string) => {
    setExpandedLayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
  }, []);

  const handleItemRename = useCallback(
    (item: LayerItem, newName: string) => {
      if (item.type === 'ITEM') updateModelItem(item.id, { name: newName });
      if (item.type === 'CONNECTOR') updateConnector(item.id, { name: newName });
      if (item.type === 'TEXTBOX') updateTextBox(item.id, { name: newName });
      if (item.type === 'RECTANGLE') updateRectangle(item.id, { name: newName });
    },
    [updateModelItem, updateConnector, updateTextBox, updateRectangle]
  );

  const handleToggleLabel = useCallback(
    (item: LayerItem) => {
      const next = item.showLabel === false ? undefined : false;
      if (item.type === 'ITEM') updateViewItem(item.id, { showLabel: next });
      if (item.type === 'CONNECTOR') updateConnector(item.id, { showLabel: next });
    },
    [updateViewItem, updateConnector]
  );

  // Flat list of visible item rows, in display order. Used to compute
  // the shift-click range. Only expanded layers contribute; collapsed
  // layers' items are not visible so they aren't selectable as range targets.
  const visibleItemsFlat = useMemo<LayerItem[]>(() => {
    const out: LayerItem[] = [];
    for (const layer of sortedLayers) {
      if (!expandedLayerIds.has(layer.id)) continue;
      const layerItems = itemsByLayerId.get(layer.id) ?? [];
      out.push(...layerItems);
    }
    const unassigned = itemsByLayerId.get('__unassigned__') ?? [];
    out.push(...unassigned);
    return out;
  }, [sortedLayers, expandedLayerIds, itemsByLayerId]);

  const buildLassoFromItems = useCallback(
    (items: ItemReference[]) => {
      const connectorPaths = sceneData.hitConnectors.reduce<
        Record<string, { tiles?: Coords[] }>
      >((acc, c) => {
        if (c.path) acc[c.id] = { tiles: c.path.tiles };
        return acc;
      }, {});
      const bounds = computeBoundingTiles(
        items,
        sceneData,
        connectorPaths
      ) ?? {
        startTile: { x: 0, y: 0 },
        endTile: { x: 0, y: 0 }
      };
      uiStateActions.setMode({
        type: 'LASSO',
        showCursor: true,
        isDragging: false,
        selection: {
          startTile: bounds.startTile,
          endTile: bounds.endTile,
          items
        }
      });
    },
    [sceneData, uiStateActions]
  );

  // Panel → canvas: clicking an item row selects it on canvas.
  // Modifier keys promote to a multi-select via LASSO mode (UX §4.1).
  const handleItemClick = useCallback(
    (item: LayerItem, modifiers: { shift: boolean; ctrl: boolean }) => {
      const ref: ItemReference = { type: item.type, id: item.id };

      if (modifiers.shift && anchorIdRef.current) {
        const anchorIdx = visibleItemsFlat.findIndex(
          (i) => i.id === anchorIdRef.current
        );
        const targetIdx = visibleItemsFlat.findIndex((i) => i.id === item.id);
        if (anchorIdx !== -1 && targetIdx !== -1) {
          const [lo, hi] =
            anchorIdx <= targetIdx
              ? [anchorIdx, targetIdx]
              : [targetIdx, anchorIdx];
          const range = visibleItemsFlat
            .slice(lo, hi + 1)
            .map<ItemReference>((i) => ({ type: i.type, id: i.id }));
          buildLassoFromItems(range);
          return;
        }
      }

      if (modifiers.ctrl) {
        // Toggle: start from current LASSO selection if present, else from
        // current single-item selection.
        const current: ItemReference[] =
          mode.type === 'LASSO' && mode.selection
            ? [...mode.selection.items]
            : itemControls && itemControls.type !== 'ADD_ITEM'
              ? [{ type: itemControls.type, id: itemControls.id }]
              : [];
        const exists = current.some(
          (r) => r.id === ref.id && r.type === ref.type
        );
        const next = exists
          ? current.filter((r) => !(r.id === ref.id && r.type === ref.type))
          : [...current, ref];
        if (next.length === 0) {
          uiStateActions.setMode({
            type: 'CURSOR',
            showCursor: true,
            mousedownItem: null
          });
          uiStateActions.setItemControls(null);
        } else if (next.length === 1) {
          uiStateActions.setMode({
            type: 'CURSOR',
            showCursor: true,
            mousedownItem: null
          });
          uiStateActions.setItemControls({ type: next[0].type, id: next[0].id });
        } else {
          buildLassoFromItems(next);
        }
        anchorIdRef.current = item.id;
        return;
      }

      // Plain click: drop any LASSO multi-select, single-select on canvas.
      if (mode.type === 'LASSO') {
        uiStateActions.setMode({
          type: 'CURSOR',
          showCursor: true,
          mousedownItem: null
        });
      }
      anchorIdRef.current = item.id;
      uiStateActions.setItemControls({ type: item.type, id: item.id });
    },
    [
      visibleItemsFlat,
      buildLassoFromItems,
      mode,
      itemControls,
      uiStateActions
    ]
  );

  // Drag item to assign to a layer
  const [itemDragState, setItemDragState] = useState<{
    item: LayerItem;
    overLayerId: string | null;
  } | null>(null);

  const handleItemDragStart = useCallback((item: LayerItem) => {
    setItemDragState({ item, overLayerId: null });
  }, []);

  const handleItemDragOverLayer = useCallback((layerId: string) => {
    setItemDragState((s) => (s ? { ...s, overLayerId: layerId } : null));
  }, []);

  const handleItemDragEnd = useCallback(() => {
    if (itemDragState?.overLayerId) {
      assignLayerToItems(itemDragState.overLayerId, [
        { type: itemDragState.item.type, id: itemDragState.item.id }
      ]);
    }
    setItemDragState(null);
  }, [itemDragState, assignLayerToItems]);

  // Simple drag-to-reorder via mousedown/mousemove on drag handle
  const [dragState, setDragState] = useState<{
    dragId: string;
    overId: string | null;
  } | null>(null);

  const handleDragStart = useCallback((layerId: string) => {
    setDragState({ dragId: layerId, overId: null });
  }, []);

  const handleDragOver = useCallback(
    (layerId: string) => {
      if (dragState && dragState.dragId !== layerId) {
        setDragState((s) => (s ? { ...s, overId: layerId } : null));
      }
    },
    [dragState]
  );

  const handleDragEnd = useCallback(() => {
    if (!dragState || !dragState.overId) {
      setDragState(null);
      return;
    }
    const ids = sortedLayers.map((l) => l.id);
    const fromIdx = ids.indexOf(dragState.dragId);
    const toIdx = ids.indexOf(dragState.overId);
    if (fromIdx !== -1 && toIdx !== -1) {
      const reordered = [...ids];
      reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, dragState.dragId);
      reorderLayers([...reordered].reverse());
    }
    setDragState(null);
  }, [dragState, sortedLayers, reorderLayers]);

  const unassignedItems = itemsByLayerId.get('__unassigned__') ?? [];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0
      }}
      onMouseUp={() => {
        handleDragEnd();
        handleItemDragEnd();
      }}
      onMouseLeave={() => {
        handleDragEnd();
        handleItemDragEnd();
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 1.5, py: 1, flexShrink: 0 }}
      >
        <Typography variant="overline" color="text.secondary">
          Layers
        </Typography>
        <Stack direction="row" spacing={0.25}>
          <Tooltip title="Add layer" placement="top">
            <IconButton size="small" onClick={handleAddLayer} sx={{ p: 0.5 }}>
              <AddOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete selected layer" placement="top">
            <span>
              <IconButton
                size="small"
                onClick={handleDeleteSelected}
                disabled={!selectedLayerId}
                sx={{ p: 0.5 }}
              >
                <DeleteOutlineOutlined fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <Divider />

      {/* Layer tree — scrollable */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 0.5, py: 0.5 }}>
        {sortedLayers.length === 0 && (
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: 'block', textAlign: 'center', mt: 2, mb: 1 }}
          >
            No layers yet. Click + to add one.
          </Typography>
        )}
        {sortedLayers.length > 0 && (
          <>
            {sortedLayers.map((layer) => {
              const isExpanded = expandedLayerIds.has(layer.id);
              const layerItems = itemsByLayerId.get(layer.id) ?? [];
              return (
                <Box
                  key={layer.id}
                  onMouseEnter={() => {
                    if (dragState) handleDragOver(layer.id);
                    if (itemDragState) handleItemDragOverLayer(layer.id);
                  }}
                  sx={{
                    outline:
                      dragState?.overId === layer.id ||
                      itemDragState?.overLayerId === layer.id
                        ? '2px solid'
                        : 'none',
                    outlineColor: 'primary.main',
                    borderRadius: 1
                  }}
                >
                  <LayerRow
                    layer={layer}
                    isSelected={selectedLayerId === layer.id}
                    isExpanded={isExpanded}
                    itemCount={itemCountByLayerId.get(layer.id) ?? 0}
                    onSelect={setSelectedLayerId}
                    onToggleExpand={handleToggleExpand}
                    onToggleVisible={handleToggleVisible}
                    onToggleLocked={handleToggleLocked}
                    onRename={handleRename}
                    onDelete={deleteLayer}
                    dragHandleProps={{
                      onMouseDown: (e) => {
                        e.preventDefault();
                        handleDragStart(layer.id);
                      }
                    }}
                  />
                  {isExpanded && layerItems.length > 0 && (
                    <Box>
                      {layerItems.map((item) => (
                        <LayerItemRow
                          key={item.id}
                          item={item}
                          isSelected={item.id === selectedItemId || lassoSelectedIds.has(item.id)}
                          onClick={handleItemClick}
                          onRename={handleItemRename}
                          onDragStart={handleItemDragStart}
                          onToggleLabel={handleToggleLabel}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              );
            })}
          </>
        )}

        {/* Unassigned group — always shown when there are unassigned items */}
        {unassignedCount > 0 && (
          <Box sx={{ mt: 0.5 }}>
            <Typography
              variant="overline"
              color="text.disabled"
              sx={{ display: 'block', px: 0.5, pt: 0.5, pb: 0.25 }}
            >
              Unassigned ({unassignedCount})
            </Typography>
            {unassignedItems.map((item) => (
              <LayerItemRow
                key={item.id}
                item={item}
                isSelected={item.id === selectedItemId}
                onClick={handleItemClick}
                onRename={handleItemRename}
                onDragStart={handleItemDragStart}
                onToggleLabel={handleToggleLabel}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};
