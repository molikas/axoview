import React, { useState } from 'react';
import { Box, Button, Collapse, TextField } from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

interface Props {
  /** Section title (already translated), e.g. "Metadata". */
  title: string;
  /** The identity name value. */
  name: string;
  /** Placeholder for the name input (already translated). */
  placeholder: string;
  onChange: (value: string) => void;
  /** Start expanded (default: collapsed — identity is secondary to content/Notes). */
  defaultExpanded?: boolean;
}

// Collapsible "Metadata" section holding an element's identity `name` (2026-07-02).
// Names are identity-only (renamed in Layers, hidden from the canvas), so the
// deck keeps them available but tucked away rather than as a prominent top field
// — every element panel uses this so name handling is consistent.
export const MetadataSection = ({
  title,
  name,
  placeholder,
  onChange,
  defaultExpanded = false
}: Props) => {
  const [open, setOpen] = useState(defaultExpanded);
  return (
    <Box sx={{ pt: 1.5, px: 2 }}>
      <Button
        fullWidth
        size="small"
        onClick={() => setOpen((v) => !v)}
        startIcon={
          <ExpandMoreIcon
            sx={{
              transition: 'transform 150ms ease',
              transform: open ? 'rotate(180deg)' : 'none'
            }}
          />
        }
        sx={{
          justifyContent: 'flex-start',
          textTransform: 'none',
          color: 'text.secondary'
        }}
      >
        {title}
      </Button>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ pt: 1 }}>
          <TextField
            placeholder={placeholder}
            value={name}
            size="small"
            fullWidth
            onChange={(e) => onChange(e.target.value)}
          />
        </Box>
      </Collapse>
    </Box>
  );
};
