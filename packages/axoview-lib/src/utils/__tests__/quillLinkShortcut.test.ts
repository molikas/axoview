/**
 * Ctrl/Cmd+K link shortcut (ADR 0034 addendum 2026-07-04).
 *
 * The binding owns the key in the toolbar-less canvas editor (snow only
 * installs its own Ctrl+K when a .ql-link toolbar button exists). These tests
 * pin:
 *   1. expandToWord — the Docs-style collapsed-caret expansion,
 *   2. the handler choreography against a mock Quill: selection expansion,
 *      the popover-open event, and the consume-the-key contract (return
 *      false even when nothing is linkable, so the browser's own Ctrl+K
 *      never fires mid-edit).
 *
 * No real Quill is imported (it binds `document` at import time and would
 * crash the node test env) — the binding's types are structural.
 */

import {
  OPEN_LINK_POPOVER_EVENT,
  expandToWord,
  buildLinkShortcutBinding,
  normalizeWebLinkUrl
} from 'src/utils/quillLinkShortcut';

describe('normalizeWebLinkUrl', () => {
  it('prepends https:// to a bare domain (Docs forgiveness)', () => {
    expect(normalizeWebLinkUrl('google.com')).toBe('https://google.com');
    expect(normalizeWebLinkUrl('  example.com/docs ')).toBe(
      'https://example.com/docs'
    );
  });

  it.each(['https://x.io', 'http://x.io', 'mailto:a@b.c', 'tel:+123', '#anchor'])(
    'keeps %j as-is',
    (url) => {
      expect(normalizeWebLinkUrl(url)).toBe(url);
    }
  );

  it('returns null for blank input (callers remove the link)', () => {
    expect(normalizeWebLinkUrl('')).toBeNull();
    expect(normalizeWebLinkUrl('   ')).toBeNull();
  });
});

describe('expandToWord', () => {
  it('expands a caret inside a word to the full word', () => {
    expect(expandToWord('visit docs today\n', 8)).toEqual({
      index: 6,
      length: 4
    });
  });

  it('expands a caret at a word END back to the word start', () => {
    expect(expandToWord('visit docs today\n', 16)).toEqual({
      index: 11,
      length: 5
    });
  });

  it('expands a caret at a word START forward to the word end', () => {
    expect(expandToWord('visit docs today\n', 6)).toEqual({
      index: 6,
      length: 4
    });
  });

  it('returns a zero-length range when the caret sits in whitespace', () => {
    expect(expandToWord('visit  docs\n', 6).length).toBe(0);
  });

  it('clamps an out-of-range index instead of throwing', () => {
    expect(expandToWord('abc', 99)).toEqual({ index: 0, length: 3 });
  });
});

const makeQuill = (text: string, selection: { index: number; length: number } | null) => {
  const calls: Array<[number, number, string]> = [];
  return {
    quill: {
      getText: () => text,
      getSelection: () => selection,
      setSelection: (index: number, length: number, source: string) => {
        calls.push([index, length, source]);
      }
    },
    calls
  };
};

// The handler defers the popover-open event one animation frame so the
// selection-change → strip re-render settles first.
const flushRaf = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

describe('buildLinkShortcutBinding', () => {
  it('is bound to shortKey+K', () => {
    const binding = buildLinkShortcutBinding();
    expect(binding.key).toBe('k');
    expect(binding.shortKey).toBe(true);
  });

  it('keeps a non-empty selection as-is and fires the popover-open event', async () => {
    const binding = buildLinkShortcutBinding();
    const { quill, calls } = makeQuill('visit docs today\n', null);
    const seen = jest.fn();
    window.addEventListener(OPEN_LINK_POPOVER_EVENT, seen);
    const result = binding.handler.call({ quill }, { index: 6, length: 4 });
    await flushRaf();
    window.removeEventListener(OPEN_LINK_POPOVER_EVENT, seen);

    expect(result).toBe(false);
    expect(calls).toHaveLength(0); // no re-selection needed
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('expands a collapsed caret to the word under it before opening', async () => {
    const binding = buildLinkShortcutBinding();
    const { quill, calls } = makeQuill('visit docs today\n', null);
    const seen = jest.fn();
    window.addEventListener(OPEN_LINK_POPOVER_EVENT, seen);
    const result = binding.handler.call({ quill }, { index: 16, length: 0 });
    await flushRaf();
    window.removeEventListener(OPEN_LINK_POPOVER_EVENT, seen);

    expect(result).toBe(false);
    expect(calls).toEqual([[11, 5, 'user']]);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('consumes the key WITHOUT opening when the caret sits in whitespace', async () => {
    const binding = buildLinkShortcutBinding();
    const { quill, calls } = makeQuill('visit  docs\n', null);
    const seen = jest.fn();
    window.addEventListener(OPEN_LINK_POPOVER_EVENT, seen);
    const result = binding.handler.call({ quill }, { index: 6, length: 0 });
    await flushRaf();
    window.removeEventListener(OPEN_LINK_POPOVER_EVENT, seen);

    expect(result).toBe(false);
    expect(calls).toHaveLength(0);
    expect(seen).not.toHaveBeenCalled();
  });

  it('falls back to getSelection when the binding range is null', async () => {
    const binding = buildLinkShortcutBinding();
    const { quill } = makeQuill('word\n', { index: 0, length: 4 });
    const seen = jest.fn();
    window.addEventListener(OPEN_LINK_POPOVER_EVENT, seen);
    const result = binding.handler.call({ quill }, null);
    await flushRaf();
    window.removeEventListener(OPEN_LINK_POPOVER_EVENT, seen);

    expect(result).toBe(false);
    expect(seen).toHaveBeenCalledTimes(1);
  });
});
