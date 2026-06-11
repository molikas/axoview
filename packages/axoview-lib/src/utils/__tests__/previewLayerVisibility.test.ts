import { isEntityVisibleInPreview } from 'src/utils/previewLayerVisibility';
import type { PreviewLayerOverrides } from 'src/types/ui';

const NONE: PreviewLayerOverrides = { hiddenLayerIds: [], soloLayerId: null };

describe('isEntityVisibleInPreview', () => {
  it('with no override, returns the base model visibility', () => {
    expect(isEntityVisibleInPreview('a', true, NONE)).toBe(true);
    expect(isEntityVisibleInPreview('a', false, NONE)).toBe(false);
    // Unassigned entity follows its base too.
    expect(isEntityVisibleInPreview(undefined, true, NONE)).toBe(true);
  });

  it('hides a layer in the hidden set even when model-visible', () => {
    const o: PreviewLayerOverrides = { hiddenLayerIds: ['a'], soloLayerId: null };
    expect(isEntityVisibleInPreview('a', true, o)).toBe(false);
    // A different, non-hidden layer is unaffected.
    expect(isEntityVisibleInPreview('b', true, o)).toBe(true);
  });

  it('keeps a model-hidden layer hidden when not solo (base minus hidden)', () => {
    expect(isEntityVisibleInPreview('a', false, NONE)).toBe(false);
  });

  it('solo wins: only the solo layer shows, regardless of hidden set', () => {
    const o: PreviewLayerOverrides = {
      hiddenLayerIds: ['a', 'b'],
      soloLayerId: 'a'
    };
    expect(isEntityVisibleInPreview('a', true, o)).toBe(true);
    expect(isEntityVisibleInPreview('b', true, o)).toBe(false);
  });

  it('solo reveals a layer even if it is model-hidden', () => {
    const o: PreviewLayerOverrides = { hiddenLayerIds: [], soloLayerId: 'a' };
    expect(isEntityVisibleInPreview('a', false, o)).toBe(true);
  });

  it('solo hides unassigned entities', () => {
    const o: PreviewLayerOverrides = { hiddenLayerIds: [], soloLayerId: 'a' };
    expect(isEntityVisibleInPreview(undefined, true, o)).toBe(false);
  });
});
