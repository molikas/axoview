import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, IconButton, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

const DISMISS_KEY = 'axoview-session-banner-dismissed';

export function LocalModeBanner() {
  const { t } = useTranslation('app');
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
