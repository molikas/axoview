// Track-A acceptance tests (ADR 0045 §Acceptance criteria). These drive the verb
// layer through a fake SceneBridge backed by the REAL reducers + an in-memory
// State — no React, no store, no transport. The fake chains each mutation onto
// the accumulating state the way useSceneActions.transaction()'s pending buffer
// does, so forward-referenced ids and partial success are exercised for real.

import * as reducers from 'src/stores/reducers';
import type { State } from 'src/stores/reducers/types';
import { Model } from 'src/types';
import { applyOps } from '../applyOps';
import { setDiagram } from '../setDiagram';
import { SceneBridge } from '../types';

const VIEW_ID = 'view-1';

const makeModel = (): Model => ({
  version: '1',
  title: 'test',
  items: [],
  views: [{ id: VIEW_ID, name: 'Page 1', items: [], connectors: [] }],
  icons: [
    { id: 'icon-server', name: 'Server', url: '' },
    { id: 'icon-database', name: 'Database', url: '' }
  ],
  colors: [{ id: 'color-1', value: '#000000' }]
});

interface Harness {
  bridge: SceneBridge;
  state: () => State;
  txCount: () => number;
}

const makeHarness = (): Harness => {
  let state: State = {
    model: makeModel(),
    scene: { connectors: {}, textBoxes: {} }
  };
  let tx = 0;
  let seq = 0;
  const ctx = () => ({ viewId: VIEW_ID, state });

  const bridge: SceneBridge = {
    transaction: (ops) => {
      tx += 1;
      ops();
    },
    createModelItem: (m) => {
      state = reducers.createModelItem(m, state);
    },
    updateModelItem: (id, u) => {
      state = reducers.updateModelItem(id, u, state);
    },
    createViewItem: (v) => {
      state = reducers.view({ action: 'CREATE_VIEWITEM', payload: v, ctx: ctx() });
    },
    updateViewItem: (id, u) => {
      state = reducers.view({
        action: 'UPDATE_VIEWITEM',
        payload: { id, ...u },
        ctx: ctx()
      });
    },
    deleteViewItem: (id) => {
      state = reducers.view({ action: 'DELETE_VIEWITEM', payload: id, ctx: ctx() });
    },
    createConnector: (c) => {
      state = reducers.view({ action: 'CREATE_CONNECTOR', payload: c, ctx: ctx() });
    },
    deleteConnector: (id) => {
      state = reducers.view({ action: 'DELETE_CONNECTOR', payload: id, ctx: ctx() });
    },
    getModel: () => state.model,
    getCurrentViewId: () => VIEW_ID,
    // Deterministic id source so results are byte-stable across runs.
    generateId: () => `gen-${(seq += 1)}`
  };

  return { bridge, state: () => state, txCount: () => tx };
};

const currentView = (h: Harness) =>
  h.state().model.views.find((v) => v.id === VIEW_ID)!;

