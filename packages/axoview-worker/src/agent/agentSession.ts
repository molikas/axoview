// AgentSessionDO — the per-pairing-session Durable Object (ADR 0046 §2). Holds the
// routing state + the hibernatable WebSocket to the user's browser tab. The worker
// is a router; THIS is where an MCP tool call crosses to the live tab and back.
//
// TWO FREE-TIER TRAPS, each one line and silent (ADR 0046 §2, tactical):
//   1. SQLite storage backend — the wrangler migration MUST be `new_sqlite_classes`
//      (NOT `new_classes`). We use `state.storage.sql`, an API that ONLY exists on
//      a SQLite-backed DO, so the wrong migration fails at runtime. Asserted in
//      tests + the wrangler config test.
//   2. WebSocket Hibernation API — we call `state.acceptWebSocket()` and implement
//      the `webSocketMessage` / `webSocketClose` handler methods, NOT
//      `server.accept()` + `addEventListener`. A non-hibernating socket pins the DO
//      in memory and burns the request budget. Asserted in tests.
//
// This is a plain class (constructor(state, env) + fetch + WS handlers), not an
// `extends DurableObject` from 'cloudflare:workers' — so it stays importable under
// ts-jest (node) for unit tests. The Workers runtime accepts either shape.

import {
  ToolCallOutcome,
  NO_ACTIVE_TAB_ERROR
} from './mcpProtocol';

const PAIR_TTL_MS = 10 * 60 * 1000; // 10-minute pairing code TTL (ADR 0046 §3 v1)
const CALL_TIMEOUT_MS = 20 * 1000; // never hang a tool call (ADR 0046 §4)
// S1 (2026-07-21): per-session rate limit (ADR 0046 §8). A flooding attacker keeps
// the DO awake, so an in-memory sliding window is hibernation-safe — the counter
// only needs to survive while calls are actually arriving. Generous for legit use,
// caps abuse. IP-level DoS on /pair/new + /mcp is a deploy-time CF rate-limit rule
// (documented in deployment.md), the ADR's "cheap hedge".
const RATE_WINDOW_MS = 10 * 1000;
const RATE_MAX_CALLS = 30;

interface SqlLike {
  exec: (
    query: string,
    ...bindings: unknown[]
  ) => { toArray: () => Record<string, unknown>[] };
}

interface StorageLike {
  sql: SqlLike;
}

// The subset of DurableObjectState we depend on — narrowed so a test can supply a
// mock without the full runtime type.
export interface AgentSessionState {
  storage: StorageLike;
  acceptWebSocket: (ws: WebSocket) => void;
  getWebSockets: () => WebSocket[];
}

