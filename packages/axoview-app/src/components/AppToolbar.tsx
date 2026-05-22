import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Chip,
  Divider,
  IconButton,
  Stack,
  Typography,
  Button,
  Tooltip
} from '@mui/material';
import {
  SaveOutlined as SaveIcon,
  VisibilityOutlined as PreviewIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useAppStorage } from '../providers/AppStorageContext';
import { useDiagramLifecycle } from '../providers/DiagramLifecycleProvider';
import { StatusCluster } from './StatusCluster';
import { ExportPopover } from './ExportPopover';

export function AppToolbar() {
  const { t } = useTranslation('app');
  const location = useLocation();
  const navigate = useNavigate();
  const { serverStorageAvailable } = useAppStorage();
  const {
    hasUnsavedChanges,
    isReadonlyUrl,
    currentDiagram,
    setSidebarTogglePortalTarget,
    handleSaveClick,
    handlePreviewClick
  } = useDiagramLifecycle();

  const [sidebarPortalSet, setSidebarPortalSet] = useState(false);

  const currentDiagramId = currentDiagram?.id;

  return (
    <Box
      className="toolbar"
      sx={{
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        px: 1.5,
        py: 0.75,
        display: 'flex',
        alignItems: 'center',
        gap: 0
      }}
    >
      {/* LEFT: subtle brand mark (ADR 0005 amendment 2026-05-19 — logo + muted wordmark only) */}
      <Box
        className="toolbar-left"
        aria-label="Axoview"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          flexShrink: 0,
          userSelect: 'none',
          pr: 1
        }}
      >
        <Box
          component="img"
          src={`${process.env.PUBLIC_URL || ''}/favicon-96x96.png`.replace(/\/+/g, '/')}
          alt=""
          sx={{ width: 24, height: 24, display: 'block' }}
        />
        <Typography
          component="span"
          sx={{
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: '#1f2937',
            lineHeight: 1
          }}
        >
          Axo<Box component="span" sx={{ color: '#2563eb' }}>view</Box>
        </Typography>
      </Box>

      {/* CENTER: intentionally empty per ADR 0005 */}
      <Box className="toolbar-center" sx={{ flex: 1 }} />

      {/* RIGHT: four groups separated by dividers */}
      <Box
        className="toolbar-right"
        sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}
      >
        {isReadonlyUrl ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 1 }}>
            <Chip
              label={t('dialog.readOnly.mode')}
              variant="outlined"
              size="small"
            />
            {(location.state as { fromEditor?: boolean } | null)?.fromEditor && (
              <Tooltip title={t('toolbar.backToEditing', 'Back to editing')}>
                <Button
                  size="small"
                  startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
                  onClick={() => navigate(-1)}
                  sx={{ textTransform: 'none' }}
                >
                  {t('toolbar.backToEditing', 'Back to editing')}
                </Button>
              </Tooltip>
            )}
          </Stack>
        ) : (
          <>
            {/* Group 1: View modes — reserved per ADR 0005, future ADRs add controls here */}

            {/* Group 2: Save group — Save action (session mode only) + StatusCluster */}
            {!serverStorageAvailable && (
              <Tooltip
                title={t('nav.save', 'Save') + ' (Ctrl+S)'}
                placement="bottom"
              >
                <span>
                  <IconButton
                    size="small"
                    onClick={handleSaveClick}
                    disabled={!!currentDiagramId && !hasUnsavedChanges}
                    sx={{ borderRadius: 1, color: 'primary.main' }}
                  >
                    <SaveIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            <StatusCluster />

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Group 3: Document actions — Export + Preview. Share moved to the
                file-explorer context-menu share-link entry; the toolbar Share
                button was redundant and confusing (it always required server
                storage). */}
            <ExportPopover />
            <Tooltip
              title={
                !currentDiagramId
                  ? t('toolbar.previewSaveFirst', 'Save first to preview')
                  : t('toolbar.preview', 'Preview')
              }
              placement="bottom"
            >
              <span>
                <IconButton
                  size="small"
                  onClick={handlePreviewClick}
                  disabled={!currentDiagramId}
                  sx={{ borderRadius: 1, color: 'inherit' }}
                >
                  <PreviewIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Group 4: Sidebar toggle — Properties panel portal */}
            <Box
              ref={(el: HTMLDivElement | null) => {
                if (el && !sidebarPortalSet) {
                  setSidebarPortalSet(true);
                  setSidebarTogglePortalTarget(el);
                }
              }}
              sx={{ display: 'inline-flex', alignItems: 'center' }}
            />
          </>
        )}
      </Box>
    </Box>
  );
}
