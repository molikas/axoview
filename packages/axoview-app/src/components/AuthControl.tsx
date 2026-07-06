import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Avatar,
  Badge,
  Box,
  CircularProgress,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  Typography
} from '@mui/material';
import {
  PersonOutlineOutlined as PersonIcon,
  LogoutOutlined as SignOutIcon,
  CloudUploadOutlined as MoveToDriveIcon,
  FolderOpenOutlined as DriveFolderIcon
} from '@mui/icons-material';
import { useAuthStore } from '../stores/authStore';
import { useAppStorage } from '../providers/AppStorageContext';
import { useDiagramLifecycle } from '../providers/DiagramLifecycleProvider';
import { GoogleDriveProvider } from '../services/storage/providers/GoogleDriveProvider';
import { GoogleGIcon } from './GoogleGIcon';

/**
 * The single account home in the toolbar (Lucid/VS Code avatar-menu pattern,
 * storage-ux-unification 2026-07-06). Renders only when a Google client id is
 * configured. One control, four states:
 *
 *  - signed out (never):        person icon → menu with the branded sign-in
 *  - reconnecting (boot):       dimmed avatar + spinner ring (non-interactive)
 *  - needs reconnect / expired: avatar + amber dot → "Sign in again"
 *  - signed in:                 avatar → name/email · move-session · Drive folder · sign out
 *
 * The old standalone "Sign in with Google" button and "Session expired" chip
 * folded into this control (ADR 0035 §5 amendment).
 */
