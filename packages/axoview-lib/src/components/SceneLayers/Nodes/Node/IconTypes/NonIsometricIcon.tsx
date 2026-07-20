import React from 'react';
import { Box } from '@mui/material';
import { Icon } from 'src/types';
import { PROJECTED_TILE_SIZE } from 'src/config';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { getIsoProjectionCss } from 'src/utils';

interface Props {
  icon: Icon;
  // ADR 0044: effective scale resolved by useIcon (per-node override ?? shared
  // asset scale ?? 1). Kept optional so any direct caller falls back sanely.
  scale?: number;
}

export const NonIsometricIcon = ({ icon, scale }: Props) => {
  const { strategy } = useCanvasMode();
  const effectiveScale = scale ?? icon.scale ?? 1;

  if (strategy.projectionName === '2D') {
    return (
      <Box
        component="img"
        src={icon.url}
        alt={`icon-${icon.id}`}
        sx={{
          position: 'absolute',
          width: PROJECTED_TILE_SIZE.width * 0.7 * effectiveScale,
          pointerEvents: 'none'
        }}
      />
    );
  }

  return (
    <Box sx={{ pointerEvents: 'none' }}>
      <Box
        sx={{
          position: 'absolute',
          left: -PROJECTED_TILE_SIZE.width / 2,
          top: 0,
          transformOrigin: 'top left',
          transform: getIsoProjectionCss()
        }}
      >
        <Box
          component="img"
          src={icon.url}
          alt={`icon-${icon.id}`}
          sx={{
            display: 'block',
            width: PROJECTED_TILE_SIZE.width * 0.7,
            // ADR 0044: scale about the CENTRE so a resize grows the flat icon
            // symmetrically (matching the isometric icon + the WebGL bulk),
            // instead of only down-and-right from the top-left corner.
            transform: `scale(${effectiveScale})`,
            transformOrigin: 'center'
          }}
        />
      </Box>
    </Box>
  );
};
