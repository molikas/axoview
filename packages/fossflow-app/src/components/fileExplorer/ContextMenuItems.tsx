import { Divider, ListItemIcon, MenuItem } from '@mui/material';
import {
  OpenInNewOutlined as OpenIcon,
  DriveFileRenameOutlineOutlined as RenameIcon,
  ContentCopyOutlined as DuplicateIcon,
  LinkOutlined as ShareLinkIcon,
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
  onExport: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ContextMenuItems({
  node,
  onOpen,
  onRename,
  onDuplicate,
  onCopyShareLink,
  onExport,
  onDelete,
  onClose
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
      {isDiagram && (
        <MenuItem dense onClick={handle(onCopyShareLink)}>
          <ListItemIcon><ShareLinkIcon fontSize="small" /></ListItemIcon>
          Copy share link
        </MenuItem>
      )}
      <MenuItem dense onClick={handle(onExport)}>
        <ListItemIcon><ExportIcon fontSize="small" /></ListItemIcon>
        {isDiagram ? 'Export…' : 'Export folder…'}
      </MenuItem>
      <Divider />
      <MenuItem dense onClick={handle(onDelete)} sx={{ color: 'error.main' }}>
        <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
        Delete
      </MenuItem>
    </>
  );
}
