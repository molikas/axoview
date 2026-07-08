// ---------------------------------------------------------------------------
// lineStyle — shared polyline dash/dot walkers for the WebGL bulk layers
// (ConnectorsCanvas, RectanglesCanvas). Pure geometry: they walk a polyline in
// scene space and invoke a callback for each dash sub-span / dot centre, so the
// caller emits its own quads/caps. Keeping the walk in one place is what makes
// connector and rectangle line-styles measure the SAME way (consistent widths /
// dash metrics across element types).
//
// Dash lengths are the caller's concern and are authored relative to the
// element's (already projection-scaled) stroke width, mirroring each element's
// DOM strokeDasharray so the unselected GPU bulk matches the selected DOM path.
// ---------------------------------------------------------------------------

import { Coords } from 'src/types';

/** Place a dot at arc-length 0, spacing, 2·spacing, … along a polyline. */
export const walkDots = (
  poly: Coords[],
  spacing: number,
  cb: (p: Coords) => void
): void => {
  if (spacing < 1e-3) return;
  let s = 0;
  let next = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen < 1e-3) continue;
    const ux = (b.x - a.x) / segLen;
    const uy = (b.y - a.y) / segLen;
    while (next <= s + segLen + 1e-6) {
      const d = next - s;
      cb({ x: a.x + ux * d, y: a.y + uy * d });
      next += spacing;
    }
    s += segLen;
  }
};

/**
 * Emit the "on" sub-spans of a [dashLen, gapLen] pattern along a polyline. Phase
 * is continuous across vertices, so a dash wraps a corner as two sub-spans that
 * meet at the vertex — the same visual as an SVG polyline strokeDasharray.
 */
export const walkDashes = (
  poly: Coords[],
  dashLen: number,
  gapLen: number,
  cb: (p0: Coords, p1: Coords) => void
): void => {
  const period = dashLen + gapLen;
  if (period < 1e-3) return;
  let s = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen < 1e-3) continue;
    const ux = (b.x - a.x) / segLen;
    const uy = (b.y - a.y) / segLen;
    let local = 0;
    while (local < segLen - 1e-6) {
      const phase = (s + local) % period;
      if (phase < dashLen) {
        const onLen = Math.min(dashLen - phase, segLen - local);
        cb(
          { x: a.x + ux * local, y: a.y + uy * local },
          { x: a.x + ux * (local + onLen), y: a.y + uy * (local + onLen) }
        );
        local += onLen;
      } else {
        local += period - phase;
      }
    }
    s += segLen;
  }
};
