import React from 'react';
import { Box } from '@mui/material';
import { Coords, AnchorPosition } from 'src/types';
import { Svg } from 'src/components/Svg/Svg';
import { TRANSFORM_CONTROLS_COLOR } from 'src/config';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { TransformAnchor } from './TransformAnchor';

// ADR 0044 (2026-07-19 UX follow-up): a node's icon is a 3-D isometric sprite,
// which a flat tile-plane diamond can't wrap (a big cube escapes upward — the
// "box doesn't follow the outline" bug). This draws a SCREEN-ALIGNED rectangle
// sized to the icon's actual rendered bounds (center + width/height in
// SceneLayer space), so the handles land on the icon's visual corners at any
// scale. Used for nodes; rectangles/text boxes keep the iso ring (TransformControls).

const RING_WIDTH = 2.5;
const OUTSET = 4;
const RADIUS = 6;
const HOVER_RING_WIDTH = 1.75;
const READOUT_GAP = 16;
const MIN_SIDE = 8;

const CORNERS: {
  key: AnchorPosition;
  sx: number;
  sy: number;
  cursor: string;
}[] = [
  { key: 'TOP_LEFT', sx: -0.5, sy: -0.5, cursor: 'nwse-resize' },
  { key: 'TOP_RIGHT', sx: 0.5, sy: -0.5, cursor: 'nesw-resize' },
  { key: 'BOTTOM_LEFT', sx: -0.5, sy: 0.5, cursor: 'nesw-resize' },
  { key: 'BOTTOM_RIGHT', sx: 0.5, sy: 0.5, cursor: 'nwse-resize' }
];

interface Props {
  /** Icon centre in SceneLayer coords (getTilePosition CENTER + off-grid). */
  center: Coords;
  width: number;
  height: number;
  onAnchorMouseDown?: (key: AnchorPosition) => void;
  /** Live "1.4×" size readout shown below the box during a resize drag. */
  readout?: string;
  /** Lighter hover variant (no glow, no handles) for the hovered-not-selected node. */
  subtle?: boolean;
}

export const ScreenBoxTransformControls = ({
  center,
  width,
  height,
  onAnchorMouseDown,
  readout,
  subtle
}: Props) => {
  // The pill counter-scales by 1/zoom so it stays a readable screen size at any
  // zoom (the handles, like the iso ones, still scale with the scene — ADR 0026
  // open item). Subscribed via React: selection chrome is one node, cheap.
  const zoom = useUiStateStore((s) => s.zoom) || 1;

  const w = Math.max(width, MIN_SIDE);
  const h = Math.max(height, MIN_SIDE);
  const left = center.x - w / 2;
  const top = center.y - h / 2;
  const ringW = w + OUTSET * 2;
  const ringH = h + OUTSET * 2;

  return (
    <>
      <Svg
        // Selection vs hover chrome, addressable from e2e: off-grid specs assert
        // that the ring lands on the DRAWN element, not its grid cell, and
        // nothing else in the DOM identifies these rings.
        data-axoview-id={
          subtle ? 'canvas-hover-outline' : 'canvas-selection-chrome'
        }
        style={{
          position: 'absolute',
          left: left - OUTSET,
          top: top - OUTSET,
          width: ringW,
          height: ringH,
          overflow: 'visible',
          pointerEvents: 'none'
        }}
      >
        {subtle ? (
          <>
            <rect
              x={0}
              y={0}
              width={ringW}
              height={ringH}
              rx={RADIUS}
              fill="none"
              stroke="#ffffff"
              strokeWidth={HOVER_RING_WIDTH + 2}
              strokeOpacity={0.6}
              strokeLinejoin="round"
            />
            <rect
              x={0}
              y={0}
              width={ringW}
              height={ringH}
              rx={RADIUS}
              fill="none"
              stroke={TRANSFORM_CONTROLS_COLOR}
              strokeWidth={HOVER_RING_WIDTH}
              strokeOpacity={0.7}
              strokeLinejoin="round"
            />
          </>
        ) : (
          <>
            {/* accent glow → white contrast under-ring → bold accent ring (ADR 0006 §9). */}
            <rect
              x={0}
              y={0}
              width={ringW}
              height={ringH}
              rx={RADIUS}
              fill="none"
              stroke={TRANSFORM_CONTROLS_COLOR}
              strokeWidth={RING_WIDTH * 3}
              strokeOpacity={0.22}
              strokeLinejoin="round"
            />
            <rect
              x={0}
              y={0}
              width={ringW}
              height={ringH}
              rx={RADIUS}
              fill="none"
              stroke="#ffffff"
              strokeWidth={RING_WIDTH + 2}
              strokeOpacity={0.9}
              strokeLinejoin="round"
            />
            <rect
              x={0}
              y={0}
              width={ringW}
              height={ringH}
              rx={RADIUS}
              fill="none"
              stroke={TRANSFORM_CONTROLS_COLOR}
              strokeWidth={RING_WIDTH}
              strokeLinejoin="round"
            />
          </>
        )}
      </Svg>

      {!subtle &&
        onAnchorMouseDown &&
        CORNERS.map((c) => (
          <TransformAnchor
            key={c.key}
            position={{ x: center.x + c.sx * w, y: center.y + c.sy * h }}
            onActivate={() => onAnchorMouseDown(c.key)}
            cursor={c.cursor}
            isEdge={false}
          />
        ))}

      {!subtle && readout && (
        <Box
          data-axoview-id="canvas-resize-readout"
          sx={{
            position: 'absolute',
            bgcolor: TRANSFORM_CONTROLS_COLOR,
            color: '#fff',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: 14,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: 2
          }}
          style={{
            left: center.x,
            top: center.y + h / 2 + READOUT_GAP,
            transform: `translateX(-50%) scale(${1 / zoom})`,
            transformOrigin: 'top center'
          }}
        >
          {readout}
        </Box>
      )}
    </>
  );
};
