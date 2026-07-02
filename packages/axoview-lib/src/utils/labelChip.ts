// Shared geometry + draw for the floating Label chip (ADR 0031). Used by BOTH
// the Canvas2D render layer (LabelsCanvas) and the DOM hit-proxy (LabelHitLayer)
// so the painted chip and its hit box can never drift. Mirrors the node-label
// chip geometry in NodesCanvas (padding / radius / max-width) for a consistent
// look, but is self-contained so the perf-critical NodesCanvas stays untouched.

import { Label } from 'src/types';
import { DEFAULT_FONT_FAMILY } from 'src/config';
import { LABEL_BASE_FONT_PX } from 'src/config/labelSettings';

// Chip padding / radius. Kept as plain constants (not theme-derived) so the
// pure measure path can run without a React/theme context; the colours ARE
// theme-derived and passed in by the caller (see ChipColors).
export const LABEL_CHIP_PAD_X = 12;
export const LABEL_CHIP_PAD_Y = 8;
export const LABEL_CHIP_MAX_W = 320;
export const LABEL_CHIP_RADIUS = 8;
const LINE_H_FACTOR = 1.5;

/** Effective px font for a label (absent / non-positive = the base size). */
export const labelFontPx = (label: Pick<Label, 'fontSize'>): number =>
  label.fontSize && label.fontSize > 0 ? label.fontSize : LABEL_BASE_FONT_PX;

export const labelChipFont = (
  fontSize: number,
  bold?: boolean,
  italic?: boolean
): string =>
  `${italic ? 'italic ' : ''}${bold ? 700 : 400} ${fontSize}px ${DEFAULT_FONT_FAMILY}`;

export interface LabelChipLayout {
  lines: string[];
  // Per-line measured width, cached with the layout so the strikethrough rule
  // needs no per-frame measureText.
  lineWidths: number[];
  lineH: number;
  chipW: number;
  chipH: number;
}

// Rounded-rect path with a manual fallback: ctx.roundRect throws on the app's
// older supported browsers (Safari <16.4, Firefox <112), which would blank the
// whole layer (same guard as NodesCanvas).
export const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void => {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

// Measure the chip for `text` at the given font. Multi-line via explicit "\n"
// (auto word-wrap is deferred); the chip width is clamped to LABEL_CHIP_MAX_W.
// `ctx` may be a draw context or a throwaway offscreen one — only its font /
// measureText are used. Mutates ctx.font.
export const measureLabelChip = (
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  bold?: boolean,
  italic?: boolean
): LabelChipLayout => {
  ctx.font = labelChipFont(fontSize, bold, italic);
  const lines = (text || '').split('\n');
  const lineWidths = lines.map((line) => ctx.measureText(line).width);
  const widest = lineWidths.reduce((a, b) => Math.max(a, b), 0);
  const innerMaxW = LABEL_CHIP_MAX_W - LABEL_CHIP_PAD_X * 2;
  const innerW = Math.min(innerMaxW, widest);
  const lineH = fontSize * LINE_H_FACTOR;
  return {
    lines,
    lineWidths,
    lineH,
    chipW: innerW + LABEL_CHIP_PAD_X * 2,
    chipH: lines.length * lineH + LABEL_CHIP_PAD_Y * 2
  };
};

// Convenience: measure a label's chip using a module-owned offscreen context,
// for DOM consumers that have no draw ctx (LabelTransformControls / hit-proxy).
// Null only when no 2D context is available (SSR / some test envs).
let offscreenCtx: CanvasRenderingContext2D | null | undefined;
export const measureLabelChipOffscreen = (
  label: Pick<Label, 'text' | 'fontSize' | 'isBold' | 'isItalic'>
): LabelChipLayout | null => {
  if (offscreenCtx === undefined) {
    offscreenCtx =
      typeof document === 'undefined'
        ? null
        : document.createElement('canvas').getContext('2d');
  }
  if (!offscreenCtx) return null;
  return measureLabelChip(
    offscreenCtx,
    label.text,
    labelFontPx(label),
    label.isBold,
    label.isItalic
  );
};

export interface ChipColors {
  bg: string;
  border: string;
  text: string;
}

// Draw a label chip CENTERED at (cx, cy) in the CURRENT (already pan/zoom
// transformed) canvas space, using a PRECOMPUTED layout (the caller caches it
// per (text, fontSize, bold, italic) so pan/zoom redraws skip measureText —
// mirrors NodesCanvas's label-layout cache). Per-label backgroundColor / color
// override the theme defaults. Strikethrough is drawn manually (Canvas2D has no
// text-decoration), per line, from the cached line widths.
export const drawLabelChip = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  label: Label,
  layout: LabelChipLayout,
  colors: ChipColors
): void => {
  const fontSize = labelFontPx(label);
  const { lines, lineWidths, lineH, chipW, chipH } = layout;
  const x0 = cx - chipW / 2;
  const y0 = cy - chipH / 2;

  roundRectPath(ctx, x0, y0, chipW, chipH, LABEL_CHIP_RADIUS);
  // The chip background can be translucent (backgroundOpacity); scope the alpha
  // to the fill only so the border + text stay fully opaque.
  const bgAlpha = label.backgroundOpacity ?? 1;
  if (bgAlpha < 1) ctx.globalAlpha = bgAlpha;
  ctx.fillStyle = label.backgroundColor || colors.bg;
  ctx.fill();
  if (bgAlpha < 1) ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.border;
  ctx.stroke();

  const textColor = label.color || colors.text;
  ctx.font = labelChipFont(fontSize, label.isBold, label.isItalic);
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const textX = x0 + LABEL_CHIP_PAD_X;
  for (let i = 0; i < lines.length; i += 1) {
    const lineTop = y0 + LABEL_CHIP_PAD_Y + i * lineH;
    ctx.fillText(lines[i], textX, lineTop + (lineH - fontSize) / 2);
    if (label.isStrikethrough) {
      const strikeY = lineTop + lineH / 2;
      ctx.strokeStyle = textColor;
      ctx.lineWidth = Math.max(1, fontSize / 14);
      ctx.beginPath();
      ctx.moveTo(textX, strikeY);
      ctx.lineTo(textX + lineWidths[i], strikeY);
      ctx.stroke();
    }
  }
};
