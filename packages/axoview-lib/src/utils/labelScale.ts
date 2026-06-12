// Pure counter-scale math for the "keep labels readable" toggle (ADR 0015).
//
// Node name labels live inside the zoom-scaled SceneLayer, so their on-screen
// font size is `baseFontPx * zoom`. When the toggle is on and that drops below
// `minReadablePx`, we scale the label up by the reciprocal so the on-screen
// size holds at the legible floor — bounded so it can't grow without limit at
// extreme low zoom. Above the implied threshold (zoom ≥ minReadablePx /
// baseFontPx) the scale is exactly 1 (no change), matching the off behavior.

export interface LabelCounterScaleParams {
  /** Whether the "keep labels readable" toggle is on. */
  enabled: boolean;
  /** Base (unzoomed) label font size in px. */
  baseFontPx: number;
  /** Minimum on-screen font size to hold the label at, in px. */
  minReadablePx: number;
  /** Upper bound on the counter-scale factor. */
  maxCounterScale: number;
}

/**
 * The CSS scale factor to apply to a node label so it stays legible at the
 * given zoom. Returns 1 when the toggle is off, when geometry is degenerate,
 * or when the label is already at/above the readable floor.
 */
export const computeLabelCounterScale = (
  zoom: number,
  { enabled, baseFontPx, minReadablePx, maxCounterScale }: LabelCounterScaleParams
): number => {
  if (!enabled) return 1;
  if (zoom <= 0 || baseFontPx <= 0) return 1;

  const onScreenPx = baseFontPx * zoom;
  if (onScreenPx >= minReadablePx) return 1;

  const scale = minReadablePx / onScreenPx;
  return Math.min(scale, maxCounterScale);
};