describe('applyOps — ADR 0045 §2 invariants', () => {
  it('forward-references an agent-local id within one call (invariant 2 + 3)', () => {
    const h = makeHarness();
    const result = applyOps(
      [
        { op: 'create_node', id: 'web', kind: 'server' },
        { op: 'create_node', id: 'db', kind: 'database' },
        { op: 'connect', from: 'web', to: 'db' }
      ],
      h.bridge
    );

    // One call = one transaction = one undo entry (invariant 3).
    expect(h.txCount()).toBe(1);

    // Both agent-local ids resolved to real ids (invariant 2).
    expect(result.id_map.web).toBeDefined();
    expect(result.id_map.db).toBeDefined();

    const view = currentView(h);
    expect(view.items).toHaveLength(2);
    expect((h.state().model.items)).toHaveLength(2);

    // The connector exists and its two anchors point at the two created nodes.
    expect(view.connectors).toHaveLength(1);
    const anchors = view.connectors![0].anchors;
    const anchoredItems = anchors.map((a) => a.ref.item).sort();
    expect(anchoredItems).toEqual(
      [result.id_map.web, result.id_map.db].sort()
    );

    expect(result.errors).toHaveLength(0);
    expect(result.created_ids).toHaveLength(3); // 2 nodes + 1 connector
  });

  it('applies valid ops and reports the bad one — partial success (invariant 6)', () => {
    const h = makeHarness();
    const result = applyOps(
      [
        { op: 'create_node', id: 'web', kind: 'server' },
        // Unresolvable kind — this op must fail without sinking the batch.
        { op: 'create_node', id: 'ghost', kind: 'no-such-icon-kind' },
        { op: 'create_node', id: 'db', kind: 'database' }
      ],
      h.bridge
    );

    // The two valid nodes still landed.
    expect(currentView(h).items).toHaveLength(2);

    // The bad op is reported precisely, at its index.
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].index).toBe(1);
    expect(result.errors[0].message).toMatch(/unknown kind/i);

    expect(result.counts.applied).toBe(2);
    expect(result.counts.failed).toBe(1);
  });

  it('returns a diff, never a dump (invariant 5)', () => {
    const h = makeHarness();
    const result = applyOps(
      [{ op: 'create_node', id: 'web', kind: 'server' }],
      h.bridge
    );

    // Exactly the diff keys — no `model`, `views`, or full-state payload.
    expect(Object.keys(result).sort()).toEqual(
      ['changed', 'counts', 'created_ids', 'errors', 'id_map'].sort()
    );
    expect(result).not.toHaveProperty('model');
    expect(result.created_ids).toEqual([result.id_map.web]);
    expect(result.counts).toEqual({
      applied: 1,
      failed: 0,
      created: 1,
      changed: 0
    });
  });

  it('auto-places coordinate-less nodes without overlap, deterministically (invariant 1 + §4)', () => {
    const run = () => {
      const h = makeHarness();
      applyOps(
        Array.from({ length: 6 }, (_, i) => ({
          op: 'create_node' as const,
          id: `n${i}`,
          kind: 'server'
        })),
        h.bridge
      );
      return currentView(h).items.map((it) => it.tile);
    };

    const tilesA = run();
    const tilesB = run();

    // Deterministic: byte-identical across runs.
    expect(tilesA).toEqual(tilesB);
    // Non-overlapping.
    const keys = tilesA.map((t) => `${t.x},${t.y}`);
    expect(new Set(keys).size).toBe(6);
  });

  it('reports an explicit error when there is no active canvas (ADR 0046 §4)', () => {
    const h = makeHarness();
    const noCanvas: SceneBridge = {
      ...h.bridge,
      getCurrentViewId: () => undefined
    };
    const result = applyOps(
      [{ op: 'create_node', id: 'web', kind: 'server' }],
      noCanvas
    );
    expect(result.counts.applied).toBe(0);
    expect(result.errors[0].message).toMatch(/no active canvas/i);
  });

  it('flags a duplicate agent-local id and skips the redeclaration', () => {
    const h = makeHarness();
    const result = applyOps(
      [
        { op: 'create_node', id: 'web', kind: 'server' },
        { op: 'create_node', id: 'web', kind: 'database' }
      ],
      h.bridge
    );
    expect(currentView(h).items).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/duplicate/i);
  });
});

describe('setDiagram — ADR 0045 §1 reconcile', () => {
  it('builds a whole 3-node graph in one call, all placed', () => {
    const h = makeHarness();
    const result = setDiagram(
      {
        nodes: [
          { id: 'web', kind: 'server' },
          { id: 'api', kind: 'server' },
          { id: 'db', kind: 'database' }
        ],
        connectors: [
          { from: 'web', to: 'api' },
          { from: 'api', to: 'db' }
        ]
      },
      h.bridge
    );

    expect(h.txCount()).toBe(1);
    expect(result.errors).toHaveLength(0);
    const view = currentView(h);
    expect(view.items).toHaveLength(3);
    expect(view.connectors).toHaveLength(2);
    // Every node got a tile.
    expect(view.items.every((it) => it.tile)).toBe(true);
  });

  it('updates an existing node in place instead of duplicating it', () => {
    const h = makeHarness();
    // First: create.
    const first = setDiagram(
      { nodes: [{ id: 'web', kind: 'server', label: 'Web' }] },
      h.bridge
    );
    const realId = first.id_map.web;

    // Second: reference the REAL id (as an agent would after get_diagram) — must
    // update, not create a second node.
    setDiagram(
      { nodes: [{ id: realId, kind: 'server', label: 'Frontend' }] },
      h.bridge
    );

    const view = currentView(h);
    expect(view.items).toHaveLength(1);
    const modelItem = h.state().model.items.find((m) => m.id === realId);
    expect(modelItem?.label).toBe('Frontend');
  });

  it('prune removes a node the spec omits', () => {
    const h = makeHarness();
    const first = setDiagram(
      {
        nodes: [
          { id: 'web', kind: 'server' },
          { id: 'db', kind: 'database' }
        ]
      },
      h.bridge
    );
    const webId = first.id_map.web;

    setDiagram(
      { nodes: [{ id: webId, kind: 'server' }], prune: true },
      h.bridge
    );

    const view = currentView(h);
    expect(view.items).toHaveLength(1);
    expect(view.items[0].id).toBe(webId);
  });
});
