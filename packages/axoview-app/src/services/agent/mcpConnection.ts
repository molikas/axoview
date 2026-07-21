// Tab-side MCP session glue (ADR 0046 §2 "tab loads → opens WS → registers").
// This is the piece that makes the remote-MCP path real: it mints a pairing code,
// opens the WebSocket to the per-session Durable Object, registers the tab's tool
// manifest, and pumps forwarded tool calls through the lib's bridge client into
// the verb layer. Pure transport glue — no model, no key.
//
// The worker origin is configurable so it works both same-origin (prod Pages
// Functions) and cross-origin (local dev: app on :3000, worker on `wrangler dev`
// :8787).

import { createBridgeClient } from 'axoview';
import type { AgentScope, AgentIdentity } from 'axoview';
import { getAgentSurface } from './getAgentSurface';

export type McpStatus =
  | 'idle'
  | 'pairing'
  | 'connecting'
  | 'connected'
  | 'closed'
  | 'error';

export interface McpSession {
  code: string;
  /** Absolute URL the user pastes into their MCP client. */
  mcpUrl: string;
  close: () => void;
}

export interface ConnectOptions {
  baseUrl: string;
  onStatus: (status: McpStatus, detail?: string) => void;
  // Connection permission (Feature A). Defaults to read-only (fail-safe).
  scope?: AgentScope;
  // Optional signed-in identity (interim; display/audit only until OAuth v2).
  user?: AgentIdentity;
}

// http(s) origin + ws path → ws(s) URL. Exported for unit testing (the http→ws
// scheme swap is an easy thing to get wrong).
export const wsUrlFromBase = (baseUrl: string, wsPath: string): string => {
  const u = new URL(wsPath, baseUrl);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
};

export const absoluteUrl = (baseUrl: string, path: string): string =>
  new URL(path, baseUrl).toString();

interface PairResponse {
  code: string;
  wsPath: string;
  mcpPath: string;
}

/**
 * Establish an MCP session: mint a code, open the WS, register the manifest, and
 * start pumping tool calls. Resolves once the socket is open (status 'connected'
 * follows registration). Rejects if the canvas isn't ready or pairing fails.
 */
export const connectMcp = async ({
  baseUrl,
  onStatus,
  scope = 'read',
  user
}: ConnectOptions): Promise<McpSession> => {
  const surface = getAgentSurface();
  if (!surface) {
    throw new Error('Axoview canvas is not ready — open a diagram and retry.');
  }

  onStatus('pairing');
  const res = await fetch(absoluteUrl(baseUrl, '/pair/new'), {
    method: 'POST'
  });
  if (!res.ok) throw new Error(`pairing failed (${res.status})`);
  const pair = (await res.json()) as PairResponse;

  onStatus('connecting');
  const bridge = createBridgeClient(surface, { scope, user });
  const ws = new WebSocket(wsUrlFromBase(baseUrl, pair.wsPath));

  ws.addEventListener('open', () => {
    ws.send(bridge.registerMessage());
    onStatus('connected');
  });
  ws.addEventListener('message', (ev) => {
    const reply = bridge.handleMessage(String(ev.data));
    if (reply) ws.send(reply);
  });
  ws.addEventListener('close', () => onStatus('closed'));
  ws.addEventListener('error', () => onStatus('error', 'WebSocket error'));

  return {
    code: pair.code,
    mcpUrl: absoluteUrl(baseUrl, pair.mcpPath),
    close: () => ws.close()
  };
};

// Sensible default worker origin: same-origin in prod (Pages Functions), but the
// local `wrangler dev` port when the app is served from the rsbuild dev server.
// Use 127.0.0.1 (NOT localhost): wrangler dev binds IPv4, while a Node-based MCP
// client (VSCode/Cursor) resolves `localhost` to IPv6 ::1 first and fails the
// fetch with AggregateError.
export const defaultWorkerBaseUrl = (): string => {
  const { origin } = window.location;
  if (origin.includes(':3000')) return 'http://127.0.0.1:8787';
  return origin;
};
