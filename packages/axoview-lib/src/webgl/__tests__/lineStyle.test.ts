import { walkDots, walkDashes, buildAaLineQuad } from '../lineStyle';
import { Coords } from 'src/types';

// The walkers are pure geometry (no WebGL), so they run under jsdom directly —
// they are the exact class of bug (finding #4: float-cursor non-advancement →
// OOM) that CI could not otherwise catch, since pixels never render in jsdom.

const collectDots = (poly: Coords[], spacing: number): Coords[] => {
  const out: Coords[] = [];
  walkDots(poly, spacing, (p) => out.push(p));
  return out;
};

const collectDashes = (
  poly: Coords[],
  dashLen: number,
  gapLen: number
): [Coords, Coords][] => {
  const out: [Coords, Coords][] = [];
  walkDashes(poly, dashLen, gapLen, (p0, p1) => out.push([p0, p1]));
  return out;
};

describe('walkDots', () => {
  test('places dots at 0, spacing, 2·spacing … along a single segment', () => {
    const dots = collectDots(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      25
    );
    expect(dots).toEqual([
      { x: 0, y: 0 },
      { x: 25, y: 0 },
      { x: 50, y: 0 },
      { x: 75, y: 0 },
      { x: 100, y: 0 }
    ]);
  });

  test('arc-length is continuous across a corner (phase carries over)', () => {
    // (0,0)→(50,0)→(50,50): the vertex sits exactly on a dot (arc-length 50),
    // so the corner dot is shared by both segments.
    const dots = collectDots(
      [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 }
      ],
      25
    );
    // First segment: 0,25,50 · second: 50,75(→y25),100(→y50). The vertex dot at
    // arc-length 50 is emitted by both segments (benign duplicate at same point).
    expect(dots).toContainEqual({ x: 50, y: 25 });
    expect(dots).toContainEqual({ x: 50, y: 50 });
    // Down-leg dots advance in y, proving phase continued past the corner.
    expect(dots.filter((d) => d.x === 50 && d.y > 0)).toHaveLength(2);
  });

  test('spacing below epsilon is a no-op (never divides by ~0)', () => {
    expect(
      collectDots(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 }
        ],
        0
      )
    ).toEqual([]);
    expect(
      collectDots(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 }
        ],
        1e-9
      )
    ).toEqual([]);
  });

  test('degenerate zero-length segments are skipped', () => {
    const dots = collectDots(
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 40, y: 0 }
      ],
      20
    );
    expect(dots).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 40, y: 0 }
    ]);
  });

  test('a pathologically tiny spacing terminates at the span cap (finding #4)', () => {
    // Float-cursor accumulation used to stall here and grow the staging buffer
    // until it OOM'd. Integer indices always advance; MAX_SPANS_PER_SEGMENT caps
    // the count. ~100k theoretical dots → exactly the 20k backstop, and it
    // returns (this test would time out on the old non-advancing walker).
    const dots = collectDots(
      [
        { x: 0, y: 0 },
        { x: 1000, y: 0 }
      ],
      0.01
    );
    expect(dots).toHaveLength(20000);
  });
});

describe('walkDashes', () => {
  test('emits the "on" spans of a [dash, gap] pattern along a straight line', () => {
    const dashes = collectDashes(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      10,
      10
    );
    expect(dashes).toEqual([
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      [
        { x: 20, y: 0 },
        { x: 30, y: 0 }
      ],
      [
        { x: 40, y: 0 },
        { x: 50, y: 0 }
      ],
      [
        { x: 60, y: 0 },
        { x: 70, y: 0 }
      ],
      [
        { x: 80, y: 0 },
        { x: 90, y: 0 }
      ]
    ]);
  });

  test('a dash straddling a corner is split into two sub-spans meeting at the vertex', () => {
    // (0,0)→(10,0)→(10,10) with a 15px dash: dash 0 spans global [0,15], which
    // crosses the vertex at arc-length 10.
    const dashes = collectDashes(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 }
      ],
      15,
      5
    );
    // First sub-span runs to the vertex; the second resumes from it — same phase.
    expect(dashes[0]).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    ]);
    expect(dashes[1]).toEqual([
      { x: 10, y: 0 },
      { x: 10, y: 5 }
    ]);
  });

  test('period below epsilon is a no-op', () => {
    expect(
      collectDashes(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 }
        ],
        0,
        0
      )
    ).toEqual([]);
  });

  test('a pathologically tiny period terminates at the span cap (finding #4)', () => {
    const dashes = collectDashes(
      [
        { x: 0, y: 0 },
        { x: 1000, y: 0 }
      ],
      0.005,
      0.005
    );
    expect(dashes.length).toBeLessThanOrEqual(20000);
    expect(dashes.length).toBeGreaterThan(0);
  });
});

describe('buildAaLineQuad (analytic edge-AA prototype)', () => {
  test('a horizontal stroke centres on the segment and fattens by 2·feather', () => {
    const q = buildAaLineQuad({ x: 0, y: 0 }, { x: 10, y: 0 }, 4, 1);
    // Along-axis basis is the raw segment vector.
    expect(q.ux).toBeCloseTo(10, 10);
    expect(q.uy).toBeCloseTo(0, 10);
    // Perpendicular basis length = width + 2·feather = 6, pointing in ±y.
    expect(Math.hypot(q.vx, q.vy)).toBeCloseTo(6, 10);
    expect(q.vx).toBeCloseTo(0, 10);
    // Centred: localOrigin = -v/2, so the centreline (q.y=0.5) sits on the axis.
    expect(q.localOriginX).toBeCloseTo(-q.vx / 2, 10);
    expect(q.localOriginY).toBeCloseTo(-q.vy / 2, 10);
    expect(q.halfWidth).toBe(2);
    expect(q.feather).toBe(1);
  });

  test('the perpendicular basis is orthogonal to the segment at any angle', () => {
    const q = buildAaLineQuad({ x: 3, y: 1 }, { x: 9, y: 9 }, 5, 1.5);
    const dot = q.ux * q.vx + q.uy * q.vy;
    expect(dot).toBeCloseTo(0, 8);
    // Quad width still width + 2·feather regardless of orientation.
    expect(Math.hypot(q.vx, q.vy)).toBeCloseTo(5 + 2 * 1.5, 8);
    expect(q.halfWidth).toBe(2.5);
  });

  test('a degenerate zero-length segment collapses without NaN', () => {
    const q = buildAaLineQuad({ x: 5, y: 5 }, { x: 5, y: 5 }, 4, 1);
    for (const n of [
      q.anchorX,
      q.localOriginX,
      q.ux,
      q.uy,
      q.vx,
      q.vy,
      q.halfWidth
    ]) {
      expect(Number.isNaN(n)).toBe(false);
    }
  });
});