export function AuthControl() {
  const { t } = useTranslation('app');
  const { googleDriveConfigured, storageManager, serverStorageAvailable } = useAppStorage();
  const { handleGoogleSignedOut } = useDiagramLifecycle();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [sessionCount, setSessionCount] = useState(0);

  // Count session diagrams when the menu opens (cheap sessionStorage read) so
  // the "Move session diagrams to Drive…" item only shows when meaningful.
  const openMenu = useCallback(
    (el: HTMLElement) => {
      setAnchor(el);
      const local = storageManager?.getProvider('local');
      if (!local) return;
      local
        .listDiagrams()
        .then((list) => setSessionCount(list.filter((d) => !d.deletedAt).length))
        .catch(() => setSessionCount(0));
    },
    [storageManager]
  );

  if (!googleDriveConfigured) return null;

  const closeMenu = () => setAnchor(null);

  const handleSignIn = () => {
    closeMenu();
    void signIn();
  };

  const handleSignOut = () => {
    closeMenu();
    // Close any Drive-side diagram (flushing while the token is still valid),
    // THEN revoke — reverse order would strand the flush without a token.
    handleGoogleSignedOut(() => signOut());
  };

  const handleMoveSession = () => {
    closeMenu();
    window.dispatchEvent(new CustomEvent('axoview-open-migrate'));
  };

  const handleOpenDriveFolder = () => {
    closeMenu();
    const drive = storageManager?.getProvider('google-drive') as
      | GoogleDriveProvider
      | undefined;
    const rootId = drive?.getCachedRootId();
    if (rootId) {
      window.open(
        `https://drive.google.com/drive/folders/${rootId}`,
        '_blank',
        'noopener'
      );
    }
  };

  // Boot reconnect in flight — a quiet, non-interactive moment (<~2s).
  if (status === 'RECONNECTING') {
    return (
      <Tooltip title={t('auth.reconnecting', 'Reconnecting to Google…')}>
        <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', px: 0.5 }}>
          <Avatar
            src={user?.avatarUrl || undefined}
            sx={{ width: 24, height: 24, fontSize: 13, opacity: 0.5 }}
          >
            {(user?.name || '?').charAt(0).toUpperCase()}
          </Avatar>
          <CircularProgress
            size={28}
            thickness={2}
            sx={{ position: 'absolute', left: 2, color: 'text.disabled' }}
          />
        </Box>
      </Tooltip>
    );
  }

  // Interactive sign-in popup pending.
  if (status === 'AUTHENTICATING') {
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 1 }}>
        <CircularProgress size={18} />
      </Box>
    );
  }

  const signedIn = (status === 'AUTHENTICATED' || status === 'REFRESHING') && !!user;
  // Remembered identity without a live token: expired mid-session, or the
  // silent boot reconnect failed. Amber dot = "one click brings Drive back".
  const needsReconnect =
    !!user && (status === 'SESSION_EXPIRED' || status === 'UNAUTHENTICATED');

  if (signedIn || needsReconnect) {
    const drive = storageManager?.getProvider('google-drive') as
      | GoogleDriveProvider
      | undefined;
    const hasDriveRoot = !!drive?.getCachedRootId();
    const showMoveSession = signedIn && !serverStorageAvailable && sessionCount > 0;
    return (
      <>
        <Tooltip
          title={
            needsReconnect
              ? t('auth.reconnectTooltip', 'Google sign-in needed — your Drive diagrams reconnect with one click')
              : user!.email || user!.name
          }
        >
          <IconButton
            size="small"
            onClick={(e) => openMenu(e.currentTarget)}
            data-axoview-id="auth-avatar"
          >
            <Badge
              variant="dot"
              color="warning"
              overlap="circular"
              invisible={!needsReconnect}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              data-axoview-id={needsReconnect ? 'auth-needs-reconnect' : undefined}
            >
              <Avatar
                src={user!.avatarUrl || undefined}
                sx={{
                  width: 24,
                  height: 24,
                  fontSize: 13,
                  filter: needsReconnect ? 'grayscale(0.8)' : 'none'
                }}
              >
                {(user!.name || '?').charAt(0).toUpperCase()}
              </Avatar>
            </Badge>
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={anchor}
          open={!!anchor}
          onClose={closeMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Box sx={{ px: 2, py: 1, maxWidth: 260 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {user!.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {user!.email}
            </Typography>
            {needsReconnect && (
              <Typography variant="caption" color="warning.main" component="div" sx={{ mt: 0.5 }}>
                {t('auth.reconnectHint', 'Signed out of Google — sign in again to use Drive')}
              </Typography>
            )}
          </Box>
          <Divider />
          {needsReconnect && (
            <MenuItem onClick={handleSignIn} data-axoview-id="auth-signin" dense>
              <ListItemIcon sx={{ minWidth: 28 }}>
                <GoogleGIcon />
              </ListItemIcon>
              {t('auth.signInAgain', 'Sign in again')}
            </MenuItem>
          )}
          {showMoveSession && (
            <MenuItem
              onClick={handleMoveSession}
              data-axoview-id="auth-move-session"
              dense
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                <MoveToDriveIcon fontSize="small" />
              </ListItemIcon>
              {t('auth.moveSessionToDrive', 'Move session diagrams to Drive…')}
            </MenuItem>
          )}
          {signedIn && hasDriveRoot && (
            <MenuItem
              onClick={handleOpenDriveFolder}
              data-axoview-id="auth-open-drive-folder"
              dense
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                <DriveFolderIcon fontSize="small" />
              </ListItemIcon>
              {t('auth.openDriveFolder', 'Open Drive folder')}
            </MenuItem>
          )}
          {(needsReconnect || showMoveSession || (signedIn && hasDriveRoot)) && <Divider />}
          <MenuItem onClick={handleSignOut} data-axoview-id="auth-signout" dense>
            <ListItemIcon sx={{ minWidth: 28 }}>
              <SignOutIcon fontSize="small" />
            </ListItemIcon>
            {t('auth.signOut', 'Sign out')}
          </MenuItem>
        </Menu>
      </>
    );
  }

  // UNAUTHENTICATED, never signed in here — a quiet person icon; the branded
  // sign-in button lives inside the menu (Google brand guidance) and on the
  // empty-state card.
  return (
    <>
      <Tooltip title={t('auth.signIn', 'Sign in with Google')}>
        <IconButton
          size="small"
          onClick={(e) => openMenu(e.currentTarget)}
          data-axoview-id="auth-account"
          sx={{ color: 'inherit' }}
        >
          <PersonIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleSignIn} data-axoview-id="auth-signin" dense>
          <ListItemIcon sx={{ minWidth: 28 }}>
            <GoogleGIcon />
          </ListItemIcon>
          {t('auth.signIn', 'Sign in with Google')}
        </MenuItem>
        <Box sx={{ px: 2, pb: 1, maxWidth: 240 }}>
          <Typography variant="caption" color="text.secondary">
            {t('auth.signInHint', 'Keep your diagrams in Google Drive — available anywhere you sign in.')}
          </Typography>
        </Box>
      </Menu>
    </>
  );
}
