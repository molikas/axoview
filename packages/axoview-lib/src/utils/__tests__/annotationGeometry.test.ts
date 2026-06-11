import {
  screenToSceneCanvas,
  polylinePathD,
  arrowHeadPoints,
  rectFromPoints
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
