import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Chip,
  Divider,
  IconButton,
  Popover,
  Stack,
  TextField,
  Typography,
  Button,
  Tooltip
} from '@mui/material';
import {
  SaveOutlined as SaveIcon,
  ShareOutlined as ShareIcon,
  Close as CloseIcon,
  VisibilityOutlined as PreviewIcon
} from '@mui/icons-material';
import { useAppStorage } from '../providers/AppStorageContext';
import { useDiagramLifecycle } from '../providers/DiagramLifecycleProvider';
import { StatusCluster } from './StatusCluster';
import { ExportPopover } from './ExportPopover';

export function AppToolbar() {
  const { t } = useTranslation('app');
  const { serverStorageAvailable, storage } = useAppStorage();
  const {
    hasUnsavedChanges,
    isReadonlyUrl,
    currentDiagram,
    setSidebarTogglePortalTarget,
    handleSaveClick,
    handlePreviewClick
  } = useDiagramLifecycle();

  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const [sidebarPortalSet, setSidebarPortalSet] = useState(false);
  const [showSharePopover, setShowSharePopover] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const currentDiagramId = currentDiagram?.id;

  useEffect(() => {
    setShareUrl('');
    setShareCopied(false);
    setShareError(null);
    setShowSharePopover(false);
  }, [currentDiagramId]);

  const handleShareClick = async () => {
    if (!serverStorageAvailable || !currentDiagramId || !storage) return;
    setShowSharePopover(true);
    setShareError(null);
    let url = shareUrl;
    if (!url) {
      if (!storage.shareDiagram) {
        setShareError(t('share.unavailable', 'Sharing is not available'));
        return;
      }
      try {
        setShareLoading(true);
        const result = await storage.shareDiagram(currentDiagramId);
        url = result.url;
        setShareUrl(url);
      } catch (err) {
        setShareError(
          err instanceof Error
            ? err.message
            : t('share.failed', 'Failed to create share link')
        );
        return;
      } finally {
        setShareLoading(false);
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };

  const handleShareUrlClick = (e: React.MouseEvent<HTMLInputElement>) => {
    (e.target as HTMLInputElement).select();
  };

  useEffect(() => {
    if (!showSharePopover) return;
    const handleOutside = (e: MouseEvent) => {
      const btn = shareButtonRef.current;
      if (btn && !btn.parentElement?.contains(e.target as Node)) {
        setShowSharePopover(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showSharePopover]);

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
      {/* LEFT: intentionally empty per ADR 0005 */}
      <Box className="toolbar-left" sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} />

      {/* CENTER: intentionally empty per ADR 0005 */}
      <Box className="toolbar-center" sx={{ flex: 1 }} />

      {/* RIGHT: four groups separated by dividers */}
      <Box
        className="toolbar-right"
        sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}
      >
        {isReadonlyUrl ? (
          <Chip
            label={t('dialog.readOnly.mode')}
            variant="outlined"
            size="small"
            sx={{ ml: 1 }}
          />
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

            {/* Group 3: Document actions — Export + Share + Preview */}
            <ExportPopover />
            <Tooltip
              title={
                !serverStorageAvailable || !currentDiagramId
                  ? t('nav.share', 'Share') + ' (requires server)'
                  : t('nav.share', 'Share')
              }
              placement="bottom"
            >
              <span>
                <IconButton
                  ref={shareButtonRef}
                  size="small"
                  onClick={handleShareClick}
                  disabled={!serverStorageAvailable || !currentDiagramId}
                  sx={{ borderRadius: 1, color: 'inherit' }}
                >
                  <ShareIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip
              title={
                !serverStorageAvailable || !currentDiagramId
                  ? t('toolbar.previewSaveFirst', 'Save first to preview')
                  : t('toolbar.preview', 'Preview')
              }
              placement="bottom"
            >
              <span>
                <IconButton
                  size="small"
                  onClick={handlePreviewClick}
                  disabled={!serverStorageAvailable || !currentDiagramId}
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

      {/* Share popover */}
      {!isReadonlyUrl && (
        <Popover
          open={showSharePopover && !!currentDiagramId}
          anchorEl={shareButtonRef.current}
          onClose={() => setShowSharePopover(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{ sx: { p: 2, width: 380, mt: 0.5 } }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">
                {t('share.title', 'Share Diagram')}
              </Typography>
              <IconButton size="small" onClick={() => setShowSharePopover(false)}>
                <CloseIcon />
              </IconButton>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {t('share.hint', 'Anyone with this link can view the diagram in read-only mode.')}
            </Typography>
            {shareError && (
              <Typography variant="body2" color="error">
                {shareError}
              </Typography>
            )}
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                fullWidth
                value={shareLoading ? t('share.creating', 'Creating link…') : shareUrl}
                inputProps={{
                  readOnly: true,
                  style: { fontFamily: 'monospace', fontSize: 12 }
                }}
                onClick={handleShareUrlClick}
              />
              <Button
                variant={shareCopied ? 'contained' : 'outlined'}
                color={shareCopied ? 'success' : 'primary'}
                size="small"
                onClick={handleShareClick}
                disabled={shareLoading}
                sx={{ whiteSpace: 'nowrap', minWidth: 80 }}
              >
                {shareCopied ? t('share.copied', '✓ Copied!') : t('share.copy', 'Copy')}
              </Button>
            </Stack>
          </Stack>
        </Popover>
      )}
    </Box>
  );
}
