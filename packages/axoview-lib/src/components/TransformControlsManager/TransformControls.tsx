import React, { useMemo } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
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
import { useUiStateStore } from 'src/stores/uiStateStore';
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
  /**
   * ADR 0044: multiplier that grows the selection ring + handles out from the
   * element centre so they frame a node's scaled icon (which overflows its bare
   * tile). Omitted / 1 = the element's own footprint (rectangles, text boxes,
   * scale-1 nodes) — byte-for-byte unchanged.
   */
  extentScale?: number;
  /**
   * ADR 0044: a live size readout (e.g. "1.4×") shown on a pill below the
   * selection while a resize drag is in flight. Omitted = no readout.
   */
  readout?: string;
  /**
   * ADR 0023 off-grid: the item's committed px residual (post-projection,
   * SceneLayer space — same units getTilePosition returns). The ring + handles
   * are laid out from the integer from/to tiles, so without this the chrome sits
   * on the grid cell while the element renders at tile + offset (the off-centre
   * selector when snap is off). Applied as a pure screen translate to both the
   * ring and every anchor. Omitted / undefined = snapped (no shift).
   */
  offset?: Coords;
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
const READOUT_OFFSET_PX = 14;

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
  subtle,
  extentScale,
  readout,
  offset
}: Props) => {
  const { css, pxSize } = useIsoProjection({
    from,
    to
  });
  // ADR 0023 off-grid: shift the chrome by the item's committed px residual so
  // it tracks the element's real rendered position, not its grid cell. Same
  // SceneLayer/post-projection units as css.left/top and the anchor corners
  // below, so it composes as a plain translate.
  const offX = offset?.x ?? 0;
  const offY = offset?.y ?? 0;
  const { getTilePosition, strategy } = useCanvasMode();
  // Screen-pixel-stable readout (counter-scaled 1/zoom), matching the screen-box
  // node outline so both node shapes show the same size pill (QA 2026-07-19).
  const zoom = useUiStateStore((s) => s.zoom) || 1;

  // ADR 0044: grow the ring rects about the element's local centre so they frame
  // a scaled node icon. ex === 1 (rectangles / text boxes / scale-1 nodes) →
  // ringX/Y = 0 and ringW/H = pxSize, i.e. the original geometry unchanged.
  const ex = extentScale ?? 1;
  const ringW = pxSize.width * ex;
  const ringH = pxSize.height * ex;
  const ringX = (pxSize.width - ringW) / 2;
  const ringY = (pxSize.height - ringH) / 2;

  // The off-grid shift moves the ring's SVG origin (left/top). The anchors read
  // the already-shifted corners (cornerScreen below), so both stay in lockstep.
  const positionedCss = useMemo(
    () =>
      offX || offY
        ? {
            ...css,
            left: (css.left as number) + offX,
            top: (css.top as number) + offY
          }
        : css,
    [css, offX, offY]
  );

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
        // Corner direction from the tile centre (distinct from the off-grid
        // offX/offY shift added below).
        const cornerX = key.endsWith('LEFT') ? -half : half;
        const cornerY = key.startsWith('BOTTOM') ? half : -half;
        out[key] = {
          x: center.x + cornerX + offX,
          y: center.y + cornerY + offY
        };
      } else {
        const p = getTilePosition({
          tile: value,
          origin: outermostCornerPositions[i]
        });
        out[key] = { x: p.x + offX, y: p.y + offY };
      }
    });
    return out;
  }, [from, to, getTilePosition, strategy.projectionName, offX, offY]);

  const anchors = useMemo(() => {
    if (!onAnchorMouseDown) return [];

    // Screen-space centre of the selection — the reference direction for each
    // corner handle's resize cursor.
    const pts = Object.values(cornerScreen);
    const center = pts.reduce(
      (acc, p) => ({
        x: acc.x + p.x / pts.length,
        y: acc.y + p.y / pts.length
      }),
      { x: 0, y: 0 }
    );

    // ADR 0044: push the handles out to the scaled-icon extent about the same
    // screen centre the ring grows about (ex === 1 → identity). Uniform scaling
    // preserves direction, so the resize cursors below still read the true edge.
    const scaleOut = (p: Coords): Coords => ({
      x: center.x + (p.x - center.x) * ex,
      y: center.y + (p.y - center.y) * ex
    });

    const cornerPositions = Object.entries(cornerScreen).map(
      ([key, position]) => ({
        key,
        position: scaleOut(position),
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
        position: scaleOut(midpoint(ca, cb)),
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
  }, [onAnchorMouseDown, anchorPositions, cornerScreen, ex]);

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

  // ADR 0044: live size readout — centred just below the (scaled) selection.
  const readoutPosition = useMemo(() => {
    if (!readout) return null;
    const points = Object.values(cornerScreen);
    if (points.length === 0) return null;
    const c = points.reduce(
      (acc, p) => ({
        x: acc.x + p.x / points.length,
        y: acc.y + p.y / points.length
      }),
      { x: 0, y: 0 }
    );
    const bottomY = Math.max(...points.map((p) => p.y));
    // Track the grown extent so the pill sits just below the scaled icon.
    const scaledBottomY = c.y + (bottomY - c.y) * ex;
    return { x: c.x, y: scaledBottomY + READOUT_OFFSET_PX };
  }, [readout, cornerScreen, ex]);

  return (
    <>
      <Svg
        style={{
          ...positionedCss,
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
              x={ringX - HOVER_OUTSET}
              y={ringY - HOVER_OUTSET}
              width={ringW + HOVER_OUTSET * 2}
              height={ringH + HOVER_OUTSET * 2}
              rx={RING_RADIUS}
              fill="none"
              stroke="#ffffff"
              strokeWidth={HOVER_RING_WIDTH + 2}
              strokeOpacity={0.6}
              strokeLinejoin="round"
            />
            <rect
              x={ringX - HOVER_OUTSET}
              y={ringY - HOVER_OUTSET}
              width={ringW + HOVER_OUTSET * 2}
              height={ringH + HOVER_OUTSET * 2}
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
              x={ringX - SELECT_OUTSET}
              y={ringY - SELECT_OUTSET}
              width={ringW + SELECT_OUTSET * 2}
              height={ringH + SELECT_OUTSET * 2}
              rx={RING_RADIUS}
              fill="none"
              stroke={TRANSFORM_CONTROLS_COLOR}
              strokeWidth={SELECT_RING_WIDTH * 3}
              strokeOpacity={0.22}
              strokeLinejoin="round"
            />
            <rect
              x={ringX - SELECT_OUTSET}
              y={ringY - SELECT_OUTSET}
              width={ringW + SELECT_OUTSET * 2}
              height={ringH + SELECT_OUTSET * 2}
              rx={RING_RADIUS}
              fill="none"
              stroke="#ffffff"
              strokeWidth={SELECT_RING_WIDTH + 2}
              strokeOpacity={0.9}
              strokeLinejoin="round"
            />
            <rect
              x={ringX - SELECT_OUTSET}
              y={ringY - SELECT_OUTSET}
              width={ringW + SELECT_OUTSET * 2}
              height={ringH + SELECT_OUTSET * 2}
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
        anchors.map(
          ({ key, position, onMouseDown, cursor, isEdge, barAngleDeg }) => {
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
          }
        )}

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

      {!subtle && readout && readoutPosition && (
        <Box
          data-axoview-id="canvas-resize-readout"
          sx={{
            position: 'absolute',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            bgcolor: TRANSFORM_CONTROLS_COLOR,
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: 2
          }}
          style={{
            left: readoutPosition.x,
            top: readoutPosition.y,
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
