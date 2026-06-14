/**
 * PERF REGRESSION — rectangle / textbox MOVE drag (immer-free batch path)
 *
 * The bug (reported 2026-06-14, perf-diag capture): moving a placed rectangle or
 * textbox dropped to ~7 fps with a GC sawtooth. DragItems moved nodes via the
 * CSS-preview path (no model write) but routed textbox/rectangle moves through
 * updateRectangle/updateTextBox, each running `produce(state, ...)` over the
 * FULL model+scene graph PER FRAME. Even inside a drag transaction (history
 * frozen) that full-state immer clone every frame is the allocation that starves
 * the GC.
 *
 * The fix: batchUpdateRectangles / batchUpdateTextBoxTiles do ONE structural
 * array copy of the active view's rectangles/textBoxes — no immer, no scene
 * touch. This test pins:
 *   1. a move still collapses to ONE history entry under a drag transaction
 *      (correctness — undo rewinds the whole drag, not one tile at a time),
 *   2. the move is applied correctly,
 *   3. untouched views keep reference identity (structural sharing preserved —
 *      a naive deep clone would fail this),
 *   4. a rectangle move leaves the scene store untouched (model-only).
 *
 * Mirrors connector.dragPerf.test.tsx's "N ticks → 1 entry" invariant.
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
const OTHER_VIEW_ID = 'view-2';
const DRAG_TICKS = 40;

function seedModel() {
  return {
    version: '1.0',
    title: 'Test',
    icons: [],
    colors: [{ id: 'c1', value: '#0066cc' }],
    items: [],
    views: [
      {
        id: VIEW_ID,
        name: 'V1',
        items: [],
        connectors: [],
        rectangles: [
          { id: 'rect1', from: { x: 0, y: 0 }, to: { x: 2, y: 2 }, color: 'c1' }
        ],
        textBoxes: [{ id: 'tb1', tile: { x: 1, y: 1 }, content: 'hi' }]
      },
      {
        id: OTHER_VIEW_ID,
        name: 'V2',
        items: [],
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
    result.current.modelApi.getState().actions.set(seedModel(), true);
    result.current.sceneApi
      .getState()
      .actions.set({ connectors: {}, textBoxes: {} }, true);
    result.current.modelApi.getState().actions.clearHistory();
    result.current.sceneApi.getState().actions.clearHistory();
  });
  return result;
}

const view = (result: ReturnType<typeof setup>, id = VIEW_ID) =>
  result.current.modelApi.getState().views.find((v) => v.id === id)!;

describe('rectangle/textbox move — perf regression', () => {
  test('rectangle drag collapses N batch updates into 1 history entry + lands the move', () => {
    const result = setup();
    const pastBefore =
      result.current.modelApi.getState().history.past.length;

    act(() => {
      result.current.scene.beginDragTransaction();
    });
    for (let i = 1; i <= DRAG_TICKS; i += 1) {
      act(() => {
        result.current.scene.batchUpdateRectangles([
          { id: 'rect1', from: { x: i, y: i }, to: { x: i + 2, y: i + 2 } }
        ]);
      });
      // History stays flat across every intermediate tick.
      expect(result.current.modelApi.getState().history.past.length).toBe(
        pastBefore
      );
    }
    act(() => {
      result.current.scene.commitDragTransaction();
    });

    expect(
      result.current.modelApi.getState().history.past.length - pastBefore
    ).toBe(1);
    const r = view(result).rectangles!.find((x) => x.id === 'rect1')!;
    expect(r.from).toEqual({ x: DRAG_TICKS, y: DRAG_TICKS });
    expect(r.to).toEqual({ x: DRAG_TICKS + 2, y: DRAG_TICKS + 2 });
  });

  test('textbox drag collapses N batch updates into 1 history entry + lands the move', () => {
    const result = setup();
    const pastBefore =
      result.current.modelApi.getState().history.past.length;

    act(() => {
      result.current.scene.beginDragTransaction();
    });
    for (let i = 1; i <= DRAG_TICKS; i += 1) {
      act(() => {
        result.current.scene.batchUpdateTextBoxTiles([
          { id: 'tb1', tile: { x: i, y: i } }
        ]);
      });
      expect(result.current.modelApi.getState().history.past.length).toBe(
        pastBefore
      );
    }
    act(() => {
      result.current.scene.commitDragTransaction();
    });

    expect(
      result.current.modelApi.getState().history.past.length - pastBefore
    ).toBe(1);
    const tb = view(result).textBoxes!.find((x) => x.id === 'tb1')!;
    expect(tb.tile).toEqual({ x: DRAG_TICKS, y: DRAG_TICKS });
  });

  test('batchUpdateRectangles preserves untouched-view identity (structural sharing, no deep clone)', () => {
    const result = setup();
    const otherBefore = view(result, OTHER_VIEW_ID);

    act(() => {
      result.current.scene.beginDragTransaction();
      result.current.scene.batchUpdateRectangles([
        { id: 'rect1', from: { x: 9, y: 9 }, to: { x: 11, y: 11 } }
      ]);
      result.current.scene.commitDragTransaction();
    });

    // The untouched view object keeps its reference — a full deep clone of the
    // model graph per frame (the regressed path) would replace it.
    expect(view(result, OTHER_VIEW_ID)).toBe(otherBefore);
  });

  test('a rectangle move leaves the scene store untouched (model-only)', () => {
    const result = setup();
    const sceneConnectorsBefore =
      result.current.sceneApi.getState().connectors;
    const sceneTextBoxesBefore =
      result.current.sceneApi.getState().textBoxes;

    act(() => {
      result.current.scene.beginDragTransaction();
      result.current.scene.batchUpdateRectangles([
        { id: 'rect1', from: { x: 5, y: 5 }, to: { x: 7, y: 7 } }
      ]);
      result.current.scene.commitDragTransaction();
    });

    expect(result.current.sceneApi.getState().connectors).toBe(
      sceneConnectorsBefore
    );
    expect(result.current.sceneApi.getState().textBoxes).toBe(
      sceneTextBoxesBefore
    );
  });
});
