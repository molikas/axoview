import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface Props {
  closeLabel: string;
  onClose: () => void;
  /** Optional leading adornment (e.g. an element icon). */
  leading?: React.ReactNode;
}

// Consistent Properties-deck header row (2026-07-02): an optional leading
// adornment on the left and a close button on the right, over the
// ControlsContainer divider. Replaces the per-panel mix of tab-bars and
// floating close buttons so every element panel has the same chrome
// (ux-principles §5.1).
export const DeckHeader = ({ closeLabel, onClose, leading }: Props) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      px: 1,
      py: 0.5,
      flexShrink: 0
    }}
  >
    {leading}
    <Box sx={{ flex: 1 }} />
    <Tooltip title={closeLabel}>
      <IconButton
        size="small"
        onClick={onClose}
        sx={{ p: 0.5, flexShrink: 0 }}
      >
        <CloseIcon sx={{ fontSize: 15 }} />
      </IconButton>
    </Tooltip>
  </Box>
);
