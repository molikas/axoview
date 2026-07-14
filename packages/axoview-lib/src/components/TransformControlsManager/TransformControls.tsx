import React, { useMemo } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { RotateRightOutlined as RotateIcon } from '@mui/icons-material';
import { Coords, AnchorPosition } from 'src/types';
import { Svg } from 'src/components/Svg/Svg';
import { TRANSFORM_CONTROLS_COLOR, UNPROJECTED_TILE_SIZE } from 'src/config';
import { useIsoProjection } from 'src/hooks/useIsoProjection';
import {
  getBoundingBox,
  outermostCornerPositions,
  convertBoundsToNamedAnchors
} from 'src/utils';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { TransformAnchor } from './TransformAnchor';

interface Props {
  from: Coords;
  to: Coords;
  onAnchorMouseDown?: (anchorPosition: AnchorPosition) => void;
  /**
   * Restrict which anchors render (e.g. a text box resizes width only, so it
   * offers just the two run-axis edge anchors — ADR 0034 addendum
   * 2026-07-03). Omitted = all eight (rectangle behavior).
   */
  anchorPositions?: AnchorPosition[];
  /**
   * Lucid-style on-canvas rotate handle (owner 2026-07-04): a small round
   * button floating above the selection. One click = quarter-turn — the text
   * box flips its iso plane, the rectangle transposes its footprint.
   */
  onRotate?: () => void;
  rotateTooltip?: string;
  /**
   * A3 hover affordance: render a single light accent outline with a faint
   * white contrast under-stroke (no glow, no resize anchors) — visually
   * distinct from, and lighter than, the selection ring. Used by HoverOutline
   * for the hovered-but-unselected item.
   */
  subtle?: boolean;
}

// Selection / hover chrome geometry (screen px, pre-shear). The ring frames the
// element from just OUTSIDE its own border so it never hides behind the
// element's own stroke, and stacks a white under-ring so the accent stays
// legible on any fill (e.g. a blue rectangle) — the fix for the owner's #1
// complaint, "I can't tell what's selected" (cluster A).
const SELECT_RING_WIDTH = 2.5;
const SELECT_OUTSET = 3;
const HOVER_RING_WIDTH = 1.75;
const HOVER_OUTSET = 2;
const RING_RADIUS = 5;
const ROTATE_HANDLE_SIZE = 32;
const ROTATE_HANDLE_OFFSET_PX = 40;

// Standard bidirectional resize cursor nearest to a screen-space angle (radians,
// y-down). Bucketed mod 180° into the four resize cursors. Reads actual on-screen
// geometry, so it is correct in BOTH iso and 2D: pass the edge NORMAL for edge
// handles and the centre→corner diagonal for corner handles.
const resizeCursorForAngle = (radians: number): string => {
  const deg = ((((radians * 180) / Math.PI) % 180) + 180) % 180;
  if (deg < 22.5 || deg >= 157.5) return 'ew-resize';
  if (deg < 67.5) return 'nwse-resize';
  if (deg < 112.5) return 'ns-resize';
  return 'nesw-resize';
};

