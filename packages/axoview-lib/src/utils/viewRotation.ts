// Turntable view rotation — pure math (ADR 0049).
//
// The model's tile grid never changes. Rotation is a VIEW transform: before a
// tile is projected it is turned about the tile-space origin by θ,
// `(x′, y′) = R(θ)·(x, y)`, and the inverse is applied on the way back. Iso
// sprites stay upright as billboards; everything on the ground plane turns.
//
// There is NO module state here. θ lives only in each instance's
// `uiState.viewRotation` and reaches the projection as a value — the strategy
// `makeIsometricStrategy(θ)` builds (coordinateTransforms.ts). Two <Axoview>
// instances on one page (the export dialog mounts a hidden one) therefore
// rotate independently (ADR 0049 §1, finding F1).

/** A CSS `matrix(a, b, c, d, e, f)` as its six components. */
export type IsoMatrix = [number, number, number, number, number, number];

/** A row-major 2×2 matrix `[m00, m01, m10, m11]`. */
export type Mat2 = readonly [number, number, number, number];

/** cos θ / sin θ of a view angle. */
export interface RotationTrig {
  readonly cos: number;
  readonly sin: number;
}

/**
 * Normalise to (−180, 180]. Returns +0, never −0, so the result is safe as a
 * cache key and in `===` comparisons against 0.
 */
export const normaliseDeg = (deg: number): number => {
  if (!Number.isFinite(deg)) return 0;
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d === 0 ? 0 : d;
};

/**
 * The view angle as people read it: a BEARING, clockwise positive — the way a
 * compass, a clock and CSS `rotate()` count. θ itself stays the math angle
 * (counter-clockwise positive, so E — which turns the floor clockwise on
 * screen — lowers it); only what is SHOWN is flipped. Whole degrees; never "-0°".
 */
export const formatViewAngle = (theta: number): string =>
  `${Math.round(normaliseDeg(-theta)) || 0}°`;

/**
 * cos/sin of a view angle, EXACT at the cardinal angles (0°, ±90°, 180°).
 *
 * `Math.cos(Math.PI / 2)` is 6e-17, not 0. At a cardinal angle that noise is
 * the only thing separating two tiles' depths, so the painter and the picker
 * could disagree about which of two tied nodes is on top (finding F5). With
 * exact trig a tie is a true tie and falls through to stable model order.
 */
export const rotationTrig = (deg: number): RotationTrig => {
  const d = normaliseDeg(deg);
  if (d === 0) return { cos: 1, sin: 0 };
  if (d === 90) return { cos: 0, sin: 1 };
  if (d === 180) return { cos: -1, sin: 0 };
  if (d === -90) return { cos: 0, sin: -1 };
  const rad = (d * Math.PI) / 180;
  return { cos: Math.cos(rad), sin: Math.sin(rad) };
};

/** R(θ)·(x, y): turn a (possibly fractional) tile about the tile origin. */
export const rotateTile = (
  x: number,
  y: number,
  t: RotationTrig
): { x: number; y: number } => ({
  x: x * t.cos - y * t.sin,
  y: x * t.sin + y * t.cos
});

/** R(−θ)·(x, y): the inverse of {@link rotateTile}. */
export const unrotateTile = (
  x: number,
  y: number,
  t: RotationTrig
): { x: number; y: number } => ({
  x: x * t.cos + y * t.sin,
  y: -x * t.sin + y * t.cos
});

/**
 * The post-projection offset map `M(θ) = P·R(θ)·P⁻¹` (ADR 0049 §4), where P is
 * the iso tile→screen map and `κ = halfW / halfH`:
 *
 *   M(θ) = [[cos θ, κ·sin θ], [−sin θ / κ, cos θ]],   det M = 1,   M(θ)⁻¹ = M(−θ)
 *
 * A stored off-grid `offset` is a residual in the UNROTATED projection's frame;
 * rendering applies `M(θ)·offset`, so the residual turns with its tile.
 */
export const offsetMatrix = (t: RotationTrig, kappa: number): Mat2 => [
  t.cos,
  kappa * t.sin,
  -t.sin / kappa,
  t.cos
];

