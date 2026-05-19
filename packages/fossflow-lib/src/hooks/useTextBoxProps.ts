import { useMemo } from 'react';
import { TextBox } from 'src/types';
import {
  UNPROJECTED_TILE_SIZE,
  DEFAULT_FONT_FAMILY,
  TEXTBOX_DEFAULTS,
  TEXTBOX_FONT_WEIGHT,
  TEXTBOX_PADDING,
  CANVAS_RICHTEXT_SCALE
} from 'src/config';

// Block-tag styles for Quill HTML rendered via dangerouslySetInnerHTML.
// The canvas TextBox does NOT mount Quill in readOnly mode (would be wasteful
// at scale), so quill.snow.css does not reach this DOM — we declare the
// minimum visual contract directly. Mirrored against isoMath dimension math
// via CANVAS_RICHTEXT_SCALE so the saved size keeps the content contained.
// Typography scale tuned for readable prose:
//   - Major-third ratio between header tiers (1.875 / 1.5 / 1.25) — clearly
//     differentiated at a glance instead of "all three headers look similar".
//   - Header weight 700 on h1/h2 (display), 600 on h3 (subhead). Body stays
//     400. Hierarchy comes from BOTH size and weight, never just one.
//   - Body line-height 1.5 (per W3C / Material readability guidance) —
//     prose breathes, doesn't read as a solid block.
//   - Headers run tighter line-heights (1.2–1.3) because at display sizes
//     the leading already feels generous.
//   - Paragraph bottom margin 0.4em so consecutive body lines have a gap
//     without floating apart like a poem.
//   - Headers carry MORE top-margin than bottom-margin (golden-ratio bias)
//     so the header is visually tied to the content beneath it.
//   - List indent 1.75em — clearly past body text; matches what the
//     in-editor Quill snow preview displays.
const richTextStyles = {
  '& p': { margin: '0 0 0.4em', padding: 0 },
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
    margin: '0.3em 0 0.5em',
    paddingInlineStart: '1.75em'
  },
  '& li': {
    marginBottom: '0.2em',
    lineHeight: 1.5,
    paddingLeft: '0.25em'
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
    return {
      fontSize:
        UNPROJECTED_TILE_SIZE * (textBox.fontSize ?? TEXTBOX_DEFAULTS.fontSize),
      fontFamily: DEFAULT_FONT_FAMILY,
      fontWeight: textBox.isBold ? 700 : TEXTBOX_FONT_WEIGHT,
      fontStyle: textBox.isItalic ? 'italic' : 'normal',
      textDecoration: textBox.isUnderline ? 'underline' : 'none',
      color: textBox.color || 'inherit',
      lineHeight: 1.5,
      ...richTextStyles
    };
  }, [
    textBox.fontSize,
    textBox.isBold,
    textBox.isItalic,
    textBox.isUnderline,
    textBox.color
  ]);

  const paddingX = useMemo(() => {
    return UNPROJECTED_TILE_SIZE * TEXTBOX_PADDING;
  }, []);

  return { paddingX, fontProps };
};
