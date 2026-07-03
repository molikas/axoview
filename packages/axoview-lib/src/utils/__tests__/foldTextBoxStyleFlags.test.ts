/**
 * ADR 0034 §4 — one-time fold of the legacy element-level text-box style flags
 * (isBold/isItalic/isUnderline) into the content HTML at load. After folding,
 * content is the single formatting layer; the flags are cleared (kept as
 * explicit false so the fold is idempotent and the object stays schema-legal).
 */
import { foldTextBoxStyleFlags } from '../foldTextBoxStyleFlags';

describe('foldTextBoxStyleFlags', () => {
  it('returns the object untouched when no flag is set', () => {
    const tb = { id: 't1', content: '<p><strong>a</strong></p>' };
    expect(foldTextBoxStyleFlags(tb)).toBe(tb);
    const cleared = { id: 't2', content: 'x', isBold: false };
    expect(foldTextBoxStyleFlags(cleared)).toBe(cleared);
  });

  it('folds a bold flag on plain text into escaped, wrapped HTML', () => {
    const out = foldTextBoxStyleFlags({
      id: 't1',
      content: 'Text',
      isBold: true
    });
    expect(out.content).toBe('<p><strong>Text</strong></p>');
    expect(out.isBold).toBe(false);
  });

  it('folds all three flags across every block of existing HTML', () => {
    const out = foldTextBoxStyleFlags({
      id: 't1',
      content: '<p>a</p><p>b</p>',
      isBold: true,
      isItalic: true,
      isUnderline: true
    });
    expect(out.content).toBe(
      '<p><u><em><strong>a</strong></em></u></p><p><u><em><strong>b</strong></em></u></p>'
    );
    expect(out.isBold).toBe(false);
    expect(out.isItalic).toBe(false);
    expect(out.isUnderline).toBe(false);
  });

  it('does not double-wrap content that already carries the format', () => {
    const out = foldTextBoxStyleFlags({
      id: 't1',
      content: '<p><strong>a</strong></p>',
      isBold: true
    });
    expect(out.content).toBe('<p><strong>a</strong></p>');
  });

  it('clears flags without inventing content for an empty box', () => {
    const out = foldTextBoxStyleFlags({ id: 't1', content: '', isBold: true });
    expect(out.content).toBe('');
    expect(out.isBold).toBe(false);
  });

  it('is idempotent', () => {
    const once = foldTextBoxStyleFlags({
      id: 't1',
      content: 'Text',
      isUnderline: true
    });
    expect(foldTextBoxStyleFlags(once)).toBe(once);
  });
});
