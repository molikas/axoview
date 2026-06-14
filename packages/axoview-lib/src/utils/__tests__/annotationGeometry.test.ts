import {
  screenToSceneCanvas,
  polylinePathD,
  arrowHeadPoints,
  rectFromPoints,
  pointToSegmentDistance,
  strokeHitByEraser
} from 'src/utils/annotationGeometry';

const rendererSize = { width: 800, height: 600 };

describe('screenToSceneCanvas', () => {
  it('maps the viewport center to the canvas point under it (-scroll/zoom)', () => {
    const scroll = { x: -200, y: 120 };
    const zoom = 0.5;
    const center = { x: rendererSize.width / 2, y: rendererSize.height / 2 };
    const p = screenToSceneCanvas(center, rendererSize, scroll, zoom);
    expect(p.x).toBeCloseTo(-scroll.x / zoom, 6);
    expect(p.y).toBeCloseTo(-scroll.y / zoom, 6);
  });

  it('inverts the SceneLayer forward transform exactly', () => {
    const scroll = { x: 40, y: -75 };
    const zoom = 1.3;
    const canvas = { x: 33, y: -52 };
    // Forward: screen = rendererCenter + scroll + zoom·canvas
    const screen = {
      x: rendererSize.width / 2 + scroll.x + zoom * canvas.x,
      y: rendererSize.height / 2 + scroll.y + zoom * canvas.y
    };
    const back = screenToSceneCanvas(screen, rendererSize, scroll, zoom);
    expect(back.x).toBeCloseTo(canvas.x, 6);
    expect(back.y).toBeCloseTo(canvas.y, 6);
  });
});

describe('polylinePathD', () => {
  it('returns empty string for no points', () => {
    expect(polylinePathD([])).toBe('');
  });

  it('builds a moveto + linetos path', () => {
    expect(
      polylinePathD([
        { x: 0, y: 0 },
        { x: 10, y: 5 },
        { x: 20, y: -3 }
      ])
    ).toBe('M 0 0 L 10 5 L 20 -3');
  });
});

describe('arrowHeadPoints', () => {
  it('returns [] for a zero-length segment', () => {
    expect(arrowHeadPoints({ x: 5, y: 5 }, { x: 5, y: 5 }, 10)).toEqual([]);
  });

  it('produces two wings behind the tip, symmetric about the shaft', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 10, y: 0 }; // pointing +x
    const wings = arrowHeadPoints(from, to, 10);
    expect(wings).toHaveLength(2);
    const [w1, w2] = wings as [{ x: number; y: number }, { x: number; y: number }];
    // Both wings sit behind the tip (smaller x) and mirror across y=0.
    expect(w1.x).toBeLessThan(to.x);
    expect(w2.x).toBeLessThan(to.x);
    expect(w1.y).toBeCloseTo(-w2.y, 6);
  });
});

describe('rectFromPoints', () => {
  it('normalises any two corners to top-left + size', () => {
    expect(rectFromPoints({ x: 30, y: 10 }, { x: 5, y: 40 })).toEqual({
      x: 5,
      y: 10,
      width: 25,
      height: 30
    });
  });
});

describe('pointToSegmentDistance', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 10, y: 0 };

  it('measures perpendicular distance to a point above the segment', () => {
    expect(pointToSegmentDistance({ x: 5, y: 4 }, a, b)).toBeCloseTo(4, 6);
  });

  it('clamps to the nearest endpoint when the projection falls off the segment', () => {
    // Beyond b: nearest point is b itself.
    expect(pointToSegmentDistance({ x: 13, y: 0 }, a, b)).toBeCloseTo(3, 6);
  });

  it('treats a degenerate (zero-length) segment as a point', () => {
    expect(pointToSegmentDistance({ x: 3, y: 4 }, a, a)).toBeCloseTo(5, 6);
  });
});

describe('strokeHitByEraser', () => {
  const freehand = {
    tool: 'pencil' as const,
    thickness: 2,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 }
    ]
  };

  it('hits a thin line when the cursor is within the radius (no direct hit needed)', () => {
    // 10 units above the line — misses a pixel-perfect click, caught by radius.
    expect(strokeHitByEraser(freehand, { x: 50, y: 10 }, 12)).toBe(true);
  });

  it('misses when the cursor is outside radius + half-thickness', () => {
    expect(strokeHitByEraser(freehand, { x: 50, y: 40 }, 12)).toBe(false);
  });

  it('hits a rectangle outline but not its hollow interior', () => {
    const rect = {
      tool: 'rectangle' as const,
      thickness: 2,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 }
      ]
    };
    // Near the top edge → hit.
    expect(strokeHitByEraser(rect, { x: 50, y: 2 }, 6)).toBe(true);
    // Dead center of an unfilled rectangle → miss.
    expect(strokeHitByEraser(rect, { x: 50, y: 50 }, 6)).toBe(false);
  });

  it('accounts for the highlighter wider footprint', () => {
    const hl = {
      tool: 'highlighter' as const,
      thickness: 8, // drawn at 8 * 2.5 = 20 wide ⇒ half-width 10
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ]
    };
    // 14 above the centre line: pencil-width would miss, highlighter half-width
    // (10) + radius (5) = 15 ≥ 14 ⇒ hit.
    expect(strokeHitByEraser(hl, { x: 50, y: 14 }, 5)).toBe(true);
  });
});
