import React, { useState } from 'react';
import { Coords } from 'src/types';
import { useTheme, Box } from '@mui/material';
import { getIsoProjectionCss } from 'src/utils';
import { Svg } from 'src/components/Svg/Svg';
import { TRANSFORM_ANCHOR_SIZE, TRANSFORM_CONTROLS_COLOR } from 'src/config';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';

interface Props {
  position: Coords;
  // Press handler — bound to onPointerDown so it fires at *touch* start too.
  // onMouseDown only fires as a compat event AFTER touchend, so on touch the
  // resize mode wasn't entered until too late and the gesture panned instead.
  onActivate: () => void;
}

const strokeWidth = 2;

export const TransformAnchor = ({ position, onActivate }: Props) => {
  const [isHovered, setIsHovered] = useState(false);
  const theme = useTheme();
  const { strategy } = useCanvasMode();

  return (
    <Box
      onMouseOver={() => {
        setIsHovered(true);
      }}
      onMouseOut={() => {
        setIsHovered(false);
      }}
      onPointerDown={onActivate}
      data-axoview-id="canvas-transform-anchor"
      sx={{
        position: 'absolute',
        transform:
          strategy.projectionName === '2D' ? undefined : getIsoProjectionCss(),
        width: TRANSFORM_ANCHOR_SIZE,
        height: TRANSFORM_ANCHOR_SIZE
      }}
      style={{
        left: position.x - TRANSFORM_ANCHOR_SIZE / 2,
        top: position.y - TRANSFORM_ANCHOR_SIZE / 2
      }}
    >
      <Svg
        style={{
          width: TRANSFORM_ANCHOR_SIZE,
          height: TRANSFORM_ANCHOR_SIZE
        }}
      >
        <g transform={`translate(${strokeWidth}, ${strokeWidth})`}>
          <rect
            fill={
              isHovered
                ? theme.palette.primary.dark
                : theme.palette.common.white
            }
            width={TRANSFORM_ANCHOR_SIZE - strokeWidth * 2}
            height={TRANSFORM_ANCHOR_SIZE - strokeWidth * 2}
            stroke={TRANSFORM_CONTROLS_COLOR}
            strokeWidth={strokeWidth}
            rx={3}
          />
        </g>
      </Svg>
    </Box>
  );
};
