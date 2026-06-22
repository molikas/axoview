import { useTranslation } from 'react-i18next';
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
  // D12: translate the toolbar button tooltips. The heading (providerLabel) is
  // translated upstream in FileExplorer where the storage provider is known.
  const { t } = useTranslation('app');
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

      {/* Icons cluster — hover/focus-revealed (VS Code style) per mqa-results.md #27.
          Visibility is driven by the FileExplorer outer container's :hover / :focus-within.
          Kept in the DOM (opacity, not display:none) so layout doesn't reflow on reveal. */}
      <Box
        className="ff-file-toolbar-icons"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.25,
          opacity: 0,
          transition: 'opacity 120ms ease',
          '&:focus-within': { opacity: 1 }
        }}
      >
        <Tooltip title={t('fileExplorer.import')} placement="bottom">
          <IconButton size="small" onClick={onImport} sx={{ flexShrink: 0 }}>
            <ImportIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title={t('fileExplorer.exportProject')} placement="bottom">
          <IconButton size="small" onClick={onExportProject} sx={{ flexShrink: 0 }}>
            <ExportIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title={t('fileExplorer.newDiagram')} placement="bottom">
          <IconButton size="small" onClick={onNewDiagram} sx={{ flexShrink: 0 }}>
            <NewDiagramIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title={t('fileExplorer.newFolder')} placement="bottom">
          <IconButton
            size="small"
            onClick={onNewFolder}
            sx={{ flexShrink: 0 }}
            data-axoview-id="file-explorer-new-folder"
          >
            <NewFolderIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title={t('fileExplorer.refresh')} placement="bottom">
          <IconButton size="small" onClick={onRefresh} sx={{ flexShrink: 0 }}>
            <RefreshIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title={t('fileExplorer.collapseAll')} placement="bottom">
          <IconButton size="small" onClick={onCollapseAll} sx={{ flexShrink: 0 }}>
            <CollapseAllIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
