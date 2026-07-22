// Tab-side MCP session manager (ADR 0046 §2 + V1/V2 hardening 2026-07-21).
//
// The connection is a MODULE-LEVEL SINGLETON, deliberately NOT owned by the panel
// component — closing the "Connect your AI" panel must not tear down the socket
// (field report §4: panel-close unregistered the tab). It also:
//   - reuses the SAME pairing code on reconnect (no code rotation, §4),
//   - keep-alives the socket (survives brief tab-focus loss, §4),
//   - auto-reconnects on an unexpected close (backoff), reusing the code.
// The panel is a thin subscriber (useSyncExternalStore).

import { createBridgeClient } from 'axoview';
import type { AgentScope, AgentIdentity } from 'axoview';
import { getAgentSurface } from './getAgentSurface';

export type McpStatus =
  | 'idle'
  | 'pairing'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'closed'
  | 'error';

export interface McpSession {
  code: string;
  /** Absolute URL the user pastes into their MCP client. */
  mcpUrl: string;
  wsPath: string;
  baseUrl: string;
  scope: AgentScope;
}

export interface McpState {
  status: McpStatus;
  session: McpSession | null;
  detail: string | null;
}

export interface ConnectOptions {
  baseUrl: string;
  scope?: AgentScope;
  user?: AgentIdentity;
  // Feature A.5 — confirm a destructive agent action (write mode only).
  confirmDestructive?: (summary: string) => Promise<boolean>;
}

// ---- URL helpers (pure, unit-tested) --------------------------------------

export const wsUrlFromBase = (baseUrl: string, wsPath: string): string => {
  const u = new URL(wsPath, baseUrl);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
};

export const absoluteUrl = (baseUrl: string, path: string): string =>
  new URL(path, baseUrl).toString();

// Prefill source for prod: the standalone MCP Worker URL isn't derivable from the
// Pages origin, so the Pages /api/config surfaces it (from the MCP_PUBLIC_URL var).
export const fetchConfiguredMcpUrl = async (): Promise<string | null> => {
  try {
    const res = await fetch(`${window.location.origin}/api/config`);
    if (!res.ok) return null;
    const cfg = (await res.json()) as { mcpBaseUrl?: string | null };
    return cfg.mcpBaseUrl || null;
  } catch {
    return null;
  }
};

export const defaultWorkerBaseUrl = (): string => {
  const { origin } = window.location;
  // Use 127.0.0.1 (NOT localhost): wrangler binds IPv4; a Node-based MCP client
  // resolves `localhost` to IPv6 ::1 first and fails with AggregateError.
  if (origin.includes(':3000')) return 'http://127.0.0.1:8787';
  // In production the MCP bridge is a SEPARATE Worker (Pages can't host the DO),
  // so its URL is not same-origin and isn't known at build time — the user pastes
  // their axoview-mcp Worker URL. (An optional /api/config value could prefill it.)
  return '';
};

// ---- Singleton state ------------------------------------------------------

const KEEPALIVE_MS = 25_000;
const RECONNECT_MS = 2_000;
// V2 (2026-07-22): never leave the panel stuck on a spinner. Both the pairing
// fetch and the WebSocket open get a hard deadline, and a socket that NEVER
// connected is a fatal error (bad URL / server down) — NOT an endless reconnect.
const PAIR_TIMEOUT_MS = 12_000;
const WS_CONNECT_TIMEOUT_MS = 12_000;
const MAX_RECONNECTS = 5;

let state: McpState = { status: 'idle', session: null, detail: null };
let ws: WebSocket | null = null;
let user: AgentIdentity | undefined;
let confirmDestructive: ((summary: string) => Promise<boolean>) | undefined;
let keepAlive: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let connectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let manualClose = false;

// Fetch with a hard timeout — a bad host makes `fetch` hang (or reject silently),
// which previously stranded the UI on "Requesting code…".
const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  ms: number
): Promise<Response> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
};

const listeners = new Set<() => void>();

const emit = (patch: Partial<McpState>): void => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const subscribeMcp = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getMcpState = (): McpState => state;

// ---- Socket lifecycle -----------------------------------------------------

const stopKeepAlive = (): void => {
  if (keepAlive) clearInterval(keepAlive);
  keepAlive = null;
};

const startKeepAlive = (): void => {
  stopKeepAlive();
  keepAlive = setInterval(() => {
    try {
      ws?.send(JSON.stringify({ type: 'ping' }));
    } catch {
      // socket gone; onclose handles reconnect
    }
  }, KEEPALIVE_MS);
};

