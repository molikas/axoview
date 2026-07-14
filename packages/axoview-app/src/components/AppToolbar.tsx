import { useRef, useState, useEffect, useCallback } from 'react';
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
  ArrowBack as ArrowBackIcon,
  VisibilityOutlined as ShowControlsIcon,
  VisibilityOffOutlined as HideControlsIcon
} from '@mui/icons-material';
import { useAppStorage } from '../providers/AppStorageContext';
import { useDiagramLifecycle } from '../providers/DiagramLifecycleProvider';
import { StatusCluster } from './StatusCluster';
import { ExportPopover } from './ExportPopover';
import { AuthControl } from './AuthControl';
import { shareUrlFromUuid } from '../utils/shareUrl';
import {
  drivePreviewUrl,
  getFileShareMeta,
  getAccessSummary,
  openNativeShareDialog,
  AccessSummary
} from '../services/drive/driveSharing';

export function AppToolbar() {
  const { t } = useTranslation('app');
  const location = useLocation();
  const navigate = useNavigate();
  const {
    serverStorageAvailable,
    remoteStorageActive,
    activeProviderId,
    storage,
    runtimeConfig
  } = useAppStorage();
  const driveActive = activeProviderId === 'google-drive';
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
  // STABLE portal-target refs. The toolbar's editable branch unmounts when you
  // enter presentation and remounts on return — a *new* DOM node each time. The
  // old "set once" guard left the portal pointing at the stale (detached) node,
  // so the top-bar style strip + sidebar toggle vanished after a present→edit
  // round-trip. A stable callback ref fires on every mount (el) / unmount (null),
  // so the portal target always tracks the live node. (Stable identity → React
  // does not re-invoke it on ordinary re-renders, so no thrash.)
  const setStyleControlsRef = useCallback(
    (el: HTMLDivElement | null) => {
      // Re-point on every (re)mount of the toolbar's editable branch. On unmount
      // (el === null) we keep the old target — harmless, since the portal isn't
      // rendered in presentation; the next mount supplies the live node.
      if (el) setStyleControlsPortalTarget(el);
    },
    [setStyleControlsPortalTarget]
  );
  const setSidebarToggleRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) setSidebarTogglePortalTarget(el);
    },
    [setSidebarTogglePortalTarget]
  );
  const [showSharePopover, setShowSharePopover] = useState(false);
  // View-only "hide all controls" — bridged to the lib (separate store) via a
  // window event the lib's UiOverlay listens for. Local state drives the button.
  const [hideControls, setHideControls] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  // Drive branch only (ADR 0042 §1): current ACL state so the owner can see
  // whether the copied link works anonymously. null = still checking.
  const [driveAccessSummary, setDriveAccessSummary] = useState<AccessSummary | null>(null);
  // ACL check FAILED (distinct from still-loading) — an inline error beats an
  // eternal "Checking…". Reset per popover open / diagram change.
  const [driveAccessError, setDriveAccessError] = useState(false);
  // Monotonic id guarding the popover's async fetches: a diagram switch (or a
  // reopen) bumps it, so a late-resolving getFileShareMeta / getAccessSummary
  // for the OLD file can't paint stale data (or a stale ACL) onto the new one.
  const shareReqRef = useRef(0);

  const currentDiagramId = currentDiagram?.id;

  useEffect(() => {
    shareReqRef.current++; // invalidate any in-flight share fetch for the old id
    setShareUrl('');
    setShareCopied(false);
    setShareError(null);
    setShareLoading(false);
    setDriveAccessSummary(null);
    setDriveAccessError(false);
    setShowSharePopover(false);
  }, [currentDiagramId]);

  // The native "Manage access" dialog — and Drive's own web UI in another tab —
  // can change the ACL with the popover still open, and ShareClient exposes no
  // close callback. Re-check the summary whenever the window regains focus while
  // the Drive share popover is open, so the indicator can't stay stale forever.
  // (Best-effort: a same-window ShareClient overlay may not blur the window, but
  // the multi-tab / return-to-tab case is fully covered. No null-reset here —
  // this is a silent background refresh, not a reopen, so avoid a "Checking…"
  // flicker; the value just updates in place if it changed.)
  useEffect(() => {
    if (!showSharePopover || !driveActive || !currentDiagramId) return;
    const onFocus = () => {
      const reqId = ++shareReqRef.current;
      setDriveAccessError(false);
      void getAccessSummary(currentDiagramId)
        .then((s) => {
          if (shareReqRef.current === reqId) setDriveAccessSummary(s);
        })
        .catch(() => {
          if (shareReqRef.current === reqId) setDriveAccessError(true);
        });
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [showSharePopover, driveActive, currentDiagramId]);

  const handleShareClick = async () => {
    const fileId = currentDiagramId;
    if (!fileId) return;
    if (!driveActive && (!serverStorageAvailable || !storage)) return;
    // This click owns the popover's async state until superseded.
    const reqId = ++shareReqRef.current;
    const current = () => shareReqRef.current === reqId;
    setShowSharePopover(true);
    setShareError(null);
    if (driveActive) {
      // Re-check the ACL on every open — the native dialog may have changed it.
      // Clear the prior summary too (not just the error): the currentDiagramId
      // reset only fires on a diagram SWITCH, so a same-diagram reopen would
      // otherwise flash the stale summary instead of the neutral "Checking…".
      setDriveAccessError(false);
      setDriveAccessSummary(null);
      void getAccessSummary(fileId)
        .then((s) => {
          if (current()) setDriveAccessSummary(s);
        })
        .catch(() => {
          if (current()) setDriveAccessError(true);
        });
    }
    let url = shareUrl;
    if (!url) {
      try {
        setShareLoading(true);
        if (driveActive) {
          // Drive place: the diagram id IS the Drive file id; the link is
          // deterministic (no publish step). resourceKey propagates iff present
          // (expected absent on app-created files) — ADR 0042 §1.
          const meta = await getFileShareMeta(fileId);
          url = drivePreviewUrl(fileId, meta.resourceKey);
        } else {
          if (!storage?.shareDiagram) {
            if (current()) setShareError(t('share.unavailable', 'Sharing is not available'));
            return;
          }
          const result = await storage.shareDiagram(fileId);
          url = shareUrlFromUuid(result.uuid);
        }
        if (!current()) return; // diagram switched mid-fetch — drop the stale URL
        setShareUrl(url);
      } catch (err) {
        if (current()) {
          setShareError(
            err instanceof Error
              ? err.message
              : t('share.failed', 'Failed to create share link')
          );
        }
        return;
      } finally {
        if (current()) setShareLoading(false);
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
    if (!current()) return;
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };

  const handleShareUrlClick = (e: React.MouseEvent<HTMLInputElement>) => {
    (e.target as HTMLInputElement).select();
  };

  // "Manage access" = Google's native sharing dialog; openNativeShareDialog
  // owns the mandatory drive.google.com fallback internally (ADR 0042 §1), so
  // this handler never surfaces an error.
  const handleManageAccessClick = async () => {
    if (!currentDiagramId) return;
    await openNativeShareDialog(
      currentDiagramId,
      runtimeConfig?.googleProjectNumber ?? null
    );
  };

  // User-facing copy never says "session mode" — see workflow + ADR 0008 D1:
  // end users read "session" as something different from the audit's mode name.
  // The session-place disabled copy must NOT claim sharing requires
  // self-hosting — Drive-place diagrams share serverlessly (ADR 0042 §3).
  const shareDisabled = driveActive
    ? !currentDiagramId
    : !serverStorageAvailable || !currentDiagramId;
  const shareTooltip =
    !serverStorageAvailable && !driveActive
      ? t(
          'toolbar.share.disabled.sessionPlaceNeedsServerStorage',
          'Shareable links for this diagram need server storage (self-hosted Docker or Cloudflare). Diagrams saved to Google Drive can be shared from any deployment.'
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
      {/* LEFT: subtle brand mark (ADR 0005 amendment 2026-05-19 — logo + muted
          wordmark only). R1 (ADR 0040): links to the marketing landing at the
          site root (`${PUBLIC_URL}/`), the "home" affordance. Full navigation
          (not router), so it leaves the editor — the beforeunload guard still
          warns on unsaved work. */}
      <Box
        component="a"
        href={`${(process.env.PUBLIC_URL || '').replace(/\/$/, '')}/`}
        className="toolbar-left"
        aria-label="Axoview — home"
        title="Axoview home"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          flexShrink: 0,
          userSelect: 'none',
          pr: 1,
          textDecoration: 'none',
          color: 'inherit',
          cursor: 'pointer',
          '&:hover': { opacity: 0.82 }
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

      {/* Format strip — LEFT-aligned after the brand (Lucid pattern; owner
          directive 2026-07-06, amends ADR 0005's empty-center layout). Still
          the ONE compressible group (F1): it shrinks and scrolls horizontally
          under viewport squeeze while the right cluster keeps its natural
          width. Portal filled by the lib's UiOverlay (selection store + scene
          actions in scope); controls self-gate on the current selection. */}
      {!isReadonlyUrl && (
        <>
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          <Box
            ref={setStyleControlsRef}
            data-axoview-id="toolbar-style-slot"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              flexShrink: 1,
              minWidth: 0,
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollbarWidth: 'thin',
              '&::-webkit-scrollbar': { height: 4 },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: 'action.disabled',
                borderRadius: 2
              }
            }}
          />
        </>
      )}

      {/* CENTER: flexible spacer (ADR 0005 empty-center, now sitting between
          the left-aligned strip and the right action cluster) */}
      <Box className="toolbar-center" sx={{ flex: 1 }} />

      {/* RIGHT: action groups separated by dividers — natural width; the
          left strip absorbs viewport squeeze (F1). */}
      <Box
        className="toolbar-right"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.25,
          flexShrink: 0
        }}
      >
        {isReadonlyUrl ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 1 }}>
            <Chip
              label={t('dialog.readOnly.mode')}
              variant="outlined"
              size="small"
            />
            <Tooltip
              title={t(
                hideControls
                  ? 'toolbar.showControls'
                  : 'toolbar.hideControls',
                hideControls ? 'Show controls' : 'Hide controls'
              )}
            >
              <IconButton
                size="small"
                aria-pressed={hideControls}
                onClick={() => {
                  const next = !hideControls;
                  setHideControls(next);
                  window.dispatchEvent(
                    new CustomEvent('axoview-set-hide-view-controls', {
                      detail: { hide: next }
                    })
                  );
                }}
                data-axoview-id="toolbar-hide-view-controls"
                sx={{
                  ...(hideControls && { bgcolor: 'action.selected' })
                }}
              >
                {hideControls ? (
                  <ShowControlsIcon sx={{ fontSize: 18 }} />
                ) : (
                  <HideControlsIcon sx={{ fontSize: 18 }} />
                )}
              </IconButton>
            </Tooltip>
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
            {/* Group 2: Save group — Save action (session mode only; remote
                storage autosaves) + StatusCluster */}
            {!remoteStorageActive && (
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

            {/* Group 3: Document actions — Export + Share + Present. Share
                renders for BOTH places (ADR 0042 §1, superseding ADR 0036 §4's
                Drive-mode hide): Drive-place diagrams share through Drive's own
                ACL (live preview links + the native sharing dialog), enabled
                whenever a diagram is open; session-place diagrams keep the
                snapshot-link contract (ADR 0010) and stay render-disabled (not
                hidden) without server storage so the affordance still signals
                the feature exists. */}
            <ExportPopover />
            <Tooltip title={shareTooltip} placement="bottom">
              <span>
                <IconButton
                  ref={shareButtonRef}
                  size="small"
                  onClick={handleShareClick}
                  disabled={shareDisabled}
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

            {/* Group 3.5: Account — the avatar menu is the single auth home
                (places model 2026-07-06; the storage picker was removed).
                Self-hides when no Google client id is configured. */}
            <AuthControl />

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Group 4: Sidebar toggle — Properties panel portal */}
            <Box
              ref={setSidebarToggleRef}
              data-axoview-id="toolbar-sidebar-slot"
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
              {driveActive
                ? t(
                    'share.drive.liveHint',
                    'Anyone the file is shared with sees the latest version — the link opens the live diagram, not a snapshot.'
                  )
                : t('share.hint', 'Anyone with this link can view the diagram in read-only mode.')}
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
            {driveActive && (
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                spacing={1}
              >
                {/* ACL summary: does the copied link work anonymously? Fetched
                    on every popover open (the native dialog can change it). */}
                <Typography
                  variant="caption"
                  color={driveAccessError ? 'error' : 'text.secondary'}
                  data-axoview-id="share-drive-access-summary"
                >
                  {driveAccessError
                    ? t('share.drive.accessError', "Couldn't check who has access.")
                    : driveAccessSummary === 'anyone-with-link'
                      ? t('share.drive.accessAnyone', 'Anyone with the link can view')
                      : driveAccessSummary === 'restricted'
                        ? t('share.drive.accessRestricted', 'Only people with access can view')
                        : t('share.drive.accessUnknown', 'Checking who has access…')}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleManageAccessClick}
                  data-axoview-id="share-manage-access-button"
                  sx={{ whiteSpace: 'nowrap', textTransform: 'none', flexShrink: 0 }}
                >
                  {t('share.drive.manageAccess', 'Manage access')}
                </Button>
              </Stack>
            )}
          </Stack>
        </Popover>
      )}
    </Box>
  );
}
