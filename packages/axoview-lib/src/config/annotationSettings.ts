// Tunables for the ephemeral annotation overlay (ADR 0014).

/** Fixed preset palette of popular annotation colors. */
export const ANNOTATION_COLOR_PRESETS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
  '#111827', // near-black
  '#ffffff' // white
] as const;

/** Selectable stroke thicknesses (px, in scene-canvas units). */
export const ANNOTATION_THICKNESS_PRESETS = [2, 4, 8, 16] as const;

/** Highlighter is drawn semi-transparent and thicker-feeling than its nominal width. */
export const HIGHLIGHTER_OPACITY = 0.35;
