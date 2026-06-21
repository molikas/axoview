import React, { useState, useEffect } from 'react';
import { Box, TextField, IconButton, Tooltip } from '@mui/material';
import { Colorize as ColorizeIcon } from '@mui/icons-material';
import { ColorPicker } from './ColorPicker';

interface EyeDropper {
  open: (options?: { signal?: AbortSignal }) => Promise<{ sRGBHex: string }>;
}

declare global {
  interface Window {
    EyeDropper?: {
      new (): EyeDropper;
    };
  }
}

interface Props {
  value: string;
  onChange: (color: string) => void;
}

const HEX_RE = /^#[0-9A-F]{6}$/i;

export const CustomColorInput = ({ value, onChange }: Props) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleEyeDropper = async () => {
    if (!window.EyeDropper) return;
    const eyeDropper = new window.EyeDropper();
    try {
      const result = await eyeDropper.open();
      onChange(result.sRGBHex);
    } catch {
      // EyeDropper.open() rejects when the user cancels (Esc) — not a
      // failure-of-intent per ADR 0011; silently abort the pick.
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    // If it's a valid hex, update immediately
    if (HEX_RE.test(newValue)) {
      onChange(newValue);
    }
  };

  const handleBlur = () => {
    // On blur, if invalid, revert to prop value
    if (!HEX_RE.test(localValue)) {
      setLocalValue(value);
    }
  };

  // E2: Enter commits a valid hex; Esc cancels the in-progress edit. Both
  // stopPropagation so the keystroke never reaches the window-level canvas
  // handler — Esc otherwise runs handleEscapeKey (which fires BEFORE the
  // editable-target guard) and closed the whole Properties panel mid-edit,
  // discarding the typed value. Mirrors the F2 inline-rename pattern (ux §3.1).
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (HEX_RE.test(localValue)) onChange(localValue);
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setLocalValue(value); // revert the unsaved edit; panel stays open
      (e.target as HTMLInputElement).blur();
    }
  };

  const hasEyeDropper = typeof window !== 'undefined' && !!window.EyeDropper;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <ColorPicker value={value} onChange={onChange} />
      <TextField
        value={localValue}
        onChange={handleTextChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        variant="standard"
        size="small"
        slotProps={{
          input: {
            disableUnderline: true,
            sx: {
              color: 'text.secondary',
              width: '80px'
            }
          }
        }}
      />
      {hasEyeDropper && (
        <Tooltip title="Pick color from screen">
          <IconButton onClick={handleEyeDropper} size="small">
            <ColorizeIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};
