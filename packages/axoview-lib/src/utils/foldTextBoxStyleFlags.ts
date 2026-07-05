import { applyInlineFormat, ensureHtmlContent } from './richTextTransform';

// ADR 0034 §4 — legacy element-level text-box style flags. `isBold/isItalic/
// isUnderline` were writable from the deck until 2026-06-29; since then they
// rendered but had no writer, so a legacy bold box could never be cleared.
// Content HTML is now the single formatting layer: fold any true flag into the
// content once at load (the `seedConnectorLabel` precedent), clear the flags,
// and the renderer stops reading them. Runs pre-parse in useInitialDataManager,
// so it works on the RAW (unvalidated) object and must never throw.

type RawTextBox = Record<string, unknown>;

export const foldTextBoxStyleFlags = (textBox: RawTextBox): RawTextBox => {
  if (!textBox || typeof textBox !== 'object') return textBox;
  const isBold = textBox.isBold === true;
  const isItalic = textBox.isItalic === true;
  const isUnderline = textBox.isUnderline === true;
  if (!isBold && !isItalic && !isUnderline) return textBox;

  const content = typeof textBox.content === 'string' ? textBox.content : '';
  let next = content;
  if (content.trim()) {
    try {
      let html = ensureHtmlContent(content);
      if (isBold) html = applyInlineFormat(html, 'bold', true);
      if (isItalic) html = applyInlineFormat(html, 'italic', true);
      if (isUnderline) html = applyInlineFormat(html, 'underline', true);
      next = html;
    } catch {
      // A malformed legacy payload keeps its content untouched — the flags are
      // still cleared below so the (now unrendered) layer can't linger as the
      // only styling source.
      next = content;
    }
  }

  return { ...textBox, content: next, isBold: false, isItalic: false, isUnderline: false };
};
