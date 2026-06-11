// Preview-mode (EXPLORABLE_READONLY) layer visibility merge (ADR 0013).
//
// A UI-only override that decides whether a canvas entity is visible while
// presenting, without ever mutating the model's `layer.visible`. Precedence:
//   1. Solo wins — when a layer is solo'd, only entities on that layer show
//      (unassigned entities hidden); it reveals the layer regardless of its
//      model `visible` flag.
//   2. Otherwise, base model visibility minus the presenter's hidden set.
// In EDITABLE the override is ignored; callers pass the base visibility through.

import type { PreviewLayerOverrides } from 'src/types/ui';

/**
 * Whether an entity is visible under the preview override.
 * @param layerId            the entity's layer id (undefined = unassigned)
 * @param baseLayerVisible   model visibility: `!layer || layer.visible`
 * @param overrides          the current preview override
 */
export const isEntityVisibleInPreview = (
  layerId: string | undefined,
  baseLayerVisible: boolean,
  overrides: PreviewLayerOverrides
): boolean => {
  const { hiddenLayerIds, soloLayerId } = overrides;

  if (soloLayerId !== null) {
    return layerId === soloLayerId;
  }

  if (layerId && hiddenLayerIds.includes(layerId)) {
    return false;
  }

  return baseLayerVisible;
};
