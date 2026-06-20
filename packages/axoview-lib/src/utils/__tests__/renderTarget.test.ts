import { computeRenderTarget, DEFAULT_RENDER_CAPS } from '../renderTarget';

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
