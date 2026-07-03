// Markdown-style list autofill for Quill editors (ADR 0034 addendum
// 2026-07-03). Typing `- `, `* ` or `1. ` at the start of a line converts it
// into a bullet / ordered list — the convention every peer tool ships (Lucid,
// Docs, Notion). This RETIRES the MQA #12 noop override: the original
// complaint ("input erased") is addressed structurally —
//   - both rich surfaces render visible list markers (quill.snow.css is
//     loaded for the inline editor and the Notes editor alike), and
//   - the handler cuts a history entry BEFORE converting, so Ctrl+Z restores
//     the literal typed text instead of leaving a surprise list.
// The handler body is a faithful port of Quill 2.0.3's default `list
// autofill` binding (modules/keyboard.js) with ONE divergence: the prefix
// drops the `[ ]` / `[x]` checkbox forms — `list: checked/unchecked` is
// outside the authoring ceiling (ADR 0034 §3) and the canvas resting render
// has no checkbox styling. Re-sync the port when Quill is upgraded.
//
// Quill itself must NEVER be imported at module scope here (its emitter binds
// `document` at import time — crashes jest/node); the caller passes the
// constructor in, and the types below are structural.

export const LIST_AUTOFILL_PREFIX = /^\s*?(\d+\.|-|\*)$/;

interface QuillLike {
  scroll: { query: (name: string) => unknown };
  getLine: (index: number) => [{ length: () => number }, number];
  insertText: (index: number, text: string, source: string) => void;
  history: { cutoff: () => void };
  updateContents: (delta: unknown, source: string) => void;
  setSelection: (index: number, source: string) => void;
}

interface DeltaLike {
  retain: (length: number, attributes?: Record<string, unknown>) => DeltaLike;
  delete: (length: number) => DeltaLike;
}

interface QuillConstructorLike {
  import: (path: string) => unknown;
  sources: { USER: string; SILENT: string };
}

export const buildListAutofillBinding = (Quill: QuillConstructorLike) => {
  const Delta = Quill.import('delta') as new () => DeltaLike;
  return {
    key: ' ',
    shiftKey: null,
    collapsed: true,
    // Match Quill's own guards: never autofill inside legacy block containers
    // (blockquote / code-block still render from old content).
    format: { 'code-block': false, blockquote: false },
    prefix: LIST_AUTOFILL_PREFIX,
    handler(
      this: { quill: QuillLike },
      range: { index: number },
      context: { prefix: string }
    ) {
      if (this.quill.scroll.query('list') == null) return true;
      const { length } = context.prefix;
      const [line, offset] = this.quill.getLine(range.index);
      if (offset > length) return true;
      const value =
        context.prefix.trim() === '-' || context.prefix.trim() === '*'
          ? 'bullet'
          : 'ordered';
      this.quill.insertText(range.index, ' ', Quill.sources.USER);
      this.quill.history.cutoff();
      const delta = new Delta()
        .retain(range.index - offset)
        .delete(length + 1)
        .retain(line.length() - 2 - offset)
        .retain(1, { list: value });
      this.quill.updateContents(delta, Quill.sources.USER);
      this.quill.history.cutoff();
      this.quill.setSelection(range.index - length, Quill.sources.SILENT);
      return false;
    }
  };
};
