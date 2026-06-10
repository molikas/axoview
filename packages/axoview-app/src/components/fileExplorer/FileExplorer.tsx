import { useRef, useState, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { Tree, TreeApi, NodeApi } from 'react-arborist';
import { exportAsJSON, mergeBundledFixtures, type Model } from 'axoview';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Menu,
  Typography,
  type PaperProps
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useAppStorage } from '../../providers/AppStorageContext';
import { useDiagramLifecycle } from '../../providers/DiagramLifecycleProvider';
import { useFileTree, FileNode } from '../../hooks/useFileTree';
import { FileTreeNode } from './FileTreeNode';
import { FileTreeToolbar } from './FileTreeToolbar';
import { ContextMenuItems } from './ContextMenuItems';
import { ExportProjectZipDialog } from './ExportProjectZipDialog';
import { ImportDialog } from './ImportDialog';
import { notificationStore } from '../../stores/notificationStore';
import { copySuffix, countDescendants, detectCollision } from '../../utils/fileOperations';
import { shareUrlFromUuid } from '../../utils/shareUrl';
import { ExportScope } from '../../services/project/projectZip';

interface DeleteConfirm {
  id: string;
  type: 'diagram' | 'folder';
  name: string;
  descendantCount: number;
}

interface CollisionDialog {
  dragId: string;
  type: 'diagram' | 'folder';
  name: string;
  targetFolderId: string | null;
}

interface PendingNew {
  type: 'folder' | 'diagram';
  parentId: string | null;
}

// Custom row: arborist's DefaultRow has only onClick — we need onDoubleClick to
// trigger inline rename on a real DOM node arborist owns.
function FileTreeRow({
  node,
  attrs,
  innerRef,
  children
}: {
  node: NodeApi<FileNode>;
  attrs: React.HTMLAttributes<HTMLDivElement> & { style?: React.CSSProperties };
  innerRef: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
}) {
  return (
    <div
      {...attrs}
      ref={innerRef}
      onFocus={(e) => e.stopPropagation()}
      onClick={node.handleClick}
      onDoubleClick={(e) => {
        if (node.data.id === '__pending__') return;
        if (node.data.type === 'folder') return;
        e.preventDefault();
        e.stopPropagation();
        node.select();
        node.tree.edit(node.id);
      }}
    >
      {children}
    </div>
  );
}

function providerIdToLabel(id: string): string {
  if (id === 'google-drive') return 'Google Drive';
  return 'Diagrams';
}

function injectPendingNode(
  nodes: FileNode[],
  parentId: string | null,
  type: 'folder' | 'diagram'
): FileNode[] {
  const pendingNode: FileNode = {
    id: '__pending__',
    name: '',
    type,
    children: type === 'folder' ? [] : undefined
  };

  if (parentId === null) {
    return [pendingNode, ...nodes];
  }

  return nodes.map((node) => {
    if (node.id === parentId) {
      return { ...node, children: [pendingNode, ...(node.children ?? [])] };
    }
    if (node.children) {
      return { ...node, children: injectPendingNode(node.children, parentId, type) };
    }
    return node;
  });
}