const openSocket = (session: McpSession): void => {
  const surface = getAgentSurface();
  if (!surface) {
    emit({ status: 'error', detail: 'Axoview canvas is not ready.' });
    return;
  }
  const bridge = createBridgeClient(surface, {
    scope: session.scope,
    user,
    confirmDestructive
  });
  const socket = new WebSocket(wsUrlFromBase(session.baseUrl, session.wsPath));
  ws = socket;
  let opened = false;

  // Deadline on the open handshake: a wrong URL or a down server would otherwise
  // sit in 'connecting' forever (the socket neither opens nor cleanly closes).
  if (connectTimer) clearTimeout(connectTimer);
  connectTimer = setTimeout(() => {
    if (opened) return;
    try {
      socket.close();
    } catch {
      // already closing
    }
    emit({
      status: 'error',
      detail:
        'Timed out opening the connection. The MCP server may be unreachable or the URL may be wrong.'
    });
  }, WS_CONNECT_TIMEOUT_MS);

  socket.addEventListener('open', () => {
    opened = true;
    reconnectAttempts = 0;
    if (connectTimer) clearTimeout(connectTimer);
    socket.send(bridge.registerMessage());
    emit({ status: 'connected', detail: null });
    startKeepAlive();
  });
  socket.addEventListener('message', (ev) => {
    void bridge.handleMessage(String(ev.data)).then((reply) => {
      if (reply) socket.send(reply);
    });
  });
  socket.addEventListener('close', () => {
    stopKeepAlive();
    if (connectTimer) clearTimeout(connectTimer);
    if (manualClose) {
      emit({ status: 'closed' });
      return;
    }
    if (!opened) {
      // Never established — bad URL / server down. Do NOT loop forever.
      emit({
        status: 'error',
        detail:
          'Could not reach the MCP server. Check that it is deployed and the URL is correct, then try again.'
      });
      return;
    }
    if (reconnectAttempts >= MAX_RECONNECTS) {
      emit({
        status: 'error',
        detail:
          'Lost the connection and could not reconnect. Pair again to reconnect.'
      });
      return;
    }
    // Unexpected drop after a good connection — reconnect to the SAME code.
    reconnectAttempts += 1;
    emit({
      status: 'reconnecting',
      detail: `Reconnecting… (${reconnectAttempts}/${MAX_RECONNECTS})`
    });
    reconnectTimer = setTimeout(() => openSocket(session), RECONNECT_MS);
  });
  // 'error' precedes 'close'; the close handler owns the state transition.
  socket.addEventListener('error', () => undefined);
};

// ---- Public API -----------------------------------------------------------

/** Establish (or reuse) the MCP session. Idempotent while already live. */
export const connectMcp = async ({
  baseUrl,
  scope = 'read',
  user: identity,
  confirmDestructive: confirm
}: ConnectOptions): Promise<McpSession> => {
  manualClose = false;
  reconnectAttempts = 0;
  user = identity;
  confirmDestructive = confirm;

  // Reuse a live/reconnecting session rather than minting a new code.
  if (
    state.session &&
    (state.status === 'connected' ||
      state.status === 'reconnecting' ||
      state.status === 'connecting')
  ) {
    return state.session;
  }

  if (!getAgentSurface()) {
    emit({ status: 'error', detail: 'Axoview canvas is not ready — open a diagram.' });
    throw new Error('canvas not ready');
  }

  emit({ status: 'pairing', detail: null });
  let res: Response;
  try {
    res = await fetchWithTimeout(
      absoluteUrl(baseUrl, '/pair/new'),
      { method: 'POST' },
      PAIR_TIMEOUT_MS
    );
  } catch (e) {
    const aborted = (e as Error)?.name === 'AbortError';
    emit({
      status: 'error',
      detail: aborted
        ? 'The MCP server did not respond in time. Check that it is deployed and the URL is correct.'
        : 'Could not reach the MCP server. Check your network and that the server is running.'
    });
    throw e instanceof Error ? e : new Error('pairing request failed');
  }
  if (!res.ok) {
    emit({
      status: 'error',
      detail: `The MCP server rejected the pairing request (HTTP ${res.status}).`
    });
    throw new Error(`pairing failed (${res.status})`);
  }
  const pair = (await res.json()) as {
    code: string;
    wsPath: string;
    mcpPath: string;
  };
  const session: McpSession = {
    code: pair.code,
    mcpUrl: absoluteUrl(baseUrl, pair.mcpPath),
    wsPath: pair.wsPath,
    baseUrl,
    scope
  };
  emit({ status: 'connecting', session });
  openSocket(session);
  return session;
};

/** Explicit teardown (the Disconnect button). */
export const disconnectMcp = (): void => {
  manualClose = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (connectTimer) clearTimeout(connectTimer);
  connectTimer = null;
  reconnectAttempts = 0;
  stopKeepAlive();
  try {
    ws?.close();
  } catch {
    // already closing
  }
  ws = null;
  emit({ status: 'idle', session: null, detail: null });
};
