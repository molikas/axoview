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
// Markdown list autofill — MQA #12 RETIRED (ADR 0034 addendum 2026-07-03)
// ---------------------------------------------------------------------------
//
// `- `/`* `/`1. ` → list is back ON, via the ONE shared binding in
// utils/quillListAutofill.ts (undo restores the literal text; checkbox
// prefixes excluded — behavior is unit-tested there). This file-level check
// pins that BOTH rich surfaces wire the shared binding — a hand-rolled inline
// binding (or a resurrected noop override) would silently drift the two
// editors apart.
describe('RichTextEditor — markdown list autofill (MQA #12 retired)', () => {
  const read = (rel: string) => {
    const fs = require('fs');
    const path = require('path');
    return fs.readFileSync(path.resolve(__dirname, rel), 'utf-8');
  };

  it('RichTextEditor wires the shared buildListAutofillBinding', () => {
    const src = read('../RichTextEditor.tsx');
    expect(src).toMatch(
      /'list autofill': buildListAutofillBinding\(ReactQuill\.Quill\)/
    );
    // The old MQA #12 noop must not come back.
    expect(src).not.toMatch(/handler\(\)\s*\{\s*return true;\s*\}/);
  });

  it('TextBoxInlineEditor wires the same shared binding', () => {
    const src = read('../../SceneLayers/TextBoxes/TextBoxInlineEditor.tsx');
    expect(src).toMatch(
      /'list autofill': buildListAutofillBinding\(ReactQuill\.Quill\)/
    );
  });
});
