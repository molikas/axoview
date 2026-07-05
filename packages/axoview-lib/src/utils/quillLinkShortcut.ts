// Ctrl/Cmd+K → "add link" for the on-canvas text-box editor (ADR 0034
// addendum 2026-07-04; the Docs/Lucid convention). Quill's snow theme only
// installs its own Ctrl+K binding when the toolbar has a .ql-link button, so
// the toolbar-less canvas editor had nothing on the key — and its .ql-tooltip
// link UI is hidden anyway (it misplaces under the iso matrix transform,
// ADR 0034 §2). This binding opens the INLINE link card in edit mode right at
// the selection (owner 2026-07-04: routing Ctrl+K to the strip popover at the
// top of the screen "doesn't really make sense, given the nice inline link
// edit"). A collapsed caret first expands to the word under it (exactly what
// Docs does).
//
// The deck editors (Notes etc.) keep Quill's native Ctrl+K — their toolbar
// includes 'link', and their .ql-tooltip is visible and styled.
//
// Quill must never be imported at module scope here (its emitter binds
// `document` at import time — crashes jest/node); types are structural.

/** Window event the strip's Link StripButton listens for (see StripButton's
 *  `openEvent` prop). Dispatched by the strip's selected-item Ctrl+K listener
 *  and the Label inline editor — element-level headerLinks have no inline
 *  card, so the popover stays their surface. */
export const OPEN_LINK_POPOVER_EVENT = 'axoview:open-link-popover';

/** Window event the canvas editor's link card listens for: open the card in
 *  EDIT mode for the current editor selection (create a new link, or edit
 *  the one under the caret). Dispatched by the Ctrl+K binding below. */
export const EDIT_LINK_AT_SELECTION_EVENT = 'axoview:edit-link-at-selection';

/** Window event the ELEMENT link card listens for (Ctrl+K while inline-
 *  renaming a floating Label, a node name, or a connector label — plain-text
 *  surfaces whose link is the element-level headerLink). detail:
 *  `{ target: ElementLinkTarget, rect: {left, top, width, height},
 *     mode?: 'edit' | 'view', hover?: boolean }` — 'view' + hover=true is the
 *  hover-a-linked-label chip (auto-dismisses); default is the Ctrl+K edit. */
export const EDIT_ELEMENT_LINK_EVENT = 'axoview:edit-element-link';

/** Hover sources dispatch this on pointer-leave; the card grace-hides unless
 *  the pointer moved onto the card itself (or it was pinned by editing). */
export const HIDE_ELEMENT_LINK_EVENT = 'axoview:hide-element-link';

/** Which element's headerLink the element link card reads/writes. */
export type ElementLinkTarget =
  | { kind: 'LABEL'; id: string }
  | { kind: 'NODE'; id: string }
  | {
      kind: 'CONNECTOR_LABEL';
      connectorId: string;
      /** A labels[] entry id, or null = the whole-connector headerLink. */
      labelId: string | null;
    };

/** Counterpart close signal (StripButton `closeEvent` prop): Docs closes the
 *  link dialog on Enter-apply, so the range URL field dispatches this. */
export const CLOSE_LINK_POPOVER_EVENT = 'axoview:close-link-popover';

/** Sentinel href scheme for INTERNAL diagram links authored on text ranges
 *  (the link card's Docs-style suggestions). A fragment href survives both
 *  Quill's LinkBlot protocol whitelist and the ADR 0029 sanitizer; clicks are
 *  intercepted in the resting render and dispatched as the same
 *  `axoview-navigate-to-diagram` event the NodePanel's linked-diagram uses. */
export const DIAGRAM_LINK_PREFIX = '#diagram:';

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
      // The card reads the fresh selection directly from quill — same tick.
      window.dispatchEvent(new CustomEvent(EDIT_LINK_AT_SELECTION_EVENT));
      return false;
    }
  };
};
