import React, { memo, useMemo } from 'react';
import { useScene } from 'src/hooks/useScene';
import { useLayerContext } from 'src/hooks/useLayerContext';
import { Rectangle } from './Rectangle';

interface Props {
  rectangles: ReturnType<typeof useScene>['rectangles'];
}

export const Rectangles = memo(({ rectangles }: Props) => {
  const { visibleIds } = useLayerContext();

  const visibleRectangles = useMemo(() => {
    const filtered = rectangles.filter(
      (r) => visibleIds.size === 0 || visibleIds.has(r.id)
    );
    // Higher zIndex paints later (on top). Stable sort over the reversed
    // insertion order keeps the prior look for equal (default 0) zIndex — only
    // explicit send-to-front/back moves a rect. Mirrors LabelsCanvas.
    return [...filtered]
      .reverse()
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  }, [rectangles, visibleIds]);

  return (
    <>
      {visibleRectangles.map((rectangle) => (
        <Rectangle key={rectangle.id} {...rectangle} />
      ))}
    </>
  );
});
