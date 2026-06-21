import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react';
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
import { STRIP_WIDTH, PANEL_WIDTH } from 'src/components/LeftDock/LeftDock';
import {
  ItemType,
  dispatch,
  hasVisibleText
} from './NodeActionBar.helpers';

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
  // Anchor tile for the active item — refreshed on every render, read by the
  // direct-subscription placement below (mirrors ViewModeInfoPopover.anchorTileRef).
  const anchorTileRef = useRef<Coords | undefined>(undefined);

  // B4 / decision #5: place the bar in SCREEN space (it renders outside the
  // SceneLayer — see UiOverlay), mirroring ViewModeInfoPopover's mechanism:
  //   - default ABOVE the anchor (the bar's historical spot), horizontally
  //     centered on it;
  //   - FLIP BELOW when sitting above would clip past the renderer's top edge;
  //   - CLAMP horizontally so the bar never slides under the LeftDock's right
  //     edge nor past the renderer's right edge.
  // Driven off the uiStoreApi scroll/zoom/rendererSize (and activeLeftTab)
  // subscription so pan/zoom never re-renders React. In screen space the bar is
  // already at natural pixel size, which is exactly the screen-pixel-stability
  // (UX §8.8) the old in-SceneLayer 1/zoom counter-scale existed to provide —
  // so no scale() is applied here (same as ViewModeInfoPopover).
  const applyPlacement = useCallback(() => {
    const el = wrapperRef.current;
    const tile = anchorTileRef.current;
    if (!el || !tile) return;
    const { scroll, zoom, rendererSize, activeLeftTab } = uiStoreApi.getState();
    if (!rendererSize.width || !rendererSize.height) return;

    // Tile point → screen px (same transform the SceneLayer applies internally).
    const toScreen = (p: Coords) => ({
      x: rendererSize.width / 2 + scroll.position.x + zoom * p.x,
      y: rendererSize.height / 2 + scroll.position.y + zoom * p.y
    });
    const topAnchor = toScreen(getTilePosition({ tile, origin: 'TOP' }));
    const bottomAnchor = toScreen(getTilePosition({ tile, origin: 'BOTTOM' }));

    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const GAP = 12; // matches the old `top: pos.y - 40` standoff at natural size
    const MARGIN = 8;

    // LeftDock right edge in renderer-x: the strip is always present in edit
    // mode; the Elements/Layers panel adds its width when a tab is open. The app
    // file-explorer surface isn't visible to the lib (its open state is a prop,
    // not store), so it's intentionally out of this clamp — STRIP + PANEL only.
    const dockRight = STRIP_WIDTH + (activeLeftTab !== null ? PANEL_WIDTH : 0);

    // Vertical: prefer ABOVE; flip BELOW when the bar's top would clip the
    // renderer top. transform's Y term anchors the bar to the chosen edge.
    const fitsAbove = topAnchor.y - GAP - h >= MARGIN;
    const placeAbove = fitsAbove;
    const topPx = placeAbove ? topAnchor.y - GAP : bottomAnchor.y + GAP;
    const tyPercent = placeAbove ? '-100%' : '0%';

    // Horizontal: centered on the anchor, then clamped so the whole bar stays
    // between the dock's right edge and the renderer's right edge.
    const half = w / 2;
    const minCenter = dockRight + MARGIN + half;
    const maxCenter = rendererSize.width - MARGIN - half;
    // When the available band is narrower than the bar, minCenter > maxCenter;
    // prefer staying clear of the dock (left bound wins) so it isn't occluded.
    const leftPx =
      minCenter <= maxCenter
        ? Math.min(Math.max(topAnchor.x, minCenter), maxCenter)
        : minCenter;

    el.style.left = `${leftPx}px`;
    el.style.top = `${topPx}px`;
    el.style.transform = `translate(-50%, ${tyPercent})`;
  }, [uiStoreApi, getTilePosition]);

  // Reposition pre-paint when the active item / its size changes (no visible jump).
  useLayoutEffect(() => {
    applyPlacement();
  });

  // Reposition on pan / zoom / resize / left-tab toggle without re-rendering React.
  useEffect(() => {
    applyPlacement();
    return uiStoreApi.subscribe((state, prev) => {
      if (
        state.scroll === prev.scroll &&
        state.zoom === prev.zoom &&
        state.rendererSize === prev.rendererSize &&
        state.activeLeftTab === prev.activeLeftTab
      ) {
        return;
      }
      applyPlacement();
    });
  }, [uiStoreApi, applyPlacement]);

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
    // B2 / Decision #3: clear the source-node selection the action bar leaves
    // behind, so an Esc mid-connection reaches connector-abort instead of being
    // consumed by the selection-clear path (belt-and-suspenders with the Esc
    // priority reorder in useInteractionManager.handleEscapeKey).
    uiStateActions.clearSelection();
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

  // Derive the anchor TILE for the active element type. Screen placement (incl.
  // origin TOP/BOTTOM for the flip) is computed from this tile in applyPlacement.
  const getAnchorTile = (): Coords | null => {
    if (type === 'ITEM' && viewItem) return viewItem.tile;
    if (type === 'TEXTBOX' && textBox) return textBox.tile;
    if (type === 'RECTANGLE' && rectangle) {
      return {
        x: (rectangle.from.x + rectangle.to.x) / 2,
        y: Math.min(rectangle.from.y, rectangle.to.y)
      };
    }
    if (type === 'CONNECTOR' && connectorTile) return connectorTile;
    return null;
  };

  // Guard: can't render without an anchor or the type's backing item data.
  const hasRequiredData = (): boolean => {
    if (type === 'ITEM') return !!viewItem && !!modelItem;
    if (type === 'CONNECTOR') return !!connector;
    if (type === 'TEXTBOX') return !!textBox;
    if (type === 'RECTANGLE') return !!rectangle;
    return false;
  };

  const anchorTile = getAnchorTile();
  // Refresh the ref every render so the direct-subscription placement uses the
  // live tile (it survives the early return below only when there's a tile).
  anchorTileRef.current = anchorTile ?? undefined;
  if (!anchorTile || !hasRequiredData()) return null;

  // Per-type source values — table lookup avoids long type-dispatch ternaries.
  const notesByType: Record<ItemType, string | undefined> = {
    ITEM: modelItem?.notes,
    CONNECTOR: connector?.notes,
    TEXTBOX: undefined,
    RECTANGLE: undefined
  };
  const linkByType: Record<ItemType, string | undefined> = {
    ITEM: modelItem?.headerLink,
    CONNECTOR: connector?.headerLink,
    TEXTBOX: undefined,
    RECTANGLE: undefined
  };
  const layerIdByType: Record<ItemType, string | undefined> = {
    ITEM: viewItem?.layerId,
    CONNECTOR: connector?.layerId,
    TEXTBOX: textBox?.layerId,
    RECTANGLE: rectangle?.layerId
  };

  const activeNotes = notesByType[type];
  const hasNotes = !!activeNotes && hasVisibleText(activeNotes);
  const hasLink = !!linkByType[type];
  const currentLayerId = layerIdByType[type];

  const showLink = type === 'ITEM' || type === 'CONNECTOR';
  const showNotes = type === 'ITEM' || type === 'CONNECTOR';
  const showStartConnector = type === 'ITEM';
  const showZOrder = type === 'ITEM';

  const renderLayerMenuItems = () => {
    if (layers.length === 0) {
      return (
        <MenuItem disabled sx={{ fontSize: 13 }}>
          No layers — open the Layers panel to add one
        </MenuItem>
      );
    }
    return [
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
    ];
  };

  return (
    <Box
      ref={wrapperRef}
      sx={{
        // left / top / transform are set imperatively by applyPlacement
        // (screen-space, top-anchored with edge flip-below + horizontal clamp).
        position: 'absolute',
        pointerEvents: 'auto',
        // B4 / decision #5: render ABOVE the LeftDock stacking context (dock is
        // zIndex 20) so the bar is never hidden behind it near the left edge.
        // Just above the dock — below MUI Portal-rendered menus/tooltips, which
        // sit at the document root.
        zIndex: 21
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
        {renderLayerMenuItems()}
      </Menu>
    </Box>
  );
};
