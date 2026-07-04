// Ctrl/Cmd+K → "add link" for the on-canvas text-box editor (ADR 0034
// addendum 2026-07-04; the Docs/Lucid convention). Quill's snow theme only
// installs its own Ctrl+K binding when the toolbar has a .ql-link button, so
// the toolbar-less canvas editor had nothing on the key — and its .ql-tooltip
// link UI is hidden anyway (it misplaces under the iso matrix transform,
// ADR 0034 §2). This binding routes to the strip's Link popover instead: the
// bridge's lastRange already survives the focus steal, so the popover formats
// the right range. A collapsed caret first expands to the word under it
// (exactly what Docs does), because the strip's range-link mode needs a
// non-empty selection.
//
// The deck editors (Notes etc.) keep Quill's native Ctrl+K — their toolbar
// includes 'link', and their .ql-tooltip is visible and styled.
//
// Quill must never be imported at module scope here (its emitter binds
// `document` at import time — crashes jest/node); types are structural.

/** Window event the strip's Link StripButton listens for (see StripButton's
 *  `openEvent` prop). Dispatched by this binding and by the strip's own
 *  selected-item Ctrl+K listener. */
export const OPEN_LINK_POPOVER_EVENT = 'axoview:open-link-popover';

/** Counterpart close signal (StripButton `closeEvent` prop): Docs closes the
 *  link dialog on Enter-apply, so the range URL field dispatches this. */
export const CLOSE_LINK_POPOVER_EVENT = 'axoview:close-link-popover';

/** Docs-style URL forgiveness for TEXT links: "google.com" → "https://...".
 *  Returns null for blank input (callers treat that as "remove the link").
 *  Element-level headerLinks keep their raw semantics — this is only for
 *  links authored on text ranges. */
export const normalizeWebLinkUrl = (raw: string): string | null => {
  const value = raw.trim();
  if (!value) return null;
  return /^(https?:|mailto:|tel:|#)/i.test(value) ? value : `https://${value}`;
};

/** Expand a collapsed caret to the whitespace-delimited word around it.
 *  Returns a zero-length range when the caret sits in whitespace. */
export const expandToWord = (
  text: string,
  index: number
): { index: number; length: number } => {
  let start = Math.max(0, Math.min(index, text.length));
  let end = start;
  while (start > 0 && !/\s/.test(text[start - 1])) start -= 1;
  while (end < text.length && !/\s/.test(text[end])) end += 1;
  return { index: start, length: end - start };
};

interface QuillLike {
  getText: () => string;
  getSelection: () => { index: number; length: number } | null;
  setSelection: (index: number, length: number, source: string) => void;
}

export const buildLinkShortcutBinding = () => {
  return {
    key: 'k',
    shortKey: true,
    handler(
      this: { quill: QuillLike },
      range: { index: number; length: number } | null
    ) {
      const { quill } = this;
      let sel = range ?? quill.getSelection();
      if (!sel) return false;
      if (sel.length === 0) {
        const word = expandToWord(quill.getText(), sel.index);
        // Caret in whitespace: nothing linkable — consume the key anyway so
        // the browser's own Ctrl+K (search bar focus) never fires mid-edit.
        if (word.length === 0) return false;
        quill.setSelection(word.index, word.length, 'user');
        sel = word;
      }
      // Let the selection-change → bridge → strip re-render settle before the
      // popover's open listener checks its disabled state.
      requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent(OPEN_LINK_POPOVER_EVENT));
      });
      return false;
    }
  };
};
