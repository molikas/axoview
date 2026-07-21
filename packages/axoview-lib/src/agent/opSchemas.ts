// Agent Control Contract — op vocabulary (ADR 0045 §3).
//
// One source of truth for the `apply_ops` op shapes. These Zod schemas validate
// agent input at the verb-layer boundary AND are the same schemas that will feed
// the MCP tool `input_schema` (ADR 0046 §5) and the BYOK tool definitions
// (ADR 0046 §7) — never hand-duplicate an op shape elsewhere.
//
// LOCKSTEP RULE (ADR 0045 §Consequences / tactical): adding or removing an op
// here MUST move in the same commit as the modeling skill (C) and the eval task
// suite (F). A verb the code ships but the skill omits (or vice versa) mis-steers
// the model silently. `apply_intent` is RESERVED (ADR 0045 §1) — it is neither
// defined here nor described anywhere until it ships.
//
// v1 (Track A) ships the node + connector + bulk-style/layer core below. The
// remaining ADR 0045 §3 verbs (create_rect / create_text / create_label /
// create_view / switch_view / create_layer / set_layer_visibility /
// set_layer_locked) are intentionally NOT in the union yet: shipping a schema for
// an unimplemented verb would let it validate and then fail at apply, exactly the
// silent drift the lockstep rule guards against. They join the union in the same
// commit that implements them.

import { z } from 'zod';
import { coords, constrainedStrings, NOTES_MAX_LENGTH, ARRAY_MAX } from 'src/schemas/common';
import {
  connectorStyleOptions,
  connectorLineTypeOptions
} from 'src/schemas/connector';

// An agent-local id: an arbitrary string the agent assigns and may
// forward-reference within a single call (ADR 0045 §2 invariant 2). It is NOT a
// real generateId() id — applyOps maps agent-local ids to real ones atomically
// and returns the mapping. A bare string that is already a real id is passed
// through unchanged (so an edit op can target an existing node by its real id).
export const agentId = z.string().min(1).max(200);

// Coordinates are OPTIONAL on every agent input (ADR 0045 §2 invariant 1): a node
// supplied without a tile is auto-placed by the layout engine. The agent must
// never compute a tile.
const optionalTile = coords.optional();

// Style object — mirrors the styleable ViewItem label* fields + iconScale
// (element-text-style field convention, ADR 0033). Field names are identical to
// the ViewItem's so the verb layer spreads them straight onto an updateViewItem
// payload with no remapping.
export const nodeStyleSchema = z
  .object({
    labelColor: z.string().optional(),
    labelFontSize: z.number().optional(),
    labelBold: z.boolean().optional(),
    labelItalic: z.boolean().optional(),
    labelUnderline: z.boolean().optional(),
    labelStrikethrough: z.boolean().optional(),
    showLabel: z.boolean().optional(),
    iconScale: z.number().min(0.1).max(3).optional()
  })
  .strict();

// A connector endpoint (`from` / `to`). Accepts either a bare node id
// (auto-anchored to that item) or an explicit ref mirroring the Connector.anchors
// `{ item | anchor | tile }` schema. All id fields are agent-local (translated
// through the id map at apply time).
const endpointRefObject = z
  .object({
    item: agentId.optional(),
    anchor: z.string().optional(),
    tile: coords.optional()
  })
  .strict();

export const endpointRef = z.union([agentId, endpointRefObject]);
export type EndpointRef = z.infer<typeof endpointRef>;

// ---------------------------------------------------------------------------
// The ops
// ---------------------------------------------------------------------------

export const createNodeOp = z
  .object({
    op: z.literal('create_node'),
    id: agentId,
    // Resolved against the icon catalog (ADR 0002) at apply time — an unresolved
    // kind is a per-op error, never a crash (ADR 0045 §3).
    kind: z.string().min(1).max(100),
    name: constrainedStrings.name.optional(),
    label: constrainedStrings.name.optional(),
    notes: z.string().max(NOTES_MAX_LENGTH).optional(),
    tile: optionalTile,
    layerId: z.string().optional(),
    style: nodeStyleSchema.optional()
  })
  .strict();

export const updateNodeOp = z
  .object({
    op: z.literal('update_node'),
    id: agentId,
    name: constrainedStrings.name.optional(),
    label: constrainedStrings.name.optional(),
    notes: z.string().max(NOTES_MAX_LENGTH).optional(),
    tile: optionalTile,
    layerId: z.string().optional(),
    style: nodeStyleSchema.optional()
  })
  .strict();

export const deleteNodeOp = z
  .object({
    op: z.literal('delete_node'),
    id: agentId
  })
  .strict();

export const connectOp = z
  .object({
    op: z.literal('connect'),
    id: agentId.optional(),
    from: endpointRef,
    to: endpointRef,
    color: z.string().optional(),
    style: z.enum(connectorStyleOptions).optional(),
    lineType: z.enum(connectorLineTypeOptions).optional(),
    label: constrainedStrings.description.optional(),
    showArrow: z.boolean().optional()
  })
  .strict();

export const disconnectOp = z
  .object({
    op: z.literal('disconnect'),
    id: agentId
  })
  .strict();

// Bulk restyle in ONE op (ADR 0045 §3) — one transaction entry for "make every
// database node blue", not one per node.
export const setStyleOp = z
  .object({
    op: z.literal('set_style'),
    targets: z.array(agentId).min(1).max(ARRAY_MAX.viewItems),
    style: nodeStyleSchema
  })
  .strict();

export const setLayerOp = z
  .object({
    op: z.literal('set_layer'),
    targets: z.array(agentId).min(1).max(ARRAY_MAX.viewItems),
    layerId: z.string()
  })
  .strict();

export const opSchema = z.discriminatedUnion('op', [
  createNodeOp,
  updateNodeOp,
  deleteNodeOp,
  connectOp,
  disconnectOp,
  setStyleOp,
  setLayerOp
]);

export const opsSchema = z.array(opSchema).max(ARRAY_MAX.viewItems);

export type Op = z.infer<typeof opSchema>;
export type CreateNodeOp = z.infer<typeof createNodeOp>;
export type UpdateNodeOp = z.infer<typeof updateNodeOp>;
export type ConnectOp = z.infer<typeof connectOp>;
export type SetStyleOp = z.infer<typeof setStyleOp>;
export type SetLayerOp = z.infer<typeof setLayerOp>;
export type NodeStyle = z.infer<typeof nodeStyleSchema>;
