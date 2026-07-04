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
   * A3 hover affordance: render a single faint outline (no dashed ring, no
   * glow, no resize anchors) — visually distinct from, and lighter than, the
   * selection ring. Used by HoverOutline for the hovered-but-unselected item.
   */
  subtle?: boolean;
}

const strokeWidth = 2;
const ROTATE_HANDLE_SIZE = 32;
const ROTATE_HANDLE_OFFSET_PX = 40;

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

    const cornerPositions = Object.entries(cornerScreen).map(
      ([key, position]) => ({
        key,
        position,
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
    const edgePositions = edgeCornerPairs.map(([key, a, b]) => ({
      key,
      position: midpoint(cornerScreen[a], cornerScreen[b]),
      onMouseDown: () => {
        onAnchorMouseDown(key);
      }
    }));

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
          pointerEvents: 'none'
        }}
      >
        {subtle ? (
          // A3 hover: one faint solid rounded outline — lighter than the
          // selection ring, no glow/dash/anchors.
          <g transform={`translate(${strokeWidth}, ${strokeWidth})`}>
            <rect
              width={pxSize.width - strokeWidth * 2}
              height={pxSize.height - strokeWidth * 2}
              rx={strokeWidth * 2}
              fill="none"
              stroke={TRANSFORM_CONTROLS_COLOR}
              strokeWidth={strokeWidth}
              strokeOpacity={0.45}
              strokeLinejoin="round"
            />
          </g>
        ) : (
          <g transform={`translate(${strokeWidth}, ${strokeWidth})`}>
            {/* S3/A1: soft accent glow under the ring so node selection reads
                clearly (the bare 2px dashed box was too faint — owner #1/#9). */}
            <rect
              width={pxSize.width - strokeWidth * 2}
              height={pxSize.height - strokeWidth * 2}
              rx={strokeWidth * 2}
              fill="none"
              stroke={TRANSFORM_CONTROLS_COLOR}
              strokeWidth={strokeWidth * 3}
              strokeOpacity={0.25}
              strokeLinejoin="round"
            />
            <rect
              width={pxSize.width - strokeWidth * 2}
              height={pxSize.height - strokeWidth * 2}
              fill="none"
              stroke={TRANSFORM_CONTROLS_COLOR}
              strokeDasharray={`${strokeWidth * 2} ${strokeWidth * 2}`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          </g>
        )}
      </Svg>

      {!subtle && anchors.map(({ key, position, onMouseDown }) => {
        return (
          <TransformAnchor
            key={key}
            position={position}
            onActivate={onMouseDown}
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
