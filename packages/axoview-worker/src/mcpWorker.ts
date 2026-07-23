// Standalone MCP Worker entry (ADR 0046 §2, 2026-07-22 Pages fix).
//
// Cloudflare Pages cannot define a Durable Object in-project, so the DO is defined
// HERE and deployed as its own Worker ("axoview-mcp" — wrangler.mcp.toml). The
// Pages project binds to this Worker's DO via `script_name`.
//
// It re-exports the same Hono app (so this Worker ALSO serves /api + /mcp + /pair
// on its own workers.dev URL — the ready fallback if the Pages script_name binding
// misbehaves) PLUS the Durable Object class the runtime instantiates.

import app from './app';

export { AgentSessionDO } from './agent/agentSession';
export default app;
