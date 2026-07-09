import React, { useState, useEffect } from 'react';
import { Box, TextField, IconButton, Tooltip } from '@mui/material';
import { Colorize as ColorizeIcon } from '@mui/icons-material';
import { ColorPicker } from './ColorPicker';
import { hasEyeDropper, openEyeDropper } from './useEyeDropper';

interface Props {
  value: string;
  onChange: (color: string) => void;
  // The unified picker (ADR 0039) hosts a single eyedropper at the top level and
  // embeds this input for the hue/sat + hex fields, so it suppresses this copy.
  hideEyeDropper?: boolean;
}

const HEX_RE = /^#[0-9A-F]{6}$/i;

// Accept a 6-digit hex typed without the leading '#' ("FF5733" → "#FF5733") so a
// value the user clearly meant isn't treated as invalid and discarded (E2).
const normalizeHex = (v: string): string => {
  const t = v.trim();
  return /^[0-9A-F]{6}$/i.test(t) ? `#${t}` : t;
};

export const CustomColorInput = ({
  value,
  onChange,
  hideEyeDropper
}: Props) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleEyeDropper = async () => {
    const picked = await openEyeDropper();
    if (picked) onChange(picked);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalValue(raw);
    // Commit immediately once it's a valid hex (a missing '#' is accepted).
    const hex = normalizeHex(raw);
    if (HEX_RE.test(hex)) {
      onChange(hex);
    }
  };

  const handleBlur = () => {
    // On blur, normalise a valid value (adds the '#') and commit it; only revert
    // to the prop value when the input is genuinely not a hex colour.
    const hex = normalizeHex(localValue);
    if (HEX_RE.test(hex)) {
      setLocalValue(hex);
      onChange(hex);
    } else {
      setLocalValue(value);
    }
  };

  // E2: Enter and Esc both COMMIT a valid hex (incl. one typed without '#') and
  // stopPropagation so the keystroke never reaches the window-level canvas
  // handler — Esc otherwise runs handleEscapeKey (which fires BEFORE the
  // editable-target guard), closing the Properties panel mid-edit and
  // discarding the value. Only genuinely invalid input is reverted on Esc.
  // Mirrors the F2 inline-rename pattern (ux §3.1).
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      if (e.key === 'Enter') e.preventDefault();
      e.stopPropagation();
      const hex = normalizeHex(localValue);
      if (HEX_RE.test(hex)) {
        onChange(hex);
        setLocalValue(hex);
      } else if (e.key === 'Escape') {
        setLocalValue(value); // cancel genuinely invalid input
      }
      (e.target as HTMLInputElement).blur();
    }
  };

  const showEyeDropper = !hideEyeDropper && hasEyeDropper();

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
      {showEyeDropper && (
        <Tooltip title="Pick color from screen">
          <IconButton onClick={handleEyeDropper} size="small">
            <ColorizeIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};
