import { isLabelVisibleInPreview } from 'src/utils/previewLabelVisibility';

describe('isLabelVisibleInPreview', () => {
  it('hide-labels OFF — model showLabel is authoritative in every mode', () => {
    expect(isLabelVisibleInPreview(true, false, false)).toBe(true);
    expect(isLabelVisibleInPreview(false, false, false)).toBe(false);
    expect(isLabelVisibleInPreview(true, true, false)).toBe(true);
    expect(isLabelVisibleInPreview(false, true, false)).toBe(false);
  });

  it('hide-labels ON — labels are forced hidden in every mode (global, not preview-only)', () => {
    // The override forces hidden regardless of mode or the model showLabel
    // (which it never mutates).
    expect(isLabelVisibleInPreview(true, false, true)).toBe(false);
    expect(isLabelVisibleInPreview(false, false, true)).toBe(false);
    expect(isLabelVisibleInPreview(true, true, true)).toBe(false);
    expect(isLabelVisibleInPreview(false, true, true)).toBe(false);
  });
});
