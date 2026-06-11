// Re-export type from canonical location for backwards compatibility.
export type { LabelSettings } from 'src/types/settings';
import type { LabelSettings } from 'src/types/settings';

export const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  expandButtonPadding: 0
};

// "Keep labels readable" tuning (ADR 0015). Tunable here without code edits.
//
// Below the implied threshold (zoom < minReadablePx / baseFontPx) a node name
// label counter-scales up so its on-screen font size never drops below
// LABEL_MIN_READABLE_PX, bounded by LABEL_MAX_COUNTER_SCALE so it can't grow
// without limit at extreme low zoom. Only applies when uiState.readableLabels
// is on; off by default.
export const LABEL_MIN_READABLE_PX = 11;
export const LABEL_MAX_COUNTER_SCALE = 4;
/** Base (unzoomed) node label font size — matches Node.tsx's default labelFontSize. */
export const LABEL_BASE_FONT_PX = 14;
