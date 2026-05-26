import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Tooltip,
  IconButton,
  Menu,
  MenuItem,
  Divider
} from '@mui/material';
import {
  PaletteOutlined as StyleIcon,
  EditOutlined as EditIcon,
  LinkOutlined as LinkIcon,
  StickyNote2Outlined as NotesIcon,
  DeleteOutlined as DeleteIcon,
  CallMadeOutlined as ConnectorIcon,
  LayersOutlined as LayersIcon,
  ArrowUpwardOutlined as BringForwardIcon,
  ArrowDownwardOutlined as SendBackIcon
} from '@mui/icons-material';
import { Coords } from 'src/types';
import { generateId } from 'src/utils';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { useViewItem } from 'src/hooks/useViewItem';
import { useModelItem } from 'src/hooks/useModelItem';
import { useConnector } from 'src/hooks/useConnector';
import { useTextBox } from 'src/hooks/useTextBox';
import { useRectangle } from 'src/hooks/useRectangle';
import { useScene } from 'src/hooks/useScene';
import { useUiStateStore, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useTranslation } from 'src/stores/localeStore';
import { useLayerContext } from 'src/hooks/useLayerContext';
import { useLayerActions } from 'src/hooks/useLayerActions';

type ItemType = 'ITEM' | 'CONNECTOR' | 'TEXTBOX' | 'RECTANGLE';

const PANEL_EVENT: Record<ItemType, string> = {
  ITEM: 'nodePanel',
  CONNECTOR: 'connectorPanel',
  TEXTBOX: 'textBoxPanel',
  RECTANGLE: 'rectanglePanel'
};

const dispatch = (type: ItemType, action: string) =>
  window.dispatchEvent(new CustomEvent(PANEL_EVENT[type], { detail: action }));

interface Props {
  type: ItemType;
  id: string;
  /** Required for CONNECTOR (no intrinsic tile position). */
  tile?: Coords;
}

