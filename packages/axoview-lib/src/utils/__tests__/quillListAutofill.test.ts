/**
 * Markdown list autofill (ADR 0034 addendum 2026-07-03; retires MQA #12).
 *
 * The binding is a faithful port of Quill 2.0.3's default `list autofill`
 * with the checkbox prefixes removed. These tests pin:
 *   1. the prefix regex — which typed markers convert (and which don't),
 *   2. the handler's delta/history choreography against a mock Quill — the
 *      history.cutoff() BEFORE the conversion is what makes Ctrl+Z restore
 *      the literal typed text (the actual fix for MQA #12's "input erased"),
 *   3. the mid-line and no-list-format guards.
 *
 * No real Quill is imported (it binds `document` at import time and would
 * crash the node test env) — the util takes the constructor as a parameter,
 * which is exactly what lets us drive it with a mock here.
 */

import {
  LIST_AUTOFILL_PREFIX,
  buildListAutofillBinding
} from 'src/utils/quillListAutofill';

describe('LIST_AUTOFILL_PREFIX', () => {
  it.each(['-', '*', '1.', '12.', '  -'])('matches %j', (prefix) => {
    expect(LIST_AUTOFILL_PREFIX.test(prefix)).toBe(true);
  });

  it.each(['[ ]', '[]', '[x]', 'a.', '-x', '1', 'foo -'])(
    'does NOT match %j (checkboxes are outside the authoring ceiling)',
    (prefix) => {
      expect(LIST_AUTOFILL_PREFIX.test(prefix)).toBe(false);
    }
  );
});

// Mock Delta mirroring quill-delta's semantics for the ops the handler uses:
// retain/delete with length <= 0 are no-ops (quill-delta guards them), so the
// recorded ops match what real Quill would apply.
class FakeDelta {
  ops: Array<Record<string, unknown>> = [];

  retain(length: number, attributes?: Record<string, unknown>) {
    if (length <= 0) return this;
    this.ops.push(attributes ? { retain: length, attributes } : { retain: length });
    return this;
  }

  delete(length: number) {
    if (length <= 0) return this;
    this.ops.push({ delete: length });
    return this;
  }
}

const FakeQuillCtor = {
  import: (path: string) => (path === 'delta' ? FakeDelta : null),
  sources: { USER: 'user', SILENT: 'silent' }
};

const makeQuill = ({
  lineLength,
  offset,
  hasListFormat = true
}: {
  lineLength: number;
  offset: number;
  hasListFormat?: boolean;
}) => ({
  scroll: { query: () => (hasListFormat ? {} : null) },
  getLine: () => [{ length: () => lineLength }, offset] as [
    { length: () => number },
    number
  ],
  insertText: jest.fn(),
  history: { cutoff: jest.fn() },
  updateContents: jest.fn(),
  setSelection: jest.fn()
});

const fire = (
  quill: ReturnType<typeof makeQuill>,
  index: number,
  prefix: string
) => {
  const binding = buildListAutofillBinding(FakeQuillCtor);
  return binding.handler.call({ quill }, { index }, { prefix });
};

describe('buildListAutofillBinding', () => {
  it('exposes Quill-shaped binding metadata (space key, collapsed, legacy-block guards)', () => {
    const binding = buildListAutofillBinding(FakeQuillCtor);
    expect(binding.key).toBe(' ');
    expect(binding.collapsed).toBe(true);
    expect(binding.format).toEqual({ 'code-block': false, blockquote: false });
    expect(binding.prefix).toBe(LIST_AUTOFILL_PREFIX);
  });

  it('converts "- " on its own line into a bullet list, undo-safely', () => {
    // Caret after the "-": document line is "-\n" (length 2), offset 1.
    const quill = makeQuill({ lineLength: 2, offset: 1 });
    const result = fire(quill, 1, '-');

    expect(result).toBe(false); // handled — the space keystroke is consumed
    // The literal space IS inserted first, THEN a history cutoff, THEN the
    // conversion — so one Ctrl+Z peels the conversion back to literal "- ".
    expect(quill.insertText).toHaveBeenCalledWith(1, ' ', 'user');
    expect(quill.history.cutoff).toHaveBeenCalledTimes(2);
    const delta = quill.updateContents.mock.calls[0][0] as FakeDelta;
    expect(delta.ops).toEqual([
      { delete: 2 }, // "- " removed…
      { retain: 1, attributes: { list: 'bullet' } } // …line becomes a bullet
    ]);
    expect(quill.updateContents).toHaveBeenCalledWith(delta, 'user');
    expect(quill.setSelection).toHaveBeenCalledWith(0, 'silent');
  });

  it('converts "1. " into an ordered list', () => {
    // Line "1.\n" (length 3), caret offset 2.
    const quill = makeQuill({ lineLength: 3, offset: 2 });
    const result = fire(quill, 2, '1.');

    expect(result).toBe(false);
    const delta = quill.updateContents.mock.calls[0][0] as FakeDelta;
    expect(delta.ops).toEqual([
      { delete: 3 },
      { retain: 1, attributes: { list: 'ordered' } }
    ]);
  });

  it('converts "* " into a bullet list', () => {
    const quill = makeQuill({ lineLength: 2, offset: 1 });
    fire(quill, 1, '*');
    const delta = quill.updateContents.mock.calls[0][0] as FakeDelta;
    expect(delta.ops[1]).toEqual({
      retain: 1,
      attributes: { list: 'bullet' }
    });
  });

  it('is a no-op mid-line (marker typed after existing text propagates the space)', () => {
    // Line "hello -\n": caret offset 7 > prefix length 1.
    const quill = makeQuill({ lineLength: 8, offset: 7 });
    const result = fire(quill, 7, '-');

    expect(result).toBe(true); // propagate — literal space gets inserted
    expect(quill.insertText).not.toHaveBeenCalled();
    expect(quill.updateContents).not.toHaveBeenCalled();
  });

  it('propagates when the list format is not registered', () => {
    const quill = makeQuill({ lineLength: 2, offset: 1, hasListFormat: false });
    expect(fire(quill, 1, '-')).toBe(true);
    expect(quill.updateContents).not.toHaveBeenCalled();
  });
});