export function FileExplorer() {
  const { storage, serverStorageAvailable } = useAppStorage();
  const {
    currentDiagram,
    openDiagramById,
    fileTreeRefreshToken,
    dirtyDiagramIds,
    checkUnsavedBeforeNavigate,
    markProjectExported,
    notifyDiagramRenamedFromTree,
    notifyDiagramDeletedFromTree,
    axoviewRef
  } = useDiagramLifecycle();
  const treeRef = useRef<TreeApi<FileNode> | undefined>(undefined);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const [treeHeight, setTreeHeight] = useState(400);

  const [selectedNode, setSelectedNode] = useState<FileNode | null>(null);
  const [pendingNew, setPendingNew] = useState<PendingNew | null>(null);
  const [contextMenuAnchor, setContextMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuNode, setContextMenuNode] = useState<FileNode | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [collisionDialog, setCollisionDialog] = useState<CollisionDialog | null>(null);
  const [exportTarget, setExportTarget] = useState<{
    scope: Exclude<ExportScope, 'diagram'>;
    folderId?: string;
    folderName?: string;
  } | null>(null);
  const [showImport, setShowImport] = useState(false);

  const tree = useFileTree(
    storage,
    fileTreeRefreshToken,
    currentDiagram?.id,
    undefined,
    dirtyDiagramIds
  );

  const providerLabel = providerIdToLabel(storage?.id ?? 'local');

  // Folder id of the currently selected node (or null for root)
  const selectedFolderId = useMemo((): string | null => {
    if (!selectedNode) return null;
    if (selectedNode.type === 'folder') return selectedNode.id;
    return selectedNode.diagramMeta?.folderId ?? null;
  }, [selectedNode]);

  // Tree data with optional pending __pending__ node injected
  const treeDataWithPending = useMemo(() => {
    if (!pendingNew) return tree.treeData;
    return injectPendingNode(tree.treeData, pendingNew.parentId, pendingNew.type);
  }, [tree.treeData, pendingNew]);

  // Trigger edit on __pending__ node when it is injected
  useEffect(() => {
    if (!pendingNew) return;
    const timer = setTimeout(() => {
      treeRef.current?.edit('__pending__');
    }, 50);
    return () => clearTimeout(timer);
  }, [pendingNew]);

  // ---------------------------------------------------------------------------
  // Context menu
  // ---------------------------------------------------------------------------

  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuAnchor({ x: e.clientX, y: e.clientY });
    setContextMenuNode(node);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenuAnchor(null);
    setContextMenuNode(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Open diagram
  // ---------------------------------------------------------------------------

  const handleOpenDiagram = useCallback(
    async (node: FileNode) => {
      if (node.type !== 'diagram' || !node.diagramMeta) return;
      if (currentDiagram?.id === node.id) return;
      try {
        await openDiagramById(node.diagramMeta.id, node.diagramMeta.name);
      } catch {
        notificationStore.push({ severity: 'error', message: `Failed to open "${node.name}"` });
      }
    },
    [openDiagramById, currentDiagram]
  );

  // ---------------------------------------------------------------------------
  // Rename (and __pending__ creation via rename submit)
  // ---------------------------------------------------------------------------

  const handleRenameNode = useCallback((node: FileNode) => {
    // Delay so the MUI Menu close animation completes and restores focus before
    // we put the input in edit mode — prevents the menu from stealing focus back.
    setTimeout(() => {
      treeRef.current?.edit(node.id);
    }, 150);
  }, []);

  const handleRenameSubmit = useCallback(
    async (id: string, name: string) => {
      if (id === '__pending__') {
        const trimmed = name.trim();
        const type = pendingNew?.type;
        const parentId = pendingNew?.parentId ?? null;
        setPendingNew(null);

        if (!trimmed || !type) return; // empty or Escape → cancel

        if (type === 'folder') {
          try {
            await tree.createFolder(parentId, trimmed);
          } catch {
            notificationStore.push({ severity: 'error', message: 'Failed to create folder' });
          }
        } else {
          // diagram — check unsaved changes, then create and open
          checkUnsavedBeforeNavigate(async () => {
            try {
              if (!storage) return;
              const newId = await storage.createDiagram(
                { title: trimmed, name: trimmed, icons: [], colors: [], items: [], views: [], fitToScreen: true },
                parentId
              );
              await tree.refresh();
              await openDiagramById(newId, trimmed);
            } catch {
              notificationStore.push({ severity: 'error', message: 'Failed to create diagram' });
            }
          });
        }
        return;
      }

      // Normal rename
      const trimmed = name.trim();
      if (!trimmed) return;
      tree.optimisticRename(id, trimmed);
      notifyDiagramRenamedFromTree(id, trimmed);
      try {
        const isFolder = tree.folders.some((f) => f.id === id);
        if (isFolder) {
          await tree.renameFolder(id, trimmed);
        } else {
          await tree.renameDiagram(id, trimmed);
        }
      } catch {
        notificationStore.push({ severity: 'error', message: 'Rename failed' });
        tree.refresh();
      }
    },
    [tree, pendingNew, checkUnsavedBeforeNavigate, storage, openDiagramById, notifyDiagramRenamedFromTree]
  );

  // ---------------------------------------------------------------------------
  // New folder (inline)
  // ---------------------------------------------------------------------------

  const handleNewFolder = useCallback(() => {
    setPendingNew({ type: 'folder', parentId: selectedFolderId });
  }, [selectedFolderId]);

  // ---------------------------------------------------------------------------
  // New diagram (inline)
  // ---------------------------------------------------------------------------

  const handleNewDiagramInline = useCallback(() => {
    setPendingNew({ type: 'diagram', parentId: selectedFolderId });
  }, [selectedFolderId]);

  // ---------------------------------------------------------------------------
  // Collapse all
  // ---------------------------------------------------------------------------

  const handleCollapseAll = useCallback(() => {
    treeRef.current?.closeAll();
  }, []);

  // Measure container height for react-window virtualization
  useLayoutEffect(() => {
    const el = treeContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTreeHeight(el.clientHeight));
    ro.observe(el);
    setTreeHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // ---------------------------------------------------------------------------
  // Delete folder (with confirmation)
  // ---------------------------------------------------------------------------

  const handleDeleteFolder = useCallback(
    (node: FileNode) => {
      const count = countDescendants(node.id, { folders: tree.folders }, tree.diagrams);
      setDeleteConfirm({ id: node.id, type: 'folder', name: node.name, descendantCount: count });
    },
    [tree.folders, tree.diagrams]
  );

  const handleDeleteDiagram = useCallback((node: FileNode) => {
    setDeleteConfirm({ id: node.id, type: 'diagram', name: node.name, descendantCount: 0 });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    const target = deleteConfirm;
    setDeleteConfirm(null);
    try {
      if (target.type === 'folder') {
        await tree.deleteFolder(target.id, true);
        notificationStore.push({ severity: 'success', message: `Folder "${target.name}" deleted` });
      } else {
        // MQA #18: if the deleted diagram is the one currently on the canvas,
        // reset the canvas BEFORE the storage delete so the in-flight autosave
        // is canceled and can't recreate the diagram after we remove it.
        notifyDiagramDeletedFromTree(target.id);
        await tree.hardDeleteDiagram(target.id);
        notificationStore.push({ severity: 'success', message: `"${target.name}" deleted` });
      }
    } catch {
      notificationStore.push({ severity: 'error', message: 'Delete failed' });
    }
  }, [deleteConfirm, tree, notifyDiagramDeletedFromTree]);

  // ---------------------------------------------------------------------------
  // Copy share link
  // ---------------------------------------------------------------------------

  const handleCopyShareLink = useCallback(async (node: FileNode) => {
    if (node.type !== 'diagram' || !storage) return;
    if (!storage.shareDiagram) {
      notificationStore.push({ severity: 'error', message: 'Sharing is not available' });
      return;
    }
    try {
      const { uuid } = await storage.shareDiagram(node.id);
      const url = shareUrlFromUuid(uuid);
      await navigator.clipboard.writeText(url);
      notificationStore.push({ severity: 'success', message: 'Share link copied to clipboard' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create share link';
      notificationStore.push({ severity: 'error', message });
    }
  }, [storage]);

  // ---------------------------------------------------------------------------
  // Duplicate diagram
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Export — image (delegates to the lib's ExportImageDialog)
  // ---------------------------------------------------------------------------

  const handleExportImage = useCallback(
    (node: FileNode) => {
      if (node.type !== 'diagram' || !node.diagramMeta) return;
      const openDialog = () => axoviewRef.current?.openExportImageDialog();
      if (currentDiagram?.id === node.id) {
        openDialog();
        return;
      }
      checkUnsavedBeforeNavigate(async () => {
        try {
          await openDiagramById(node.diagramMeta!.id, node.diagramMeta!.name);
          // Wait one tick so the model store finishes hydrating before the
          // hidden Axoview inside the dialog reads from it.
          requestAnimationFrame(() => openDialog());
        } catch {
          notificationStore.push({ severity: 'error', message: `Failed to open "${node.name}"` });
        }
      });
    },
    [currentDiagram, openDiagramById, checkUnsavedBeforeNavigate, axoviewRef]
  );

  // ---------------------------------------------------------------------------
  // Export — JSON (direct download, no dialog)
  // ---------------------------------------------------------------------------

  const handleExportJsonNode = useCallback(
    async (node: FileNode) => {
      if (node.type !== 'diagram' || !storage) return;
      try {
        const raw = await storage.loadDiagram(node.id);
        // Storage returns `unknown`; runtime shape is a persisted diagram blob
        // that matches Model structurally — assert at this single lib boundary.
        const model = mergeBundledFixtures(raw as Model);
        exportAsJSON(model);
      } catch {
        notificationStore.push({ severity: 'error', message: `Failed to export "${node.name}"` });
      }
    },
    [storage]
  );

  const handleDuplicate = useCallback(
    async (node: FileNode) => {
      if (node.type !== 'diagram' || !storage) return;
      try {
        const siblingsInFolder = tree.diagrams
          .filter((d) => d.folderId === (node.diagramMeta?.folderId ?? null))
          .map((d) => d.name);
        const newName = copySuffix(node.name, siblingsInFolder);
        const data = await storage.loadDiagram(node.id);
        // Strip the original id so the server assigns a fresh one (prevents 409 Conflict).
        const { id: _id, ...dataWithoutId } = data as Record<string, unknown>;
        await storage.createDiagram(
          { ...dataWithoutId, title: newName, name: newName },
          node.diagramMeta?.folderId ?? null
        );
        await tree.refresh();
        notificationStore.push({ severity: 'success', message: `"${newName}" created` });
      } catch {
        notificationStore.push({ severity: 'error', message: 'Duplicate failed' });
      }
    },
    [storage, tree]
  );

  // ---------------------------------------------------------------------------
  // Drag-and-drop
  // ---------------------------------------------------------------------------

  const handleMove = useCallback(
    async ({
      dragIds,
      parentId
    }: {
      dragIds: string[];
      parentId: string | null;
      index: number;
    }) => {
      for (const dragId of dragIds) {
        const isFolder = tree.folders.some((f) => f.id === dragId);
        const type = isFolder ? 'folder' : 'diagram';

        // Determine current parent to reject same-parent reorders
        const currentParentId = isFolder
          ? (tree.folders.find((f) => f.id === dragId)?.parentId ?? null)
          : (tree.diagrams.find((d) => d.id === dragId)?.folderId ?? null);

        if (currentParentId === parentId) return; // same-parent reorder: silently ignore

        const node = isFolder
          ? tree.folders.find((f) => f.id === dragId)
          : tree.diagrams.find((d) => d.id === dragId);
        const nodeName = node?.name ?? '';

        const siblingNames = isFolder
          ? tree.folders.filter((f) => f.parentId === parentId && f.id !== dragId).map((f) => f.name)
          : tree.diagrams.filter((d) => d.folderId === parentId && d.id !== dragId).map((d) => d.name);

        if (detectCollision(nodeName, siblingNames)) {
          setCollisionDialog({ dragId, type, name: nodeName, targetFolderId: parentId });
          return;
        }

        try {
          await tree.moveItem(dragId, type, parentId);
        } catch {
          notificationStore.push({ severity: 'error', message: `Failed to move "${nodeName}"` });
        }
      }
    },
    [tree]
  );

  const confirmMove = useCallback(async () => {
    if (!collisionDialog) return;
    setCollisionDialog(null);
    try {
      await tree.moveItem(collisionDialog.dragId, collisionDialog.type, collisionDialog.targetFolderId);
    } catch {
      notificationStore.push({ severity: 'error', message: 'Move failed' });
    }
  }, [collisionDialog, tree]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        // VS Code-style hover-reveal for toolbar icons (mqa-results.md #27).
        '&:hover .ff-file-toolbar-icons, &:focus-within .ff-file-toolbar-icons': {
          opacity: 1
        }
      }}
    >
      <FileTreeToolbar
        providerLabel={providerLabel}
        onNewDiagram={handleNewDiagramInline}
        onNewFolder={handleNewFolder}
        onRefresh={tree.refresh}
        onCollapseAll={handleCollapseAll}
        onImport={() => setShowImport(true)}
        onExportProject={() => setExportTarget({ scope: 'project' })}
      />
      <Divider />

      {tree.error && (
        <Box sx={{ px: 1.5, py: 1 }}>
          <Typography variant="caption" color="error">{tree.error}</Typography>
        </Box>
      )}

      <Box
        ref={treeContainerRef}
        tabIndex={-1}
        sx={{ flex: 1, overflow: 'hidden', py: 0.5, outline: 'none' }}
        onKeyDown={(e) => {
          if (!selectedNode) return;
          if (e.key === 'F2') {
            e.preventDefault();
            treeRef.current?.edit(selectedNode.id);
          }
          if (e.key === 'Delete' || e.key === 'Backspace') {
            // Only fire Delete when not renaming
            if (document.activeElement?.tagName === 'INPUT') return;
            e.preventDefault();
            if (selectedNode.type === 'folder') {
              handleDeleteFolder(selectedNode);
            } else {
              handleDeleteDiagram(selectedNode);
            }
          }
        }}
      >
        {treeDataWithPending.length === 0 && !tree.isLoading && (
          <Box sx={{ px: 1.5, py: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              No diagrams yet. Create one to get started.
            </Typography>
          </Box>
        )}

        <Tree
          ref={treeRef}
          data={treeDataWithPending}
          openByDefault={false}
          onMove={handleMove}
          onRename={({ id, name }) => handleRenameSubmit(id, name)}
          onSelect={(nodes) => setSelectedNode(nodes[0]?.data ?? null)}
          renderRow={FileTreeRow}
          width="100%"
          height={treeHeight}
          rowHeight={28}
          indent={16}
          paddingTop={4}
          paddingBottom={4}
        >
          {(props) => (
            <FileTreeNode
              {...props}
              selectedId={currentDiagram?.id}
              onContextMenu={handleContextMenu}
              onOpen={handleOpenDiagram}
            />
          )}
        </Tree>
      </Box>

      {/* Context menu */}
      <Menu
        open={!!contextMenuAnchor}
        onClose={closeContextMenu}
        disableRestoreFocus
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenuAnchor
            ? { top: contextMenuAnchor.y, left: contextMenuAnchor.x }
            : undefined
        }
      >
        {contextMenuNode && (
          <ContextMenuItems
            node={contextMenuNode}
            canShare={serverStorageAvailable}
            onOpen={() => { if (contextMenuNode) handleOpenDiagram(contextMenuNode); }}
            onRename={() => contextMenuNode && handleRenameNode(contextMenuNode)}
            onDuplicate={() => contextMenuNode && handleDuplicate(contextMenuNode)}
            onCopyShareLink={() => contextMenuNode && handleCopyShareLink(contextMenuNode)}
            onExportImage={() => contextMenuNode && handleExportImage(contextMenuNode)}
            onExportJson={() => contextMenuNode && handleExportJsonNode(contextMenuNode)}
            onExportFolder={() => {
              if (!contextMenuNode || contextMenuNode.type !== 'folder') return;
              setExportTarget({
                scope: 'folder',
                folderId: contextMenuNode.id,
                folderName: contextMenuNode.name
              });
            }}
            onDelete={() => {
              if (!contextMenuNode) return;
              if (contextMenuNode.type === 'folder') {
                handleDeleteFolder(contextMenuNode);
              } else {
                handleDeleteDiagram(contextMenuNode);
              }
            }}
            onClose={closeContextMenu}
          />
        )}
      </Menu>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          // data-* anchors (ADR 0008 Decision 5) aren't in the typed paper
          // slot props; cast to PaperProps to keep the E2E hook on the root.
          paper: {
            'data-axoview-id': 'file-explorer-delete-confirm-dialog',
            sx: { boxShadow: '0px 10px 20px -2px rgba(0,0,0,0.25)', borderRadius: 2 }
          } as PaperProps
        }}
      >
        <DialogTitle sx={{ pb: 1, pr: 6 }}>
          <Typography variant="h6" component="span">
            Delete &ldquo;{deleteConfirm?.name}&rdquo;?
          </Typography>
          <IconButton
            size="small"
            onClick={() => setDeleteConfirm(null)}
            sx={{ position: 'absolute', top: 12, right: 12, color: 'text.secondary' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Typography variant="body2" color="text.secondary">
            {deleteConfirm?.type === 'folder' && deleteConfirm.descendantCount > 0
              ? `This folder and ${deleteConfirm.descendantCount} item${deleteConfirm.descendantCount !== 1 ? 's' : ''} inside will be permanently deleted and cannot be recovered.`
              : `This ${deleteConfirm?.type === 'folder' ? 'folder' : 'diagram'} will be permanently deleted and cannot be recovered.`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1 }}>
          <Button
            variant="text"
            data-axoview-id="file-explorer-delete-cancel"
            onClick={() => setDeleteConfirm(null)}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            data-axoview-id="file-explorer-delete-confirm"
            onClick={confirmDelete}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export dialog (project / folder zip only) */}
      {exportTarget && storage && (
        <ExportProjectZipDialog
          open
          onClose={() => setExportTarget(null)}
          scope={exportTarget.scope}
          folderId={exportTarget.folderId}
          folderName={exportTarget.folderName}
          storage={storage}
          exporterTag={`axoview-app@${process.env.REACT_APP_VERSION ?? 'dev'}`}
          onProjectZipExported={() => markProjectExported?.()}
        />
      )}

      {/* Import dialog */}
      {showImport && storage && (
        <ImportDialog
          open
          onClose={() => setShowImport(false)}
          storage={storage}
          onImported={async () => {
            await tree.refresh();
          }}
          onImportSingleJson={async (data, suggestedName) => {
            const folderId = selectedFolderId;
            const newId = await storage.createDiagram(
              { ...(data as object), name: suggestedName, title: suggestedName },
              folderId
            );
            await tree.refresh();
            await openDiagramById(newId, suggestedName);
          }}
        />
      )}

      {/* Name collision dialog */}
      <Dialog
        open={!!collisionDialog}
        onClose={() => setCollisionDialog(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { boxShadow: '0px 10px 20px -2px rgba(0,0,0,0.25)', borderRadius: 2 } } }}
      >
        <DialogTitle sx={{ pb: 1, pr: 6 }}>
          <Typography variant="h6" component="span">
            Name already exists
          </Typography>
          <IconButton
            size="small"
            onClick={() => setCollisionDialog(null)}
            sx={{ position: 'absolute', top: 12, right: 12, color: 'text.secondary' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Typography variant="body2" color="text.secondary">
            &ldquo;{collisionDialog?.name}&rdquo; already exists in this folder. Replace it?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1 }}>
          <Button variant="text" onClick={() => setCollisionDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={confirmMove}>Replace</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
