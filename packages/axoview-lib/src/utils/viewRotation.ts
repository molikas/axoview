// POC — horizontal (turntable) view rotation for the ISOMETRIC projection.
//
// The model's tile grid never changes. The rotation is a pure VIEW transform:
// every tile (x, y) is rotated about the tile-space origin by `angle` BEFORE it
// is projected onto the screen, so the ground plane spins like a turntable while
// isometric icon sprites (pre-rendered, fixed-viewpoint art) stay upright as
// billboards — a cheap simulation of orbiting the camera around the vertical axis.
//
// Module-level mutable state (rather than React state) so the pure projection
// helpers (strategy.toScreen/fromScreen, isoMath.*) can read it without being
// threaded through every call site. The UI store mirrors the value
// (`viewRotation`, degrees) to trigger re-renders; always change it through
// `uiState.actions.setViewRotation`, which keeps the two in sync and re-centres
// the viewport on the tile that was under the screen centre.

let angleRad = 0;
let cos = 1;
let sin = 0;

export const getViewRotationRad = () => angleRad;

export const setViewRotationRad = (rad: number) => {
  angleRad = rad;
  cos = Math.cos(rad);
  sin = Math.sin(rad);
};

export const isViewRotated = () => angleRad !== 0;

/** Rotate a (possibly fractional) tile coordinate about the origin. */
export const rotateTile = (x: number, y: number): { x: number; y: number } =>
  angleRad === 0
    ? { x, y }
    : { x: x * cos - y * sin, y: x * sin + y * cos };

/** Inverse of {@link rotateTile}. */
export const unrotateTile = (x: number, y: number): { x: number; y: number } =>
  angleRad === 0
    ? { x, y }
    : { x: x * cos + y * sin, y: -x * sin + y * cos };

/**
 * Painter's-order depth of a tile under the current rotation: larger = nearer the
 * viewer. Equals `-x - y` (the original iso depth) while unrotated.
 */
export const viewDepth = (tile: { x: number; y: number }): number => {
  const r = rotateTile(tile.x, tile.y);
  return -r.x - r.y;
};

export type IsoMatrix = [number, number, number, number, number, number];

/**
 * CSS matrix(a,b,c,d,e,f) taking an element's local UNPROJECTED px axes onto the
 * (possibly rotated) isometric ground plane. Orientation 'X': local u → tile
 * +x, v → tile −y; 'Y': u → tile −y, v → tile −x. Bit-identical to the original
 * constants while the view is unrotated.
 */
export const getRotatedIsoMatrix = (
  orientation?: 'X' | 'Y',
  // The iso half-extents per px. The DOM CSS matrix has always used the 3-decimal
  // literals below; the WebGL area quad uses the exact ratio derived from
  // TILE_PROJECTION_MULTIPLIERS (renderedGeometry ISO_A..D, R1/PROJ-06) — each
  // caller passes its own so rotation changes neither path's 0° output.
  K1 = 0.707,
  K2 = 0.409
): IsoMatrix => {
  if (angleRad === 0) {
    return orientation === 'Y'
      ? [K1, K2, -K1, K2, 0, -0.816]
      : [K1, -K2, K1, K2, 0, -0.816];
  }
  const c = cos;
  const s = sin;
  return orientation === 'Y'
    ? [K1 * (c + s), K2 * (c - s), K1 * (s - c), K2 * (c + s), 0, -0.816]
    : [K1 * (c - s), -K2 * (c + s), K1 * (c + s), K2 * (c - s), 0, -0.816];
};

export const degToRad = (deg: number) => (deg * Math.PI) / 180;

/** Normalise to (-180, 180]. */
export const normaliseDeg = (deg: number) => {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
};
