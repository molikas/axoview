import { produce } from 'immer';
import { Label } from 'src/types';
import { getItemByIdOrThrow } from 'src/utils';
import { State, ViewReducerContext } from './types';

// Label reducers (ADR 0031). Labels are MODEL-ONLY: unlike a TextBox they carry
// no scene-size entry — the Canvas2D LabelsCanvas and the DOM LabelHitLayer each
// measure the chip themselves (exactly like node labels in NodesCanvas), so
// there is no syncLabel / scene write here and nothing for SYNC_SCENE to rebuild.

export const updateLabel = (
  { id, ...updates }: { id: string } & Partial<Label>,
  { viewId, state }: ViewReducerContext
): State => {
  const view = getItemByIdOrThrow(state.model.views, viewId);

  return produce(state, (draft) => {
    const { labels } = draft.model.views[view.index];

    if (!labels) return;

    const label = getItemByIdOrThrow(labels, id);
    labels[label.index] = { ...label.value, ...updates };
  });
};

export const createLabel = (
  newLabel: Label,
  { viewId, state }: ViewReducerContext
): State => {
  const view = getItemByIdOrThrow(state.model.views, viewId);

  return produce(state, (draft) => {
    const { labels } = draft.model.views[view.index];

    if (!labels) {
      draft.model.views[view.index].labels = [newLabel];
    } else {
      labels.unshift(newLabel);
    }
  });
};

export const deleteLabel = (
  id: string,
  { viewId, state }: ViewReducerContext
): State => {
  const view = getItemByIdOrThrow(state.model.views, viewId);
  const label = getItemByIdOrThrow(view.value.labels ?? [], id);

  return produce(state, (draft) => {
    draft.model.views[view.index].labels?.splice(label.index, 1);
  });
};
