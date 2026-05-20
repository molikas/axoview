/**
 * REGRESSION — RichTextEditor Quill formats config
 *
 * Quill validates the `formats` array against its registered format registry
 * at mount time. 'bullet' is not a registered format — it is an alias for the
 * 'list' format's bullet variant and causes:
 *   quill Cannot register "bullet" specified in "formats" config.
 *
 * This test pins the real exported `formats` constant so 'bullet' cannot be
 * re-added accidentally.
 *
 * Note: the toolbar `tools` array uses { list: 'bullet' } — that is a toolbar
 * config object (renders the bullet-list button), NOT a format registration
 * string. The formats registry only needs 'list'.
 */

jest.mock('react-quill-new', () => ({ __esModule: true, default: () => null }));
jest.mock('@mui/material', () => ({ Box: () => null }));

import { formats } from '../RichTextEditor';

describe('RichTextEditor — Quill formats config', () => {
  it('does NOT contain "bullet" (unregistered Quill alias)', () => {
    expect(formats).not.toContain('bullet');
  });

  it('contains "list" (correct Quill list format covering both bullet and ordered)', () => {
    expect(formats).toContain('list');
  });

  it('contains all expected base formats', () => {
    const expected = [
      'bold',
      'italic',
      'underline',
      'strike',
      'link',
      'header',
      'list',
      'blockquote',
      'code-block'
    ];
    expected.forEach((f) => expect(formats).toContain(f));
  });

  it('has exactly 9 formats (pin count to catch unreviewed additions)', () => {
    expect(formats).toHaveLength(9);
  });
});

// ---------------------------------------------------------------------------
// MQA #12 — list autofill must be disabled (file-level structural check)
// ---------------------------------------------------------------------------
//
// Reading the source rather than mounting Quill keeps this test cheap and
// pins the contract: the `list autofill` binding override must remain in
// place, and its handler must return true (so the literal space is inserted
// and the autofill never replaces the line with an empty list block).
describe('RichTextEditor — list autofill override (MQA #12)', () => {
  it('overrides Quill list autofill with a noop handler', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../RichTextEditor.tsx'),
      'utf-8',
    );
    expect(src).toMatch(/'list autofill'\s*:/);
    // Handler must propagate (return true) — never `return false` which would
    // also swallow the literal space the user typed.
    const sliceStart = src.indexOf("'list autofill'");
    const slice = src.slice(sliceStart, sliceStart + 600);
    expect(slice).toMatch(/handler\(\)\s*\{\s*return true;\s*\}/);
  });
});
