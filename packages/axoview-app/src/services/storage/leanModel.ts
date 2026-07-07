import { PersistedDiagramBlob, isPersistedDiagramBlob } from './types';
import type { Icon } from 'axoview';

// ADR 0003 lean-save. Shared by every StorageProvider that persists a model so
// they all strip pack icons + record requiredPacks identically (LocalStorage +
// GoogleDrive). Keep it provider-agnostic — no fetch, no storage.
//
// Plain-object dictionaries (not Set) and indexed `for` loops throughout are
// deliberate: ts-jest transpiles `new Set` under target=es5 with a broken
// polyfill where `.add()` is a no-op for string members, making derived-/known-
// lookups silently empty.

// Index the icon ids referenced by items.
const collectItemIconIds = (
  items: PersistedDiagramBlob['items']
): { [k: string]: true } => {
  const itemIconIds: { [k: string]: true } = {};
  if (Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && typeof item.icon === 'string') itemIconIds[item.icon] = true;
    }
  }
  return itemIconIds;
};

// Walk the model's icons once: record which ids are known, and which
// non-core/non-imported collections are actually referenced by an item.
const analyzeModelIcons = (
  modelIcons: Icon[],
  itemIconIds: { [k: string]: true }
): {
  knownIconIds: { [k: string]: true };
  derivedRequiredPacks: { [k: string]: true };
} => {
  const knownIconIds: { [k: string]: true } = {};
  const derivedRequiredPacks: { [k: string]: true } = {};
  for (let i = 0; i < modelIcons.length; i++) {
    const icon = modelIcons[i];
    if (icon && icon.id) knownIconIds[icon.id] = true;
    if (
      icon &&
      icon.id &&
      itemIconIds[icon.id] &&
      typeof icon.collection === 'string' &&
      icon.collection !== 'isoflow' &&
      icon.collection !== 'imported'
    ) {
      derivedRequiredPacks[icon.collection] = true;
    }
  }
  return { knownIconIds, derivedRequiredPacks };
};

// True when every item-referenced icon id resolves against the icons array.
const allItemIconsResolved = (
  itemIconIds: { [k: string]: true },
  knownIconIds: { [k: string]: true }
): boolean => {
  const itemIconIdList = Object.keys(itemIconIds);
  for (let i = 0; i < itemIconIdList.length; i++) {
    if (!knownIconIds[itemIconIdList[i]]) return false;
  }
  return true;
};

/**
 * Apply ADR 0003 lean-save: keep only user-supplied (imported) icons. Pack icons
 * (isoflow, aws, gcp, …) are always rehydrated from the icon pack manager on
 * load, so their SVG payloads are not persisted. Also persists `requiredPacks` —
 * the unique non-isoflow/imported collections referenced by items — so the load
 * path can fetch exactly those packs.
 */
export const leanIfModel = (data: unknown): unknown => {
  if (!isPersistedDiagramBlob(data)) return data;
  const modelIcons: Icon[] | undefined = data.icons;
  if (!Array.isArray(modelIcons)) return data;
  const model = data;

  const itemIconIds = collectItemIconIds(model.items);
  const { knownIconIds, derivedRequiredPacks } = analyzeModelIcons(
    modelIcons,
    itemIconIds
  );

  // If every item's icon resolves against the icons array, the derived list is
  // authoritative. Otherwise the input is already lean (icons stripped to
  // imported-only) and we can't see what packs the unresolved items need —
  // preserve whatever was on the input rather than overwriting with [].
  const allResolved = allItemIconsResolved(itemIconIds, knownIconIds);
  const existingRequiredPacks = Array.isArray(model.requiredPacks)
    ? (model.requiredPacks as unknown[]).filter(
        (p): p is string => typeof p === 'string'
      )
    : null;
  const derived = Object.keys(derivedRequiredPacks);
  const requiredPacks = allResolved ? derived : existingRequiredPacks ?? derived;

  return {
    ...model,
    icons: modelIcons.filter((icon) => icon.collection === 'imported'),
    requiredPacks
  };
};
