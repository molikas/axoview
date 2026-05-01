import { Icon, Model } from 'src/types';
import { icons as bundledFixtures } from 'src/fixtures/icons';

let _byIdCache: Map<string, Icon> | null = null;

export const getBundledFixturesById = (): Map<string, Icon> => {
  if (_byIdCache === null) {
    _byIdCache = new Map(bundledFixtures.map((icon) => [icon.id, icon]));
  }
  return _byIdCache;
};

const ICON_COMPARE_FIELDS: (keyof Icon)[] = ['name', 'url', 'collection', 'isIsometric'];

const iconMatchesFixture = (icon: Icon, fixture: Icon): boolean => {
  for (const field of ICON_COMPARE_FIELDS) {
    if (icon[field] !== fixture[field]) return false;
  }
  return true;
};

/**
 * Drop icons that are pure duplicates of bundled fixtures.
 * Custom icons (unknown id) and overridden defaults (same id, different metadata)
 * are preserved verbatim. See ADR 0003.
 */
export const stripDefaultIcons = <M extends Pick<Model, 'icons'>>(model: M): M => {
  const byId = getBundledFixturesById();
  const filtered = (model.icons ?? []).filter((icon) => {
    const fixture = byId.get(icon.id);
    if (!fixture) return true;
    return !iconMatchesFixture(icon, fixture);
  });
  return { ...model, icons: filtered };
};

/**
 * Merge bundled fixtures into a saved model's icons array. Used by the loader
 * (ADR 0002) so the side dock always has the full catalog regardless of what
 * was saved. Union by id, with the model's entry winning on collision (so user
 * overrides of default-icon metadata are preserved).
 */
export const mergeBundledFixtures = <M extends Pick<Model, 'icons'>>(model: M): M => {
  const modelIcons = model.icons ?? [];
  const seen = new Set(modelIcons.map((i) => i.id));
  const additions = bundledFixtures.filter((f) => !seen.has(f.id));
  if (additions.length === 0) return { ...model, icons: modelIcons };
  return { ...model, icons: [...modelIcons, ...additions] };
};
