import React, { useMemo, memo } from 'react';
import { Coords } from 'src/types';
import { Svg } from 'src/components/Svg/Svg';
import { useIsoProjection } from 'src/hooks/useIsoProjection';

interface Props {
  from: Coords;
  to: Coords;
  origin?: Coords;
  fill?: string;
  cornerRadius?: number;
  stroke?: {
    width: number;
    color: string;
    dashArray?: string;
  };
}

export const IsoTileArea = memo(
  ({ from, to, fill = 'none', cornerRadius = 0, stroke }: Props) => {
    const { css, pxSize } = useIsoProjection({
      from,
      to
    });

    const strokeParams = useMemo(() => {
      if (!stroke) return {};

      const params: Record<string, string | number> = {
        stroke: stroke.color,
        strokeWidth: stroke.width
      };

      if (stroke.dashArray) {
        params.strokeDasharray = stroke.dashArray;
      }

      return params;
    }, [stroke]);

    // SVG strokes are centred on the path, so a rect drawn flush to the viewport
    // loses strokeWidth/2 to clipping on every edge (a 30px border showed ~15px).
    // Inset the rect by half the stroke and shrink it by the full stroke so the
    // whole border stays inside [0,width]×[0,height]. With no stroke, strokeW is
    // 0 and this collapses to the original full-bleed geometry (fills still cover
    // the entire tile footprint — no seam gap). Same DOM feeds the image export,
    // so this fixes the clip on canvas and in PNG/SVG exports at once.
    const strokeW = stroke?.width ?? 0;
    const halfStroke = strokeW / 2;

    return (
      <Svg viewboxSize={pxSize} style={css}>
        <rect
          x={halfStroke}
          y={halfStroke}
          width={Math.max(0, pxSize.width - strokeW)}
          height={Math.max(0, pxSize.height - strokeW)}
          fill={fill}
          rx={Math.max(0, cornerRadius - halfStroke)}
          {...strokeParams}
        />
      </Svg>
    );
  }
);
