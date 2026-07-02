import React from 'react';
import { Box, Typography } from '@mui/material';
import { KeyboardArrowRight as ChevronIcon } from '@mui/icons-material';

interface Props {
  /** Section title (already translated). */
  title: string;
  open: boolean;
  onToggle: () => void;
  /** Optional trailing adornment (e.g. a count Chip). */
  trailing?: React.ReactNode;
}

// Shared quiet disclosure header for the Properties deck (2026-07-02). A
// plain-text row (uppercase caption + rotating chevron) on the panel background
// — deliberately NOT a filled button, which read as the loudest thing in the
// panel. Used by MetadataSection and the connector's additional-labels section
// so every collapsible in the deck looks the same.
export const SectionDisclosure = ({ title, open, onToggle, trailing }: Props) => (
  <Box
    onClick={onToggle}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 0.25,
      cursor: 'pointer',
      color: 'text.secondary',
      userSelect: 'none',
      py: 0.25,
      '&:hover': { color: 'text.primary' }
    }}
  >
    <ChevronIcon
      sx={{
        fontSize: 16,
        transition: 'transform 150ms ease',
        transform: open ? 'rotate(90deg)' : 'none'
      }}
    />
    <Typography
      variant="caption"
      sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
    >
      {title}
    </Typography>
    {trailing}
  </Box>
);
