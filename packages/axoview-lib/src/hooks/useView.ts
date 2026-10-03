import { useCallback } from 'react';
import { useUiStateStore, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useSceneStore } from 'src/stores/sceneStore';
import * as reducers from 'src/stores/reducers';
import { Model } from 'src/types';
import { INITIAL_SCENE_STATE } from 'src/config';

export const useView = () => {
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });

  const uiStateApi = useUiStateStoreApi();

  const sceneActions = useSceneStore((state) => {
    return state.actions;
  });

  const changeView = useCallback(
    (viewId: string, model: Model) => {
      const newState = reducers.view({
        action: 'SYNC_SCENE',
        payload: undefined,
        ctx: { viewId, state: { model, scene: INITIAL_SCENE_STATE } }
      });

      // ADR 0051 §3: switching PAGES opens the target at its default angle
      // (zoom and scroll carry over, as before). A resync of the page already
      // shown is not a switch, so it never resets a viewer's angle.
      const switching = uiStateApi.getState().view !== viewId;

      sceneActions.set(newState.scene, true);
      uiStateActions.setView(viewId);

      if (switching) {
        const target = model.views.find((v) => v.id === viewId);
        uiStateActions.jumpViewRotation(target?.defaultRotation ?? 0);
      }
    },
    [uiStateActions, uiStateApi, sceneActions]
  );

  return {
    changeView
  };
};
