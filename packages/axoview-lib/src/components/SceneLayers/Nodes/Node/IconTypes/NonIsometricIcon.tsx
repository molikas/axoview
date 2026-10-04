import React from 'react';
import { Box } from '@mui/material';
import { Icon } from 'src/types';
import { PROJECTED_TILE_SIZE } from 'src/config';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';

interface Props {
  icon: Icon;
  // ADR 0044: effective scale resolved by useIcon (per-node override ?? shared
  // asset scale ?? 1). Kept optional so any direct caller falls back sanely.
  scale?: number;
}

export const NonIsometricIcon = ({ icon, scale }: Props) => {
  const { strategy, getTileCorner, getProjectionCss, uprightFlip } =
    useCanvasMode();
  const effectiveScale = scale ?? icon.scale ?? 1;
  // The flat icon's local origin is the tile's LEFT corner relative to the tile
  // centre. Projection is linear, so the offset from tile (0,0) is tile-independent;
  // (−halfW, 0) while unrotated; swings around with the view rotation (ADR 0049 §3).
  const leftCorner = getTileCorner({ tile: { x: 0, y: 0 }, corner: 'LEFT' });

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
          left: leftCorner.x,
          top: leftCorner.y,
          transformOrigin: 'top left',
          transform: getProjectionCss()
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
            // instead of only down-and-right from the top-left corner. ADR 0050
            // §2 keep-upright turns it 180° about the same centre, in step with
            // the WebGL bulk's flipped quad.
            transform: `scale(${effectiveScale})${
              uprightFlip.X ? ' rotate(180deg)' : ''
            }`,
            transformOrigin: 'center'
          }}
        />
      </Box>
    </Box>
  );
};
