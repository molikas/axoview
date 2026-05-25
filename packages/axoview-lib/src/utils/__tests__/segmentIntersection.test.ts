import {
  segmentsIntersect,
  segmentIntersectsRect,
  segmentIntersectsPolygon
} from '../segmentIntersection';

describe('segmentsIntersect', () => {
  it('returns true for two crossing segments', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })
    ).toBe(true);
  });

  it('returns false for two parallel segments', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 })
    ).toBe(false);
  });

  it('returns false for two non-touching segments', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 5, y: 5 }, { x: 7, y: 7 })
    ).toBe(false);
  });

  it('returns true when segments share an endpoint (T-intersection)', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 10 })
    ).toBe(true);
  });

  it('returns true for collinear overlapping segments', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 })
    ).toBe(true);
  });

  it('returns false for collinear non-overlapping segments', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 15, y: 0 })
    ).toBe(false);
  });
});

describe('segmentIntersectsRect', () => {
  const rect = [
    { x: 2, y: 2 },
    { x: 8, y: 6 }
  ];

  it('returns true when segment crosses through the rect (both endpoints outside)', () => {
    expect(
      segmentIntersectsRect({ x: 0, y: 4 }, { x: 10, y: 4 }, rect)
    ).toBe(true);
  });

  it('returns true when segment lies entirely inside the rect', () => {
    expect(
      segmentIntersectsRect({ x: 3, y: 3 }, { x: 5, y: 5 }, rect)
    ).toBe(true);
  });

  it('returns true when one endpoint is inside the rect', () => {
    expect(
      segmentIntersectsRect({ x: 5, y: 4 }, { x: 15, y: 4 }, rect)
    ).toBe(true);
  });

  it('returns true when one endpoint is exactly on the rect boundary', () => {
    expect(
      segmentIntersectsRect({ x: 2, y: 4 }, { x: -5, y: 4 }, rect)
    ).toBe(true);
  });

  it('returns false when segment is entirely outside the rect (above)', () => {
    expect(
      segmentIntersectsRect({ x: 0, y: 0 }, { x: 10, y: 0 }, rect)
    ).toBe(false);
  });

  it('returns false when segment is entirely outside the rect (to the side)', () => {
    expect(
      segmentIntersectsRect({ x: 10, y: 0 }, { x: 10, y: 10 }, rect)
    ).toBe(false);
  });

  it('accepts the rect corners in either order (mirrors isWithinBounds)', () => {
    const flipped = [
      { x: 8, y: 6 },
      { x: 2, y: 2 }
    ];
    expect(
      segmentIntersectsRect({ x: 0, y: 4 }, { x: 10, y: 4 }, flipped)
    ).toBe(true);
  });

  it('REGRESSION (2026-05-25 screenshot) — diagonal connector path crosses a horizontal lasso strip between its two node-bound endpoints', () => {
    // Repro of the user's screenshot: connector from (1, 1) to (9, 9), lasso
    // is a horizontal strip across the middle. Both endpoints outside, but
    // the diagonal path must register as a hit.
    const lasso = [
      { x: 0, y: 4 },
      { x: 10, y: 6 }
    ];
    expect(
      segmentIntersectsRect({ x: 1, y: 1 }, { x: 9, y: 9 }, lasso)
    ).toBe(true);
  });
});

describe('segmentIntersectsPolygon', () => {
  const triangle = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 5, y: 10 }
  ];

  it('returns false for degenerate polygon (< 3 vertices)', () => {
    expect(
      segmentIntersectsPolygon({ x: 0, y: 0 }, { x: 1, y: 1 }, [{ x: 0, y: 0 }, { x: 1, y: 1 }])
    ).toBe(false);
  });

  it('returns true when segment crosses through the polygon (both endpoints outside)', () => {
    expect(
      segmentIntersectsPolygon({ x: -5, y: 3 }, { x: 15, y: 3 }, triangle)
    ).toBe(true);
  });

  it('returns true when segment lies entirely inside the polygon', () => {
    expect(
      segmentIntersectsPolygon({ x: 4, y: 2 }, { x: 6, y: 2 }, triangle)
    ).toBe(true);
  });

  it('returns false when segment is entirely outside the polygon', () => {
    expect(
      segmentIntersectsPolygon({ x: 0, y: -5 }, { x: 10, y: -5 }, triangle)
    ).toBe(false);
  });
});
