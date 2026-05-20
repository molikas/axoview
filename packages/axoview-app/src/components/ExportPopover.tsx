import { useRef, useState } from 'react';
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  Popover,
  Tooltip
} from '@mui/material';
import {
  FileDownloadOutlined as DownloadIcon,
  DataObjectOutlined as JsonIcon,
  ImageOutlined as ImageIcon,
  FolderZipOutlined as ProjectZipIcon
} from '@mui/icons-material';
import { useDiagramLifecycle } from '../providers/DiagramLifecycleProvider';

export function ExportPopover() {
  const {
    handleExportJSON,
    handleExportImage,
    handleExportProject,
    currentDiagram
  } = useDiagramLifecycle();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const handleOption = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <Tooltip title="Export" placement="bottom">
        <span>
          <IconButton
            ref={buttonRef}
            size="small"
            onClick={() => setOpen(true)}
            disabled={!currentDiagram}
            sx={{ borderRadius: 1, color: 'inherit' }}
          >
            <DownloadIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={buttonRef.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { mt: 0.5, minWidth: 200 } }}
      >
        <MenuList dense sx={{ py: 0.5 }}>
          <MenuItem onClick={() => handleOption(handleExportJSON)}>
            <ListItemIcon><JsonIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Export JSON</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleOption(handleExportImage)}>
            <ListItemIcon><ImageIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Export Image</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleOption(handleExportProject)}>
            <ListItemIcon><ProjectZipIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Export Project (.zip)</ListItemText>
          </MenuItem>
        </MenuList>
      </Popover>
    </>
  );
}
