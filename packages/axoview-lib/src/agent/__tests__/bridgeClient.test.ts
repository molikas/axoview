// Tab-side bridge client (ADR 0046 §2) — the register + call→result loop, tested
// against a fake AgentSurface (no WebSocket, no DO).

import { createBridgeClient } from '../bridgeClient';
import { buildMcpManifest } from '../mcpManifest';
import { opSchema } from '../opSchemas';
import { AgentSurface } from '../createAgentSurface';

const fakeSurface = (over: Partial<AgentSurface> = {}): AgentSurface => ({
  version: 'test',
  apply_ops: (ops) => ({
    created_ids: ['x'],
    id_map: {},
    changed: [],
    errors: [],
    counts: { applied: Array.isArray(ops) ? ops.length : 0, failed: 0, created: 1, changed: 0 }
  }),
  set_diagram: () => ({
    created_ids: [],
    id_map: {},
    changed: [],
    errors: [],
    counts: { applied: 0, failed: 0, created: 0, changed: 0 }
  }),
  get_diagram: () => ({ title: 'd' }) as never,
  list_canvases: () => [{ id: 'v1', name: 'Page 1', current: true }],
  select_canvas: () => ({ ok: true }),
  open_diagram: async () => ({ ok: true }),
  list_diagrams: async () => ({ diagrams: [{ id: 'd1', name: 'Diagram 1' }] }),
  create_diagram: async () => ({ ok: true }),
  save_diagram: async () => ({ ok: true }),
  ...over
});

