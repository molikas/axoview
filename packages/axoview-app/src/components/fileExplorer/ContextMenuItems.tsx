import { useTranslation } from 'react-i18next';
import { Divider, ListItemIcon, MenuItem } from '@mui/material';
import {
  OpenInNewOutlined as OpenIcon,
  DriveFileRenameOutlineOutlined as RenameIcon,
  ContentCopyOutlined as DuplicateIcon,
  LinkOutlined as ShareLinkIcon,
  ImageOutlined as ImageIcon,
  DataObjectOutlined as JsonIcon,
  FileDownloadOutlined as ExportIcon,
  DeleteOutlined as DeleteIcon,
  NoteAddOutlined as NewDiagramIcon,
  CreateNewFolderOutlined as NewFolderIcon,
  RefreshOutlined as RefreshIcon,
  CloudUploadOutlined as MoveToDriveIcon
} from '@mui/icons-material';
import type { FileNode } from '../../hooks/useFileTree';

interface Props {
  /** null = empty-space menu with no selected/open diagram to target (the
   *  create actions are still useful — VS Code convention). */
  node: FileNode | null;
  /** Where the right-click landed: a tree row or the empty space below. */
  origin: 'row' | 'empty';
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onCopyShareLink: () => void;
  onExportImage: () => void;
  onExportJson: () => void;
  onExportFolder: () => void;
  onDelete: () => void;
  onNewDiagram: () => void;
  onNewFolder: () => void;
  onRefresh: () => void;
  onMoveToDrive: () => void;
  onClose: () => void;
  canShare: boolean;
  /**
   * True when signed in to Google and the node lives in the session place —
   * MOVE semantics (create on Drive → verify → delete here), owner decision
   * 2026-07-06 superseding the copy-only "Save to Google Drive".
   */
  canMoveToDrive: boolean;
}

export function ContextMenuItems({
  node,
  origin,
  onOpen,
  onRename,
  onDuplicate,
  onCopyShareLink,
  onExportImage,
  onExportJson,
  onExportFolder,
  onDelete,
  onNewDiagram,
  onNewFolder,
  onRefresh,
  onMoveToDrive,
  onClose,
  canShare,
  canMoveToDrive
}: Props) {
  const { t } = useTranslation('app');
  const isDiagram = node?.type === 'diagram';

  const handle = (fn: () => void) => () => {
    onClose();
    fn();
  };

  // VS Code convention: create actions on folder rows and on the empty space
  // (targeting the folder / the root respectively) — never on file rows.
  const showCreate = origin === 'empty' || node?.type === 'folder';

  return (
    <>
      {showCreate && (
        <>
          <MenuItem
            dense
            data-axoview-id="file-explorer-context-menu-new-diagram"
            onClick={handle(onNewDiagram)}
          >
            <ListItemIcon><NewDiagramIcon fontSize="small" /></ListItemIcon>
            New diagram
          </MenuItem>
          <MenuItem
            dense
            data-axoview-id="file-explorer-context-menu-new-folder"
            onClick={handle(onNewFolder)}
          >
            <ListItemIcon><NewFolderIcon fontSize="small" /></ListItemIcon>
            New folder
          </MenuItem>
          {node && <Divider />}
        </>
      )}
      {node && isDiagram && (
        <MenuItem dense onClick={handle(onOpen)}>
          <ListItemIcon><OpenIcon fontSize="small" /></ListItemIcon>
          Open
        </MenuItem>
      )}
      {node && (
        <MenuItem dense onClick={handle(onRename)}>
          <ListItemIcon><RenameIcon fontSize="small" /></ListItemIcon>
          Rename
        </MenuItem>
      )}
      {isDiagram && (
        <MenuItem dense onClick={handle(onDuplicate)}>
          <ListItemIcon><DuplicateIcon fontSize="small" /></ListItemIcon>
          Duplicate
        </MenuItem>
      )}
      {isDiagram && canShare && (
        <MenuItem
          dense
          data-axoview-id="file-explorer-context-menu-share"
          onClick={handle(onCopyShareLink)}
        >
          <ListItemIcon><ShareLinkIcon fontSize="small" /></ListItemIcon>
          Copy share link
        </MenuItem>
      )}
      {isDiagram && canMoveToDrive && (
        <MenuItem
          dense
          data-axoview-id="file-explorer-context-menu-move-to-drive"
          onClick={handle(onMoveToDrive)}
        >
          <ListItemIcon><MoveToDriveIcon fontSize="small" /></ListItemIcon>
          {t('fileExplorer.moveToDrive', 'Move to Google Drive')}
        </MenuItem>
      )}
      {node &&
        (isDiagram ? (
          <>
            <Divider />
            <MenuItem dense onClick={handle(onExportImage)}>
              <ListItemIcon><ImageIcon fontSize="small" /></ListItemIcon>
              Export as image…
            </MenuItem>
            <MenuItem dense onClick={handle(onExportJson)}>
              <ListItemIcon><JsonIcon fontSize="small" /></ListItemIcon>
              Export as JSON
            </MenuItem>
          </>
        ) : (
          <MenuItem dense onClick={handle(onExportFolder)}>
            <ListItemIcon><ExportIcon fontSize="small" /></ListItemIcon>
            Export folder…
          </MenuItem>
        ))}
      {node && (
        <>
          <Divider />
          <MenuItem
            dense
            data-axoview-id="file-explorer-context-menu-delete"
            onClick={handle(onDelete)}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            Delete
          </MenuItem>
        </>
      )}
      {showCreate && (
        <>
          <Divider />
          <MenuItem
            dense
            data-axoview-id="file-explorer-context-menu-refresh"
            onClick={handle(onRefresh)}
          >
            <ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>
            Refresh
          </MenuItem>
        </>
      )}
    </>
  );
}
