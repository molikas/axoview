import React, { useState } from 'react';
import { Coords } from 'src/types';
import { useTheme, Box } from '@mui/material';
import { getIsoProjectionCss } from 'src/utils';
import { Svg } from 'src/components/Svg/Svg';
import { TRANSFORM_ANCHOR_SIZE, TRANSFORM_CONTROLS_COLOR } from 'src/config';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';

interface Props {
  position: Coords;
  /**
   * Direction-appropriate resize cursor (ns/ew/nwse/nesw), computed from the
   * on-screen edge/corner geometry by the parent so it's correct in iso AND 2D.
   */
  cursor: string;
  /**
   * Edge-midpoint handles render as an elongated bar (Google-style) — a much
   * wider hit target than the old square, so users stop misclicking when
   * grabbing an edge. Corner handles stay square.
   */
  isEdge: boolean;
  /** Screen angle (deg) the edge bar is rotated to lie along; edges only. */
  barAngleDeg?: number;
  // Press handler — bound to onPointerDown so it fires at *touch* start too.
  // onMouseDown only fires as a compat event AFTER touchend, so on touch the
  // resize mode wasn't entered until too late and the gesture panned instead.
  onActivate: () => void;
}

const strokeWidth = 2;
// Edge bars: long ALONG the edge, thin across — the widened hit target.
const EDGE_LENGTH = 42;
const EDGE_THICKNESS = 15;

export const TransformAnchor = ({
  position,
  cursor,
  isEdge,
  barAngleDeg,
  onActivate
}: Props) => {
  const [isHovered, setIsHovered] = useState(false);
  const theme = useTheme();
  const { strategy } = useCanvasMode();

  const w = isEdge ? EDGE_LENGTH : TRANSFORM_ANCHOR_SIZE;
  const h = isEdge ? EDGE_THICKNESS : TRANSFORM_ANCHOR_SIZE;

  // Edge bars are screen-rotated to sit exactly along the (possibly sheared)
  // edge; corner squares keep the existing iso-plane shear.
  const boxTransform = isEdge
    ? `rotate(${barAngleDeg ?? 0}deg)`
    : strategy.projectionName === '2D'
      ? undefined
      : getIsoProjectionCss();

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
        cursor,
        transform: boxTransform,
        width: w,
        height: h
      }}
      style={{
        left: position.x - w / 2,
        top: position.y - h / 2
      }}
    >
      <Svg
        style={{
          width: w,
          height: h
        }}
      >
        <rect
          x={strokeWidth}
          y={strokeWidth}
          fill={
            isHovered ? theme.palette.primary.dark : theme.palette.common.white
          }
          width={w - strokeWidth * 2}
          height={h - strokeWidth * 2}
          stroke={TRANSFORM_CONTROLS_COLOR}
          strokeWidth={strokeWidth}
          rx={isEdge ? (h - strokeWidth * 2) / 2 : 3}
        />
      </Svg>
    </Box>
  );
};
