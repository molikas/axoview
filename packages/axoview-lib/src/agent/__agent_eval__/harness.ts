// Agent-interaction eval harness (ADR 0047). ZERO-COST-WHEN-OFF (ADR 0047 §4): this
// lives outside the lib's index entry, so it is never imported into the app or
// worker bundle — it is dev/CI tooling only.
//
// The harness drives the real verb layer through a fake SceneBridge backed by the
// real reducers + an in-memory State (no React, no store, no transport). A
// "transcript" is a recorded tool-call sequence; replaying it counts round-trips
// (ADR 0047 axis 1) and produces a final Model to structurally diff against a
// golden (axis 4). No model is in the loop → the GATE runs free on every PR.

import * as reducers from 'src/stores/reducers';
import type { State } from 'src/stores/reducers/types';
import { Model } from 'src/types';
import { createAgentSurface, AgentSurface } from '../createAgentSurface';
import { SceneBridge, ApplyOpsResult } from '../types';

export const EVAL_VIEW_ID = 'view-1';

export const makeEvalModel = (): Model => ({
  version: '1',
  title: 'eval',
  items: [],
  views: [{ id: EVAL_VIEW_ID, name: 'Page 1', items: [], connectors: [] }],
  icons: [
    { id: 'icon-server', name: 'Server', url: '' },
    { id: 'icon-database', name: 'Database', url: '' },
    { id: 'icon-cache', name: 'Cache', url: '' },
    { id: 'icon-gateway', name: 'Gateway', url: '' }
  ],
  colors: [{ id: 'color-1', value: '#000000' }]
});

export interface EvalHarness {
  surface: AgentSurface;
  model: () => Model;
  callCount: () => number;
  resetCount: () => void;
}

// A tool call in a transcript.
export interface TranscriptCall {
  tool: 'apply_ops' | 'set_diagram' | 'get_diagram' | 'select_canvas';
  args?: unknown;
}

const buildBridge = (
  getState: () => State,
  setState: (s: State) => void,
  onCall: () => void
): SceneBridge => {
  let seq = 0;
  const ctx = () => ({ viewId: EVAL_VIEW_ID, state: getState() });
  return {
    transaction: (ops) => ops(),
    createModelItem: (m) => setState(reducers.createModelItem(m, getState())),
    updateModelItem: (id, u) =>
      setState(reducers.updateModelItem(id, u, getState())),
    createViewItem: (v) =>
      setState(reducers.view({ action: 'CREATE_VIEWITEM', payload: v, ctx: ctx() })),
    updateViewItem: (id, u) =>
      setState(
        reducers.view({
          action: 'UPDATE_VIEWITEM',
          payload: { id, ...u },
          ctx: ctx()
        })
      ),
    deleteViewItem: (id) =>
      setState(reducers.view({ action: 'DELETE_VIEWITEM', payload: id, ctx: ctx() })),
    createConnector: (c) =>
      setState(reducers.view({ action: 'CREATE_CONNECTOR', payload: c, ctx: ctx() })),
    deleteConnector: (id) =>
      setState(reducers.view({ action: 'DELETE_CONNECTOR', payload: id, ctx: ctx() })),
    getModel: () => getState().model,
    getCurrentViewId: () => EVAL_VIEW_ID,
    // Deterministic ids → byte-stable transcripts (ADR 0045 §4 / 0047 goldens).
    generateId: () => {
      onCall.length; // no-op to keep the closure honest
      return `gen-${(seq += 1)}`;
    }
  };
};

export const makeHarness = (): EvalHarness => {
  let state: State = {
    model: makeEvalModel(),
    scene: { connectors: {}, textBoxes: {} }
  };
  let calls = 0;

  const bridge = buildBridge(
    () => state,
    (s) => {
      state = s;
    },
    () => {
      calls += 1;
    }
  );

  // Wrap the surface so every mutating/read tool call increments the round-trip
  // counter (ADR 0047 axis 1).
  const base = createAgentSurface(bridge, {
    switchView: () => undefined
  });
  const count = <T,>(fn: () => T): T => {
    calls += 1;
    return fn();
  };
  const surface: AgentSurface = {
    version: base.version,
    apply_ops: (ops) => count(() => base.apply_ops(ops)) as ApplyOpsResult,
    set_diagram: (spec) => count(() => base.set_diagram(spec)) as ApplyOpsResult,
    get_diagram: () => count(() => base.get_diagram()),
    list_canvases: () => count(() => base.list_canvases()),
    select_canvas: (id) => count(() => base.select_canvas(id)),
    open_diagram: (id) => count(() => base.open_diagram(id))
  };

  return {
    surface,
    model: () => state.model,
    callCount: () => calls,
    resetCount: () => {
      calls = 0;
    }
  };
};

// Replay a transcript against a harness, returning the last tool result.
export const replay = (
  harness: EvalHarness,
  transcript: TranscriptCall[]
): unknown => {
  let last: unknown;
  for (const call of transcript) {
    switch (call.tool) {
      case 'apply_ops':
        last = harness.surface.apply_ops(call.args);
        break;
      case 'set_diagram':
        last = harness.surface.set_diagram(call.args);
        break;
      case 'get_diagram':
        last = harness.surface.get_diagram();
        break;
      case 'select_canvas':
        last = harness.surface.select_canvas(String(call.args));
        break;
    }
  }
  return last;
};
