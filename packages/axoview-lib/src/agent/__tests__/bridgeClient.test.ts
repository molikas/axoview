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
  open_diagram: () => ({ ok: false, error: 'not wired' }),
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

  it('dispatches a forwarded apply_ops call and returns a correlated result', () => {
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
    const reply = client.handleMessage(
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

  it('returns an error result for an unknown tool (never throws to the caller)', () => {
    const client = createBridgeClient(fakeSurface());
    const reply = client.handleMessage(
      JSON.stringify({ type: 'call', id: 'r1', tool: 'frobnicate', args: {} })
    );
    expect(JSON.parse(reply!)).toMatchObject({
      type: 'result',
      id: 'r1',
      error: expect.stringMatching(/unknown tool/)
    });
  });

  it('ignores a non-call message', () => {
    const client = createBridgeClient(fakeSurface());
    expect(client.handleMessage(JSON.stringify({ type: 'noise' }))).toBeNull();
    expect(client.handleMessage('not json')).toBeNull();
  });

  describe('read-only scope (Feature A)', () => {
    it('defaults to read-only (fail-safe)', () => {
      expect(createBridgeClient(fakeSurface()).scope).toBe('read');
    });

    it('rejects a mutating tool with a read-only error, without touching the surface', () => {
      const spy = jest.fn();
      const client = createBridgeClient(fakeSurface({ apply_ops: spy as never }), {
        scope: 'read'
      });
      const reply = JSON.parse(
        client.handleMessage(
          JSON.stringify({ type: 'call', id: 'r1', tool: 'apply_ops', args: { ops: [] } })
        )!
      );
      expect(reply.error).toMatch(/read-only/i);
      expect(spy).not.toHaveBeenCalled();
    });

    it('allows reads under read-only scope', () => {
      const spy = jest.fn(() => ({ title: 'd' }));
      const client = createBridgeClient(
        fakeSurface({ get_diagram: spy as never }),
        { scope: 'read' }
      );
      const reply = JSON.parse(
        client.handleMessage(
          JSON.stringify({ type: 'call', id: 'r2', tool: 'get_diagram', args: {} })
        )!
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

  it('manifest tool names stay in lockstep with shipped ops', () => {
    const shipped = [...opSchema.options].map((o) => o.shape.op.value).sort();
    const manifestOps = buildMcpManifest()
      .tools[0].inputSchema.properties as {
      ops: { items: { properties: { op: { enum: string[] } } } };
    };
    expect([...manifestOps.ops.items.properties.op.enum].sort()).toEqual(shipped);
  });
});
