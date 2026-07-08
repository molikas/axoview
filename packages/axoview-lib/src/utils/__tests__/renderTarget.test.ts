import {
  computeRenderTarget,
  computeBackingStore,
  DEFAULT_RENDER_CAPS
} from '../renderTarget';

// Small caps make the clamp boundary easy to reason about in tests.
const CAPS = { maxDimension: 1000, maxArea: 1000 * 1000 };

describe('computeRenderTarget', () => {
  describe('under the limit — passes through', () => {
    test('returns the requested scale and exact dimensions', () => {
      const t = computeRenderTarget({ width: 100, height: 50 }, 4, CAPS);
      expect(t.wasClamped).toBe(false);
      expect(t.effectiveScale).toBe(4);
      expect(t.width).toBe(400);
      expect(t.height).toBe(50 * 4);
      expect(t.requestedScale).toBe(4);
    });

    test('1× of a small diagram is never clamped', () => {
      const t = computeRenderTarget({ width: 800, height: 600 }, 1, CAPS);
      expect(t.wasClamped).toBe(false);
      expect(t.effectiveScale).toBe(1);
    });
  });

  describe('over the dimension limit — clamps + flags', () => {
    test('clamps the requested scale to the max dimension', () => {
      // 500 px wide × 4 = 2000 > maxDimension 1000 → effective scale 2.
      const t = computeRenderTarget({ width: 500, height: 100 }, 4, CAPS);
      expect(t.wasClamped).toBe(true);
      expect(t.effectiveScale).toBeCloseTo(2, 5);
      expect(t.width).toBe(1000);
      expect(Math.max(t.width, t.height)).toBeLessThanOrEqual(CAPS.maxDimension);
      // The user still asked for 4× — preserved for messaging.
      expect(t.requestedScale).toBe(4);
    });

    test('the longest side governs the clamp', () => {
      const t = computeRenderTarget({ width: 100, height: 900 }, 4, CAPS);
      expect(t.wasClamped).toBe(true);
      expect(t.height).toBeLessThanOrEqual(CAPS.maxDimension);
      expect(t.effectiveScale).toBeCloseTo(1000 / 900, 5);
    });
  });

  describe('over the area limit — clamps', () => {
    test('clamps when area cap is tighter than the dimension cap', () => {
      // 800×800 area cap = 640k. At scale 1.5, area = 800*1.5 squared each side
      // → 1200×1200 = 1.44M > 1M area, but each side 1200 > 1000 dim too.
      // Use a case where AREA binds first: wide-but-short bounds.
      const caps = { maxDimension: 100000, maxArea: 1000 * 1000 };
      const t = computeRenderTarget({ width: 800, height: 800 }, 4, caps);
      expect(t.wasClamped).toBe(true);
      // maxScale = sqrt(1e6 / (800*800)) = 1000/800 = 1.25
      expect(t.effectiveScale).toBeCloseTo(1.25, 5);
      expect(t.width * t.height).toBeLessThanOrEqual(caps.maxArea + 2000);
    });
  });

  describe('edge cases', () => {
    test('zero / negative bounds floor to 1px base, no throw', () => {
      const t = computeRenderTarget({ width: 0, height: 0 }, 2, CAPS);
      expect(t.width).toBeGreaterThanOrEqual(1);
      expect(t.height).toBeGreaterThanOrEqual(1);
    });

    test('non-finite / zero requested scale normalises to 1×', () => {
      expect(
        computeRenderTarget({ width: 100, height: 100 }, 0, CAPS).effectiveScale
      ).toBe(1);
      expect(
        computeRenderTarget({ width: 100, height: 100 }, NaN, CAPS).effectiveScale
      ).toBe(1);
    });

    test('default caps protect a 4× large diagram', () => {
      // ~5000px wide diagram at 4× = 20000px > 16384 default cap → must clamp.
      const t = computeRenderTarget({ width: 5000, height: 3000 }, 4);
      expect(t.wasClamped).toBe(true);
      expect(t.width).toBeLessThanOrEqual(DEFAULT_RENDER_CAPS.maxDimension);
      expect(t.height).toBeLessThanOrEqual(DEFAULT_RENDER_CAPS.maxDimension);
    });
  });
});

describe('computeBackingStore', () => {
  const CAPS = { maxDimension: 2000, maxArea: 2000 * 2000 };

  test('a normal viewport passes dpr through untouched', () => {
    const b = computeBackingStore(1000, 800, 2, CAPS);
    expect(b.wasClamped).toBe(false);
    expect(b.dpr).toBe(2);
    expect(b.width).toBe(2000);
    expect(b.height).toBe(1600);
  });

  test('a very-high-DPI large viewport clamps the effective dpr to fit the caps', () => {
    // 1000·4 = 4000 > maxDimension 2000 → effective dpr must drop to 2.
    const b = computeBackingStore(1000, 1000, 4, CAPS);
    expect(b.wasClamped).toBe(true);
    expect(b.dpr).toBeCloseTo(2, 5);
    expect(Math.max(b.width, b.height)).toBeLessThanOrEqual(CAPS.maxDimension);
  });

  test('dpr 1 on a modest viewport is never clamped', () => {
    const b = computeBackingStore(1440, 900, 1, CAPS);
    expect(b.wasClamped).toBe(false);
    expect(b.dpr).toBe(1);
    expect(b.width).toBe(1440);
    expect(b.height).toBe(900);
  });

  test('default caps guard a 4K viewport at dpr 3 (4·dpr would exceed 16384)', () => {
    const b = computeBackingStore(3840, 2160, 3);
    // 3840·3 = 11520 < 16384, so this specific case is NOT clamped — documents
    // that the guard only trips at genuinely extreme sizes.
    expect(b.wasClamped).toBe(false);
    expect(b.width).toBe(11520);
  });

  test('an 8K-wide viewport at dpr 3 does clamp under the default caps', () => {
    const b = computeBackingStore(8000, 8000, 3);
    expect(b.wasClamped).toBe(true);
    expect(b.width).toBeLessThanOrEqual(DEFAULT_RENDER_CAPS.maxDimension);
    expect(b.height).toBeLessThanOrEqual(DEFAULT_RENDER_CAPS.maxDimension);
  });
});
