// The MCP tool manifest the tab registers with its Durable Object on connect
// (ADR 0046 §5). The worker is a pure router and imports none of this — the TAB
// (which bundles axoview-lib) is the single source of truth for tool shapes +
// the modeling skill, and hands them to the worker over the WS.
//
// LOCKSTEP: the tool names here are exactly the shipped verbs. Guarded by a test
// that cross-checks against opSchema. Keep JSON schemas compact — they cross the
// wire and land in the model's context.

import { MODELING_SKILL, MODELING_SKILL_VERSION } from './modelingSkill';
import { AgentScope, isMutatingTool } from './scope';

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpManifest {
  tools: McpToolDef[];
  skill: string;
  skillVersion: string;
}

const opsArraySchema = {
  type: 'array',
  description:
    'Typed edit ops applied atomically in one transaction (one undo). Assign your own string ids and forward-reference them in the same batch.',
  items: {
    type: 'object',
    properties: {
      op: {
        type: 'string',
        enum: [
          'create_node',
          'update_node',
          'delete_node',
          'connect',
          'disconnect',
          'set_style',
          'set_layer'
        ]
      }
    },
    required: ['op']
  }
};

export const buildMcpManifest = (scope: AgentScope = 'write'): McpManifest => {
  const tools = ALL_TOOLS.filter(
    (t) => scope === 'write' || !isMutatingTool(t.name)
  );
  return {
    skill: MODELING_SKILL,
    skillVersion: MODELING_SKILL_VERSION,
    // Read-only connections advertise a read prefix so the agent knows up front.
    tools:
      scope === 'read'
        ? tools.map((t) => ({
            ...t,
            description: `[read-only connection] ${t.description}`
          }))
        : tools
  };
};

const ALL_TOOLS: McpToolDef[] = [
    {
      name: 'apply_ops',
      description:
        'Apply a batch of edit ops atomically (one undo). Returns a diff: {created_ids, id_map, changed, errors, counts}. See the `modeling-skill` prompt for op shapes + efficiency rules; coordinates are optional (auto-laid-out).',
      inputSchema: {
        type: 'object',
        properties: { ops: opsArraySchema },
        required: ['ops']
      }
    },
    {
      name: 'set_diagram',
      description:
        'Declare a whole desired diagram; Axoview diffs + auto-lays-out. Use for wholesale generation/redesign, not a hundred apply_ops.',
      inputSchema: {
        type: 'object',
        properties: {
          nodes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                kind: { type: 'string' },
                name: { type: 'string' },
                label: { type: 'string' },
                notes: { type: 'string' }
              },
              required: ['id']
            }
          },
          connectors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                from: { type: 'string' },
                to: { type: 'string' },
                label: { type: 'string' }
              },
              required: ['from', 'to']
            }
          },
          layout: {
            type: 'string',
            enum: ['layered-lr', 'layered-tb', 'grid']
          },
          prune: { type: 'boolean' }
        }
      }
    },
    {
      name: 'get_diagram',
      description:
        'Return the current diagram as compact JSON. Prefer the `axoview://diagram/current` resource over calling this each turn (same data, no tool round-trip).',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'list_canvases',
      description: 'List the canvases (pages) available in the current tab.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'select_canvas',
      description: 'Switch to a canvas by id.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id']
      }
    },
    {
      name: 'open_diagram',
      description: 'Open a stored diagram by id.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id']
      }
    }
];
