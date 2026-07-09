import React, { useState } from 'react';
import { Box, Button, IconButton, Tooltip } from '@mui/material';
import { Add as AddIcon, Colorize as ColorizeIcon } from '@mui/icons-material';
import { useTranslation } from 'src/stores/localeStore';
import { STANDARD_COLOR_PALETTE } from 'src/config/colorPalette';
import { CustomColorInput } from './CustomColorInput';
import { NoColorSwatch } from './NoColorSwatch';
import { hasEyeDropper, openEyeDropper } from './useEyeDropper';

// The single canonical colour-picker body (ADR 0039). One Google-Slides-style
// surface for every colour control: an always-visible standard grid, a "Custom"
// affordance that reveals the hue/sat + hex input, a top-level eyedropper, and
// a contextual Transparent / no-colour swatch. Replaces the former
// LabelColorPicker + PresetCustomColor + the "Custom color" toggle.
//
// It is value-in / hex-out: callers pass the RESOLVED hex (via resolveHex, so a
// stored legacy `color: <presetId>` still displays) and receive a hex to commit
// on the element's own colour field. No entry is added to the scene palette.

const TRANSPARENT = 'transparent';
const norm = (c?: string) => (c || '').toLowerCase();
const COLUMNS = STANDARD_COLOR_PALETTE[0].length;
const FLAT_PALETTE = STANDARD_COLOR_PALETTE.flat();

interface Props {
  /** Resolved hex currently applied (or undefined / 'transparent'). */
  value: string | undefined;
  /** Commit a picked colour as a hex string. */
  onChange: (hex: string) => void;
  /** Show the Transparent / no-colour swatch (fill / border / background). */
  allowNoColor?: boolean;
  /** Clear to transparent / derived — required iff allowNoColor. */
  onNoColor?: () => void;
  /**
   * Whether an ABSENT value reads as "no colour" (active Transparent swatch).
   * True for fill/background (absent renders nothing); false for the rectangle
   * border (absent renders a DERIVED stroke). Defaults to allowNoColor.
   */
  absentIsNoColor?: boolean;
}

export const ColorPickerBody = ({
  value,
  onChange,
  allowNoColor,
  onNoColor,
  absentIsNoColor
}: Props) => {
  const { t } = useTranslation('topBarStyleControls');
  const absentNoColor = absentIsNoColor ?? Boolean(allowNoColor);
  const noColorActive =
    norm(value) === TRANSPARENT || (absentNoColor && !value);

  // Grid-first, like Google: the standard grid is always the landing view and
  // the hue/sat + hex input is one "Custom" click away. (The current colour —
  // custom or not — is already shown on the strip control's underline bar.)
  const [showCustom, setShowCustom] = useState(false);

  const handleEyeDropper = async () => {
    const picked = await openEyeDropper();
    if (picked) onChange(picked);
  };

  return (
    <Box>
      {/* Standard colour grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
          gap: '3px'
        }}
      >
        {FLAT_PALETTE.map((hex) => {
          const active = !noColorActive && norm(value) === norm(hex);
          return (
            <Box
              key={hex}
              component="button"
              type="button"
              aria-label={hex}
              aria-pressed={active}
              onClick={() => onChange(hex)}
              sx={{
                p: 0,
                m: 0,
                cursor: 'pointer',
                width: '100%',
                aspectRatio: '1 / 1',
                borderRadius: '3px',
                bgcolor: hex,
                border: '1px solid',
                borderColor: active ? 'primary.main' : 'divider',
                boxShadow: active
                  ? (th) => `0 0 0 2px ${th.palette.primary.main}`
                  : 'none',
                boxSizing: 'border-box'
              }}
            />
          );
        })}
      </Box>

      {/* Custom · eyedropper · transparent */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setShowCustom((v) => !v)}
          sx={{ textTransform: 'none', minWidth: 'auto' }}
        >
          {t('customColor')}
        </Button>
        {hasEyeDropper() && (
          <Tooltip title={t('pickColorFromScreen')}>
            <IconButton onClick={handleEyeDropper} size="small">
              <ColorizeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {allowNoColor && onNoColor && (
          <Box sx={{ ml: 'auto' }}>
            <NoColorSwatch isActive={noColorActive} onClick={onNoColor} />
          </Box>
        )}
      </Box>

      {showCustom && (
        <Box sx={{ mt: 0.5 }}>
          <CustomColorInput
            value={value && norm(value) !== TRANSPARENT ? value : '#000000'}
            onChange={onChange}
            hideEyeDropper
          />
        </Box>
      )}
    </Box>
  );
};
