import { computeLabelCounterScale } from 'src/utils/labelScale';

// baseFontPx 14, minReadablePx 11 ⇒ threshold zoom = 11/14 ≈ 0.7857.
const base = { baseFontPx: 14, minReadablePx: 11, maxCounterScale: 4 };

describe('computeLabelCounterScale', () => {
  it('returns 1 when the toggle is off, regardless of zoom', () => {
    expect(computeLabelCounterScale(0.1, { ...base, enabled: false })).toBe(1);
    expect(computeLabelCounterScale(1, { ...base, enabled: false })).toBe(1);
  });

  it('returns 1 above the readable threshold (label already legible)', () => {
    // zoom 1 → on-screen 14px ≥ 11px floor.
    expect(computeLabelCounterScale(1, { ...base, enabled: true })).toBe(1);
    // exactly at threshold (on-screen == floor) → still 1.
    expect(
      computeLabelCounterScale(11 / 14, { ...base, enabled: true })
    ).toBe(1);
  });

  it('counter-scales below the threshold so on-screen size holds at the floor', () => {
    // zoom 0.5 → on-screen 7px; need scale 11/7 to reach 11px.
    const scale = computeLabelCounterScale(0.5, { ...base, enabled: true });
    expect(scale).toBeCloseTo(11 / 7, 6);
    // Effective on-screen size = baseFontPx * zoom * scale === minReadablePx.
    expect(14 * 0.5 * scale).toBeCloseTo(11, 6);
  });

  it('clamps to maxCounterScale at extreme low zoom', () => {
    // zoom 0.05 → uncapped scale would be 11/(14*0.05) ≈ 15.7; capped at 4.
    expect(computeLabelCounterScale(0.05, { ...base, enabled: true })).toBe(4);
  });

  it('guards degenerate inputs (zoom ≤ 0 or baseFontPx ≤ 0)', () => {
    expect(computeLabelCounterScale(0, { ...base, enabled: true })).toBe(1);
    expect(computeLabelCounterScale(-1, { ...base, enabled: true })).toBe(1);
    expect(
      computeLabelCounterScale(0.5, { ...base, enabled: true, baseFontPx: 0 })
    ).toBe(1);
  });

  it('scale never drops below 1 (only ever enlarges)', () => {
    for (const zoom of [0.05, 0.3, 0.5, 0.78, 0.79, 1, 2]) {
      expect(
        computeLabelCounterScale(zoom, { ...base, enabled: true })
      ).toBeGreaterThanOrEqual(1);
    }
  });
});
