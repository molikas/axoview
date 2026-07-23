import chroma from 'chroma-js';
import { clamp, getColorVariant } from '../common';

describe('Tests common utilities', () => {
  test('clamp() works correctly', () => {
    const clampNoChange = clamp(5, 0, 10);
    const clampMin = clamp(5, 6, 10);
    const clampMax = clamp(5, 0, 3);
    const clampDraw1 = clamp(5, 5, 10);
    const clampDraw2 = clamp(5, 0, 5);

    expect(clampNoChange).toBe(5);
    expect(clampMin).toBe(6);
    expect(clampMax).toBe(3);
    expect(clampDraw1).toBe(5);
    expect(clampDraw2).toBe(5);
  });

  describe('getColorVariant', () => {
    // The "grey connector renders orange" bug: `.saturate()` on a neutral grey
    // fabricated a warm hue. The 'dark' variant must keep achromatic input
    // achromatic while still saturating real hues.
    const chromaOf = (c: string) => chroma(c).get('lch.c');

    test.each(['#000000', '#434343', '#999999', '#cccccc', '#ffffff'])(
      'dark variant keeps greyscale %s neutral (no fabricated hue)',
      (grey) => {
        const out = getColorVariant(grey, 'dark', { grade: 1 });
        // A true grey has ~0 LCH chroma; allow a tiny rounding epsilon.
        expect(chromaOf(out)).toBeLessThan(1);
      }
    );

    test('dark variant still darkens greyscale (not a no-op)', () => {
      const out = getColorVariant('#999999', 'dark', { grade: 1 });
      expect(chroma(out).luminance()).toBeLessThan(chroma('#999999').luminance());
    });

    test('dark variant still saturates a hued colour (unchanged behaviour)', () => {
      const base = '#4a86e8';
      const out = getColorVariant(base, 'dark', { grade: 1 });
      // Coloured input keeps the darken+saturate path — chroma should not drop.
      expect(chromaOf(out)).toBeGreaterThan(chromaOf(base) - 1);
      expect(chroma(out).luminance()).toBeLessThan(chroma(base).luminance());
    });
  });
});
