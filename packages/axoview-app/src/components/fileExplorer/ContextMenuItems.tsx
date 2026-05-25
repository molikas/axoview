import { Divider, ListItemIcon, MenuItem } from '@mui/material';
import {
  OpenInNewOutlined as OpenIcon,
  DriveFileRenameOutlineOutlined as RenameIcon,
  ContentCopyOutlined as DuplicateIcon,
  LinkOutlined as ShareLinkIcon,
  ImageOutlined as ImageIcon,
  DataObjectOutlined as JsonIcon,
  FileDownloadOutlined as ExportIcon,
  DeleteOutlined as DeleteIcon
} from '@mui/icons-material';
import type { FileNode } from '../../hooks/useFileTree';

interface Props {
  node: FileNode;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onCopyShareLink: () => void;
  onExportImage: () => void;
  onExportJson: () => void;
  onExportFolder: () => void;
  onDelete: () => void;
  onClose: () => void;
  canShare: boolean;
}

export function ContextMenuItems({
  node,
  onOpen,
  onRename,
  onDuplicate,
  onCopyShareLink,
  onExportImage,
  onExportJson,
  onExportFolder,
  onDelete,
  onClose,
  canShare
}: Props) {
  const isDiagram = node.type === 'diagram';

  const handle = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <>
      {isDiagram && (
        <MenuItem dense onClick={handle(onOpen)}>
          <ListItemIcon><OpenIcon fontSize="small" /></ListItemIcon>
          Open
        </MenuItem>
      )}
      <MenuItem dense onClick={handle(onRename)}>
        <ListItemIcon><RenameIcon fontSize="small" /></ListItemIcon>
        Rename
      </MenuItem>
      {isDiagram && (
        <MenuItem dense onClick={handle(onDuplicate)}>
          <ListItemIcon><DuplicateIcon fontSize="small" /></ListItemIcon>
          Duplicate
        </MenuItem>
      )}
      {isDiagram && canShare && (
        <MenuItem dense onClick={handle(onCopyShareLink)}>
          <ListItemIcon><ShareLinkIcon fontSize="small" /></ListItemIcon>
          Copy share link
        </MenuItem>
      )}
      {isDiagram ? (
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
      )}
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
  );
}
