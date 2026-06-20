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
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { useLayerContext } from 'src/hooks/useLayerContext';
import { useLayerActions } from 'src/hooks/useLayerActions';
import { useCopyPaste } from 'src/clipboard/useCopyPaste';
import { collectSelectableRefs } from 'src/utils/selectableRefs';
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
 * Division of labor (ADR 0027 §4): the NodeActionBar carries the 3–4 quick
 * actions on selection; THIS menu is the full catalogue on right-tap /
 * long-press; the details panel is for editing. No command is reachable only
 * via a removed gesture — everything here is also reachable elsewhere (the bar,
 * the panel, or a hotkey).
 *
 * Rendered via MUI Menu → portals to the document root, so it is screen-pixel
 * stable at any zoom (UX §8.8 — no counter-scale needed). Self-gates on the
 * `contextMenu` store slice; mount it once (edit mode) in UiOverlay.
 */
export const CanvasContextMenu = () => {
  const contextMenu = useUiStateStore((s) => s.contextMenu);
  const actions = useUiStateStore((s) => s.actions);
  const scene = useScene();
  const { layers, lockedIds, visibleIds } = useLayerContext();
  const { assignLayerToItems } = useLayerActions();
  const { handleCopy, handleCut, handlePaste } = useCopyPaste();

  // Layer-assign flyout anchor (a secondary Menu, like NodeActionBar).
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

  const handleAssignLayer = useCallback(
    (layerId: string | undefined) => {
      if (target) assignLayerToItems(layerId, [target]);
      close();
    },
    [assignLayerToItems, target, close]
  );

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

  if (!contextMenu) return null;

  const isItemMenu = target !== null;
  const isItem = target?.type === 'ITEM';
  const canRename = !!target && INLINE_RENAMEABLE.has(target.type);

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
        {isItemMenu
          ? [
              <MenuItem key="details" onClick={run(handleDetails)}>
                <ListItemIcon>
                  <DetailsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Details…</ListItemText>
              </MenuItem>,
              canRename && (
                <MenuItem key="rename" onClick={run(handleRename)}>
                  <ListItemIcon>
                    <RenameIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Rename</ListItemText>
                  <Hint>F2</Hint>
                </MenuItem>
              ),
              <Divider key="d1" />,
              <MenuItem key="cut" onClick={run(handleCut)}>
                <ListItemIcon>
                  <CutIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Cut</ListItemText>
                <Hint>Ctrl+X</Hint>
              </MenuItem>,
              <MenuItem key="copy" onClick={run(handleCopy)}>
                <ListItemIcon>
                  <CopyIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Copy</ListItemText>
                <Hint>Ctrl+C</Hint>
              </MenuItem>,
              <MenuItem key="paste" onClick={run(handlePaste)}>
                <ListItemIcon>
                  <PasteIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Paste</ListItemText>
                <Hint>Ctrl+V</Hint>
              </MenuItem>,
              <MenuItem key="duplicate" onClick={run(handleDuplicate)}>
                <ListItemIcon>
                  <DuplicateIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Duplicate</ListItemText>
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
                  <ListItemText>Bring forward</ListItemText>
                  <Hint>Ctrl+]</Hint>
                </MenuItem>
              ),
              isItem && (
                <MenuItem key="back" onClick={run(() => nudgeZOrder(-1))}>
                  <ListItemIcon>
                    <SendBackIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Send backward</ListItemText>
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
                <ListItemText>Assign to layer</ListItemText>
                <ChevronRightIcon fontSize="small" sx={{ ml: 2, opacity: 0.6 }} />
              </MenuItem>,
              <Divider key="d3" />,
              // T8 (ADR 0023) — the unsnap / collision model fields don't exist
              // yet. Render the catalogue entries disabled so the menu shows its
              // full shape; T8 wires the handlers + per-item state.
              <MenuItem key="snap" disabled>
                <ListItemIcon>
                  <SnapIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Unsnap from grid</ListItemText>
              </MenuItem>,
              <MenuItem key="collision" disabled>
                <ListItemIcon>
                  <CollisionIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Disable collision</ListItemText>
              </MenuItem>,
              <Divider key="d4" />,
              <MenuItem key="delete" onClick={run(handleDelete)}>
                <ListItemIcon>
                  <DeleteIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
                <Hint>Del</Hint>
              </MenuItem>
            ].filter(Boolean)
          : [
              <MenuItem key="add" onClick={run(handleAddItem)}>
                <ListItemIcon>
                  <AddItemIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Add item</ListItemText>
              </MenuItem>,
              <MenuItem key="paste" onClick={run(handlePaste)}>
                <ListItemIcon>
                  <PasteIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Paste</ListItemText>
                <Hint>Ctrl+V</Hint>
              </MenuItem>,
              <MenuItem key="selectall" onClick={run(handleSelectAll)}>
                <ListItemIcon>
                  <SelectAllIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Select all</ListItemText>
                <Hint>Ctrl+A</Hint>
              </MenuItem>,
              <Divider key="d1" />,
              <MenuItem key="snap" disabled>
                <ListItemIcon>
                  <SnapIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Snap to grid</ListItemText>
              </MenuItem>
            ]}
      </Menu>

      {/* Layer-assign flyout — mirrors NodeActionBar's pattern. */}
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
            <ListItemText>No layers — add one in the Layers panel</ListItemText>
          </MenuItem>
        )}
        {currentLayerId && (
          <MenuItem onClick={() => handleAssignLayer(undefined)}>
            <ListItemText>Remove from layer</ListItemText>
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
