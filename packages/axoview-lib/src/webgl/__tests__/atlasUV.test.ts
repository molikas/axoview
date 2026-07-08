import { atlasUVRect } from '../glSpriteBatch';

// The half-texel inset is pure math extracted from createSpriteBatch's closure so
// it can be checked without a live GL context (jsdom has none). It is the fix for
// finding #2 (partial grey chip border) and the classic atlas-seam bleed: LINEAR
// sampling at a slot edge must never reach into the neighbouring gutter.

const ATLAS = 4096;

describe('atlasUVRect (half-texel inset)', () => {
  test('origin is nudged +½ texel and the span shrunk by one full texel', () => {
    const uv = atlasUVRect(0, 0, 64, 64, ATLAS);
    expect(uv.u0).toBeCloseTo(0.5 / ATLAS, 10);
    expect(uv.v0).toBeCloseTo(0.5 / ATLAS, 10);
    expect(uv.uS).toBeCloseTo(63 / ATLAS, 10);
    expect(uv.vS).toBeCloseTo(63 / ATLAS, 10);
  });

  test('the sampled band stays strictly inside the packed slot (no gutter bleed)', () => {
    const x = 100;
    const y = 200;
    const w = 32;
    const h = 48;
    const uv = atlasUVRect(x, y, w, h, ATLAS);
    // Slot occupies texels [x, x+w) / atlas. The sampled band [u0, u0+uS] must sit
    // inside it with a half-texel margin on BOTH edges.
    expect(uv.u0).toBeGreaterThan(x / ATLAS);
    expect(uv.u0 + uv.uS).toBeLessThan((x + w) / ATLAS);
    expect(uv.v0).toBeGreaterThan(y / ATLAS);
    expect(uv.v0 + uv.vS).toBeLessThan((y + h) / ATLAS);
  });

  test('the inset is symmetric — a border is not trimmed on one side (finding #2)', () => {
    const x = 100;
    const w = 32;
    const uv = atlasUVRect(x, 0, w, 10, ATLAS);
    const leading = uv.u0 - x / ATLAS; // texels of margin before the band
    const trailing = (x + w) / ATLAS - (uv.u0 + uv.uS); // margin after
    expect(leading).toBeCloseTo(0.5 / ATLAS, 10);
    expect(trailing).toBeCloseTo(0.5 / ATLAS, 10);
    expect(leading).toBeCloseTo(trailing, 12);
  });

  test('a 1px slot collapses to a zero-size UV at the texel centre (the white/dot texel)', () => {
    const uv = atlasUVRect(7, 9, 1, 1, ATLAS);
    expect(uv.uS).toBe(0);
    expect(uv.vS).toBe(0);
    expect(uv.u0).toBeCloseTo(7.5 / ATLAS, 10);
    expect(uv.v0).toBeCloseTo(9.5 / ATLAS, 10);
  });

  test('all coordinates are normalised into [0, 1]', () => {
    const uv = atlasUVRect(4000, 4000, 64, 64, ATLAS);
    for (const c of [uv.u0, uv.v0, uv.u0 + uv.uS, uv.v0 + uv.vS]) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });
});
