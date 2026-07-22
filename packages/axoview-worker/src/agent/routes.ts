// Remote-MCP + pairing routes (ADR 0046 §1/§3) registered on the worker's Hono
// app — the Worker-only carve-out (ADR 0009 §1), a sibling to the Drive proxy.
// These live OUTSIDE /api/* on purpose: the /api/* auth middleware + storage-
// disabled catch-all must not gate the MCP endpoint, whose auth is the pairing
// code itself.
//
// The worker is a pure ROUTER here (ADR 0046 §1): every route forwards to the
// per-session Durable Object; none execute a verb.

import type { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleMcpMessage } from './mcpProtocol';
import { createSessionRouter } from './sessionRouter';
import {
  generatePairingCode,
  normalizePairingCode,
  isValidPairingCode
} from './pairing';

interface AgentBindings {
  AGENT_SESSION: DurableObjectNamespace;
  // Deploy-time build stamp for `serverInfo.version` (see the /mcp handler).
  // Injected by the Cloudflare Workers Builds deploy command
  // (`wrangler deploy --var AGENT_SERVER_VERSION:<pkg>+<sha>`); absent under local
  // `wrangler dev`, where the compiled fallback is used.
  AGENT_SERVER_VERSION?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHono = Hono<any>;

export const registerAgentRoutes = (app: AnyHono, serverVersion: string): void => {
  const ns = (c: { env: AgentBindings }) => c.env.AGENT_SESSION;

  // CORS for the JSON endpoints the browser tab + a browser-based MCP client hit
  // cross-origin (local dev: app on :3000, worker on `wrangler dev` :8787). The
  // pairing code is the auth and no cookies are used, so `*` is safe here. The WS
  // upgrade route needs no CORS (browsers don't preflight WebSocket handshakes).
  app.use('/pair/new', cors());
  app.use('/mcp/*', cors());

  // Tab asks for a fresh pairing code to display. The DO is created lazily on the
  // first WS connect / call, so this is a pure token mint.
  app.post('/pair/new', (c: { json: (v: unknown) => Response }) => {
    const code = generatePairingCode();
    return c.json({
      code,
      wsPath: `/pair/${code}/ws`,
      mcpPath: `/mcp/${code}`,
      ttlSeconds: 600
    });
  });

  // Tab opens its WebSocket to the DO. We forward the raw upgrade request (its URL
  // ends in /ws, which the DO routes) so the Upgrade header and 101 flow through.
  app.get(
    '/pair/:code/ws',
    (c: {
      req: { param: (k: string) => string; raw: Request };
      env: AgentBindings;
      json: (v: unknown, s?: number) => Response;
    }) => {
      const code = normalizePairingCode(c.req.param('code'));
      if (!isValidPairingCode(code)) {
        return c.json({ error: 'invalid pairing code' }, 400);
      }
      const stub = ns(c).get(ns(c).idFromName(code));
      return stub.fetch(c.req.raw);
    }
  );

  // The MCP endpoint the user's AI connects to. Streamable-HTTP JSON-RPC over
  // POST: accepts a single message or a batch, returns the response(s), or 202 for
  // a notification-only body.
  app.post(
    '/mcp/:code',
    async (c: {
      req: { param: (k: string) => string; json: () => Promise<unknown> };
      env: AgentBindings;
      json: (v: unknown, s?: number) => Response;
      body: (b: BodyInit | null, s?: number) => Response;
    }) => {
      const code = normalizePairingCode(c.req.param('code'));
      if (!isValidPairingCode(code)) {
        return c.json({ error: 'invalid pairing code' }, 400);
      }
      // Prefer the deploy-injected version so a live `initialize` proves WHICH
      // worker bundle is serving (the compiled constant never moved, which hid a
      // stale worker — 2026-07-22 CI-deploy gap). Falls back to the constant under
      // local dev, where no `--var` is passed.
      const version = c.env.AGENT_SERVER_VERSION || serverVersion;
      const router = createSessionRouter(ns(c), code, version);

      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json(
          { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
          400
        );
      }

      if (Array.isArray(body)) {
        const out = (
          await Promise.all(body.map((m) => handleMcpMessage(m, router)))
        ).filter((r): r is object => r !== null);
        return out.length > 0 ? c.json(out) : c.body(null, 202);
      }

      const res = await handleMcpMessage(body, router);
      return res ? c.json(res) : c.body(null, 202);
    }
  );
};
