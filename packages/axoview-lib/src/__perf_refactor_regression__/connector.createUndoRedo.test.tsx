/**
 * REGRESSION — MQA #5 (Bundle B re-test): user reports that drawing a single
 * connector with the palette tool then pressing undo correctly removes it,
 * but redo does NOT bring it back AND the redo button becomes disabled.
 * That means future stack is empty after undo on at least one of model/scene.
 *
 * This test reproduces the create flow (begin/createConnector/commit) on real
 * stores, runs undo, and asserts canRedo() is true on both stores.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { ModelProvider, useModelStoreApi } from 'src/stores/modelStore';
import { SceneProvider, useSceneStoreApi } from 'src/stores/sceneStore';
import { UiStateProvider, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ModelProvider>
    <SceneProvider>
      <UiStateProvider>{children}</UiStateProvider>
    </SceneProvider>
  </ModelProvider>
);

const useTestHarness = () => ({
  scene: useScene(),
  modelApi: useModelStoreApi(),
  sceneApi: useSceneStoreApi(),
  uiStateApi: useUiStateStoreApi()
});

const VIEW_ID = 'view-1';

function seedView() {
  return {
    version: '1.0',
    title: 'Test',
    icons: [
      { id: 'block', name: 'Block', url: '', isIsometric: true }
    ],
    colors: [{ id: 'c1', value: '#0066cc' }],
    items: [
      { id: 'node-A', name: 'A', icon: 'block' },
      { id: 'node-B', name: 'B', icon: 'block' }
    ],
    views: [
      {
        id: VIEW_ID,
        name: 'View',
        items: [
          { id: 'node-A', tile: { x: 0, y: 0 } },
          { id: 'node-B', tile: { x: 5, y: 5 } }
        ],
        connectors: [],
        rectangles: [],
        textBoxes: []
      }
    ]
  };
}

function setup() {
  const { result } = renderHook(useTestHarness, { wrapper: Providers });
  act(() => {
    result.current.uiStateApi.getState().actions.setView(VIEW_ID);
    result.current.modelApi.getState().actions.set(seedView(), true);
    result.current.sceneApi.getState().actions.set(
      { connectors: {}, textBoxes: {} },
      true
    );
    result.current.modelApi.getState().actions.clearHistory();
    result.current.sceneApi.getState().actions.clearHistory();
  });
  return result;
}

describe('connector create → undo → redo (MQA #5)', () => {
  it('after begin/create/commit then undo, canRedo is true on both stores', () => {
    const result = setup();

    // Simulate connector palette tool: drag from node-A to node-B.
    act(() => {
      result.current.scene.beginDragTransaction();
      result.current.scene.createConnector({
        id: 'new-conn',
        color: 'c1',
        anchors: [
          { id: 'a1', ref: { item: 'node-A' } },
          { id: 'a2', ref: { item: 'node-A' } }
        ]
      });
      // Simulate a few drag ticks updating the second anchor.
      result.current.scene.updateConnector('new-conn', {
        anchors: [
          { id: 'a1', ref: { item: 'node-A' } },
          { id: 'a2', ref: { tile: { x: 2, y: 2 } } }
        ]
      });
      result.current.scene.updateConnector('new-conn', {
        anchors: [
          { id: 'a1', ref: { item: 'node-A' } },
          { id: 'a2', ref: { item: 'node-B' } }
        ]
      });
      result.current.scene.commitDragTransaction();
    });

    const modelPastAfterCreate =
      result.current.modelApi.getState().history.past.length;
    const scenePastAfterCreate =
      result.current.sceneApi.getState().history.past.length;

    // Sanity: exactly one entry should have been pushed on each store.
    expect(modelPastAfterCreate).toBe(1);
    expect(scenePastAfterCreate).toBe(1);

    // Undo on both stores.
    act(() => {
      result.current.modelApi.getState().actions.undo();
      result.current.sceneApi.getState().actions.undo();
    });

    // Connector should be gone from both stores.
    const modelStateAfterUndo = result.current.modelApi.getState();
    expect(modelStateAfterUndo.views[0].connectors).toEqual([]);

    // canRedo MUST be true — otherwise the user's symptom (redo button
    // disabled, redo doesn't bring connector back) reproduces.
    expect(result.current.modelApi.getState().actions.canRedo()).toBe(true);
    expect(result.current.sceneApi.getState().actions.canRedo()).toBe(true);

    // Now redo and verify the connector returns.
    act(() => {
      result.current.modelApi.getState().actions.redo();
      result.current.sceneApi.getState().actions.redo();
    });

    const modelAfterRedo = result.current.modelApi.getState();
    expect(modelAfterRedo.views[0].connectors.length).toBe(1);
    expect(modelAfterRedo.views[0].connectors[0].id).toBe('new-conn');
  });
});