export const TransformControls = ({
  from,
  to,
  onAnchorMouseDown,
  anchorPositions,
  onRotate,
  rotateTooltip,
  subtle
}: Props) => {
  const { css, pxSize } = useIsoProjection({
    from,
    to
  });
  const { getTilePosition, strategy } = useCanvasMode();

  // Screen position of each outer corner, keyed by corner name — feeds the
  // anchor handles (edge midpoints are corner averages) and the rotate handle.
  const cornerScreen = useMemo(() => {
    const corners = getBoundingBox([from, to]);
    const namedCorners = convertBoundsToNamedAnchors(corners);
    const out = {} as Record<string, Coords>;
    Object.entries(namedCorners).forEach(([key, value], i) => {
      if (strategy.projectionName === '2D') {
        // 2D tiles are squares — outer corners are diagonals from each
        // corner-tile's center, not single-axis offsets like in iso.
        const center = getTilePosition({ tile: value });
        const half = UNPROJECTED_TILE_SIZE / 2;
        const offsetX = key.endsWith('LEFT') ? -half : half;
        const offsetY = key.startsWith('BOTTOM') ? half : -half;
        out[key] = { x: center.x + offsetX, y: center.y + offsetY };
      } else {
        out[key] = getTilePosition({
          tile: value,
          origin: outermostCornerPositions[i]
        });
      }
    });
    return out;
  }, [from, to, getTilePosition, strategy.projectionName]);

  const anchors = useMemo(() => {
    if (!onAnchorMouseDown) return [];

    // Screen-space centre of the selection — the reference direction for each
    // corner handle's resize cursor.
    const pts = Object.values(cornerScreen);
    const center = pts.reduce(
      (acc, p) => ({ x: acc.x + p.x / pts.length, y: acc.y + p.y / pts.length }),
      { x: 0, y: 0 }
    );

    const cornerPositions = Object.entries(cornerScreen).map(
      ([key, position]) => ({
        key,
        position,
        isEdge: false,
        barAngleDeg: undefined as number | undefined,
        // Corner drag resizes along the diagonal from the centre outward.
        cursor: resizeCursorForAngle(
          Math.atan2(position.y - center.y, position.x - center.x)
        ),
        onMouseDown: () => {
          onAnchorMouseDown(key as AnchorPosition);
        }
      })
    );

    // Edge-midpoint handles (ADR 0026). Averaging the two adjacent corner
    // screen positions lands the midpoint exactly on the visible edge in
    // BOTH iso (diamond) and 2D (square) — no projection-specific math.
    const midpoint = (a: Coords, b: Coords): Coords => ({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2
    });
    const edgeCornerPairs: [AnchorPosition, string, string][] = [
      ['TOP', 'TOP_LEFT', 'TOP_RIGHT'],
      ['RIGHT', 'TOP_RIGHT', 'BOTTOM_RIGHT'],
      ['BOTTOM', 'BOTTOM_LEFT', 'BOTTOM_RIGHT'],
      ['LEFT', 'TOP_LEFT', 'BOTTOM_LEFT']
    ];
    const edgePositions = edgeCornerPairs.map(([key, a, b]) => {
      const ca = cornerScreen[a];
      const cb = cornerScreen[b];
      // Angle of the visible edge from its two corners — tracks the sheared iso
      // edge exactly. The bar lies along it; the cursor points across it.
      const edgeAngle = Math.atan2(cb.y - ca.y, cb.x - ca.x);
      return {
        key,
        position: midpoint(ca, cb),
        isEdge: true,
        barAngleDeg: (edgeAngle * 180) / Math.PI,
        cursor: resizeCursorForAngle(edgeAngle + Math.PI / 2),
        onMouseDown: () => {
          onAnchorMouseDown(key);
        }
      };
    });

    const all = [...cornerPositions, ...edgePositions];
    return anchorPositions
      ? all.filter((a) => anchorPositions.includes(a.key as AnchorPosition))
      : all;
  }, [onAnchorMouseDown, anchorPositions, cornerScreen]);

  // Rotate handle floats above the selection's TOPMOST screen point — a
  // stable, unoccluded spot in both projections (iso diamond apex / 2D top
  // edge), clear of the resize anchors.
  const rotatePosition = useMemo(() => {
    if (!onRotate) return null;
    const points = Object.values(cornerScreen);
    if (points.length === 0) return null;
    const topmost = points.reduce((min, p) => (p.y < min.y ? p : min));
    return { x: topmost.x, y: topmost.y - ROTATE_HANDLE_OFFSET_PX };
  }, [onRotate, cornerScreen]);

  return (
    <>
      <Svg
        style={{
          ...css,
          pointerEvents: 'none',
          // Selection/hover chrome frames the element from just OUTSIDE its own
          // border; the default svg viewport (== element footprint) would clip
          // the outset ring + glow, so let them escape.
          overflow: 'visible'
        }}
      >
        {subtle ? (
          // A3 hover: a light accent outline sitting just outside the element
          // edge, over a faint white under-stroke so it stays legible on a
          // coloured fill. Thinner/dimmer than the selection ring (no glow, no
          // anchors) — reads as "a click will grab this".
          <>
            <rect
              x={-HOVER_OUTSET}
              y={-HOVER_OUTSET}
              width={pxSize.width + HOVER_OUTSET * 2}
              height={pxSize.height + HOVER_OUTSET * 2}
              rx={RING_RADIUS}
              fill="none"
              stroke="#ffffff"
              strokeWidth={HOVER_RING_WIDTH + 2}
              strokeOpacity={0.6}
              strokeLinejoin="round"
            />
            <rect
              x={-HOVER_OUTSET}
              y={-HOVER_OUTSET}
              width={pxSize.width + HOVER_OUTSET * 2}
              height={pxSize.height + HOVER_OUTSET * 2}
              rx={RING_RADIUS}
              fill="none"
              stroke={TRANSFORM_CONTROLS_COLOR}
              strokeWidth={HOVER_RING_WIDTH}
              strokeOpacity={0.7}
              strokeLinejoin="round"
            />
          </>
        ) : (
          // Selection ring (owner cluster A — "I can't tell what's selected").
          // Three stacked strokes just OUTSIDE the element edge: a soft accent
          // glow, a white contrast under-ring (so the accent survives on any
          // fill/border — e.g. a blue rectangle with a red border), and a bold
          // SOLID accent ring. Solid (was a faint dashed box) + outset + white
          // halo = unmistakable on every element type.
          <>
            <rect
              x={-SELECT_OUTSET}
              y={-SELECT_OUTSET}
              width={pxSize.width + SELECT_OUTSET * 2}
              height={pxSize.height + SELECT_OUTSET * 2}
              rx={RING_RADIUS}
              fill="none"
              stroke={TRANSFORM_CONTROLS_COLOR}
              strokeWidth={SELECT_RING_WIDTH * 3}
              strokeOpacity={0.22}
              strokeLinejoin="round"
            />
            <rect
              x={-SELECT_OUTSET}
              y={-SELECT_OUTSET}
              width={pxSize.width + SELECT_OUTSET * 2}
              height={pxSize.height + SELECT_OUTSET * 2}
              rx={RING_RADIUS}
              fill="none"
              stroke="#ffffff"
              strokeWidth={SELECT_RING_WIDTH + 2}
              strokeOpacity={0.9}
              strokeLinejoin="round"
            />
            <rect
              x={-SELECT_OUTSET}
              y={-SELECT_OUTSET}
              width={pxSize.width + SELECT_OUTSET * 2}
              height={pxSize.height + SELECT_OUTSET * 2}
              rx={RING_RADIUS}
              fill="none"
              stroke={TRANSFORM_CONTROLS_COLOR}
              strokeWidth={SELECT_RING_WIDTH}
              strokeLinejoin="round"
            />
          </>
        )}
      </Svg>

      {!subtle &&
        anchors.map(({ key, position, onMouseDown, cursor, isEdge, barAngleDeg }) => {
          return (
            <TransformAnchor
              key={key}
              position={position}
              onActivate={onMouseDown}
              cursor={cursor}
              isEdge={isEdge}
              barAngleDeg={barAngleDeg}
            />
          );
        })}

      {!subtle && onRotate && rotatePosition && (
        <Tooltip title={rotateTooltip ?? ''} placement="top">
          <IconButton
            size="small"
            data-axoview-id="canvas-rotate-handle"
            onPointerDown={(e) => {
              // Never reach the canvas interaction layer (no drag/deselect).
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onRotate();
            }}
            sx={{
              position: 'absolute',
              width: ROTATE_HANDLE_SIZE,
              height: ROTATE_HANDLE_SIZE,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: 1,
              color: 'text.primary',
              '&:hover': { bgcolor: 'background.paper' }
            }}
            style={{
              left: rotatePosition.x - ROTATE_HANDLE_SIZE / 2,
              top: rotatePosition.y - ROTATE_HANDLE_SIZE / 2
            }}
          >
            <RotateIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      )}
    </>
  );
};
