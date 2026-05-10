import { useState } from 'react';
import { Box, Button, IconButton, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

const DISMISS_KEY = 'fossflow-session-banner-dismissed';

interface Props {
  onExportProject: () => void;
}

export function SessionModeBanner({ onExportProject }: Props) {
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
        Your work lives in this browser tab only. Export your project to keep it.
      </Typography>
      <Box sx={{ flex: 1 }} />
      <Button
        size="small"
        variant="outlined"
        color="warning"
        onClick={onExportProject}
      >
        Export project
      </Button>
      <IconButton
        size="small"
        onClick={handleDismiss}
        aria-label="Dismiss"
        sx={{ color: 'text.secondary' }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
