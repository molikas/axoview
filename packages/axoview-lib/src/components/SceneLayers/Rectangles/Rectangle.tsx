import React, { memo, useMemo } from 'react';
import { useScene } from 'src/hooks/useScene';
import { IsoTileArea } from 'src/components/IsoTileArea/IsoTileArea';
import { getColorVariant } from 'src/utils';
import { useColor } from 'src/hooks/useColor';

type Props = ReturnType<typeof useScene>['rectangles'][0];

// Compositor drag wrapper (RECT-1). DragItems mutates --ff-drag-dx/dy on the
// [data-drag-id] element during a move; this one translate3d moves the whole
// rectangle on the GPU — no React re-render and no full-area <rect> repaint per
// frame (the big-square drag cliff: the rect is positioned via left/top, so a
// per-frame model write forced a real repaint scaling with its pixel area).
// The wrapper is a zero-offset positioned anchor, so the IsoTileArea <Svg> inside
// keeps its own left/top positioning — the transform only adds the drag delta.
const RECT_DRAG_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  transform: 'translate3d(var(--ff-drag-dx, 0px), var(--ff-drag-dy, 0px), 0)',
  willChange: 'transform'
};

export const Rectangle = memo(
  ({ id, from, to, color: colorId, customColor, offset }: Props) => {
    const predefinedColor = useColor(colorId);

    // Use custom color if provided, otherwise use the predefined color value.
    const colorValue = customColor ? customColor : predefinedColor?.value;

    // ADR 0023 off-grid: compose the unprojected-px offset into the SAME
    // translate3d that hosts the live drag delta, so they add (the IsoTileArea
    // inside still positions from the integer from/to). Snapped rectangles keep
    // the shared module-const style (referential stability for emotion).
    const dragStyle = useMemo(
      () =>
        offset
          ? {
              ...RECT_DRAG_STYLE,
              transform: `translate3d(calc(var(--ff-drag-dx, 0px) + ${offset.x}px), calc(var(--ff-drag-dy, 0px) + ${offset.y}px), 0)`
            }
          : RECT_DRAG_STYLE,
      [offset?.x, offset?.y] // eslint-disable-line react-hooks/exhaustive-deps
    );

    // Memoise the chroma-derived stroke variant so it isn't recomputed on every
    // render (the chroma pipeline is unmemoised). Keyed on the colour string.
    const strokeColor = useMemo(
      () =>
        colorValue ? getColorVariant(colorValue, 'dark', { grade: 2 }) : '',
      [colorValue]
    );

    if (!colorValue) {
      return null;
    }

    return (
      <div data-drag-id={id} style={dragStyle}>
        <IsoTileArea
          from={from}
          to={to}
          fill={colorValue}
          cornerRadius={22}
          stroke={{
            color: strokeColor,
            width: 1
          }}
        />
      </div>
    );
  }
);
