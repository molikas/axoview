// Pure geometry for the annotation overlay (ADR 0014). No React / DOM imports
// so it's unit-testable in isolation.

import type { Coords, Size } from 'src/types';

/**
 * Convert a renderer-relative screen point to scene-canvas coordinates (the
 * unscaled space SceneLayer draws in). Inverse of the SceneLayer transform
 * `screen = rendererCenter + scroll + zoom · canvas`, so strokes stored in
 * scene-canvas space track pan and zoom automatically.
 */
export const screenToSceneCanvas = (
  screen: Coords,
  rendererSize: Size,
  scroll: Coords,
  zoom: number
): Coords => ({
  x: (screen.x - rendererSize.width / 2 - scroll.x) / zoom,
  y: (screen.y - rendererSize.height / 2 - scroll.y) / zoom
});

/** SVG path `d` for a polyline through the given points (freehand / line). */
export const polylinePathD = (points: Coords[]): string => {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return (
    `M ${first.x} ${first.y}` +
    rest.map((p) => ` L ${p.x} ${p.y}`).join('')
  );
};

/**
 * The two wing points of an arrowhead at `to`, for a line coming from `from`.
 * Returns [] for a degenerate zero-length segment.
 */
export const arrowHeadPoints = (
  from: Coords,
  to: Coords,
  size: number
): [Coords, Coords] | [] => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return [];

  const ux = dx / len;
  const uy = dy / len;
  // Rotate the reversed unit vector by ±~28° and scale by `size`.
  const ANGLE = Math.PI / 6.4;
  const cos = Math.cos(ANGLE);
  const sin = Math.sin(ANGLE);
  const wing = (s: number): Coords => ({
    x: to.x - size * (ux * cos - s * uy * sin),
    y: to.y - size * (uy * cos + s * ux * sin)
  });
  return [wing(1), wing(-1)];
};

/** Axis-aligned bounding box (top-left + size) for two corner points. */
export const rectFromPoints = (a: Coords, b: Coords): Coords & Size => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y)
});
