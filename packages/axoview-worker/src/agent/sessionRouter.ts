// The DO-backed McpRouter (ADR 0046 §1) — the transport impl of the pure protocol
// layer's McpRouter interface. It turns tools/list + tool calls into HTTP fetches
// against the per-session Durable Object stub, which forwards them over the WS to
// the live tab. Split out from mcpProtocol.ts so the protocol stays runtime-free
// and unit-testable with a fake router.

import {
  McpRouter,
  SessionManifest,
  ToolCallOutcome
} from './mcpProtocol';

export const createSessionRouter = (
  ns: DurableObjectNamespace,
  code: string,
  serverVersion: string
): McpRouter => {
  const stub = () => ns.get(ns.idFromName(code));

  return {
    serverVersion,

    async getManifest(): Promise<SessionManifest | null> {
      const res = await stub().fetch('https://do/manifest');
      const data = (await res.json()) as SessionManifest | null;
      return data ?? null;
    },

    async callTool(name: string, args: unknown): Promise<ToolCallOutcome> {
      const res = await stub().fetch('https://do/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: name, args })
      });
      return (await res.json()) as ToolCallOutcome;
    }
  };
};