export const NodeActionBar = ({ type, id, tile: connectorTile }: Props) => {
  const { t } = useTranslation('nodeActionBar');
  const viewItem = useViewItem(id);
  const modelItem = useModelItem(id);
  const connector = useConnector(id);
  const textBox = useTextBox(id);
  const rectangle = useRectangle(id);
  const {
    deleteViewItem,
    deleteConnector,
    deleteTextBox,
    deleteRectangle,
    createConnector,
    updateViewItem,
    beginDragTransaction,
    colors
  } = useScene();
  const uiStateActions = useUiStateStore((state) => state.actions);
  const uiStoreApi = useUiStateStoreApi();
  const { layers } = useLayerContext();
  const { assignLayerToItems } = useLayerActions();
  const { getTilePosition } = useCanvasMode();
  const [layerMenuAnchor, setLayerMenuAnchor] = useState<HTMLElement | null>(
    null
  );
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Counter-scale unconditionally — bar stays at natural pixel size at every
  // zoom level (UX §8.8). Bypasses React render, same pattern as SceneLayer.
  useEffect(() => {
    const apply = (zoom: number) => {
      if (!wrapperRef.current) return;
      const counter = 1 / zoom;
      wrapperRef.current.style.transform = `translateX(-50%) scale(${counter})`;
    };
    apply(uiStoreApi.getState().zoom);
    return uiStoreApi.subscribe((state, prev) => {
      if (state.zoom === prev.zoom) return;
      apply(state.zoom);
    });
  }, [uiStoreApi]);

  const handleDelete = useCallback(() => {
    uiStateActions.setItemControls(null);
    if (type === 'ITEM') deleteViewItem(id);
    else if (type === 'CONNECTOR') deleteConnector(id);
    else if (type === 'TEXTBOX') deleteTextBox(id);
    else if (type === 'RECTANGLE') deleteRectangle(id);
  }, [
    type,
    id,
    uiStateActions,
    deleteViewItem,
    deleteConnector,
    deleteTextBox,
    deleteRectangle
  ]);

  const handleStartConnector = useCallback(() => {
    const newConnector = {
      id: generateId(),
      color: colors[0]?.id ?? '',
      anchors: [
        { id: generateId(), ref: { item: id } },
        { id: generateId(), ref: { item: id } }
      ]
    };
    // MQA #5 (Bundle B follow-up): the right-click → "Add connection" path
    // bypassed Connector.mousedown's beginDragTransaction, so every tile the
    // user crossed while dragging the new connector to its target became its
    // own history entry — undo had to step through each tile. Open the same
    // drag-transaction bracket here so the entire create + drag + commit
    // collapses into one undo step. Connector.mousedown's second-click branch
    // already calls commitDragTransaction.
    beginDragTransaction();
    createConnector(newConnector);
    uiStateActions.setItemControls(null);
    uiStateActions.setMode({
      type: 'CONNECTOR',
      showCursor: true,
      id: newConnector.id,
      startAnchor: { itemId: id },
      isConnecting: true,
      returnToCursor: true
    });
  }, [id, colors, createConnector, beginDragTransaction, uiStateActions]);

  const handleBringForward = useCallback(() => {
    if (!viewItem) return;
    const currentZ = viewItem.zIndex ?? 0;
    updateViewItem(id, { zIndex: currentZ + 1 });
  }, [id, viewItem, updateViewItem]);

  const handleSendBack = useCallback(() => {
    if (!viewItem) return;
    const currentZ = viewItem.zIndex ?? 0;
    updateViewItem(id, { zIndex: currentZ - 1 });
  }, [id, viewItem, updateViewItem]);

  const handleAssignLayer = useCallback(
    (layerId: string | undefined) => {
      assignLayerToItems(layerId, [{ type, id }]);
      setLayerMenuAnchor(null);
    },
    [assignLayerToItems, type, id]
  );

  // Derive position based on element type
  const getPosition = useCallback(() => {
    if (type === 'ITEM' && viewItem) {
      return getTilePosition({ tile: viewItem.tile, origin: 'TOP' });
    }
    if (type === 'TEXTBOX' && textBox) {
      return getTilePosition({ tile: textBox.tile, origin: 'TOP' });
    }
    if (type === 'RECTANGLE' && rectangle) {
      const midX = (rectangle.from.x + rectangle.to.x) / 2;
      const topY = Math.min(rectangle.from.y, rectangle.to.y);
      return getTilePosition({ tile: { x: midX, y: topY }, origin: 'TOP' });
    }
    if (type === 'CONNECTOR' && connectorTile) {
      return getTilePosition({ tile: connectorTile, origin: 'TOP' });
    }
    return null;
  }, [type, viewItem, textBox, rectangle, connectorTile, getTilePosition]);

  // Guard: can't render without position or item data
  const pos = getPosition();
  if (!pos) return null;
  if (type === 'ITEM' && (!viewItem || !modelItem)) return null;
  if (type === 'CONNECTOR' && !connector) return null;
  if (type === 'TEXTBOX' && !textBox) return null;
  if (type === 'RECTANGLE' && !rectangle) return null;

  const hasNotes =
    type === 'ITEM'
      ? !!modelItem?.notes &&
        modelItem.notes.replace(/<[^>]*>/g, '').trim() !== ''
      : type === 'CONNECTOR'
      ? !!connector?.notes &&
        connector.notes.replace(/<[^>]*>/g, '').trim() !== ''
      : false;

  const hasLink =
    type === 'ITEM'
      ? !!modelItem?.headerLink
      : type === 'CONNECTOR'
      ? !!connector?.headerLink
      : false;

  const currentLayerId =
    type === 'ITEM'
      ? viewItem?.layerId
      : type === 'CONNECTOR'
      ? connector?.layerId
      : type === 'TEXTBOX'
      ? textBox?.layerId
      : rectangle?.layerId;

  const showLink = type === 'ITEM' || type === 'CONNECTOR';
  const showNotes = type === 'ITEM' || type === 'CONNECTOR';
  const showStartConnector = type === 'ITEM';
  const showZOrder = type === 'ITEM';

  return (
    <Box
      ref={wrapperRef}
      sx={{
        position: 'absolute',
        left: pos.x,
        top: pos.y - 40,
        transform: 'translateX(-50%)',
        transformOrigin: 'center bottom',
        pointerEvents: 'auto',
        zIndex: 10
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Paper
        elevation={4}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: '20px',
          px: 0.75,
          py: 0.25,
          gap: 0,
          bgcolor: 'background.paper'
        }}
      >
        <Tooltip title={t('style')} placement="top">
          <IconButton
            size="small"
            onClick={() => dispatch(type, 'scrollToAppearance')}
            sx={{ p: 0.75 }}
          >
            <StyleIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title={t('editName')} placement="top">
          <IconButton
            size="small"
            onClick={() => dispatch(type, 'focusName')}
            sx={{ p: 0.75 }}
          >
            <EditIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        {showLink && (
          <Tooltip title={hasLink ? t('editLink') : t('addLink')} placement="top">
            <IconButton
              size="small"
              onClick={() => dispatch(type, 'focusLink')}
              color={hasLink ? 'primary' : 'default'}
              sx={{ p: 0.75 }}
            >
              <LinkIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}

        {showNotes && (
          <Tooltip
            title={hasNotes ? t('editNotes') : t('addNotes')}
            placement="top"
          >
            <IconButton
              size="small"
              onClick={() => dispatch(type, 'focusNotes')}
              color={hasNotes ? 'primary' : 'default'}
              sx={{ p: 0.75 }}
            >
              <NotesIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}

        {showStartConnector && (
          <Tooltip title={t('startConnector')} placement="top">
            <IconButton
              size="small"
              onClick={handleStartConnector}
              sx={{ p: 0.75 }}
            >
              <ConnectorIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title="Assign to layer" placement="top">
          <IconButton
            size="small"
            onClick={(e) => setLayerMenuAnchor(e.currentTarget)}
            color={currentLayerId ? 'primary' : 'default'}
            sx={{ p: 0.75 }}
          >
            <LayersIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        {showZOrder && (
          <>
            <Tooltip title="Bring forward (Ctrl+])" placement="top">
              <IconButton
                size="small"
                onClick={handleBringForward}
                sx={{ p: 0.75 }}
              >
                <BringForwardIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Send back (Ctrl+[)" placement="top">
              <IconButton
                size="small"
                onClick={handleSendBack}
                sx={{ p: 0.75 }}
              >
                <SendBackIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </>
        )}

        <Tooltip title={t('delete')} placement="top">
          <IconButton
            size="small"
            onClick={handleDelete}
            color="error"
            sx={{ p: 0.75 }}
          >
            <DeleteIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Paper>

      <Menu
        anchorEl={layerMenuAnchor}
        open={!!layerMenuAnchor}
        onClose={() => setLayerMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {layers.length === 0 ? (
          <MenuItem disabled sx={{ fontSize: 13 }}>
            No layers — open the Layers panel to add one
          </MenuItem>
        ) : (
          [
            currentLayerId && (
              <MenuItem
                key="remove"
                onClick={() => handleAssignLayer(undefined)}
                sx={{ fontSize: 13 }}
              >
                Remove from layer
              </MenuItem>
            ),
            currentLayerId && <Divider key="divider" />,
            ...[...layers]
              .sort((a, b) => b.order - a.order)
              .map((layer) => (
                <MenuItem
                  key={layer.id}
                  onClick={() => handleAssignLayer(layer.id)}
                  selected={layer.id === currentLayerId}
                  sx={{ fontSize: 13 }}
                >
                  {layer.name}
                </MenuItem>
              ))
          ]
        )}
      </Menu>
    </Box>
  );
};
