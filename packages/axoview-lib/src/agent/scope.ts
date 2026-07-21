// Connection scope (Feature A, 2026-07-21) — a read-only vs read-write permission
// on an MCP/agent connection, chosen at connect time, protecting users from a
// malicious or careless agent's edits/deletes.
//
// Enforcement is TAB-SIDE and authoritative (the verb layer is the security
// boundary, ADR 0045 §6): a read-only connection rejects every mutating tool at
// the bridge, so a forged worker-side tools/list can never bypass it. The manifest
// also omits mutating tools in read-only mode so the agent doesn't waste turns.

export type AgentScope = 'read' | 'write';

// Tools that MUTATE the canvas / storage. Everything else (get_diagram,
// list_canvases, select_canvas, open_diagram, list_diagrams) is a safe read /
// navigation and is allowed under a read-only scope.
export const MUTATING_TOOLS: ReadonlySet<string> = new Set([
  'apply_ops',
  'set_diagram',
  // Diagram-library writes (Feature A.4) — reserved names, gated the same way.
  'create_diagram',
  'save_diagram',
  // Contract-expansion writes (C1) — reserved.
  'create_rect',
  'create_text',
  'create_label'
]);

export const isMutatingTool = (tool: string): boolean =>
  MUTATING_TOOLS.has(tool);

export const READ_ONLY_ERROR =
  'This connection is read-only — the user did not grant edit access. Only reads (get_diagram, list_canvases, list_diagrams, open_diagram) are allowed.';

const BULK_THRESHOLD = 10;

// Detect a DESTRUCTIVE call (Feature A.5 / ADR 0045 §6) — deletes, prune, or a
// large bulk restyle/relayer. Returns a short human summary for the confirm
// prompt, or null when the call is non-destructive. Runs only in write mode
// (read-only already blocked mutations upstream).
export const destructiveSummary = (
  tool: string,
  args: unknown
): string | null => {
  const a = (args ?? {}) as Record<string, unknown>;

  if (tool === 'set_diagram' && a.prune === true) {
    return 'redesign this diagram, deleting every node not in the new spec';
  }

  if (tool === 'apply_ops') {
    const ops = Array.isArray(args) ? args : (a.ops as unknown);
    if (!Array.isArray(ops)) return null;
    let deletes = 0;
    let bulk = 0;
    for (const raw of ops) {
      const o = (raw ?? {}) as Record<string, unknown>;
      if (o.op === 'delete_node' || o.op === 'disconnect') deletes += 1;
      if (
        (o.op === 'set_style' || o.op === 'set_layer') &&
        Array.isArray(o.targets) &&
        o.targets.length > BULK_THRESHOLD
      ) {
        bulk += 1;
      }
    }
    if (deletes > 0) {
      return `delete ${deletes} item${deletes === 1 ? '' : 's'} from the canvas`;
    }
    if (bulk > 0) return 'bulk-restyle a large number of items';
  }

  return null;
};
