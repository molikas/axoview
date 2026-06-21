import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  // D2: route the trigger tooltip + the three menu labels through app i18n.
  const { t } = useTranslation('app');
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
      <Tooltip title={t('exportMenu.tooltip')} placement="bottom">
        <span>
          <IconButton
            ref={buttonRef}
            size="small"
            onClick={() => setOpen(true)}
            disabled={!currentDiagram}
            data-axoview-id="toolbar-export"
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
        slotProps={{ paper: { sx: { mt: 0.5, minWidth: 200 } } }}
      >
        <MenuList dense sx={{ py: 0.5 }}>
          <MenuItem
            onClick={() => handleOption(handleExportJSON)}
            data-axoview-id="toolbar-export-json"
          >
            <ListItemIcon><JsonIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('exportMenu.json')}</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => handleOption(handleExportImage)}
            data-axoview-id="toolbar-export-image"
          >
            <ListItemIcon><ImageIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('exportMenu.image')}</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => handleOption(handleExportProject)}
            data-axoview-id="toolbar-export-project-zip"
          >
            <ListItemIcon><ProjectZipIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('exportMenu.projectZip')}</ListItemText>
          </MenuItem>
        </MenuList>
      </Popover>
    </>
  );
}
