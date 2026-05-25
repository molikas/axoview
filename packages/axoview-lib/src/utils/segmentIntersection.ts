import { Coords } from 'src/types';
import { isWithinBounds } from './isoMath';
import { isPointInPolygon } from './pointInPolygon';

const orientation = (p: Coords, q: Coords, r: Coords): number => {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (val === 0) return 0;
  return val > 0 ? 1 : 2;
};

const onSegment = (p: Coords, q: Coords, r: Coords): boolean =>
  q.x <= Math.max(p.x, r.x) &&
  q.x >= Math.min(p.x, r.x) &&
  q.y <= Math.max(p.y, r.y) &&
  q.y >= Math.min(p.y, r.y);

export const segmentsIntersect = (
  a1: Coords,
  a2: Coords,
  b1: Coords,
  b2: Coords
): boolean => {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if (o1 !== o2 && o3 !== o4) return true;

  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b2, a2)) return true;
  if (o3 === 0 && onSegment(b1, a1, b2)) return true;
  if (o4 === 0 && onSegment(b1, a2, b2)) return true;

  return false;
};

/**
 * Returns true if the segment [a, b] shares any point with the axis-aligned
 * rectangle defined by `bounds` (two opposite corners, in either order, as
 * isWithinBounds accepts). Used by Lasso to detect connectors whose visible
 * path crosses the lasso rect even when both endpoints are outside (path-hit
 * semantics — mirrors click selection).
 */
export const segmentIntersectsRect = (
  a: Coords,
  b: Coords,
  bounds: Coords[]
): boolean => {
  if (isWithinBounds(a, bounds) || isWithinBounds(b, bounds)) return true;

  const [c1, c2] = bounds;
  const lowX = Math.min(c1.x, c2.x);
  const lowY = Math.min(c1.y, c2.y);
  const highX = Math.max(c1.x, c2.x);
  const highY = Math.max(c1.y, c2.y);

  const corners: Coords[] = [
    { x: lowX, y: lowY },
    { x: highX, y: lowY },
    { x: highX, y: highY },
    { x: lowX, y: highY }
  ];

  for (let i = 0; i < 4; i += 1) {
    if (segmentsIntersect(a, b, corners[i], corners[(i + 1) % 4])) return true;
  }

  return false;
};

/**
 * Returns true if the segment [a, b] shares any point with the polygon.
 * Used by FreehandLasso for path-hit connector selection.
 */
export const segmentIntersectsPolygon = (
  a: Coords,
  b: Coords,
  polygon: Coords[]
): boolean => {
  if (polygon.length < 3) return false;
  if (isPointInPolygon(a, polygon) || isPointInPolygon(b, polygon)) return true;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    if (segmentsIntersect(a, b, polygon[j], polygon[i])) return true;
  }

  return false;
};
