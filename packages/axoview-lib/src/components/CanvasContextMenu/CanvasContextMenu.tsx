import React, { useCallback, useMemo, useState } from 'react';
import {
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  Typography
} from '@mui/material';
import {
  InfoOutlined as DetailsIcon,
  DriveFileRenameOutlineOutlined as RenameIcon,
  ContentCutOutlined as CutIcon,
  ContentCopyOutlined as CopyIcon,
  ContentPasteOutlined as PasteIcon,
  ControlPointDuplicateOutlined as DuplicateIcon,
  DeleteOutlineOutlined as DeleteIcon,
  ArrowUpwardOutlined as BringForwardIcon,
  ArrowDownwardOutlined as SendBackIcon,
  LayersOutlined as LayersIcon,
  GridOnOutlined as SnapIcon,
  BlockOutlined as CollisionIcon,
  AddBoxOutlined as AddItemIcon,
  SelectAllOutlined as SelectAllIcon,
  ChevronRight as ChevronRightIcon,
  Check as CheckIcon,
  StickyNote2Outlined as AddNoteIcon,
  NewLabelOutlined as AddLabelIcon
} from '@mui/icons-material';
import {
  dispatch as dispatchPanelEvent,
  ItemType
} from 'src/components/NodeActionBar/NodeActionBar.helpers';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useTranslation } from 'src/stores/localeStore';
import { useScene } from 'src/hooks/useScene';
import { useLayerContext } from 'src/hooks/useLayerContext';
import { useLayerActions } from 'src/hooks/useLayerActions';
import { useCopyPaste } from 'src/clipboard/useCopyPaste';
import { collectSelectableRefs } from 'src/utils/selectableRefs';
import { itemCollides } from 'src/utils';
import {
  countUserFacingRefs,
  filterUserFacingRefs
} from 'src/utils/connectorSelection';
import { ItemReference } from 'src/types';

// Keyboard hint chip on the right of a row (monospace, secondary) — mirrors the
// hotkey hints elsewhere. Display-only.
const Hint = ({ children }: { children: React.ReactNode }) => (
  <Typography
    variant="micro"
    color="text.secondary"
    sx={{ fontFamily: 'monospace', ml: 3 }}
  >
    {children}
  </Typography>
);

// Item types that support canvas inline-rename (F2 / 'inlineEditNodeName').
const INLINE_RENAMEABLE = new Set(['ITEM', 'TEXTBOX', 'CONNECTOR']);

/**
 * Canvas context menu (ADR 0027) — the per-item / empty-canvas command surface.
 *
 * Division of labor (ADR 0027 §4, 2026-06-25 addendum): this menu is now the
 * SOLE per-item command surface — the floating NodeActionBar was removed, so the
 * three-tier model collapsed to two: menu = per-item commands (right-tap /
 * long-press), details panel = editing. No command is reachable only via a
 * removed gesture — everything here also has a panel or hotkey route.
 *
 * Rendered via MUI Menu → portals to the document root, so it is screen-pixel
 * stable at any zoom (UX §8.8 — no counter-scale needed). Self-gates on the
 * `contextMenu` store slice; mount it once (edit mode) in UiOverlay.
 */
