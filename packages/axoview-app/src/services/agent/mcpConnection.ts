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

let state: McpState = { status: 'idle', session: null, detail: null };
let ws: WebSocket | null = null;
let user: AgentIdentity | undefined;
let confirmDestructive: ((summary: string) => Promise<boolean>) | undefined;
let keepAlive: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let manualClose = false;

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

  socket.addEventListener('open', () => {
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
    if (manualClose) {
      emit({ status: 'closed' });
      return;
    }
    // Unexpected drop — reconnect to the SAME code (no rotation).
    emit({ status: 'reconnecting', detail: 'Reconnecting…' });
    reconnectTimer = setTimeout(() => openSocket(session), RECONNECT_MS);
  });
  socket.addEventListener('error', () => emit({ detail: 'WebSocket error' }));
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
  const res = await fetch(absoluteUrl(baseUrl, '/pair/new'), { method: 'POST' });
  if (!res.ok) {
    emit({ status: 'error', detail: `pairing failed (${res.status})` });
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
  stopKeepAlive();
  try {
    ws?.close();
  } catch {
    // already closing
  }
  ws = null;
  emit({ status: 'idle', session: null, detail: null });
};
