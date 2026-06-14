// Pure geometry for the annotation overlay (ADR 0014). No React / DOM imports
// so it's unit-testable in isolation.

import type { Coords, Size } from 'src/types';
import type { AnnotationStroke } from 'src/types/ui';
import { HIGHLIGHTER_WIDTH_MULTIPLIER } from 'src/config/annotationSettings';

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

/** Shortest distance from point `p` to the segment `a`→`b`. */
export const pointToSegmentDistance = (
  p: Coords,
  a: Coords,
  b: Coords
): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  // Project p onto the segment, clamped to [0, 1].
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

const ELLIPSE_SAMPLES = 48;

/**
 * Decompose a stroke into the line segments that make up its drawn geometry, in
 * scene-canvas coordinates. Freehand = its polyline; line/arrow = one segment;
 * rectangle/ellipse = their (sampled) outline. Used by the eraser hit-test so a
 * stroke counts as hit when the cursor comes within radius of any segment.
 */
export const strokeSegments = (
  stroke: Pick<AnnotationStroke, 'tool' | 'points'>
): [Coords, Coords][] => {
  const { tool, points } = stroke;
  if (points.length === 0) return [];

  if (tool === 'rectangle' || tool === 'ellipse') {
    if (points.length < 2) return [];
    const r = rectFromPoints(points[0], points.at(-1)!);
    if (tool === 'rectangle') {
      const tl = { x: r.x, y: r.y };
      const tr = { x: r.x + r.width, y: r.y };
      const br = { x: r.x + r.width, y: r.y + r.height };
      const bl = { x: r.x, y: r.y + r.height };
      return [
        [tl, tr],
        [tr, br],
        [br, bl],
        [bl, tl]
      ];
    }
    // Ellipse: sample the outline into a closed polyline.
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const rx = r.width / 2;
    const ry = r.height / 2;
    const pts: Coords[] = [];
    for (let i = 0; i < ELLIPSE_SAMPLES; i += 1) {
      const a = (i / ELLIPSE_SAMPLES) * Math.PI * 2;
      pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    }
    return pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
  }

  // line / arrow: a single segment from first to last point.
  if (tool === 'line' || tool === 'arrow') {
    return points.length >= 2 ? [[points[0], points.at(-1)!]] : [];
  }

  // freehand (pencil / highlighter): consecutive segments.
  if (points.length === 1) return [[points[0], points[0]]];
  const segs: [Coords, Coords][] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    segs.push([points[i], points[i + 1]]);
  }
  return segs;
};

/**
 * True when an eraser circle of `radius` (scene units) centred at `center`
 * touches the stroke's drawn geometry. The stroke's own half-thickness (and the
 * highlighter's wider felt-tip footprint) is added to the radius so erasing
 * matches what the user sees rather than the zero-width centre line.
 */
export const strokeHitByEraser = (
  stroke: Pick<AnnotationStroke, 'tool' | 'points' | 'thickness'>,
  center: Coords,
  radius: number
): boolean => {
  const drawnWidth =
    stroke.tool === 'highlighter'
      ? stroke.thickness * HIGHLIGHTER_WIDTH_MULTIPLIER
      : stroke.thickness;
  const tolerance = radius + drawnWidth / 2;
  return strokeSegments(stroke).some(
    ([a, b]) => pointToSegmentDistance(center, a, b) <= tolerance
  );
};
