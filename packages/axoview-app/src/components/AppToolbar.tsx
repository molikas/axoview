import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
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
  SlideshowOutlined as PresentIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useAppStorage } from '../providers/AppStorageContext';
import { useDiagramLifecycle } from '../providers/DiagramLifecycleProvider';
import { StatusCluster } from './StatusCluster';
import { ExportPopover } from './ExportPopover';
import { shareUrlFromUuid } from '../utils/shareUrl';

export function AppToolbar() {
  const { t } = useTranslation('app');
  const location = useLocation();
  const navigate = useNavigate();
  const { serverStorageAvailable, storage } = useAppStorage();
  const {
    hasUnsavedChanges,
    isReadonlyUrl,
    currentDiagram,
    setSidebarTogglePortalTarget,
    setStyleControlsPortalTarget,
    handleSaveClick,
    handlePreviewClick
  } = useDiagramLifecycle();

  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const [sidebarPortalSet, setSidebarPortalSet] = useState(false);
  const [stylePortalSet, setStylePortalSet] = useState(false);
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
        url = shareUrlFromUuid(result.uuid);
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

  // User-facing copy never says "session mode" — see workflow + ADR 0008 D1:
  // end users read "session" as something different from the audit's mode name.
  const shareTooltip = !serverStorageAvailable
    ? t(
        'toolbar.share.disabled.needsServerStorage',
        'Share requires server storage. Run Axoview self-hosted (Docker) or on Cloudflare to enable shareable links.'
      )
    : !currentDiagramId
      ? t(
          'toolbar.share.disabled.needsDiagram',
          'Open or create a diagram first to share it.'
        )
      : t('nav.share', 'Share');

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
                  data-axoview-id="toolbar-back-to-editing"
                  sx={{ textTransform: 'none' }}
                >
                  {t('toolbar.backToEditing', 'Back to editing')}
                </Button>
              </Tooltip>
            )}
          </Stack>
        ) : (
          <>
            {/* Group 1: View modes / Format (ADR 0005 reserved slot). Style
                controls strip — portal filled by the lib's UiOverlay (which has
                the selection store + scene actions in scope). Controls self-gate
                on the current selection. */}
            <Box
              ref={(el: HTMLDivElement | null) => {
                if (el && !stylePortalSet) {
                  setStylePortalSet(true);
                  setStyleControlsPortalTarget(el);
                }
              }}
              sx={{ display: 'inline-flex', alignItems: 'center' }}
            />

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Group 2: Save group — Save action (local mode only) + StatusCluster */}
            {!serverStorageAvailable && (
              <Tooltip
                title={t('nav.save', 'Save') + ' (Ctrl+S)'}
                placement="bottom"
              >
                <span>
                  <IconButton
                    size="small"
                    onClick={handleSaveClick}
                    disabled={!currentDiagram || !hasUnsavedChanges}
                    data-axoview-id="toolbar-save"
                    sx={{ borderRadius: 1, color: 'primary.main' }}
                  >
                    <SaveIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            <StatusCluster />

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Group 3: Document actions — Export + Share + Present. Share is
                render-disabled (not hidden) without server storage so the
                affordance still signals the feature exists. */}
            <ExportPopover />
            <Tooltip title={shareTooltip} placement="bottom">
              <span>
                <IconButton
                  ref={shareButtonRef}
                  size="small"
                  onClick={handleShareClick}
                  disabled={!serverStorageAvailable || !currentDiagramId}
                  data-axoview-id="toolbar-share"
                  sx={{ borderRadius: 1, color: 'inherit' }}
                >
                  <ShareIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip
              title={
                !currentDiagramId
                  ? t('toolbar.presentSaveFirst', 'Save first to present')
                  : t('toolbar.present', 'Present')
              }
              placement="bottom"
            >
              <span>
                <IconButton
                  size="small"
                  onClick={handlePreviewClick}
                  disabled={!currentDiagramId}
                  data-axoview-id="toolbar-preview"
                  sx={{ borderRadius: 1, color: 'inherit' }}
                >
                  <PresentIcon sx={{ fontSize: 18 }} />
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

      {/* Share popover. onClose reason-guarded — only backdrop click + Escape
          dismiss; any other path (focus shifts, internal MUI dispatches) keeps
          it open. B-3 original symptom: clicks inside the TextField closed the
          popover; the underlying cause was a custom document mousedown listener
          (removed in 95a0fd5) that treated portaled content as outside. This
          reason guard is the defense-in-depth for any future MUI behaviour
          drift. */}
      {!isReadonlyUrl && (
        <Popover
          open={showSharePopover && !!currentDiagramId}
          anchorEl={shareButtonRef.current}
          onClose={(_event, reason) => {
            if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
              setShowSharePopover(false);
            }
          }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              sx: { p: 2, width: 380, mt: 0.5 },
              'data-axoview-id': 'share-popover'
            } as React.ComponentProps<'div'>
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">
                {t('share.title', 'Share Diagram')}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setShowSharePopover(false)}
                data-axoview-id="share-popover-close"
              >
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
                  'data-axoview-id': 'share-url-input',
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
                data-axoview-id="share-copy-button"
                sx={{ whiteSpace: 'nowrap', minWidth: 80, textTransform: 'none' }}
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
