import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, IconButton, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useAppStorage } from '../providers/AppStorageContext';
import { useAuthStore } from '../stores/authStore';

const DISMISS_KEY = 'axoview-session-banner-dismissed';

export function LocalModeBanner() {
  const { t } = useTranslation('app');
  const { googleDriveConfigured } = useAppStorage();
  const authStatus = useAuthStore((s) => s.status);
  const signIn = useAuthStore((s) => s.signIn);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* noop */
    }
  };

  if (dismissed) return null;

  const signedIn = authStatus === 'AUTHENTICATED' || authStatus === 'REFRESHING';

  // §8.5 — quiet banner: caption + a single text button, no tinted bar. With
  // Drive configured, the escape hatch is Drive (sign in / move); the export
  // copy remains the fallback for deployments without a client id.
  const driveAction = !googleDriveConfigured
    ? null
    : signedIn
      ? {
          label: t('status.sessionBannerMove', 'Move to Google Drive…'),
          onClick: () =>
            window.dispatchEvent(new CustomEvent('axoview-open-migrate'))
        }
      : {
          label: t('status.sessionBannerSignIn', 'Sign in to save to Google Drive'),
          onClick: () => void signIn()
        };

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderLeft: '4px solid',
        borderLeftColor: 'warning.main',
        borderBottom: 1,
        borderBottomColor: 'divider',
        px: 2,
        py: 0.75,
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}
      role="status"
    >
      <Typography variant="caption" color="text.secondary">
        {t('status.sessionBanner')}
      </Typography>
      {driveAction && (
        <Button
          size="small"
          variant="text"
          onClick={driveAction.onClick}
          data-axoview-id="session-banner-drive-action"
          sx={{ textTransform: 'none', py: 0, minWidth: 0, lineHeight: 1.5, flexShrink: 0 }}
        >
          {driveAction.label}
        </Button>
      )}
      <Box sx={{ flex: 1 }} />
      <IconButton
        size="small"
        onClick={handleDismiss}
        aria-label={t('status.dismiss')}
        sx={{ color: 'text.secondary' }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
