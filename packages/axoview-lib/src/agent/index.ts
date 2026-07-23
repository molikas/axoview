// Agent Control Contract — verb layer (ADR 0045, Track A).
//
// The transport-agnostic surface both transports (MCP bridge — ADR 0046 §1; BYOK
// loop — ADR 0046 §7) sit on. Nothing here imports React or a transport; it wraps
// useSceneActions via an injected SceneBridge so it is unit-testable standalone.

export {
  createAgentSurface,
  AGENT_CONTRACT_VERSION
} from './createAgentSurface';
export type {
  AgentSurface,
  AgentNavigation,
  CanvasInfo,
  NavResult
} from './createAgentSurface';

export { applyOps } from './applyOps';
export type { ApplyOpsOptions } from './applyOps';
export { setDiagram, setDiagramSpecSchema } from './setDiagram';
export type { SetDiagramSpec } from './setDiagram';
export { getDiagram } from './getDiagram';
export { resolveKind } from './resolveKind';
export { MODELING_SKILL, MODELING_SKILL_VERSION } from './modelingSkill';
export { buildMcpManifest } from './mcpManifest';
export type { McpManifest, McpToolDef } from './mcpManifest';
export { createBridgeClient } from './bridgeClient';
export type {
  BridgeClient,
  BridgeClientOptions,
  AgentIdentity
} from './bridgeClient';
export {
  MUTATING_TOOLS,
  isMutatingTool,
  destructiveSummary,
  READ_ONLY_ERROR
} from './scope';
export type { AgentScope } from './scope';
export { computeLayout, gridPack } from './layout';
export type { LayoutMode, LayoutEdge, LayoutOptions } from './layout';

export {
  opSchema,
  opsSchema,
  createNodeOp,
  updateNodeOp,
  deleteNodeOp,
  connectOp,
  disconnectOp,
  setStyleOp,
  setLayerOp,
  nodeStyleSchema,
  endpointRef,
  agentId
} from './opSchemas';
export type {
  Op,
  CreateNodeOp,
  UpdateNodeOp,
  ConnectOp,
  SetStyleOp,
  SetLayerOp,
  NodeStyle,
  EndpointRef
} from './opSchemas';

export type {
  SceneBridge,
  ApplyOpsResult,
  OpError
} from './types';
