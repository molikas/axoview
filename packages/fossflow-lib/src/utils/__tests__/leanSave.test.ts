import {
  stripDefaultIcons,
  mergeBundledFixtures,
  getBundledFixturesById
} from '../leanSave';
import { icons as bundledFixtures } from '../../fixtures/icons';

const baseModel = (icons: any[]) => ({
  title: 'Test',
  version: '1.0.0',
  icons,
  colors: [],
  items: [],
  views: []
});

describe('stripDefaultIcons (ADR 0003)', () => {
  it('drops icons that are pure duplicates of bundled fixtures', () => {
    const model = baseModel(bundledFixtures.map((i) => ({ ...i })));
    const stripped = stripDefaultIcons(model);
    expect(stripped.icons).toEqual([]);
  });

  it('preserves custom icons (unknown id)', () => {
    const customIcon = {
      id: 'custom-1',
      name: 'Custom',
      url: 'data:image/svg+xml;base64,abc'
    };
    const model = baseModel([...bundledFixtures.map((i) => ({ ...i })), customIcon]);
    const stripped = stripDefaultIcons(model);
    expect(stripped.icons).toEqual([customIcon]);
  });

  it('preserves overridden defaults (same id, changed name)', () => {
    const overridden = { ...bundledFixtures[0], name: 'User-renamed' };
    const model = baseModel([overridden]);
    const stripped = stripDefaultIcons(model);
    expect(stripped.icons).toEqual([overridden]);
  });

  it('returns empty icons when input has no icons field', () => {
    const stripped = stripDefaultIcons({ icons: undefined as any });
    expect(stripped.icons).toEqual([]);
  });
});

describe('mergeBundledFixtures (ADR 0002)', () => {
  it('adds every bundled fixture when model.icons is empty', () => {
    const merged = mergeBundledFixtures(baseModel([]));
    const ids = new Set(merged.icons.map((i: any) => i.id));
    for (const fixture of bundledFixtures) {
      expect(ids.has(fixture.id)).toBe(true);
    }
    expect(merged.icons.length).toBe(bundledFixtures.length);
  });

  it('preserves custom icons and adds bundled fixtures alongside', () => {
    const customIcon = {
      id: 'custom-1',
      name: 'Custom',
      url: 'data:image/svg+xml;base64,abc'
    };
    const merged = mergeBundledFixtures(baseModel([customIcon]));
    expect(merged.icons.length).toBe(bundledFixtures.length + 1);
    expect(merged.icons.some((i: any) => i.id === 'custom-1')).toBe(true);
  });

  it('overridden default wins over bundled fixture (same id, changed metadata)', () => {
    const overridden = { ...bundledFixtures[0], name: 'User-renamed' };
    const merged = mergeBundledFixtures(baseModel([overridden]));
    const found = merged.icons.find((i: any) => i.id === bundledFixtures[0].id);
    expect(found?.name).toBe('User-renamed');
  });
});

describe('round-trip: strip then merge', () => {
  it('produces an icons array equivalent to the original (modulo order)', () => {
    const customIcon = {
      id: 'custom-1',
      name: 'Custom',
      url: 'data:image/svg+xml;base64,abc'
    };
    const original = baseModel([...bundledFixtures.map((i) => ({ ...i })), customIcon]);

    const stripped = stripDefaultIcons(original);
    const remerged = mergeBundledFixtures(stripped);

    const originalIds = new Set(original.icons.map((i: any) => i.id));
    const remergedIds = new Set(remerged.icons.map((i: any) => i.id));
    expect(remergedIds).toEqual(originalIds);
    expect(remerged.icons.find((i: any) => i.id === 'custom-1')).toEqual(customIcon);
  });
});

describe('getBundledFixturesById', () => {
  it('returns the same memoized Map across calls', () => {
    const a = getBundledFixturesById();
    const b = getBundledFixturesById();
    expect(a).toBe(b);
  });

  it('contains every bundled fixture keyed by id', () => {
    const map = getBundledFixturesById();
    for (const fixture of bundledFixtures) {
      expect(map.get(fixture.id)).toEqual(fixture);
    }
  });
});
