import React, { useState } from 'react';
import { Box, Collapse } from '@mui/material';
import { SectionDisclosure } from './SectionDisclosure';

interface Props {
  /** Section title (already translated). */
  title: string;
  /** Initial open state (uncontrolled). Ignored when `open` is provided. */
  defaultOpen?: boolean;
  /** Controlled open state — the parent owns open/close (e.g. so a "focus
   *  Notes" deep-link can force one section open). */
  open?: boolean;
  onToggle?: () => void;
  /** Trailing header adornment (e.g. a count Chip or a "has content" dot). */
  trailing?: React.ReactNode;
  children: React.ReactNode;
}

// Shared collapsible section for the Properties deck (2026-07-02). A quiet
// SectionDisclosure header over a MUI Collapse body — every element panel is a
// vertical stack of these, so the deck looks and behaves identically for every
// item type (ux-principles §5.1). Uncontrolled by default (`defaultOpen` seeds
// the initial state, e.g. the first/content section starts open); pass
// `open`/`onToggle` to control it.
export const CollapsibleSection = ({
  title,
  defaultOpen = false,
  open,
  onToggle,
  trailing,
  children
}: Props) => {
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : localOpen;
  const handleToggle = isControlled
    ? onToggle ?? (() => {})
    : () => setLocalOpen((v) => !v);

  return (
    <Box sx={{ pt: 1.5, px: 2 }}>
      <SectionDisclosure
        title={title}
        open={isOpen}
        onToggle={handleToggle}
        trailing={trailing}
      />
      <Collapse in={isOpen} unmountOnExit>
        <Box sx={{ pt: 1 }}>{children}</Box>
      </Collapse>
    </Box>
  );
};
