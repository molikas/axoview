import React, { useCallback, useEffect, useRef } from 'react';
import {
  Stack,
  Typography,
  IconButton,
  Tooltip,
  Slider,
  Divider
} from '@mui/material';
import { RotateLeft, RotateRight } from '@mui/icons-material';
import { useUiStateStore, useUiStateStoreApi } from 'src/stores/uiStateStore';

// POC — horizontal (turntable) rotation of the isometric ground plane.
// See utils/viewRotation.ts for how the rotation is applied.

const STEP_DEG = 15;
const TWEEN_MS = 220;

const btnSx = {
  borderRadius: 1,
  p: 0.5,
  color: 'text.secondary',
  '&:hover': { bgcolor: 'action.hover', color: 'text.primary' }
} as const;

export const ViewRotationControls = () => {
  const storeApi = useUiStateStoreApi();
  const canvasMode = useUiStateStore((s) => s.canvasMode);
  const rotation = useUiStateStore((s) => s.viewRotation);
  const setViewRotation = useUiStateStore((s) => s.actions.setViewRotation);
  const rafRef = useRef(0);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Ease to `target` (degrees) along the SHORTEST arc so a 15° nudge past ±180°
  // doesn't spin the long way round.
  const tweenTo = useCallback(
    (target: number) => {
      cancelAnimationFrame(rafRef.current);
      const from = storeApi.getState().viewRotation;
      let delta = (((target - from) % 360) + 540) % 360 - 180;
      if (delta === -180) delta = 180;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / TWEEN_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        setViewRotation(from + delta * eased);
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [storeApi, setViewRotation]
  );

  // The rotation only exists in the isometric projection.
  if (canvasMode !== 'ISOMETRIC') return null;

  const rounded = Math.round(rotation);

  return (
    <Stack direction="row" spacing={0} alignItems="center">
      <Tooltip title={`Rotate view left ${STEP_DEG}°`} placement="top">
        <IconButton
          size="small"
          sx={btnSx}
          onClick={() => tweenTo(storeApi.getState().viewRotation - STEP_DEG)}
          data-axoview-id="canvas-rotate-left"
        >
          <RotateLeft sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      <Tooltip
        title="Rotate the canvas about the vertical axis (Alt + drag on canvas)"
        placement="top"
      >
        <Slider
          size="small"
          min={-180}
          max={180}
          step={1}
          value={rotation}
          onChange={(_, v) => {
            cancelAnimationFrame(rafRef.current);
            setViewRotation(v as number);
          }}
          aria-label="View rotation"
          data-axoview-id="canvas-rotate-slider"
          sx={{ width: 84, mx: 1, py: 0 }}
        />
      </Tooltip>

      <Tooltip title={`Rotate view right ${STEP_DEG}°`} placement="top">
        <IconButton
          size="small"
          sx={btnSx}
          onClick={() => tweenTo(storeApi.getState().viewRotation + STEP_DEG)}
          data-axoview-id="canvas-rotate-right"
        >
          <RotateRight sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      <Tooltip title="Reset rotation" placement="top">
        <Typography
          variant="body2"
          onClick={() => tweenTo(0)}
          sx={{
            minWidth: 36,
            textAlign: 'center',
            fontSize: 11,
            color: rounded === 0 ? 'text.secondary' : 'text.primary',
            cursor: rounded === 0 ? 'default' : 'pointer',
            userSelect: 'none',
            fontVariantNumeric: 'tabular-nums'
          }}
          data-axoview-id="canvas-rotate-readout"
        >
          {rounded}°
        </Typography>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.75 }} />
    </Stack>
  );
};
