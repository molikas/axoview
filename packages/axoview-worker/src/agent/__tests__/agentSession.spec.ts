import { AgentSessionDO, AgentSessionState } from '../agentSession';
import { NO_ACTIVE_TAB_ERROR } from '../mcpProtocol';

// -- In-memory SQLite mock. Using the `.sql` API at all is the runtime proof the
//    DO is SQLite-backed (new_sqlite_classes) — ADR 0046 §2 trap 1. --
const mockSql = () => {
  const store = new Map<string, string>();
  const queries: string[] = [];
  const exec = (query: string, ...binds: unknown[]) => {
    queries.push(query);
    if (query.startsWith('SELECT v FROM session')) {
      const v = store.get(binds[0] as string);
      return { toArray: () => (v !== undefined ? [{ v }] : []) };
    }
    if (query.startsWith('INSERT INTO session')) {
      store.set(binds[0] as string, binds[1] as string);
      return { toArray: () => [] };
    }
    return { toArray: () => [] };
  };
  return { exec, store, queries };
};

const mockState = () => {
  const sql = mockSql();
  const sockets: WebSocket[] = [];
  const accepted: WebSocket[] = [];
  const state: AgentSessionState = {
    storage: { sql },
    acceptWebSocket: (ws) => {
      accepted.push(ws);
      sockets.push(ws);
    },
    getWebSockets: () => sockets
  };
  return { state, sql, sockets, accepted };
};

const mockSocket = () => ({
  send: jest.fn(),
  close: jest.fn(),
  accept: jest.fn() // MUST NOT be called — hibernation uses acceptWebSocket
});

// Subclass to bypass the real 101 upgrade Response (node's Response rejects it)
// and to shorten the tool-call timeout for the timeout test (real timer, no fake-
// timer race against the async body read).
class TestDO extends AgentSessionDO {
  public override upgradeResponse(): Response {
    return new Response('upgrade-stub', { status: 200 });
  }
  public setTimeoutMs(ms: number): void {
    this.callTimeoutMs = ms;
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('AgentSessionDO — SQLite + WebSocket Hibernation (ADR 0046 §2)', () => {
  it('creates its SQLite table on construction (trap 1: SQLite-backed)', () => {
    const { state, sql } = mockState();
    new AgentSessionDO(state);
    expect(sql.queries.some((q) => q.startsWith('CREATE TABLE'))).toBe(true);
  });

  it('uses the Hibernation API (acceptWebSocket), never server.accept (trap 2)', async () => {
    const { state, accepted } = mockState();
    const client = mockSocket();
    const server = mockSocket();
    // Mock the runtime WebSocketPair global.
    (globalThis as any).WebSocketPair = function () {
      return { 0: client, 1: server };
    };
    const doInst = new TestDO(state);
    const res = await doInst.fetch(
      new Request('https://do/ws', { headers: { Upgrade: 'websocket' } })
    );
    expect(res.status).toBe(200); // our stub
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toBe(server);
    expect(server.accept).not.toHaveBeenCalled();
    delete (globalThis as any).WebSocketPair;
  });

  it('exposes the hibernation handler methods (not addEventListener)', () => {
    const { state } = mockState();
    const doInst = new AgentSessionDO(state);
    expect(typeof doInst.webSocketMessage).toBe('function');
    expect(typeof doInst.webSocketClose).toBe('function');
  });

  it('stores the tab manifest on a register message and serves it', async () => {
    const { state } = mockState();
    const doInst = new AgentSessionDO(state);
    await doInst.webSocketMessage(
      mockSocket() as unknown as WebSocket,
      JSON.stringify({
        type: 'register',
        manifest: { tools: [{ name: 'apply_ops', inputSchema: {} }], skill: 's' }
      })
    );
    const res = await doInst.fetch(new Request('https://do/manifest'));
    const manifest = await res.json();
    expect(manifest.tools[0].name).toBe('apply_ops');
  });

  it('returns an explicit no-active-tab error, never a hang (ADR 0046 §4)', async () => {
    const { state } = mockState(); // no sockets registered
    const doInst = new AgentSessionDO(state);
    const res = await doInst.fetch(
      new Request('https://do/call', {
        method: 'POST',
        body: JSON.stringify({ tool: 'apply_ops', args: {} })
      })
    );
    const body = await res.json();
    expect(body.error).toBe(NO_ACTIVE_TAB_ERROR);
  });

  it('forwards a tool call over the WS and resolves with the tab result', async () => {
    const { state, sockets } = mockState();
    const ws = mockSocket();
    sockets.push(ws as unknown as WebSocket);
    const doInst = new AgentSessionDO(state);

    const p = doInst.fetch(
      new Request('https://do/call', {
        method: 'POST',
        body: JSON.stringify({ tool: 'apply_ops', args: { a: 1 } })
      })
    );

    // Let the DO read the body + forward over the WS before asserting.
    await tick();
    // The DO sent a correlated request over the WS; simulate the tab replying.
    expect(ws.send).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.type).toBe('call');
    expect(sent.tool).toBe('apply_ops');
    await doInst.webSocketMessage(
      ws as unknown as WebSocket,
      JSON.stringify({ type: 'result', id: sent.id, result: { ok: true } })
    );

    const body = await (await p).json();
    expect(body).toEqual({ result: { ok: true } });
  });

  it('times out instead of hanging when the tab never replies', async () => {
    const { state, sockets } = mockState();
    sockets.push(mockSocket() as unknown as WebSocket); // tab connected but silent
    const doInst = new TestDO(state);
    doInst.setTimeoutMs(20); // short real timeout

    const res = await doInst.fetch(
      new Request('https://do/call', {
        method: 'POST',
        body: JSON.stringify({ tool: 'apply_ops', args: {} })
      })
    );
    const body = await res.json();
    expect(body.error).toMatch(/timed out/i);
  });

  it('rate-limits a flood of tool calls (S1, ADR 0046 §8)', async () => {
    const { state } = mockState(); // no tab — calls return no-active-tab but still count
    const doInst = new AgentSessionDO(state);
    const call = () =>
      doInst
        .fetch(
          new Request('https://do/call', {
            method: 'POST',
            body: JSON.stringify({ tool: 'get_diagram', args: {} })
          })
        )
        .then((r) => r.json());

    // 30 calls pass the rate gate; the 31st within the window is rejected.
    for (let i = 0; i < 30; i += 1) await call();
    const over = await call();
    expect(over.error).toMatch(/rate limit/i);
  });

  it('reports expired pairing (10-min TTL)', async () => {
    const { state, sql, sockets } = mockState();
    sockets.push(mockSocket() as unknown as WebSocket);
    const doInst = new AgentSessionDO(state);
    // Seed a creation time 11 minutes ago.
    sql.store.set('created', String(Date.now() - 11 * 60 * 1000));
    const res = await doInst.fetch(
      new Request('https://do/call', {
        method: 'POST',
        body: JSON.stringify({ tool: 'apply_ops', args: {} })
      })
    );
    const body = await res.json();
    expect(body.error).toMatch(/expired/i);
  });
});