describe('createBridgeClient', () => {
  it('emits a register message carrying the manifest + scope', () => {
    const client = createBridgeClient(fakeSurface(), { scope: 'write' });
    const msg = JSON.parse(client.registerMessage());
    expect(msg.type).toBe('register');
    expect(msg.scope).toBe('write');
    expect(msg.manifest.tools.map((t: { name: string }) => t.name)).toContain(
      'apply_ops'
    );
    expect(typeof msg.manifest.skill).toBe('string');
  });

  it('dispatches a forwarded apply_ops call and returns a correlated result', async () => {
    const spy = jest.fn(() => ({
      created_ids: [],
      id_map: {},
      changed: [],
      errors: [],
      counts: { applied: 2, failed: 0, created: 0, changed: 0 }
    }));
    const client = createBridgeClient(fakeSurface({ apply_ops: spy as never }), {
      scope: 'write'
    });
    const reply = await client.handleMessage(
      JSON.stringify({
        type: 'call',
        id: 'r7',
        tool: 'apply_ops',
        args: { ops: [{ op: 'create_node', id: 'a', kind: 'server' }] }
      })
    );
    const parsed = JSON.parse(reply!);
    expect(parsed).toMatchObject({ type: 'result', id: 'r7' });
    expect(spy).toHaveBeenCalledWith([
      { op: 'create_node', id: 'a', kind: 'server' }
    ]);
  });

  it('returns an error result for an unknown tool (never throws to the caller)', async () => {
    const client = createBridgeClient(fakeSurface(), { scope: 'write' });
    const reply = await client.handleMessage(
      JSON.stringify({ type: 'call', id: 'r1', tool: 'frobnicate', args: {} })
    );
    expect(JSON.parse(reply!)).toMatchObject({
      type: 'result',
      id: 'r1',
      error: expect.stringMatching(/unknown tool/)
    });
  });

  it('ignores a non-call message', async () => {
    const client = createBridgeClient(fakeSurface());
    expect(await client.handleMessage(JSON.stringify({ type: 'noise' }))).toBeNull();
    expect(await client.handleMessage('not json')).toBeNull();
  });

  describe('read-only scope (Feature A)', () => {
    it('defaults to read-only (fail-safe)', () => {
      expect(createBridgeClient(fakeSurface()).scope).toBe('read');
    });

    it('rejects a mutating tool with a read-only error, without touching the surface', async () => {
      const spy = jest.fn();
      const client = createBridgeClient(fakeSurface({ apply_ops: spy as never }), {
        scope: 'read'
      });
      const reply = JSON.parse(
        (await client.handleMessage(
          JSON.stringify({ type: 'call', id: 'r1', tool: 'apply_ops', args: { ops: [] } })
        ))!
      );
      expect(reply.error).toMatch(/read-only/i);
      expect(spy).not.toHaveBeenCalled();
    });

    it('allows reads under read-only scope', async () => {
      const spy = jest.fn(() => ({ title: 'd' }));
      const client = createBridgeClient(
        fakeSurface({ get_diagram: spy as never }),
        { scope: 'read' }
      );
      const reply = JSON.parse(
        (await client.handleMessage(
          JSON.stringify({ type: 'call', id: 'r2', tool: 'get_diagram', args: {} })
        ))!
      );
      expect(reply).toMatchObject({ type: 'result', id: 'r2' });
      expect(spy).toHaveBeenCalled();
    });

    it('read-only manifest omits mutating tools', () => {
      const msg = JSON.parse(
        createBridgeClient(fakeSurface(), { scope: 'read' }).registerMessage()
      );
      const names = msg.manifest.tools.map((t: { name: string }) => t.name);
      expect(names).not.toContain('apply_ops');
      expect(names).not.toContain('set_diagram');
      expect(names).toContain('get_diagram');
      expect(names).toContain('list_canvases');
    });
  });

  it('dispatches async diagram-library verbs (A.4) and awaits the result', async () => {
    const listSpy = jest.fn(async () => ({
      diagrams: [{ id: 'd9', name: 'Roadmap' }]
    }));
    const client = createBridgeClient(
      fakeSurface({ list_diagrams: listSpy as never }),
      { scope: 'read' } // list is a read → allowed under read-only
    );
    const reply = JSON.parse(
      (await client.handleMessage(
        JSON.stringify({ type: 'call', id: 'r9', tool: 'list_diagrams', args: {} })
      ))!
    );
    expect(listSpy).toHaveBeenCalled();
    expect(reply.result.diagrams[0].name).toBe('Roadmap');
  });

  it('blocks create_diagram / save_diagram under read-only scope (A.4 is a write)', async () => {
    const createSpy = jest.fn();
    const client = createBridgeClient(
      fakeSurface({ create_diagram: createSpy as never }),
      { scope: 'read' }
    );
    const reply = JSON.parse(
      (await client.handleMessage(
        JSON.stringify({ type: 'call', id: 'r1', tool: 'create_diagram', args: {} })
      ))!
    );
    expect(reply.error).toMatch(/read-only/i);
    expect(createSpy).not.toHaveBeenCalled();
  });

  describe('destructive-op confirm (Feature A.5)', () => {
    it('rejects a destructive apply_ops when the user declines', async () => {
      const applySpy = jest.fn();
      const confirm = jest.fn(async () => false); // user says no
      const client = createBridgeClient(
        fakeSurface({ apply_ops: applySpy as never }),
        { scope: 'write', confirmDestructive: confirm }
      );
      const reply = JSON.parse(
        (await client.handleMessage(
          JSON.stringify({
            type: 'call',
            id: 'r1',
            tool: 'apply_ops',
            args: { ops: [{ op: 'delete_node', id: 'x' }] }
          })
        ))!
      );
      expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/delete 1 item/));
      expect(reply.error).toMatch(/declined/i);
      expect(applySpy).not.toHaveBeenCalled();
    });

    it('proceeds when the user confirms; non-destructive ops never prompt', async () => {
      const confirm = jest.fn(async () => true);
      const client = createBridgeClient(fakeSurface(), {
        scope: 'write',
        confirmDestructive: confirm
      });
      // Pure creates → no prompt.
      await client.handleMessage(
        JSON.stringify({
          type: 'call',
          id: 'r1',
          tool: 'apply_ops',
          args: { ops: [{ op: 'create_node', id: 'a', kind: 'server' }] }
        })
      );
      expect(confirm).not.toHaveBeenCalled();
      // prune → prompt, confirmed → applies.
      const reply = JSON.parse(
        (await client.handleMessage(
          JSON.stringify({
            type: 'call',
            id: 'r2',
            tool: 'set_diagram',
            args: { nodes: [], prune: true }
          })
        ))!
      );
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(reply).toMatchObject({ type: 'result', id: 'r2' });
    });
  });

  it('manifest tool names stay in lockstep with shipped ops', () => {
    const shipped = [...opSchema.options].map((o) => o.shape.op.value).sort();
    const manifestOps = buildMcpManifest()
      .tools[0].inputSchema.properties as {
      ops: { items: { properties: { op: { enum: string[] } } } };
    };
    expect([...manifestOps.ops.items.properties.op.enum].sort()).toEqual(shipped);
  });
});
