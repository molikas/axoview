import { resolveHomogeneousBulk } from '../bulkStyleTarget';
import { ItemReference } from 'src/types';

const ref = (type: ItemReference['type'], id: string): ItemReference =>
  ({ type, id } as ItemReference);

describe('resolveHomogeneousBulk (ADR 0030 §2 amendment — bulk style gate)', () => {
  it('returns null for an empty selection', () => {
    expect(resolveHomogeneousBulk([])).toBeNull();
  });

  it('returns null for a single selection (single path handles it)', () => {
    expect(resolveHomogeneousBulk([ref('CONNECTOR', 'c1')])).toBeNull();
  });

  it('resolves a homogeneous multi-selection to {type, ids}', () => {
    const out = resolveHomogeneousBulk([
      ref('CONNECTOR', 'c1'),
      ref('CONNECTOR', 'c2'),
      ref('CONNECTOR', 'c3')
    ]);
    expect(out).toEqual({ type: 'CONNECTOR', ids: ['c1', 'c2', 'c3'] });
  });

  it('returns null for a heterogeneous multi-selection', () => {
    expect(
      resolveHomogeneousBulk([ref('CONNECTOR', 'c1'), ref('ITEM', 'i1')])
    ).toBeNull();
  });

  it('preserves selection order in ids', () => {
    const out = resolveHomogeneousBulk([
      ref('LABEL', 'b'),
      ref('LABEL', 'a')
    ]);
    expect(out?.ids).toEqual(['b', 'a']);
  });
});
