import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Badge,
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
  VisibilityOutlined as PreviewIcon,
  AccountTreeOutlined as FileExplorerIcon,
  SyncOutlined as SavingIcon,
  ErrorOutlineOutlined as SaveErrorIcon
} from '@mui/icons-material';
import { useAppStorage } from '../providers/AppStorageContext';
import { useDiagramLifecycle } from '../providers/DiagramLifecycleProvider';
import { SessionStorageGauge } from './fileExplorer/SessionStorageGauge';

export function AppToolbar() {
  const { t } = useTranslation('app');
  const { serverStorageAvailable, storage } = useAppStorage();
  const {
    hasUnsavedChanges,
    lastSaved,
    saveStatus,
    isReadonlyUrl,
    currentDiagram,
    setToolbarPortalTarget,
    setSidebarTogglePortalTarget,
    handleSaveClick,
    handlePreviewClick,
    saveAllDirty,
    fileExplorerOpen,
    setFileExplorerOpen,
    dirtyDiagramIds
  } = useDiagramLifecycle();

  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const [toolbarPortalSet, setToolbarPortalSet] = useState(false);
  const [sidebarPortalSet, setSidebarPortalSet] = useState(false);
  const [showSharePopover, setShowSharePopover] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const currentDiagramId = currentDiagram?.id;

  // Reset share state whenever the active diagram changes
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

  const formatSavedAt = (d: Date): string => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (dDay.getTime() === today.getTime()) return t('status.savedAt', { time });
    if (dDay.getTime() === yesterday.getTime())
      return t('status.savedYesterdayAt', { time });
    const month = d.toLocaleString([], { month: 'short' });
    const day = d.getDate();
    if (d.getFullYear() === now.getFullYear())
      return t('status.savedOnDate', { month, day, time });
    return t('status.savedOnDateYear', { month, day, year: d.getFullYear(), time });
  };

  // ── Auto-save status (server mode) ──────────────────────────────────────────
  const renderAutoSaveStatus = () => {
    if (saveStatus === 'saving') {
      return (
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <SavingIcon sx={{ fontSize: 13, color: 'text.disabled', animation: 'spin 1s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />
          <Typography variant="caption" sx={{ color: 'text.disabled', userSelect: 'none' }}>
            {t('status.saving', 'Saving…')}
          </Typography>
        </Stack>
      );
    }
    if (saveStatus === 'error') {
      return (
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <SaveErrorIcon sx={{ fontSize: 13, color: 'error.main' }} />
          <Typography variant="caption" sx={{ color: 'error.main', userSelect: 'none' }}>
            {t('status.saveFailed', 'Save failed')}
          </Typography>
          <Button
            size="small"
            variant="text"
            color="error"
            sx={{ minWidth: 0, px: 0.5, py: 0, fontSize: 11, textTransform: 'none', lineHeight: 1.5 }}
            onClick={handleSaveClick}
          >
            {t('status.retry', 'Retry')}
          </Button>
        </Stack>
      );
    }
    if (lastSaved) {
      return (
        <Typography variant="caption" sx={{ color: 'text.disabled', userSelect: 'none', whiteSpace: 'nowrap' }}>
          {formatSavedAt(lastSaved)}
        </Typography>
      );
    }
    return null;
  };

  // ── Session-mode status ──────────────────────────────────────────────────────
  const renderSessionStatus = () => (
    <Typography
      variant="caption"
      sx={{
        color: hasUnsavedChanges ? 'text.primary' : 'text.disabled',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        minWidth: 60,
        textAlign: 'right'
      }}
    >
      {lastSaved
        ? `${formatSavedAt(lastSaved)}${hasUnsavedChanges ? ' •' : ''}`
        : hasUnsavedChanges
          ? t('status.unsaved', 'Unsaved')
          : ''}
    </Typography>
  );

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
      {/* LEFT: menu portal + file-explorer toggle + new + save + open */}
      <Box
        className="toolbar-left"
        sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}
      >
        <Box
          ref={(el: HTMLDivElement | null) => {
            if (el && !toolbarPortalSet) {
              setToolbarPortalSet(true);
              setToolbarPortalTarget(el);
            }
          }}
          sx={{ display: 'inline-flex', alignItems: 'center' }}
        />
        {!isReadonlyUrl && (
          <>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Tooltip
              title={fileExplorerOpen ? 'Close file explorer' : 'Open file explorer'}
              placement="bottom"
            >
              <IconButton
                size="small"
                onClick={() => setFileExplorerOpen(!fileExplorerOpen)}
                sx={{
                  borderRadius: 1,
                  color: fileExplorerOpen ? 'primary.main' : 'inherit'
                }}
              >
                <FileExplorerIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Save — shown in session mode; hidden in server mode (auto-save handles it) */}
            {!serverStorageAvailable && (
              <>
                <Tooltip title={t('nav.save', 'Save') + ' (Ctrl+S)'} placement="bottom">
                  <span>
                    <IconButton
                      size="small"
                      onClick={handleSaveClick}
                      disabled={!!currentDiagramId && !hasUnsavedChanges}
                      sx={{ borderRadius: 1, color: 'inherit' }}
                    >
                      <SaveIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </span>
                </Tooltip>
                {dirtyDiagramIds.size > (hasUnsavedChanges ? 1 : 0) && (
                  <Tooltip
                    title={`Save All — ${dirtyDiagramIds.size} unsaved diagrams`}
                    placement="bottom"
                  >
                    <IconButton
                      size="small"
                      onClick={saveAllDirty}
                      sx={{ borderRadius: 1, color: 'inherit' }}
                    >
                      <Badge
                        badgeContent={dirtyDiagramIds.size}
                        color="warning"
                        sx={{ '& .MuiBadge-badge': { fontSize: 9, minWidth: 14, height: 14, padding: 0 } }}
                      >
                        <SaveIcon sx={{ fontSize: 18 }} />
                      </Badge>
                    </IconButton>
                  </Tooltip>
                )}
                <Chip
                  label="SESSION"
                  size="small"
                  color="warning"
                  sx={{
                    height: 18,
                    fontSize: '0.5625rem',
                    fontWeight: 700,
                    ml: 0.25,
                    '& .MuiChip-label': { px: 0.75 }
                  }}
                />
                <SessionStorageGauge />
              </>
            )}
          </>
        )}
        {isReadonlyUrl && (
          <Chip
            label={t('dialog.readOnly.mode')}
            variant="outlined"
            size="small"
            sx={{ ml: 1 }}
          />
        )}
      </Box>

      {/* CENTER: diagram name (editable in server mode) */}
      <Box
        className="toolbar-center"
        sx={{ flex: 1 }}
      />

      {/* RIGHT: status | share + preview | sidebar toggle portal */}
      <Box
        className="toolbar-right"
        sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}
      >
        {!isReadonlyUrl && (
          <>
            {serverStorageAvailable
              ? renderAutoSaveStatus()
              : renderSessionStatus()}

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
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
