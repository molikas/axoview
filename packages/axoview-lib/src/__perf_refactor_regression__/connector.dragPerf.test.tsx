/**
 * PERF REGRESSION — connector drag (drag transaction + closed-form router)
 *
 * Reproduces the slow-drag bug from 2026-05-09: every tile crossed during a
 * connector drag triggered (a) a history-patch computation across the whole
 * model, and (b) an A* run on a freshly allocated W×H grid. On a moderately
 * sized diagram this dropped frame rate from 60 to single digits with heavy
 * GC churn.
 *
 * The fix has two parts, both verified here:
 *   1. beginDragTransaction / commitDragTransaction collapse N per-tick history
 *      entries into 1. Asserted as a CORRECTNESS invariant — if this regresses,
 *      undo will rewind one tile at a time again.
 *   2. The closed-form router (utils/pathfinder.ts) replaced A* over an
 *      always-empty grid. Asserted as a TIMING bound — generous to avoid CI
 *      flake but tight enough to catch a re-introduction of A* / new
 *      per-tick allocation churn.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { ModelProvider, useModelStoreApi } from 'src/stores/modelStore';
import { SceneProvider, useSceneStoreApi } from 'src/stores/sceneStore';
import {
  UiStateProvider,
  useUiStateStoreApi
} from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { modelSchema } from 'src/schemas/model';

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

// One hook to surface every API we drive.
const useTestHarness = () => ({
  scene: useScene(),
  modelApi: useModelStoreApi(),
  sceneApi: useSceneStoreApi(),
  uiStateApi: useUiStateStoreApi()
});

// ---------------------------------------------------------------------------
// Fixture — 80 nodes / 120 connectors, schema-validated on load. Originally
// shared with the legacy e2e suite; that suite was deleted in T1 Session 2
// (`3ff4110`), so the fixture now lives alongside its sole consumer (this
// test) and the cross-package read is gone.
// ---------------------------------------------------------------------------
const FIXTURE_PATH = resolve(
  __dirname,
  'fixtures/perf-stress-diagram.json'
);

const SEED_MODEL = (() => {
  const raw = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8'));
  // Strict-validate. If the fixture goes out of schema (importable manually
  // but rejected by the model schema), fail here with a clear error rather
  // than letting downstream calls silently mis-seed the stores.
  const parsed = modelSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((i) => `  - ${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('\n');
    throw new Error(
      `perf-stress-diagram.json failed model schema validation:\n${issues}`
    );
  }
  return parsed.data;
})();

const VIEW_ID = SEED_MODEL.views[0].id;
// One connector in the fixture is reserved for the drag test — pick the first
// filler-pair connector and rewrite its ref so it starts both anchors on Node A.
// (This keeps the import file as a single artifact while still giving us a
// well-defined "drag-connector" handle for the simulation.)
const DRAG_CONNECTOR_ID = 'drag-conn';
// Stay under MAX_HISTORY_SIZE (50) so the no-transaction baseline test can
// assert an exact count rather than fight overflow trim.
const DRAG_TICKS = 40;

function buildSeedModel() {
  // Clone-once-per-test so mutations during the run don't leak across tests.
  const seed = JSON.parse(JSON.stringify(SEED_MODEL));
  const view = seed.views[0];
  // Inject the drag-connector at the head of the connectors list.
  view.connectors = [
    {
      id: DRAG_CONNECTOR_ID,
      color: seed.colors[0].id,
      anchors: [
        { id: 'drag-a1', ref: { item: 'node-A' } },
        { id: 'drag-a2', ref: { item: 'node-A' } }
      ]
    },
    ...view.connectors
  ];
  return seed;
}

// ---------------------------------------------------------------------------
// Test setup — render harness, seed stores, return helpers
// ---------------------------------------------------------------------------
function setup() {
  const { result } = renderHook(useTestHarness, { wrapper: Providers });

  act(() => {
    // Seed model + scene with skipHistory so the seed itself doesn't pollute
    // the past stack.
    result.current.uiStateApi.getState().actions.setView(VIEW_ID);
    result.current.modelApi.getState().actions.set(buildSeedModel(), true);
    // Seed an empty path for the dragged connector — updateConnector will
    // overwrite it on first tick.
    result.current.sceneApi.getState().actions.set(
      {
        connectors: {
          [DRAG_CONNECTOR_ID]: {
            path: {
              tiles: [],
              rectangle: { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } }
            }
          }
        },
        textBoxes: {}
      },
      true
    );
    // Discard any history entries the seed-set might have produced before
    // measuring — we want a clean past stack at t=0.
    result.current.modelApi.getState().actions.clearHistory();
    result.current.sceneApi.getState().actions.clearHistory();
  });

  return result;
}

// One simulated tile-crossing during a drag — exactly the work
// Connector.mousemove does per `hasMovedTile` event.
function tickDrag(
  result: ReturnType<typeof setup>,
  tile: { x: number; y: number }
) {
  act(() => {
    result.current.scene.updateConnector(DRAG_CONNECTOR_ID, {
      anchors: [
        { id: 'drag-a1', ref: { item: 'node-A' } },
        { id: `drag-a2-${tile.x}-${tile.y}`, ref: { tile } }
      ]
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('connector drag — perf regression', () => {
  test('drag transaction collapses N tile updates into 1 history entry', () => {
    const result = setup();
    const pastBefore =
      result.current.modelApi.getState().history.past.length;

    act(() => {
      result.current.scene.beginDragTransaction();
    });
    for (let i = 0; i < DRAG_TICKS; i += 1) {
      tickDrag(result, { x: 2 + i, y: 6 + (i % 12) });
    }
    act(() => {
      result.current.scene.commitDragTransaction();
    });

    const pastAfter =
      result.current.modelApi.getState().history.past.length;

    // Exactly 1 entry should have landed even though we did DRAG_TICKS updates.
    // If this ever returns DRAG_TICKS, the begin/commit wiring has regressed
    // (likely a missing freezePendingPre call on one of the stores).
    expect(pastAfter - pastBefore).toBe(1);
  });

  test('without drag transaction, every tick lands its own history entry', () => {
    // Inverse of the test above — proves the drag transaction is doing
    // something. If both this and the previous test were green, the previous
    // test could be a no-op.
    const result = setup();
    const pastBefore =
      result.current.modelApi.getState().history.past.length;

    for (let i = 0; i < DRAG_TICKS; i += 1) {
      tickDrag(result, { x: 2 + i, y: 6 + (i % 12) });
    }

    const pastAfter =
      result.current.modelApi.getState().history.past.length;
    expect(pastAfter - pastBefore).toBe(DRAG_TICKS);
  });

  test('drag transaction does not consume pendingPre on intermediate ticks', () => {
    // Internal contract: while a drag is open, freezePendingPre keeps the
    // pre-drag snapshot alive so commitDragTransaction can diff against it.
    // If a per-tick set() ever consumed pendingPre, the drag would land its
    // first entry on tick 1 and a no-op (or wrong-pre) entry on commit.
    // Asserted by checking that history.past stays flat across all ticks
    // and only grows on commit.
    const result = setup();
    const pastBefore =
      result.current.modelApi.getState().history.past.length;

    act(() => {
      result.current.scene.beginDragTransaction();
    });
    for (let i = 0; i < DRAG_TICKS; i += 1) {
      tickDrag(result, { x: 2 + i, y: 6 + (i % 12) });
      expect(
        result.current.modelApi.getState().history.past.length
      ).toBe(pastBefore);
    }
    act(() => {
      result.current.scene.commitDragTransaction();
    });
    expect(
      result.current.modelApi.getState().history.past.length
    ).toBe(pastBefore + 1);
  });

  test(`${DRAG_TICKS} drag ticks complete under 1500ms (absolute regression bound)`, () => {
    // Loose absolute bound to catch order-of-magnitude regressions —
    // e.g., re-introducing A* (which used to put this in the multi-second
    // range on the same fixture) or a runaway immer clone.
    //
    // On a typical dev box this currently runs in ~150-300ms; the 1500ms
    // ceiling leaves ample headroom for slow CI runners.
    const result = setup();

    const t0 = performance.now();
    act(() => {
      result.current.scene.beginDragTransaction();
    });
    for (let i = 0; i < DRAG_TICKS; i += 1) {
      tickDrag(result, { x: 2 + i, y: 6 + (i % 12) });
    }
    act(() => {
      result.current.scene.commitDragTransaction();
    });
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(1500);
  });
});
