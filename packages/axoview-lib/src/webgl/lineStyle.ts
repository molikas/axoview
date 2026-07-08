// ---------------------------------------------------------------------------
// lineStyle — shared polyline dash/dot walkers for the WebGL bulk layers
// (ConnectorsCanvas, RectanglesCanvas). Pure geometry: they walk a polyline in
// scene space and invoke a callback for each dash sub-span / dot centre, so the
// caller emits its own quads/caps. Keeping the walk in one place is what makes
// connector and rectangle line-styles measure the SAME way (consistent widths /
// dash metrics across element types).
//
// Both walkers iterate by an INTEGER dash/dot index rather than accumulating a
// float cursor. An earlier float-accumulating version could stall: near a dash
// boundary the "on" span length rounds to ~0, and `cursor += tinyValue` is
// absorbed by float precision once the cursor is a few hundred px in — the loop
// then never advances and emits sprites until the GPU staging buffer exhausts
// memory (RangeError: Array buffer allocation failed). Integer indices always
// advance, and MAX_SPANS_PER_SEGMENT is a belt-and-braces cap against a
// pathologically tiny period.
//
// Dash lengths are the caller's concern and are authored relative to the
// element's (already projection-scaled) stroke width, mirroring each element's
// DOM strokeDasharray so the unselected GPU bulk matches the selected DOM path.
// ---------------------------------------------------------------------------

import { Coords } from 'src/types';

const EPS = 1e-3;
// A single edge never needs more spans than this in a real diagram; hitting it
// means the period is pathologically small — stop rather than exhaust memory.
const MAX_SPANS_PER_SEGMENT = 20000;

/** Place a dot at arc-length 0, spacing, 2·spacing, … along a polyline. */
export const walkDots = (
  poly: Coords[],
  spacing: number,
  cb: (p: Coords) => void
): void => {
  if (spacing < EPS) return;
  let s = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen < EPS) continue;
    const ux = (b.x - a.x) / segLen;
    const uy = (b.y - a.y) / segLen;
    const segEnd = s + segLen;
    // First dot index whose global position (k·spacing) falls at/after s.
    const kStart = Math.ceil(s / spacing - 1e-6);
    for (let k = kStart, n = 0; k * spacing <= segEnd + 1e-6; k++, n++) {
      if (n >= MAX_SPANS_PER_SEGMENT) break;
      const d = k * spacing - s;
      cb({ x: a.x + ux * d, y: a.y + uy * d });
    }
    s = segEnd;
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
  if (period < EPS) return;
  let s = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen < EPS) continue;
    const ux = (b.x - a.x) / segLen;
    const uy = (b.y - a.y) / segLen;
    const segEnd = s + segLen;
    // Dash k spans global [k·period, k·period + dashLen]; iterate the k's that
    // overlap this segment and clip each to it.
    const kStart = Math.floor(s / period);
    for (let k = kStart, n = 0; k * period < segEnd; k++, n++) {
      if (n >= MAX_SPANS_PER_SEGMENT) break;
      const onStart = Math.max(k * period, s);
      const onEnd = Math.min(k * period + dashLen, segEnd);
      if (onEnd <= onStart) continue;
      const l0 = onStart - s;
      const l1 = onEnd - s;
      cb(
        { x: a.x + ux * l0, y: a.y + uy * l0 },
        { x: a.x + ux * l1, y: a.y + uy * l1 }
      );
    }
    s = segEnd;
  }
};
