import React, { useMemo } from 'react';
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
}

const strokeWidth = 2;

export const TransformControls = ({ from, to, onAnchorMouseDown }: Props) => {
  const { css, pxSize } = useIsoProjection({
    from,
    to
  });
  const { getTilePosition, strategy } = useCanvasMode();

  const anchors = useMemo(() => {
    if (!onAnchorMouseDown) return [];

    const corners = getBoundingBox([from, to]);
    const namedCorners = convertBoundsToNamedAnchors(corners);

    // Screen position of each corner handle, keyed by corner name so the
    // edge midpoints can be derived as averages of the visible corners.
    const cornerScreen = {} as Record<string, Coords>;
    const cornerPositions = Object.entries(namedCorners).map(
      ([key, value], i) => {
        let position: Coords;
        if (strategy.projectionName === '2D') {
          // 2D tiles are squares — outer corners are diagonals from each
          // corner-tile's center, not single-axis offsets like in iso.
          const center = getTilePosition({ tile: value });
          const half = UNPROJECTED_TILE_SIZE / 2;
          const offsetX = key.endsWith('LEFT') ? -half : half;
          const offsetY = key.startsWith('BOTTOM') ? half : -half;
          position = { x: center.x + offsetX, y: center.y + offsetY };
        } else {
          position = getTilePosition({
            tile: value,
            origin: outermostCornerPositions[i]
          });
        }

        cornerScreen[key] = position;
        return {
          key,
          position,
          onMouseDown: () => {
            onAnchorMouseDown(key as AnchorPosition);
          }
        };
      }
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

    return [...cornerPositions, ...edgePositions];
  }, [onAnchorMouseDown, from, to, getTilePosition, strategy.projectionName]);

  return (
    <>
      <Svg
        style={{
          ...css,
          pointerEvents: 'none'
        }}
      >
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
      </Svg>

      {anchors.map(({ key, position, onMouseDown }) => {
        return (
          <TransformAnchor
            key={key}
            position={position}
            onActivate={onMouseDown}
          />
        );
      })}
    </>
  );
};
