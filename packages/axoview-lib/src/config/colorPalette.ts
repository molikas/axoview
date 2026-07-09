// Standard colour grid for the unified colour picker (ADR 0039). A fixed,
// code-owned palette — NOT the scene `colors` model palette (which stays a
// read-only legacy path for stored preset-ID references). Clicking a swatch
// commits the hex directly onto the element's `customColor` / `labelColor` /
// `borderColor` / `backgroundColor` field; no entry is added to the model.
//
// Layout mirrors the Google Docs / Slides custom-colour surface: a greyscale
// row on top, then a saturated base row, then progressively lighter tints and
// darker shades — 8 rows × 10 columns. Kept as a plain `as const` 2-D array
// (like ANNOTATION_COLOR_PRESETS) so it renders row-major with a stable column
// count and is trivially testable.
export const STANDARD_COLOR_PALETTE = [
  // Greyscale (black → white)
  ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff'],
  // Saturated base hues
  ['#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff'],
  // Tint 3 (lightest)
  ['#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc'],
  // Tint 2
  ['#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd'],
  // Tint 1
  ['#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0'],
  // Shade 1
  ['#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79'],
  // Shade 2
  ['#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47'],
  // Shade 3 (darkest)
  ['#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130']
] as const;
