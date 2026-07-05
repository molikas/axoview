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
/**
 * Base (unzoomed) font size for on-canvas labels — node labels, floating
 * Labels, and connector labels all default to this. Bumped 14 → 18 (2026-07-01)
 * so labels read well at typical zoom without the user hand-bumping every one;
 * 18px is the readable sweet spot for on-canvas chrome text. Explicitly-sized
 * labels are unaffected.
 */
export const LABEL_BASE_FONT_PX = 18;