export const CanvasContextMenu = () => {
  // D1 — every label below is routed through the canvasContextMenu namespace
  // (was hardcoded English in all locales). Count rows interpolate {count}.
  const { t } = useTranslation('canvasContextMenu');
  const contextMenu = useUiStateStore((s) => s.contextMenu);
  const selectedIds = useUiStateStore((s) => s.selectedIds);
  const snapToGrid = useUiStateStore((s) => s.snapToGrid);
  const actions = useUiStateStore((s) => s.actions);
  const scene = useScene();
  const { layers, lockedIds, visibleIds } = useLayerContext();
  const { assignLayerToItems } = useLayerActions();
  const { handleCopy, handleCut, handlePaste } = useCopyPaste();

  // Layer-assign flyout anchor (a secondary, nested MUI Menu).
  const [layerAnchor, setLayerAnchor] = useState<HTMLElement | null>(null);

  const close = useCallback(() => {
    setLayerAnchor(null);
    actions.closeContextMenu();
  }, [actions]);

  // Wrap a command so it always closes the menu afterwards.
  const run = useCallback(
    (fn: () => void) => () => {
      fn();
      close();
    },
    [close]
  );

  const target = contextMenu?.target ?? null;

  const handleDetails = useCallback(() => {
    if (!target) return;
    actions.setItemControls({ type: target.type, id: target.id });
  }, [actions, target]);

  const handleRename = useCallback(() => {
    if (!target) return;
    window.dispatchEvent(
      new CustomEvent('inlineEditNodeName', { detail: { id: target.id } })
    );
  }, [target]);

  const handleAddNote = useCallback(() => {
    if (!target) return;
    // Open the details panel, then (one frame later, once the freshly-mounted
    // controls have attached their panel-event listener) switch to the Notes tab.
    actions.setItemControls({ type: target.type, id: target.id });
    requestAnimationFrame(() =>
      dispatchPanelEvent(target.type as ItemType, 'focusNotes')
    );
  }, [actions, target]);

  const handleAddLabel = useCallback(() => {
    if (target?.type !== 'CONNECTOR') return;
    // Open the connector's details, then (one frame later, once the freshly
    // mounted controls have attached their panel-event listener) create a label
    // through the same path as the in-panel + button.
    actions.setItemControls({ type: 'CONNECTOR', id: target.id });
    requestAnimationFrame(() => dispatchPanelEvent('CONNECTOR', 'addLabel'));
  }, [actions, target]);

  const handleDelete = useCallback(() => {
    if (!target) return;
    if (target.type === 'ITEM') scene.deleteViewItem(target.id);
    else if (target.type === 'CONNECTOR') scene.deleteConnector(target.id);
    else if (target.type === 'TEXTBOX') scene.deleteTextBox(target.id);
    else if (target.type === 'RECTANGLE') scene.deleteRectangle(target.id);
    actions.setItemControls(null);
  }, [scene, actions, target]);

  const handleDuplicate = useCallback(() => {
    // Copy + paste — paste offsets to the cursor tile + nudges off occupied
    // tiles, giving a near-in-place duplicate (the pre-existing paste path).
    handleCopy();
    handlePaste();
  }, [handleCopy, handlePaste]);

  // Z-order: read the current view item's zIndex, nudge it. ITEM only — the
  // same scope as the action bar / Ctrl+]/Ctrl+[.
  const nudgeZOrder = useCallback(
    (delta: number) => {
      if (target?.type !== 'ITEM') return;
      const viewItem = scene.currentView.items?.find((i) => i.id === target.id);
      const currentZ = viewItem?.zIndex ?? 0;
      scene.updateViewItem(target.id, { zIndex: currentZ + delta });
    },
    [scene, target]
  );

  const variant = contextMenu?.variant ?? 'item';

  // Assign-to-layer dispatches to the single target, or — in the bulk menu — to
  // every user-facing ref in the multi-selection (waypoints stripped; they ride
  // with their connector — see filterUserFacingRefs).
  const handleAssignLayer = useCallback(
    (layerId: string | undefined) => {
      if (variant === 'multi') {
        assignLayerToItems(layerId, filterUserFacingRefs(selectedIds));
      } else if (target) {
        assignLayerToItems(layerId, [target]);
      }
      close();
    },
    [variant, assignLayerToItems, selectedIds, target, close]
  );

  // Bulk delete — every selected item (mirrors the Delete-key multi path).
  const handleDeleteMulti = useCallback(() => {
    scene.deleteSelectedItems(selectedIds);
    actions.clearSelection();
  }, [scene, actions, selectedIds]);

  const handleSelectAll = useCallback(() => {
    actions.setSelectedIds(
      collectSelectableRefs(scene, lockedIds, visibleIds)
    );
  }, [actions, scene, lockedIds, visibleIds]);

  const handleAddItem = useCallback(() => {
    actions.setActiveLeftTab('ELEMENTS');
  }, [actions]);

  // Current layer (for the flyout's "selected" highlight + "Remove from layer").
  // ITEM only — the view item carries layerId; assignment itself works for every
  // type, this is just the cosmetic pre-highlight.
  const currentLayerId = useMemo(() => {
    if (target?.type !== 'ITEM') return undefined;
    return scene.currentView.items?.find((i) => i.id === target.id)?.layerId;
  }, [scene, target]);

  // ADR 0023 off-grid + collision. Snap/collision apply to ITEM / RECTANGLE /
  // TEXTBOX (a connector has no placement of its own). Read the target's current
  // view-item/rectangle/textbox to label + toggle the entries.
  const offGridTarget = useMemo(() => {
    if (!target) return null;
    if (target.type === 'ITEM')
      return scene.currentView.items?.find((i) => i.id === target.id) ?? null;
    if (target.type === 'RECTANGLE')
      return (
        scene.currentView.rectangles?.find((r) => r.id === target.id) ?? null
      );
    if (target.type === 'TEXTBOX')
      return scene.currentView.textBoxes?.find((t) => t.id === target.id) ?? null;
    return null;
  }, [scene, target]);

  // Apply an off-grid field update to any placement ref via the type-appropriate
  // scene action (connectors carry no snap/collides, so they are skipped).
  const applyOffGrid = useCallback(
    (
      ref: ItemReference,
      updates: { snap?: boolean; collides?: boolean; offset?: undefined }
    ) => {
      if (ref.type === 'ITEM') scene.updateViewItem(ref.id, updates);
      else if (ref.type === 'RECTANGLE') scene.updateRectangle(ref.id, updates);
      else if (ref.type === 'TEXTBOX') scene.updateTextBox(ref.id, updates);
    },
    [scene]
  );

  const handleToggleSnap = useCallback(() => {
    if (!target || !offGridTarget) return;
    if (offGridTarget.snap === false) {
      // Re-snap: back to the grid AND clear the committed offset (one chokepoint
      // owns clearing it; here it is the explicit snap action).
      applyOffGrid(target, { snap: undefined, offset: undefined });
    } else {
      // Unsnap: collision is implied off via the itemCollides predicate.
      applyOffGrid(target, { snap: false });
    }
  }, [target, offGridTarget, applyOffGrid]);

  const handleToggleCollision = useCallback(() => {
    if (!target || !offGridTarget) return;
    applyOffGrid(target, { collides: !itemCollides(offGridTarget) });
  }, [target, offGridTarget, applyOffGrid]);

  // Bulk: unsnap / disable collision over every user-facing ref in the
  // selection (waypoints stripped; connectors skipped), one undo entry.
  const handleBulkUnsnap = useCallback(() => {
    scene.transaction(() => {
      filterUserFacingRefs(selectedIds).forEach((ref) =>
        applyOffGrid(ref, { snap: false })
      );
    });
  }, [scene, selectedIds, applyOffGrid]);

  const handleBulkDisableCollision = useCallback(() => {
    scene.transaction(() => {
      filterUserFacingRefs(selectedIds).forEach((ref) =>
        applyOffGrid(ref, { collides: false })
      );
    });
  }, [scene, selectedIds, applyOffGrid]);

  if (!contextMenu) return null;

  const isItem = target?.type === 'ITEM';
  // Off-grid commands apply to placeable items, not connectors.
  const canOffGrid = !!target && target.type !== 'CONNECTOR';
  const isUnsnapped = offGridTarget?.snap === false;
  const collidesNow = offGridTarget ? itemCollides(offGridTarget) : true;
  const canRename = !!target && INLINE_RENAMEABLE.has(target.type);
  // Only nodes (ITEM) and connectors carry a `notes` field / Notes tab.
  const canAddNote =
    !!target && (target.type === 'ITEM' || target.type === 'CONNECTOR');
  // Labels are a connector-only concept (ADR 0011 connector labels array).
  const canAddLabel = target?.type === 'CONNECTOR';
  const multiCount = countUserFacingRefs(selectedIds);

  // D1 — pluralise the count rows through i18n: pick the singular/plural key by
  // count, then interpolate {count} (the lib t() has no built-in interpolation,
  // so we string-replace, matching QuickIconSelector/IconPackSettings). Never
  // append an 's' — that breaks every non-English locale.
  const countLabel = (
    oneKey: 'itemsSelectedOne' | 'deleteItemsOne',
    otherKey: 'itemsSelectedOther' | 'deleteItemsOther'
  ) =>
    t(multiCount === 1 ? oneKey : otherKey).replace(
      '{count}',
      String(multiCount)
    );

  return (
    <>
      <Menu
        open
        onClose={close}
        anchorReference="anchorPosition"
        anchorPosition={{
          top: contextMenu.anchor.y,
          left: contextMenu.anchor.x
        }}
        // Right-click should not steal focus into the first item; keep the
        // canvas focused so a follow-up keystroke still routes to it.
        disableAutoFocusItem
        slotProps={{ paper: { sx: { minWidth: 200 } } }}
        MenuListProps={{ dense: true }}
      >
        {variant === 'item'
          ? [
              <MenuItem key="details" onClick={run(handleDetails)}>
                <ListItemIcon>
                  <DetailsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t('details')}</ListItemText>
              </MenuItem>,
              canRename && (
                <MenuItem key="rename" onClick={run(handleRename)}>
                  <ListItemIcon>
                    <RenameIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t('rename')}</ListItemText>
                  <Hint>F2</Hint>
                </MenuItem>
              ),
              canAddLabel && (
                <MenuItem key="addLabel" onClick={run(handleAddLabel)}>
                  <ListItemIcon>
                    <AddLabelIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t('addLabel')}</ListItemText>
                </MenuItem>
              ),
              canAddNote && (
                <MenuItem key="addNote" onClick={run(handleAddNote)}>
                  <ListItemIcon>
                    <AddNoteIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t('addNote')}</ListItemText>
                </MenuItem>
              ),
              <Divider key="d1" />,
              <MenuItem key="cut" onClick={run(handleCut)}>
                <ListItemIcon>
                  <CutIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t('cut')}</ListItemText>
                <Hint>Ctrl+X</Hint>
              </MenuItem>,
              <MenuItem key="copy" onClick={run(handleCopy)}>
                <ListItemIcon>
                  <CopyIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t('copy')}</ListItemText>
                <Hint>Ctrl+C</Hint>
              </MenuItem>,
              <MenuItem key="paste" onClick={run(handlePaste)}>
                <ListItemIcon>
                  <PasteIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t('paste')}</ListItemText>
                <Hint>Ctrl+V</Hint>
              </MenuItem>,
              <MenuItem key="duplicate" onClick={run(handleDuplicate)}>
                <ListItemIcon>
                  <DuplicateIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t('duplicate')}</ListItemText>
              </MenuItem>,
              <Divider key="d2" />,
              isItem && (
                <MenuItem
                  key="forward"
                  onClick={run(() => nudgeZOrder(1))}
                >
                  <ListItemIcon>
                    <BringForwardIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t('bringForward')}</ListItemText>
                  <Hint>Ctrl+]</Hint>
                </MenuItem>
              ),
              isItem && (
                <MenuItem key="back" onClick={run(() => nudgeZOrder(-1))}>
                  <ListItemIcon>
                    <SendBackIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t('sendBackward')}</ListItemText>
                  <Hint>Ctrl+[</Hint>
                </MenuItem>
              ),
              <MenuItem
                key="layer"
                onClick={(e) => setLayerAnchor(e.currentTarget)}
              >
                <ListItemIcon>
                  <LayersIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t('assignToLayer')}</ListItemText>
                <ChevronRightIcon fontSize="small" sx={{ ml: 2, opacity: 0.6 }} />
              </MenuItem>,
              canOffGrid && <Divider key="d3" />,
              // ADR 0023 — per-item off-grid + collision. Snap toggles whether
              // the item rounds to the grid (and clears its offset on re-snap);
              // collision toggles whether it participates in the TileIndex.
              // The per-item snap override is only meaningful while GLOBAL grid
              // snap is ON — when the whole canvas is already off-grid, an
              // "unsnap this item" entry is a no-op users found confusing, so we
              // hide it then (collision is grid-independent and stays).
              canOffGrid && snapToGrid && (
                <MenuItem key="snap" onClick={run(handleToggleSnap)}>
                  <ListItemIcon>
                    <SnapIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>
                    {isUnsnapped ? t('snapToGrid') : t('unsnapFromGrid')}
                  </ListItemText>
                </MenuItem>
              ),
              canOffGrid && (
                <MenuItem key="collision" onClick={run(handleToggleCollision)}>
                  <ListItemIcon>
                    <CollisionIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>
                    {collidesNow ? t('disableCollision') : t('enableCollision')}
                  </ListItemText>
                </MenuItem>
              ),
              <Divider key="d4" />,
              <MenuItem key="delete" onClick={run(handleDelete)}>
                <ListItemIcon>
                  <DeleteIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText sx={{ color: 'error.main' }}>
                  {t('delete')}
                </ListItemText>
                <Hint>Del</Hint>
              </MenuItem>
            ].filter(Boolean)
          : variant === 'multi'
          ? [
              <MenuItem key="count" disabled>
                <ListItemText
                  primaryTypographyProps={{ variant: 'caption' }}
                  sx={{ color: 'text.secondary' }}
                >
                  {countLabel('itemsSelectedOne', 'itemsSelectedOther')}
                </ListItemText>
              </MenuItem>,
              <Divider key="d0" />,
              <MenuItem key="cut" onClick={run(handleCut)}>
                <ListItemIcon>
                  <CutIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t('cut')}</ListItemText>
                <Hint>Ctrl+X</Hint>
              </MenuItem>,
              <MenuItem key="copy" onClick={run(handleCopy)}>
                <ListItemIcon>
                  <CopyIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t('copy')}</ListItemText>
                <Hint>Ctrl+C</Hint>
              </MenuItem>,
              <MenuItem key="duplicate" onClick={run(handleDuplicate)}>
                <ListItemIcon>
                  <DuplicateIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t('duplicate')}</ListItemText>
              </MenuItem>,
              <Divider key="d1" />,
              <MenuItem
                key="layer"
                onClick={(e) => setLayerAnchor(e.currentTarget)}
              >
                <ListItemIcon>
                  <LayersIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t('assignToLayer')}</ListItemText>
                <ChevronRightIcon fontSize="small" sx={{ ml: 2, opacity: 0.6 }} />
              </MenuItem>,
              <Divider key="d2" />,
              // ADR 0023 — bulk off-grid over the whole selection (one undo
              // entry). The primary bulk intent: free a group from the grid /
              // collision; re-snap or re-enable is per-item on the item menu.
              // Only meaningful while GLOBAL snap is ON (see the item menu note).
              snapToGrid && (
                <MenuItem key="snap" onClick={run(handleBulkUnsnap)}>
                  <ListItemIcon>
                    <SnapIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t('unsnapFromGrid')}</ListItemText>
                </MenuItem>
              ),
              <MenuItem key="collision" onClick={run(handleBulkDisableCollision)}>
                <ListItemIcon>
                  <CollisionIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t('disableCollision')}</ListItemText>
              </MenuItem>,
              <Divider key="d3" />,
              <MenuItem key="delete" onClick={run(handleDeleteMulti)}>
                <ListItemIcon>
                  <DeleteIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText sx={{ color: 'error.main' }}>
                  {countLabel('deleteItemsOne', 'deleteItemsOther')}
                </ListItemText>
                <Hint>Del</Hint>
              </MenuItem>
            ]
          : [
              <MenuItem key="add" onClick={run(handleAddItem)}>
                <ListItemIcon>
                  <AddItemIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t('addItem')}</ListItemText>
              </MenuItem>,
              <MenuItem key="paste" onClick={run(handlePaste)}>
                <ListItemIcon>
                  <PasteIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t('paste')}</ListItemText>
                <Hint>Ctrl+V</Hint>
              </MenuItem>,
              <MenuItem key="selectall" onClick={run(handleSelectAll)}>
                <ListItemIcon>
                  <SelectAllIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t('selectAll')}</ListItemText>
                <Hint>Ctrl+A</Hint>
              </MenuItem>,
              <Divider key="d1" />,
              // ADR 0023 #12 — the global snap-to-grid toggle (persisted).
              // Stateful: a stable "Snap to grid" label + a trailing check when
              // global snap is ON, so the canvas-wide state is legible at a
              // glance rather than inferred from an Enable/Disable verb. This is
              // the single source of truth for grid snapping; per-item snap
              // overrides only surface while it's ON. (User feedback.)
              <MenuItem
                key="snap"
                onClick={run(() => actions.toggleSnapToGrid())}
              >
                <ListItemIcon>
                  <SnapIcon
                    fontSize="small"
                    color={snapToGrid ? 'primary' : undefined}
                  />
                </ListItemIcon>
                <ListItemText>{t('snapToGrid')}</ListItemText>
                {snapToGrid && (
                  <CheckIcon fontSize="small" color="primary" sx={{ ml: 2 }} />
                )}
              </MenuItem>
            ]}
      </Menu>

      {/* Layer-assign flyout — a secondary MUI Menu nested in the context menu. */}
      <Menu
        anchorEl={layerAnchor}
        open={!!layerAnchor}
        onClose={() => setLayerAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        MenuListProps={{ dense: true }}
      >
        {layers.length === 0 && (
          <MenuItem disabled>
            <ListItemText>{t('noLayers')}</ListItemText>
          </MenuItem>
        )}
        {currentLayerId && (
          <MenuItem onClick={() => handleAssignLayer(undefined)}>
            <ListItemText>{t('removeFromLayer')}</ListItemText>
          </MenuItem>
        )}
        {currentLayerId && <Divider />}
        {[...layers]
          .sort((a, b) => b.order - a.order)
          .map((layer) => (
            <MenuItem
              key={layer.id}
              selected={layer.id === currentLayerId}
              onClick={() => handleAssignLayer(layer.id)}
            >
              <ListItemText>{layer.name}</ListItemText>
            </MenuItem>
          ))}
      </Menu>
    </>
  );
};
