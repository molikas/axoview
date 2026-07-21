// MCP protocol handling (ADR 0046 §5) — PURE. No Durable Object, no WebSocket, no
// Cloudflare runtime: this turns an MCP JSON-RPC message into a response by
// delegating the actual work to an injected `McpRouter`. That split is what makes
// the protocol unit-testable with a fake router (the DO-backed router is one impl;
// see sessionRouter.ts) and keeps the runtime-coupled code tiny.
//
// The worker is a ROUTER, not an executor (ADR 0046 §1): tools/list, the modeling
// prompt, and every tool call are answered from what the live tab registered over
// its WebSocket — the tab holds the verb layer + op schemas (axoview-lib), so
// there is ONE source of truth and the worker imports none of it.

export const MCP_PROTOCOL_VERSION = '2025-06-18';

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

// The tab registers this over its WS on connect; the DO persists it (SQLite) so
// it survives hibernation.
export interface SessionManifest {
  tools: McpTool[];
  skill: string;
  skillVersion?: string;
}

export interface ToolCallOutcome {
  result?: unknown;
  error?: string;
}

// The transport the protocol layer talks to. `getManifest` returns null when no
// tab has registered (tab-not-open); callTool returns an explicit error in that
// case, never a hang (ADR 0046 §4).
export interface McpRouter {
  serverVersion: string;
  getManifest(): Promise<SessionManifest | null>;
  callTool(name: string, args: unknown): Promise<ToolCallOutcome>;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

const NO_TAB_MESSAGE =
  'No active Axoview canvas — open your diagram in a browser tab and retry.';

const DIAGRAM_URI = 'axoview://diagram/current';

// X1 (2026-07-21): a tools-only agent never queries MCP prompts/resources, so the
// carefully-authored modeling skill (an MCP prompt) never reaches it. The MCP
// `initialize` result carries an `instructions` field that far more clients inject
// than prompts — so we return the FULL skill there when a tab has registered it,
// prefixed with a breadcrumb pointing at the prompt + the (cheaper) resource.
const INSTRUCTIONS_BREADCRUMB =
  'You are editing an Axoview isometric diagram. Read the current diagram via the ' +
  '`axoview://diagram/current` resource (cheaper than calling get_diagram each turn). ' +
  'Coordinates are optional — never compute a tile; declare topology and let Axoview ' +
  'lay it out. The full modeling guide follows (also available as the `modeling-skill` prompt).';

const ok = (id: JsonRpcRequest['id'], result: unknown) => ({
  jsonrpc: '2.0' as const,
  id: id ?? null,
  result
});

const err = (
  id: JsonRpcRequest['id'],
  code: number,
  message: string
) => ({
  jsonrpc: '2.0' as const,
  id: id ?? null,
  error: { code, message }
});

// Canonical error codes. MCP requires tool failures as isError content and
// protocol failures as JSON-RPC errors (different namespaces by spec), but E2
// (2026-07-21) makes the error BODY identical everywhere: `{error:{code,message}}`
// — so an agent parses ONE shape whether the failure arrives as tool content, a
// resource-read error, or a prompt error.
const NO_ACTIVE_TAB_CODE = -32002;
const TOOL_ERROR_CODE = -32010;

const canonicalError = (message: string, code: number) => ({
  error: { code, message }
});

// A tool-call outcome rendered as MCP tool result content. A failure is reported
// as isError content (not a JSON-RPC error) so the model reads it and adapts,
// matching the contract's explicit-partial-success philosophy (ADR 0045 §2 #6).
const toolContent = (outcome: ToolCallOutcome) => {
  if (outcome.error !== undefined) {
    const code =
      outcome.error === NO_TAB_MESSAGE ? NO_ACTIVE_TAB_CODE : TOOL_ERROR_CODE;
    return {
      content: [
        { type: 'text', text: JSON.stringify(canonicalError(outcome.error, code)) }
      ],
      isError: true
    };
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(outcome.result) }],
    isError: false
  };
};

/**
 * Handle a single MCP JSON-RPC message. Returns the response object, or null for
 * a notification (no id) that needs no reply.
 */
export const handleMcpMessage = async (
  msg: unknown,
  router: McpRouter
): Promise<object | null> => {
  if (
    !msg ||
    typeof msg !== 'object' ||
    (msg as JsonRpcRequest).jsonrpc !== '2.0' ||
    typeof (msg as JsonRpcRequest).method !== 'string'
  ) {
    return err(null, -32600, 'Invalid Request');
  }

  const { id, method, params } = msg as JsonRpcRequest;
  const isNotification = id === undefined;

  switch (method) {
    case 'initialize': {
      const manifest = await router.getManifest();
      const instructions = manifest?.skill
        ? `${INSTRUCTIONS_BREADCRUMB}\n\n---\n\n${manifest.skill}`
        : INSTRUCTIONS_BREADCRUMB;
      return ok(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {}, prompts: {}, resources: {} },
        serverInfo: { name: 'axoview', version: router.serverVersion },
        instructions
      });
    }

    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null; // notifications — no reply

    case 'ping':
      return ok(id, {});

    case 'tools/list': {
      const manifest = await router.getManifest();
      return ok(id, { tools: manifest?.tools ?? [] });
    }

    case 'tools/call': {
      const name = params?.name as string | undefined;
      if (!name) return err(id, -32602, 'tools/call requires params.name');
      const args = (params?.arguments as unknown) ?? {};
      const outcome = await router.callTool(name, args);
      return ok(id, toolContent(outcome));
    }

    case 'prompts/list': {
      const manifest = await router.getManifest();
      return ok(id, {
        prompts: manifest
          ? [
              {
                name: 'modeling-skill',
                description:
                  'How to model Axoview diagrams efficiently with this contract.'
              }
            ]
          : []
      });
    }

    case 'prompts/get': {
      const manifest = await router.getManifest();
      if (!manifest) return err(id, -32002, NO_TAB_MESSAGE);
      return ok(id, {
        description: 'Axoview modeling skill',
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: manifest.skill }
          }
        ]
      });
    }

    case 'resources/list':
      return ok(id, {
        resources: [
          {
            uri: DIAGRAM_URI,
            name: 'Current diagram',
            description: 'The active Axoview diagram as compact JSON.',
            mimeType: 'application/json'
          }
        ]
      });

    case 'resources/read': {
      const uri = params?.uri as string | undefined;
      if (uri !== DIAGRAM_URI) {
        return err(id, -32602, `unknown resource ${uri}`);
      }
      const outcome = await router.callTool('get_diagram', {});
      if (outcome.error) return err(id, -32002, outcome.error);
      return ok(id, {
        contents: [
          {
            uri: DIAGRAM_URI,
            mimeType: 'application/json',
            text: JSON.stringify(outcome.result)
          }
        ]
      });
    }

    default:
      return isNotification ? null : err(id, -32601, `Method not found: ${method}`);
  }
};

export const NO_ACTIVE_TAB_ERROR = NO_TAB_MESSAGE;
