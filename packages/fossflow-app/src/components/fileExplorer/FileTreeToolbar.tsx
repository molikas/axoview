import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import {
  ArticleOutlined as NewDiagramIcon,
  CreateNewFolderOutlined as NewFolderIcon,
  RefreshOutlined as RefreshIcon,
  UnfoldLessOutlined as CollapseAllIcon,
  FileUploadOutlined as ImportIcon,
  FileDownloadOutlined as ExportIcon
} from '@mui/icons-material';

interface Props {
  providerLabel: string;
  onNewDiagram: () => void;
  onNewFolder: () => void;
  onRefresh: () => Promise<void>;
  onCollapseAll: () => void;
  onImport: () => void;
  onExportProject: () => void;
}

export function FileTreeToolbar({
  providerLabel,
  onNewDiagram,
  onNewFolder,
  onRefresh,
  onCollapseAll,
  onImport,
  onExportProject
}: Props) {
  return (
    <Box
      sx={{
        px: 1.5,
        py: 0.5,
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
        minHeight: 32
      }}
    >
      <Typography
        variant="overline"
        sx={{
          flex: 1,
          color: 'text.secondary',
          userSelect: 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {providerLabel}
      </Typography>

      <Tooltip title="Import" placement="bottom">
        <IconButton size="small" onClick={onImport} sx={{ flexShrink: 0 }}>
          <ImportIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      <Tooltip title="Export project" placement="bottom">
        <IconButton size="small" onClick={onExportProject} sx={{ flexShrink: 0 }}>
          <ExportIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      <Tooltip title="New diagram" placement="bottom">
        <IconButton size="small" onClick={onNewDiagram} sx={{ flexShrink: 0 }}>
          <NewDiagramIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      <Tooltip title="New folder" placement="bottom">
        <IconButton size="small" onClick={onNewFolder} sx={{ flexShrink: 0 }}>
          <NewFolderIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      <Tooltip title="Refresh" placement="bottom">
        <IconButton size="small" onClick={onRefresh} sx={{ flexShrink: 0 }}>
          <RefreshIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      <Tooltip title="Collapse all" placement="bottom">
        <IconButton size="small" onClick={onCollapseAll} sx={{ flexShrink: 0 }}>
          <CollapseAllIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
