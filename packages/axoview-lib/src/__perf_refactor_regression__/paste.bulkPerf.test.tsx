/**
 * PERF REGRESSION — bulk paste (the "paste freeze" fix)
 *
 * Reproduces the user-reported defect: select ~150 nodes → Ctrl+C → Ctrl+V →
 * the app freezes / "dies". Root cause was a synchronous per-item create loop
 * inside one transaction in useSceneActions.pasteItems, where each pasted node
 * paid:
 *   1. O(N^3) validation — every createViewItem ends in updateViewItem →
 *      validateView(entireView), and validateView did a linear findIndex
 *      (getItemByIdOrThrow) per view item against model.items. Insert i cost
 *      ~O((N+i)^2); summed over N inserts = O(N^3).
 *   2. O(N^2) immer churn — ~2 full-state produce() clones per pasted node, each
 *      copying (and deep-freezing) the growing items/views arrays.
 *
 * The fix (Phase 1): pasteItems assembles the N-scale arrays in ONE structural
 * pass (no per-item produce, no per-item reducer) and validates the resulting
 * view ONCE. Paste of N nodes goes O(N^3) → O(N).
 *
 * This suite drives the REAL store stack + REAL pasteItems (the function that
 * froze) — the unit suite in clipboard/__tests__/useCopyPaste.test.ts mocks
 * pasteItems, so it cannot catch this. Asserted here:
 *   (a) a 150-node paste completes well under a generous budget (no freeze),
 *   (b) the pasted nodes all land (300 model + 300 view items),
 *   (c) no two nodes share a tile (pasteItems writes every tile faithfully),
 *   (d) the whole paste is exactly ONE undo entry and fully reversible.
 *
 * On the pre-fix code (O(N^3)) the timing test blows the budget; (b)-(d) pass
 * (the old loop was correct, just catastrophically slow).
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { ModelProvider, useModelStoreApi } from 'src/stores/modelStore';
import { SceneProvider, useSceneStoreApi } from 'src/stores/sceneStore';
import { UiStateProvider, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { DEFAULT_COLOR } from 'src/config';
import { Model } from 'src/types';
import { PastePayload } from 'src/clipboard/clipboard';
import * as validation from 'src/schemas/validation';

// ---------------------------------------------------------------------------
// Provider stack — same nesting as Axoview.tsx
// ---------------------------------------------------------------------------
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

const VIEW_ID = 'perf-view';
// The reported repro is ~150 nodes. The O(N^3) cliff is steep enough that 150
// already hangs the real app; in the headless harness it blows the budget.
const N = 150;
// Generous absolute bound — the fix runs in low tens of ms here; the ceiling
// leaves ample headroom for slow CI runners while still catching a
// re-introduction of the cubic (which is multi-hundred-ms-to-seconds at N=150).
const PASTE_BUDGET_MS = 600;

// A compact grid of N existing nodes occupying tiles around the origin.
function buildSeedModel(n: number): Model {
  const items = [];
  const viewItems = [];
  const width = 13; // ~13x12 block for 150 nodes
  for (let i = 0; i < n; i += 1) {
    const id = `seed-${i}`;
    items.push({ id, name: `Seed ${i}` });
    viewItems.push({ id, tile: { x: i % width, y: Math.floor(i / width) } });
  }
  return {
    version: '',
    title: 'Paste perf',
    description: '',
    colors: [DEFAULT_COLOR],
    icons: [],
    items,
    views: [
      {
        id: VIEW_ID,
        name: 'Page 1',
        items: viewItems,
        connectors: [],
        rectangles: [],
        textBoxes: []
      }
    ]
  };
}

// A paste payload of N fresh nodes (new ids) on distinct, non-overlapping tiles
// — exactly what useCopyPaste.handlePaste produces after id-remap + collision
// avoidance. pasteItems must write all of them without stacking or dropping.
function buildPastePayload(n: number): PastePayload {
  const items = [];
  const width = 13;
  for (let i = 0; i < n; i += 1) {
    const id = `paste-${i}`;
    items.push({
      modelItem: { id, name: `Pasted ${i}` },
      viewItem: { id, tile: { x: i % width, y: 1000 + Math.floor(i / width) } }
    });
  }
  return { items, connectors: [], rectangles: [], textBoxes: [], labels: [] };
}

function setup(n: number = N) {
  const { result } = renderHook(useTestHarness, { wrapper: Providers });

  act(() => {
    result.current.uiStateApi.getState().actions.setView(VIEW_ID);
    result.current.modelApi.getState().actions.set(buildSeedModel(n), true);
    // Clean past stack at t=0 so we can assert exactly one entry lands on paste.
    result.current.modelApi.getState().actions.clearHistory();
    result.current.sceneApi.getState().actions.clearHistory();
  });

  return result;
}

const currentView = (result: ReturnType<typeof setup>) =>
  result.current.modelApi
    .getState()
    .views.find((v) => v.id === VIEW_ID)!;

const uniqueTileCount = (tiles: { x: number; y: number }[]) =>
  new Set(tiles.map((t) => `${t.x},${t.y}`)).size;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('bulk paste — perf regression (paste freeze)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // THE freeze guard — deterministic and machine-independent. The pre-fix path
  // (per-item createViewItem → updateViewItem → validateView) validated the
  // ENTIRE growing view once PER pasted node: N validateView calls, each
  // O((N+i)·M) via the linear getItemByIdOrThrow — i.e. the O(N^3) cubic. The
  // fix assembles the arrays in one pass and validates the result exactly once.
  // On the pre-fix code this asserts 150 ≤ 1 and FAILS (documents the bug).
  test('validates the pasted view at most once (not once per node)', () => {
    const result = setup();
    const payload = buildPastePayload(N);

    // spyOn (not mock) — the real validator still runs, so correctness holds;
    // we only count invocations.
    const spy = jest.spyOn(validation, 'validateView');

    act(() => {
      result.current.scene.pasteItems(payload);
    });

    // Sanity: the paste actually landed (so we know the path ran).
    expect(result.current.modelApi.getState().items).toHaveLength(2 * N);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test(`pastes ${N} nodes in under ${PASTE_BUDGET_MS}ms (loose bound)`, () => {
    // Loose absolute bound — the fix runs in low tens of ms; this catches an
    // order-of-magnitude regression (e.g. re-introducing the per-item produce
    // / per-item validate loop) without flaking on slow CI runners.
    const result = setup();
    const payload = buildPastePayload(N);

    const t0 = performance.now();
    act(() => {
      result.current.scene.pasteItems(payload);
    });
    const elapsed = performance.now() - t0;

    // Sanity: the paste actually landed (so we're timing real work).
    expect(result.current.modelApi.getState().items).toHaveLength(2 * N);
    expect(elapsed).toBeLessThan(PASTE_BUDGET_MS);
  });

  test(`all ${N} pasted nodes land — 2N model + 2N view items, no stacking`, () => {
    const result = setup();
    const payload = buildPastePayload(N);

    act(() => {
      result.current.scene.pasteItems(payload);
    });

    const model = result.current.modelApi.getState();
    expect(model.items).toHaveLength(2 * N);

    const view = currentView(result);
    expect(view.items).toHaveLength(2 * N);

    // No two nodes share a tile — pasteItems wrote every tile faithfully.
    expect(uniqueTileCount(view.items.map((vi) => vi.tile))).toBe(2 * N);
  });

  test('the whole paste is exactly one undo entry and fully reversible', () => {
    const result = setup();
    const payload = buildPastePayload(N);

    const pastBefore =
      result.current.modelApi.getState().history.past.length;

    act(() => {
      result.current.scene.pasteItems(payload);
    });

    const pastAfter =
      result.current.modelApi.getState().history.past.length;
    // One transaction → exactly one history entry, regardless of node count.
    expect(pastAfter - pastBefore).toBe(1);

    act(() => {
      result.current.modelApi.getState().actions.undo();
    });

    // Undo removes exactly the pasted set, restoring the original N.
    expect(result.current.modelApi.getState().items).toHaveLength(N);
    expect(currentView(result).items).toHaveLength(N);
  });
});
