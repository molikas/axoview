/**
 * D-7 — DUAL-STACK UNDO SKEW (canvas-interaction-behavior-map §4.5).
 *
 * STATUS (2026-06-14): FIXED via logical-action sequence stamping
 * (src/stores/historySequence.ts + useHistory coordination). The two stacks can
 * still skew at the depth level (a model-only op pushes a model entry but no
 * scene entry — the first test below still characterizes that), but
 * useHistory.undo/redo now reverts exactly ONE logical action per keystroke by
 * stamping every entry with a shared sequence and stepping only the stack(s)
 * whose top carries the most-recent (undo) / least-future (redo) sequence.
 *
 * Undo/redo is TWO independent immer patch stacks: modelStore.history (node
 * tiles, connector anchors, rectangles, textbox model) and sceneStore.history
 * (connector PATHS + scene textboxes). The real Ctrl+Z path is
 * useHistory.undo(), which steps BOTH stacks independently, each gated by its
 * own canUndo() ("model first then scene").
 *
 * A model-only operation (place icon / lone-node drag) pushes a MODEL entry but
 * — because the scene didn't change — hits the no-op branch in sceneStore.set
 * (produceWithPatches yields 0 patches → returns without pushing an entry and
 * without clearing future). So the two stacks drift to DIFFERENT depths.
 *
 * Once skewed, a SINGLE undo keystroke pops the top of EACH stack — which now
 * correspond to DIFFERENT user actions:
 *
 *   draw connector  (both stores)  → model.past=[c]   scene.past=[c']
 *   place icon      (model only)   → model.past=[c,p] scene.past=[c']
 *   Ctrl+Z (one undo)              → model pops p (icon)  ; scene pops c' (path)
 *
 * After that single undo the connector still exists in model.views[].connectors
 * but its scene.connectors[id] entry has been reverted = the MQA #5
 * invisible-connector symptom, via a different mechanism.
 *
 * Harness mirrors connector.createUndoRedo.test.tsx.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { ModelProvider, useModelStoreApi } from 'src/stores/modelStore';
import { SceneProvider, useSceneStoreApi } from 'src/stores/sceneStore';
import { UiStateProvider, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { useHistory } from 'src/hooks/useHistory';
import { getConnectorPath } from 'src/utils';

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ModelProvider>
    <SceneProvider>
      <UiStateProvider>{children}</UiStateProvider>
    </SceneProvider>
  </ModelProvider>
);

const useTestHarness = () => ({
  scene: useScene(),
  history: useHistory(),
  modelApi: useModelStoreApi(),
  sceneApi: useSceneStoreApi(),
  uiStateApi: useUiStateStoreApi()
});

const VIEW_ID = 'view-1';

function seedView() {
  return {
    version: '1.0',
    title: 'Test',
    icons: [{ id: 'block', name: 'Block', url: '', isIsometric: true }],
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
    result.current.sceneApi
      .getState()
      .actions.set({ connectors: {}, textBoxes: {} }, true);
    result.current.modelApi.getState().actions.clearHistory();
    result.current.sceneApi.getState().actions.clearHistory();
  });
  return result;
}

function modelView(result: ReturnType<typeof setup>) {
  return result.current.modelApi
    .getState()
    .views.find((v) => v.id === VIEW_ID)!;
}

/**
 * Coherence invariant: every connector present in the active view's model must
 * have a non-stale scene.connectors[id] path (presence + non-empty tiles + the
 * tiles match a fresh getConnectorPath recompute). A failure here IS the MQA #5
 * invisible-connector symptom (connector in model, empty/missing scene path).
 */
function expectCoherent(result: ReturnType<typeof setup>) {
  const scene = result.current.sceneApi.getState();
  const view = modelView(result);
  for (const c of view.connectors ?? []) {
    const sceneEntry = scene.connectors[c.id];
    expect(sceneEntry).toBeDefined();
    expect(sceneEntry.path.tiles.length).toBeGreaterThan(0);
    const fresh = getConnectorPath({ anchors: c.anchors, view });
    expect(sceneEntry.path.tiles).toEqual(fresh.tiles);
  }
}

function drawConnector(result: ReturnType<typeof setup>) {
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
    result.current.scene.updateConnector('new-conn', {
      anchors: [
        { id: 'a1', ref: { item: 'node-A' } },
        { id: 'a2', ref: { item: 'node-B' } }
      ]
    });
    result.current.scene.commitDragTransaction();
  });
}

function placeIconC(result: ReturnType<typeof setup>) {
  act(() => {
    result.current.scene.placeIcon({
      modelItem: { id: 'node-C', name: 'C', icon: 'block' },
      viewItem: { id: 'node-C', tile: { x: 3, y: 3 } }
    });
  });
}

describe('D-7 dual-stack undo skew (hazardous interleaved order)', () => {
  it('the model-only op pushes a model entry but NO scene entry (the skew source)', () => {
    const result = setup();

    drawConnector(result);
    expect(result.current.modelApi.getState().history.past.length).toBe(1);
    expect(result.current.sceneApi.getState().history.past.length).toBe(1);

    placeIconC(result);
    // Model gained an entry; scene's no-op branch left its stack untouched.
    expect(result.current.modelApi.getState().history.past.length).toBe(2);
    expect(result.current.sceneApi.getState().history.past.length).toBe(1);
  });

  // CORRECTED-BEHAVIOR spec for the D-7 fix (sequence stamping). One keystroke
  // reverts exactly one logical action across whichever store(s) participated,
  // and the active view's connectors stay coherent at every intermediate step —
  // the orphaned/invisible-connector window is gone.
  it('stays coherent after each undo and redo in the hazardous order', () => {
    const result = setup();

    drawConnector(result); // both stores  (logical action 1)
    placeIconC(result); //    model only   (logical action 2)
    expectCoherent(result);

    // Undo #1 reverts the most-recent action (place icon) only. The connector
    // (action 1) is untouched on BOTH stores — no orphaned path.
    act(() => {
      result.current.history.undo();
    });
    let view = modelView(result);
    expect((view.items ?? []).some((i) => i.id === 'node-C')).toBe(false);
    expect((view.connectors ?? []).some((c) => c.id === 'new-conn')).toBe(true);
    expect(
      result.current.sceneApi.getState().connectors['new-conn']
    ).toBeDefined();
    expectCoherent(result);

    // Undo #2 reverts the connector — both stacks (model anchors + scene path)
    // pop together because they share the same logical-action sequence.
    act(() => {
      result.current.history.undo();
    });
    view = modelView(result);
    expect((view.connectors ?? []).some((c) => c.id === 'new-conn')).toBe(false);
    expect(result.current.sceneApi.getState().connectors['new-conn']).toBe(
      undefined
    );
    expectCoherent(result);

    // Redo #1 re-applies the connector on both stores together.
    act(() => {
      result.current.history.redo();
    });
    view = modelView(result);
    expect((view.connectors ?? []).some((c) => c.id === 'new-conn')).toBe(true);
    expectCoherent(result);

    // Redo #2 re-applies the place icon (model only).
    act(() => {
      result.current.history.redo();
    });
    view = modelView(result);
    expect((view.items ?? []).some((i) => i.id === 'node-C')).toBe(true);
    expect((view.connectors ?? []).some((c) => c.id === 'new-conn')).toBe(true);
    expectCoherent(result);
  });
});
