import { useState } from 'react';
import { Box, Button, IconButton, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface Props {
  onExportProject: () => void;
}

export function SessionModeBanner({ onExportProject }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <Box
      sx={{
        bgcolor: 'warning.light',
        color: 'warning.contrastText',
        px: 2,
        py: 0.75,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        borderBottom: 1,
        borderColor: 'warning.main'
      }}
      role="status"
    >
      <Typography variant="body2" sx={{ flex: 1 }}>
        Your work lives in this browser tab only. Export your project to keep it.
      </Typography>
      <Button size="small" variant="contained" color="warning" onClick={onExportProject}>
        Export project
      </Button>
      <IconButton
        size="small"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        sx={{ color: 'inherit' }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
