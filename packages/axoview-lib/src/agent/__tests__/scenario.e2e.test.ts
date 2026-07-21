// Handover scenario (2026-07-21) — an end-to-end walk of the agent contract
// through the REAL MCP dispatch path: forwarded WS messages → createBridgeClient
// → the verb layer over the real reducers. Exercises everything the plan added:
// set_diagram + radial layout, create_rect backdrop, read-only scope enforcement,
// and the destructive-op confirm. No React, no worker, no network.

import { makeHarness, EVAL_VIEW_ID } from '../__agent_eval__/harness';
import { createBridgeClient } from '../bridgeClient';

let callSeq = 0;
const call = async (
  client: ReturnType<typeof createBridgeClient>,
  tool: string,
  args: unknown
) => {
  const raw = await client.handleMessage(
    JSON.stringify({ type: 'call', id: `c${(callSeq += 1)}-${tool}`, tool, args })
  );
  return JSON.parse(raw!);
};

const view = (h: ReturnType<typeof makeHarness>) =>
  h.model().views.find((v) => v.id === EVAL_VIEW_ID)!;

describe('SCENARIO: agent builds + guards a diagram over the MCP dispatch path', () => {
  // jsdom canvas stub for any TextBox sizing (not used here but safe).
  const orig = HTMLCanvasElement.prototype.getContext;
  beforeAll(() => {
    (HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext =
      () => ({ font: '', measureText: (t: string) => ({ width: t.length * 8 }) });
  });
  afterAll(() => {
    (HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext =
      orig;
  });

  it('write-mode: builds a cyclic lifecycle (radial) + a labelled backdrop in single calls', async () => {
    const h = makeHarness();
    const write = createBridgeClient(h.surface, { scope: 'write' });

    // 1) One set_diagram builds a 4-step lifecycle as a ring.
    const gen = await call(write, 'set_diagram', {
      layout: 'radial',
      nodes: [
        { id: 'plan', kind: 'server', label: 'Plan' },
        { id: 'build', kind: 'server', label: 'Build' },
        { id: 'ship', kind: 'server', label: 'Ship' },
        { id: 'learn', kind: 'server', label: 'Learn' }
      ],
      connectors: [
        { from: 'plan', to: 'build' },
        { from: 'build', to: 'ship' },
        { from: 'ship', to: 'learn' },
        { from: 'learn', to: 'plan' } // closes the loop
      ]
    });
    expect(gen.result.errors).toHaveLength(0);
    expect(view(h).items).toHaveLength(4);
    expect(view(h).connectors).toHaveLength(4);

    // 2) One apply_ops adds a backdrop around the whole ring + a title label.
    const decorate = await call(write, 'apply_ops', {
      ops: [
        {
          op: 'create_rect',
          id: 'bg',
          around: [
            view(h).items[0].id,
            view(h).items[1].id,
            view(h).items[2].id,
            view(h).items[3].id
          ],
          padding: 2,
          color: 'color-1'
        }
      ]
    });
    expect(decorate.result.errors).toHaveLength(0);
    expect(view(h).rectangles).toHaveLength(1);
    // Backdrop encloses all four nodes.
    const r = view(h).rectangles![0];
    const xs = view(h).items.map((i) => i.tile.x);
    const ys = view(h).items.map((i) => i.tile.y);
    expect(r.from.x).toBeLessThanOrEqual(Math.min(...xs));
    expect(r.to.x).toBeGreaterThanOrEqual(Math.max(...xs));
    expect(r.from.y).toBeLessThanOrEqual(Math.min(...ys));
    expect(r.to.y).toBeGreaterThanOrEqual(Math.max(...ys));
  });

  it('read-only: the same edits are rejected, reads still work', async () => {
    const h = makeHarness();
    const read = createBridgeClient(h.surface, { scope: 'read' });

    const blocked = await call(read, 'set_diagram', {
      nodes: [{ id: 'x', kind: 'server', label: 'X' }]
    });
    expect(blocked.error).toMatch(/read-only/i);
    expect(view(h).items).toHaveLength(0); // nothing created

    const dump = await call(read, 'get_diagram', {});
    expect(dump.result).toBeDefined();
    expect(dump.result.title).toBeDefined();
  });

  it('write-mode + confirm: a decline blocks a destructive delete; the canvas is untouched', async () => {
    const h = makeHarness();
    // Seed a node to delete.
    const write = createBridgeClient(h.surface, { scope: 'write' });
    await call(write, 'apply_ops', {
      ops: [{ op: 'create_node', id: 'doomed', kind: 'server', label: 'Doomed' }]
    });
    const realId = view(h).items[0].id;
    expect(view(h).items).toHaveLength(1);

    // A guarded connection that declines destructive actions.
    const guarded = createBridgeClient(h.surface, {
      scope: 'write',
      confirmDestructive: async () => false
    });
    const del = await call(guarded, 'apply_ops', {
      ops: [{ op: 'delete_node', id: realId }]
    });
    expect(del.error).toMatch(/declined/i);
    expect(view(h).items).toHaveLength(1); // still there
  });
});