interface Pending {
  resolve: (outcome: ToolCallOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class AgentSessionDO {
  protected state: AgentSessionState;
  // Overridable so a unit test can use a short real timeout instead of racing
  // fake timers against the async body read.
  protected callTimeoutMs = CALL_TIMEOUT_MS;
  private pending = new Map<string, Pending>();
  private reqSeq = 0;
  private callTimes: number[] = [];

  constructor(state: AgentSessionState, _env?: unknown) {
    this.state = state;
    // Using `.sql` is the runtime proof the DO is SQLite-backed (trap 1).
    this.exec(
      'CREATE TABLE IF NOT EXISTS session (k TEXT PRIMARY KEY, v TEXT NOT NULL)'
    );
  }

  // ---- SQLite helpers -----------------------------------------------------

  private exec(query: string, ...binds: unknown[]) {
    return this.state.storage.sql.exec(query, ...binds);
  }

  private getRow(k: string): string | null {
    const rows = this.exec('SELECT v FROM session WHERE k = ?', k).toArray();
    return rows.length > 0 ? String(rows[0].v) : null;
  }

  private setRow(k: string, v: string): void {
    this.exec(
      'INSERT INTO session (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v',
      k,
      v
    );
  }

  private now(): number {
    // Runtime-only (Workers/node) — determinism constraints apply to the layout
    // engine + eval goldens, not to session TTL.
    return Date.now();
  }

  private markCreated(): void {
    if (!this.getRow('created')) this.setRow('created', String(this.now()));
  }

  private isExpired(): boolean {
    const created = this.getRow('created');
    if (!created) return false;
    return this.now() - Number(created) > PAIR_TTL_MS;
  }

  // ---- HTTP surface (called by the worker router via the DO stub) ---------

  async fetch(req: Request): Promise<Response> {
    const path = new URL(req.url).pathname;
    if (path.endsWith('/ws')) return this.handleWsUpgrade(req);
    if (path.endsWith('/manifest')) return this.handleManifest();
    if (path.endsWith('/call')) return this.handleCall(req);
    return json({ error: 'not found' }, 404);
  }

  private handleWsUpgrade(req: Request): Response {
    if (req.headers.get('Upgrade') !== 'websocket') {
      return json({ error: 'expected websocket upgrade' }, 426);
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    // HIBERNATION (trap 2): register with the runtime instead of accept()+listen.
    this.state.acceptWebSocket(server);
    this.markCreated();
    return this.upgradeResponse(client);
  }

  // Seam so a unit test can assert acceptWebSocket without constructing a real
  // 101 upgrade Response (which node's Response constructor rejects).
  protected upgradeResponse(client: WebSocket): Response {
    return new Response(null, {
      status: 101,
      webSocket: client
    } as ResponseInit & { webSocket: WebSocket });
  }

  private handleManifest(): Response {
    if (this.isExpired()) return json(null);
    const manifest = this.getRow('manifest');
    return new Response(manifest ?? 'null', {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private rateLimited(): boolean {
    const now = this.now();
    this.callTimes = this.callTimes.filter((t) => now - t < RATE_WINDOW_MS);
    if (this.callTimes.length >= RATE_MAX_CALLS) return true;
    this.callTimes.push(now);
    return false;
  }

  private async handleCall(req: Request): Promise<Response> {
    if (this.isExpired()) {
      return json({ error: 'Pairing expired — re-pair from the Axoview tab.' });
    }
    if (this.rateLimited()) {
      return json({
        error: 'Rate limit exceeded — too many tool calls; slow down and retry.'
      });
    }
    const body = (await req.json()) as { tool?: string; args?: unknown };
    if (!body.tool) return json({ error: 'call requires a tool name' });
    const ws = this.activeSocket();
    if (!ws) return json({ error: NO_ACTIVE_TAB_ERROR });
    const outcome = await this.forward(ws, body.tool, body.args ?? {});
    return json(outcome);
  }

  // ---- Hibernation WebSocket handlers (runtime calls these) ----------------

  async webSocketMessage(
    _ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    let data: {
      type?: string;
      id?: string;
      manifest?: unknown;
      result?: unknown;
      error?: string;
    };
    try {
      const text =
        typeof message === 'string'
          ? message
          : new TextDecoder().decode(message);
      data = JSON.parse(text);
    } catch {
      return;
    }

    if (data.type === 'register' && data.manifest) {
      this.setRow('manifest', JSON.stringify(data.manifest));
      this.markCreated();
      return;
    }

    if (data.type === 'result' && typeof data.id === 'string') {
      const p = this.pending.get(data.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(data.id);
      p.resolve(
        data.error !== undefined ? { error: data.error } : { result: data.result }
      );
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    try {
      ws.close();
    } catch {
      // already closing
    }
  }

  async webSocketError(): Promise<void> {
    // no-op; the runtime cleans the socket up
  }

  // ---- Forwarding ----------------------------------------------------------

  private activeSocket(): WebSocket | null {
    const sockets = this.state.getWebSockets();
    // v1 multi-tab: most-recently-registered tab wins (ADR 0046 §4); the agent
    // can disambiguate explicitly via select_canvas.
    return sockets.length > 0 ? sockets[sockets.length - 1] : null;
  }

  private forward(
    ws: WebSocket,
    tool: string,
    args: unknown
  ): Promise<ToolCallOutcome> {
    const id = `r${(this.reqSeq += 1)}`;
    return new Promise<ToolCallOutcome>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ error: 'Timed out waiting for the Axoview tab to respond.' });
      }, this.callTimeoutMs);
      this.pending.set(id, { resolve, timer });
      try {
        ws.send(JSON.stringify({ type: 'call', id, tool, args }));
      } catch {
        clearTimeout(timer);
        this.pending.delete(id);
        resolve({ error: NO_ACTIVE_TAB_ERROR });
      }
    });
  }
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
