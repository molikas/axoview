import { isLabelVisibleInPreview } from 'src/utils/previewLabelVisibility';

describe('isLabelVisibleInPreview', () => {
  it('in EDITABLE (not preview), the hide flag is ignored — model showLabel rules', () => {
    expect(isLabelVisibleInPreview(true, false, true)).toBe(true);
    expect(isLabelVisibleInPreview(false, false, true)).toBe(false);
    expect(isLabelVisibleInPreview(true, false, false)).toBe(true);
  });

  it('in preview with hide-labels OFF, model showLabel is authoritative', () => {
    expect(isLabelVisibleInPreview(true, true, false)).toBe(true);
    expect(isLabelVisibleInPreview(false, true, false)).toBe(false);
  });

  it('in preview with hide-labels ON, the name label is forced hidden', () => {
    // ...even when the model says showLabel is on (override never mutates it).
    expect(isLabelVisibleInPreview(true, true, true)).toBe(false);
    expect(isLabelVisibleInPreview(false, true, true)).toBe(false);
  });
});
