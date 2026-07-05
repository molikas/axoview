import { useMemo } from 'react';
import { TextBox } from 'src/types';
import {
  UNPROJECTED_TILE_SIZE,
  DEFAULT_FONT_FAMILY,
  TEXTBOX_DEFAULTS,
  TEXTBOX_FONT_WEIGHT,
  TEXTBOX_LINE_HEIGHT,
  TEXTBOX_PADDING,
  CANVAS_RICHTEXT_SCALE,
  CANVAS_RICHTEXT_LIST_INDENT_EM
} from 'src/config';

// Block-tag styles for Quill HTML rendered via dangerouslySetInnerHTML.
// The canvas TextBox does NOT mount Quill in readOnly mode (would be wasteful
// at scale), so quill.snow.css does not reach this DOM — we declare the
// minimum visual contract directly. Mirrored against isoMath dimension math
// via CANVAS_RICHTEXT_SCALE so the saved size keeps the content contained.
// Typography (ADR 0034 addendum 2026-07-03 — Lucid-parity line spacing):
//   - Quill makes every line its own <p>, so p/li carry ZERO vertical margins
//     — the box's lineHeight multiplier (default TEXTBOX_LINE_HEIGHT, user-set
//     via the strip) is the single line-spacing knob, exactly like Lucid's
//     line-spacing stepper. Margins here would silently stack on top of it.
//   - List text indents CANVAS_RICHTEXT_LIST_INDENT_EM — the same constant
//     the inline editor and isoMath width measurement use.
//   - Legacy render-only blocks (headers/blockquote/pre — authoring retired,
//     ADR 0034 §3) keep their tuned sizes/margins: major-third header ratio,
//     weight 700/700/600, tight display line-heights, golden-ratio top-margin
//     bias so a header ties to the content beneath it.
const richTextStyles = {
  '& p': { margin: 0, padding: 0 },
  '& h1': {
    fontSize: `${CANVAS_RICHTEXT_SCALE.h1}em`,
    fontWeight: 700,
    lineHeight: 1.2,
    margin: '0.8em 0 0.3em',
    letterSpacing: '-0.01em'
  },
  '& h2': {
    fontSize: `${CANVAS_RICHTEXT_SCALE.h2}em`,
    fontWeight: 700,
    lineHeight: 1.25,
    margin: '0.7em 0 0.25em',
    letterSpacing: '-0.005em'
  },
  '& h3': {
    fontSize: `${CANVAS_RICHTEXT_SCALE.h3}em`,
    fontWeight: 600,
    lineHeight: 1.3,
    margin: '0.6em 0 0.2em'
  },
  '& ul, & ol': {
    margin: 0,
    paddingInlineStart: `${CANVAS_RICHTEXT_LIST_INDENT_EM}em`
  },
  '& li': {
    margin: 0,
    padding: 0
  },
  '& blockquote': {
    margin: '0.5em 0',
    paddingLeft: '0.8em',
    borderLeft: '2px solid currentColor',
    fontStyle: 'italic',
    opacity: 0.75
  },
  '& pre, & code': {
    fontFamily: 'monospace',
    fontSize: `${CANVAS_RICHTEXT_SCALE.pre}em`
  },
  '& pre': {
    margin: '0.5em 0',
    padding: '0.4em 0.6em',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: '4px'
  },
  // Inline code (when not inside <pre>): small chip-like background to
  // visually separate from prose without making it loud.
  '& code': {
    padding: '0.1em 0.3em',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: '3px'
  },
  '& pre code': { padding: 0, backgroundColor: 'transparent' },
  // Strip leading/trailing block margin so the first/last block sits flush
  // with the textbox padding — avoids a visible gap at the top of the box.
  '& > :first-child, & > * > :first-child': { marginTop: 0 },
  '& > :last-child, & > * > :last-child': { marginBottom: 0 }
};

export const useTextBoxProps = (textBox: TextBox) => {
  const fontProps = useMemo(() => {
    // ADR 0034 §4: the legacy element-level isBold/isItalic/isUnderline flags
    // are no longer applied here — content HTML is the single formatting layer
    // (legacy true flags are folded into content at load, foldTextBoxStyleFlags).
    return {
      fontSize:
        UNPROJECTED_TILE_SIZE * (textBox.fontSize ?? TEXTBOX_DEFAULTS.fontSize),
      fontFamily: DEFAULT_FONT_FAMILY,
      fontWeight: TEXTBOX_FONT_WEIGHT,
      color: textBox.color || 'inherit',
      lineHeight: textBox.lineHeight ?? TEXTBOX_LINE_HEIGHT,
      // White-space contract (ADR 0034 addendum 2026-07-03):
      //   AUTO box  → 'pre': never soft-wrap (the box hugs the longest line;
      //               wrapping would reflow every existing diagram) and keep
      //               space runs, matching the editor's rendering.
      //   FIXED box → 'pre-wrap' + minWidth 0: soft-wrap at the box edge
      //               exactly like the editor (.ql-editor is pre-wrap);
      //               minWidth 0 lets the flex child shrink to the container
      //               instead of flooring at the text's min-content width.
      //               break-word matches the editor and the measurement's
      //               hard-break estimate for over-long words.
      ...(textBox.width !== undefined
        ? {
            whiteSpace: 'pre-wrap' as const,
            overflowWrap: 'break-word' as const,
            minWidth: 0,
            width: '100%'
          }
        : { whiteSpace: 'pre' as const }),
      ...richTextStyles
    };
  }, [textBox.fontSize, textBox.color, textBox.lineHeight, textBox.width]);

  const paddingX = useMemo(() => {
    return UNPROJECTED_TILE_SIZE * TEXTBOX_PADDING;
  }, []);

  return { paddingX, fontProps };
};
