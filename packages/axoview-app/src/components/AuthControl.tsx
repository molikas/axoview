import { useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography
} from '@mui/material';
import { useAuthStore } from '../stores/authStore';
import { useAppStorage } from '../providers/AppStorageContext';
import { useDiagramLifecycle } from '../providers/DiagramLifecycleProvider';

/**
 * Toolbar Google account control (ADR 0035 §5). Renders only when a client id is
 * configured. States: sign-in button · authenticating spinner · avatar+menu ·
 * session-expired chip. Sign-out reverts storage to local.
 */
export function AuthControl() {
  const { runtimeConfig } = useAppStorage();
  const { switchStorageProvider } = useDiagramLifecycle();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const clientId =
    runtimeConfig?.googleClientId || process.env.PUBLIC_GOOGLE_CLIENT_ID || null;
  if (!clientId) return null;

  if (status === 'AUTHENTICATING') {
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 1 }}>
        <CircularProgress size={18} />
      </Box>
    );
  }

  if (status === 'SESSION_EXPIRED') {
    return (
      <Chip
        label="Session expired"
        color="warning"
        size="small"
        onClick={() => void signIn()}
        data-axoview-id="auth-session-expired"
        sx={{ cursor: 'pointer' }}
      />
    );
  }

  // Keep the avatar during a silent refresh (REFRESHING) — the token/user are
  // still valid; otherwise it would flicker to the sign-in button each cycle.
  if ((status === 'AUTHENTICATED' || status === 'REFRESHING') && user) {
    const handleSignOut = () => {
      setAnchor(null);
      signOut();
      // Drive is unusable without a token — fall back to local storage.
      switchStorageProvider('local');
    };
    return (
      <>
        <Tooltip title={user.email || user.name}>
          <IconButton
            size="small"
            onClick={(e) => setAnchor(e.currentTarget)}
            data-axoview-id="auth-avatar"
          >
            <Avatar
              src={user.avatarUrl || undefined}
              sx={{ width: 24, height: 24, fontSize: 13 }}
            >
              {(user.name || '?').charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={anchor}
          open={!!anchor}
          onClose={() => setAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Box sx={{ px: 2, py: 1, maxWidth: 240 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {user.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user.email}
            </Typography>
          </Box>
          <Divider />
          <MenuItem onClick={handleSignOut} data-axoview-id="auth-signout" dense>
            Sign out
          </MenuItem>
        </Menu>
      </>
    );
  }

  // UNAUTHENTICATED
  return (
    <Button
      size="small"
      variant="outlined"
      onClick={() => void signIn()}
      data-axoview-id="auth-signin"
      sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
    >
      Sign in with Google
    </Button>
  );
}