/** `m·v` for a row-major 2×2. */
export const applyMat2 = (
  m: Mat2,
  v: { x: number; y: number }
): { x: number; y: number } => ({
  x: m[0] * v.x + m[1] * v.y,
  y: m[2] * v.x + m[3] * v.y
});

/**
 * CSS matrix(a,b,c,d,e,f) taking an element's local UNPROJECTED px axes onto
 * the (possibly rotated) isometric ground plane. Orientation 'X': local u →
 * tile +x, v → tile −y; 'Y': u → tile −y, v → tile −x.
 *
 * `K1`/`K2` are the iso half-extents per px. The DOM CSS matrix has always used
 * the 3-decimal literals below; the WebGL area quad uses the exact ratio derived
 * from TILE_PROJECTION_MULTIPLIERS (renderedGeometry ISO_A..D, R1/PROJ-06). Each
 * caller passes its own, so rotation changes neither path's 0° output. With the
 * exact trig of {@link rotationTrig}, θ = 0 reproduces the historical literals
 * bit for bit (`K·(1 − 0) === K`).
 */
export const isoPlaneMatrix = (
  orientation: 'X' | 'Y' | undefined,
  t: RotationTrig,
  K1 = 0.707,
  K2 = 0.409
): IsoMatrix => {
  const c = t.cos;
  const s = t.sin;
  return orientation === 'Y'
    ? [K1 * (c + s), K2 * (c - s), K1 * (s - c), K2 * (c + s), 0, -0.816]
    : [K1 * (c - s), -K2 * (c + s), K1 * (c + s), K2 * (c - s), 0, -0.816];
};

/**
 * The shortest signed arc from `from` to `to`, in (−180, 180]. Animations read
 * it so a step past ±180° never spins the long way round.
 */
export const shortestArc = (from: number, to: number): number =>
  normaliseDeg(to - from);

/**
 * Total width of the keep-upright hysteresis band, centred on each boundary
 * (ADR 0050 §2): ±5°.
 */
export const KEEP_UPRIGHT_BAND_DEG = 10;

/**
 * Keep-upright for floor-readable content (ADR 0050 §2): should an element of
 * this orientation be drawn rotated 180° within its own plane at view angle
 * `deg`, so its text / logo never reads upside-down?
 *
 * An element's reading direction is its local +u axis through the rotated
 * plane; its on-screen x component is `cos θ − sin θ` for 'X' (and flat icons)
 * and `cos θ + sin θ` for 'Y', i.e. ∝ cos(θ ± 45°). It "reads leftward" when
 * that is negative — X for θ ∈ (45°, 180°] ∪ (−180°, −135°), Y for
 * θ ∈ (135°, 180°] ∪ (−180°, −45°).
 *
 * HYSTERESIS: within half the band of a boundary the element keeps its
 * `previous` state, so one resting near a boundary (an Alt+drag let go at 46°,
 * then nudged to 44°) does not flip back and forth. The flip never mirrors —
 * the determinant stays positive — and never changes the footprint.
 */
export const keepUprightFlip = (
  orientation: 'X' | 'Y',
  deg: number,
  previous = false
): boolean => {
  const phase = orientation === 'Y' ? -45 : 45;
  const ux = Math.cos(((normaliseDeg(deg) + phase) * Math.PI) / 180);
  const band = Math.sin(((KEEP_UPRIGHT_BAND_DEG / 2) * Math.PI) / 180);
  return previous ? ux < band : ux < -band;
};

/** The rotation step of the dock buttons and Q/E (ADR 0049 §7). */
export const VIEW_ROTATION_STEP_DEG = 15;

/**
 * The next multiple of `step` strictly beyond `current` in `direction`
 * (+1 = the angle grows), normalised. 37° → 45° / 30°; 45° → 60° / 30°. A
 * float that is a hair off a lattice point counts as on it, so a settled 45°
 * never steps to 45°.
 */
export const nextLatticeAngle = (
  current: number,
  direction: 1 | -1,
  step: number = VIEW_ROTATION_STEP_DEG
): number => {
  const k = current / step;
  const EPS = 1e-6;
  const nextK =
    direction > 0 ? Math.floor(k + EPS) + 1 : Math.ceil(k - EPS) - 1;
  return normaliseDeg(nextK * step);
};
