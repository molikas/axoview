// Tab-side bridge client (ADR 0046 §2 "tab loads → registers → executes"). Turns
// the DO's forwarded WS messages into agent-surface calls and returns the result
// message. PURE: it takes an AgentSurface + raw message strings, so it is unit-
// testable without a real WebSocket. The transport glue (open the socket, send
// registerMessage on open, pipe onmessage → handleMessage → ws.send) lives in the
// app's MCP pairing panel (Track E / Track D UI).
//
// Feature A (2026-07-21): the client carries a connection SCOPE. A read-only
// connection rejects every mutating tool HERE (the authoritative security
// boundary) and registers a manifest with the mutating tools removed.

import { AgentSurface } from './createAgentSurface';
import { buildMcpManifest } from './mcpManifest';
import {
  AgentScope,
  isMutatingTool,
  destructiveSummary,
  READ_ONLY_ERROR
} from './scope';

// Optional identity metadata the tab attaches at registration (interim before
// OAuth v2; used for display/audit, not yet enforced).
export interface AgentIdentity {
  id?: string;
  email?: string;
  name?: string;
}

export interface BridgeClientOptions {
  // Default 'read' — fail-safe: a caller that forgets to pass a scope gets the
  // safe one, never accidental write access.
  scope?: AgentScope;
  user?: AgentIdentity;
  // Feature A.5 / ADR 0045 §6: called (in write mode only) before a DESTRUCTIVE
  // call (deletes / prune / large bulk) with a short summary; resolve false to
  // reject it. Absent → destructive calls proceed (write mode is explicit consent).
  confirmDestructive?: (summary: string) => Promise<boolean>;
}

export interface BridgeClient {
  scope: AgentScope;
  // Send this once the WS opens, so the DO can answer tools/list + prompts/get.
  registerMessage(): string;
  // Handle one forwarded call message; resolves to the JSON result to send back,
  // or null if the message isn't a call (nothing to reply). Async because the
  // diagram-library verbs (open/list/create/save) touch storage / Drive.
  handleMessage(raw: string): Promise<string | null>;
}

const dispatch = async (
  surface: AgentSurface,
  tool: string,
  args: unknown
): Promise<unknown> => {
  const a = (args ?? {}) as Record<string, unknown>;
  switch (tool) {
    case 'apply_ops':
      // The MCP tool wraps the op array as { ops: [...] }; the surface takes the
      // array directly. Tolerate a bare array too.
      return surface.apply_ops(Array.isArray(args) ? args : a.ops);
    case 'set_diagram':
      return surface.set_diagram(args);
    case 'get_diagram':
      return surface.get_diagram();
    case 'list_canvases':
      return surface.list_canvases();
    case 'select_canvas':
      return surface.select_canvas(String(a.id));
    case 'open_diagram':
      return surface.open_diagram(String(a.id));
    case 'list_diagrams':
      return surface.list_diagrams();
    case 'create_diagram':
      return surface.create_diagram(
        a.name !== undefined ? String(a.name) : undefined
      );
    case 'save_diagram':
      return surface.save_diagram();
    default:
      throw new Error(`unknown tool "${tool}"`);
  }
};

export const createBridgeClient = (
  surface: AgentSurface,
  opts: BridgeClientOptions = {}
): BridgeClient => {
  const scope: AgentScope = opts.scope ?? 'read';

  return {
    scope,

    registerMessage: () =>
      JSON.stringify({
        type: 'register',
        scope,
        ...(opts.user ? { user: opts.user } : {}),
        // In read-only mode the manifest omits mutating tools, so the agent's
        // tools/list never even offers them.
        manifest: buildMcpManifest(scope)
      }),

    handleMessage: async (raw: string): Promise<string | null> => {
      let msg: { type?: string; id?: string; tool?: string; args?: unknown };
      try {
        msg = JSON.parse(raw);
      } catch {
        return null;
      }
      if (msg.type !== 'call' || typeof msg.id !== 'string' || !msg.tool) {
        return null;
      }
      // Authoritative read-only enforcement (Feature A / ADR 0045 §6).
      if (scope === 'read' && isMutatingTool(msg.tool)) {
        return JSON.stringify({
          type: 'result',
          id: msg.id,
          error: READ_ONLY_ERROR
        });
      }
      // Destructive-op confirm (Feature A.5) — write mode only.
      if (opts.confirmDestructive) {
        const summary = destructiveSummary(msg.tool, msg.args);
        if (summary) {
          const approved = await opts.confirmDestructive(summary);
          if (!approved) {
            return JSON.stringify({
              type: 'result',
              id: msg.id,
              error: `The user declined a destructive action (${summary}).`
            });
          }
        }
      }
      try {
        const result = await dispatch(surface, msg.tool, msg.args);
        return JSON.stringify({ type: 'result', id: msg.id, result });
      } catch (e) {
        return JSON.stringify({
          type: 'result',
          id: msg.id,
          error: (e as Error).message
        });
      }
    }
  };
};
