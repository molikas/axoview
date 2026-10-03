/**
 * The per-page default view angle (ADR 0051).
 *
 * The live angle is per-viewer uiState and never touches the model; a page may
 * carry ONE persisted angle, `view.defaultRotation`, which load, page switch
 * and the display routes open at. These pin the decision's unit-level
 * acceptance criteria against the real stores.
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { ModelProvider, useModelStoreApi } from 'src/stores/modelStore';
import { SceneProvider, useSceneStoreApi } from 'src/stores/sceneStore';
import { UiStateProvider, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { useHistory } from 'src/hooks/useHistory';
import { useInitialDataManager } from 'src/hooks/useInitialDataManager';
import { viewSchema } from 'src/schemas/views';
import { modelSchema } from 'src/schemas/model';
import { modelFromModelStore } from 'src/utils';
import type { InitialData } from 'src/types';

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ModelProvider>
    <SceneProvider>
      <UiStateProvider>{children}</UiStateProvider>
    </SceneProvider>
  </ModelProvider>
);

const useHarness = () => ({
  scene: useScene(),
  history: useHistory(),
  loader: useInitialDataManager(),
  modelApi: useModelStoreApi(),
  sceneApi: useSceneStoreApi(),
  uiApi: useUiStateStoreApi()
});

const baseView = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  items: [],
  connectors: [],
  rectangles: [],
  textBoxes: [],
  ...extra
});

const model = (views: ReturnType<typeof baseView>[]): InitialData =>
  ({
    version: '1.0',
    title: 'Rotation',
    icons: [],
    colors: [{ id: 'c1', value: '#000000' }],
    items: [],
    views
  }) as unknown as InitialData;

const setup = (data: InitialData) => {
  const { result } = renderHook(useHarness, { wrapper: Providers });
  act(() => {
    result.current.uiApi.getState().actions.setCanvasMode('ISOMETRIC');
    result.current.loader.load(data);
  });
  return result;
};

describe('the schema (ADR 0051 §1)', () => {
  it('round-trips a view with and without defaultRotation', () => {
    expect(viewSchema.safeParse(baseView('a')).success).toBe(true);
    const withField = viewSchema.safeParse(
      baseView('a', { defaultRotation: 37.5 })
    );
    expect(withField.success).toBe(true);
    expect(withField.success && withField.data.defaultRotation).toBe(37.5);
  });

  it('accepts (−180, 180] only', () => {
    expect(viewSchema.safeParse(baseView('a', { defaultRotation: 180 })).success).toBe(true);
    expect(viewSchema.safeParse(baseView('a', { defaultRotation: -180 })).success).toBe(false);
    expect(viewSchema.safeParse(baseView('a', { defaultRotation: 200 })).success).toBe(false);
  });

  it('an OLD client keeps the field through load and re-save', () => {
    // An old client's schema has no `defaultRotation`; zod strips unknown keys
    // from its PARSED output, but the loader stores the raw object it validated.
    // Simulate with a key THIS client does not know either: it must survive
    // load and re-save exactly as `defaultRotation` survives an old client.
    const data = model([
      baseView('v1', { defaultRotation: 60, futureViewField: 'kept' })
    ]);
    expect(modelSchema.safeParse(data).success).toBe(true);
    const result = setup(data);
    const saved = JSON.parse(
      JSON.stringify(modelFromModelStore(result.current.modelApi.getState()))
    );
    expect(saved.views[0].futureViewField).toBe('kept');
    expect(saved.views[0].defaultRotation).toBe(60);
  });

  it('lean save: a page with no default writes no field', () => {
    const result = setup(model([baseView('v1')]));
    const saved = JSON.parse(
      JSON.stringify(modelFromModelStore(result.current.modelApi.getState()))
    );
    expect('defaultRotation' in saved.views[0]).toBe(false);
  });
});

describe('setting the default (ADR 0051 §2)', () => {
  it('is ONE undo step and a model change; rotating is neither', () => {
    const result = setup(model([baseView('v1')]));
    const modelBefore = result.current.modelApi.getState();

    // Rotating never writes the model and never enters history.
    act(() => result.current.uiApi.getState().actions.setViewRotation(45));
    expect(result.current.modelApi.getState()).toBe(modelBefore);
    expect(result.current.history.canUndo).toBe(false);

    act(() => result.current.scene.updateView('v1', { defaultRotation: 45 }));
    expect(result.current.modelApi.getState().views[0].defaultRotation).toBe(45);
    expect(result.current.history.canUndo).toBe(true);

    act(() => result.current.history.undo());
    expect(result.current.modelApi.getState().views[0].defaultRotation).toBeUndefined();
    expect(result.current.history.canUndo).toBe(false);
    // ...and undoing the default did not move the live angle.
    expect(result.current.uiApi.getState().viewRotation).toBe(45);
  });

  it('setting it to 0 removes the field', () => {
    const result = setup(model([baseView('v1', { defaultRotation: 90 })]));
    act(() => result.current.scene.updateView('v1', { defaultRotation: undefined }));
    expect('defaultRotation' in result.current.modelApi.getState().views[0]).toBe(false);
  });
});

describe('where the default applies (ADR 0051 §3)', () => {
  it('a load opens at the page default — no carry-over', () => {
    const result = setup(model([baseView('v1', { defaultRotation: -90 })]));
    expect(result.current.uiApi.getState().viewRotation).toBe(-90);
    expect(result.current.uiApi.getState().viewRotationBase).toBe(-90);

    act(() => result.current.uiApi.getState().actions.setViewRotation(30));
    act(() => result.current.loader.load(model([baseView('v9')])));
    expect(result.current.uiApi.getState().viewRotation).toBe(0);
  });

  it('initialData.viewRotation wins over the page default', () => {
    const data = {
      ...model([baseView('v1', { defaultRotation: 90 })]),
      viewRotation: 15
    } as InitialData;
    const result = setup(data);
    expect(result.current.uiApi.getState().viewRotation).toBe(15);
  });

  it('a page switch opens the target at ITS default; a resync does not reset', () => {
    const result = setup(
      model([baseView('v1'), baseView('v2', { defaultRotation: 135 })])
    );
    expect(result.current.uiApi.getState().viewRotation).toBe(0);
    act(() => result.current.scene.switchView('v2'));
    expect(result.current.uiApi.getState().viewRotation).toBe(135);

    // The viewer turns the page; re-syncing the SAME page keeps their angle.
    act(() => result.current.uiApi.getState().actions.setViewRotation(150));
    act(() => result.current.scene.switchView('v2'));
    expect(result.current.uiApi.getState().viewRotation).toBe(150);

    act(() => result.current.scene.switchView('v1'));
    expect(result.current.uiApi.getState().viewRotation).toBe(0);
  });

  it('in 2D the default is retained but has no projection effect', () => {
    const { result } = renderHook(useHarness, { wrapper: Providers });
    act(() => {
      result.current.uiApi.getState().actions.setCanvasMode('2D');
      result.current.loader.load(model([baseView('v1', { defaultRotation: 60 })]));
    });
    expect(result.current.uiApi.getState().viewRotation).toBe(60);
  });
});
