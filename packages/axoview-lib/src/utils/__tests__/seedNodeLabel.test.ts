import { seedNodeLabel } from '../seedNodeLabel';

describe('seedNodeLabel (ADR 0032 amendment — label↔name decouple seed)', () => {
  it('seeds label = name when name is set and label is absent', () => {
    const out = seedNodeLabel({ id: 'a', name: 'Database' }) as Record<
      string,
      unknown
    >;
    expect(out.label).toBe('Database');
    expect(out.name).toBe('Database');
  });

  it('is idempotent — a second pass does not change an already-seeded item', () => {
    const once = seedNodeLabel({ id: 'a', name: 'Database' });
    const twice = seedNodeLabel(once);
    expect(twice).toEqual(once);
  });

  it('preserves an existing distinct label (does not overwrite a user edit)', () => {
    const out = seedNodeLabel({
      id: 'a',
      name: 'db-primary',
      label: 'Primary DB'
    }) as Record<string, unknown>;
    expect(out.label).toBe('Primary DB');
    expect(out.name).toBe('db-primary');
  });

  it('preserves an explicit empty label (user cleared it to hide the chip)', () => {
    const out = seedNodeLabel({ id: 'a', name: 'Database', label: '' }) as Record<
      string,
      unknown
    >;
    expect(out.label).toBe('');
  });

  it('does not seed when name is empty', () => {
    const out = seedNodeLabel({ id: 'a', name: '' }) as Record<string, unknown>;
    expect(out.label).toBeUndefined();
  });

  it('returns non-objects untouched', () => {
    expect(seedNodeLabel(null)).toBeNull();
    expect(seedNodeLabel('x')).toBe('x');
  });
});
