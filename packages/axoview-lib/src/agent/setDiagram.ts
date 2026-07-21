// set_diagram — the power verb (ADR 0045 §1). The agent declares a whole desired
// diagram (or subtree); Axoview diffs it against the current view, applies the
// minimal patch, and auto-lays-out anything coordinate-less. Wholesale generation
// / redesign in ONE call, not a hundred apply_ops.
//
// v1 (Track A) reconcile is additive + update: a spec node whose id matches an
// existing view item is UPDATED in place; an unknown id is CREATED (and, if
// coordinate-less, auto-placed). Explicitly-positioned and hand-placed elements
// are respected — nothing reflows (ADR 0045 §4). Removal of nodes the spec omits
// is opt-in via `prune` (default false) so a partial spec never silently wipes
// the canvas; a full redesign passes `prune: true`.
//
// It compiles the spec to an op list and delegates to applyOps, so it inherits
// the one-transaction / one-undo, forward-referenceable ids, diff result, and
// partial-success guarantees for free — no second mutation path.

import { z } from 'zod';
import { createNodeOp, connectOp, Op } from './opSchemas';
import { applyOps } from './applyOps';
import { SceneBridge, ApplyOpsResult, OpError } from './types';

// A spec node carries create-shaped fields (kind is needed when it turns out to
// be a create); on an update, kind is ignored.
const specNodeSchema = createNodeOp
  .omit({ op: true })
  .extend({ kind: z.string().min(1).max(100).optional() });

const specConnectorSchema = connectOp.omit({ op: true });

export const setDiagramSpecSchema = z
  .object({
    nodes: z.array(specNodeSchema).optional(),
    connectors: z.array(specConnectorSchema).optional(),
    // Declarative layout hint (ADR 0045 §4) — never coordinates. `radial` places
    // a cyclic process (lifecycle) as a visible loop.
    layout: z.enum(['layered-lr', 'layered-tb', 'grid', 'radial']).optional(),
    // Delete existing view items whose ids the spec omits (full-redesign mode).
    prune: z.boolean().optional()
  })
  .strict();

export type SetDiagramSpec = z.infer<typeof setDiagramSpecSchema>;

export const setDiagram = (
  input: unknown,
  bridge: SceneBridge
): ApplyOpsResult => {
  const errorResult = (message: string): ApplyOpsResult => ({
    created_ids: [],
    id_map: {},
    changed: [],
    errors: [{ index: -1, message } as OpError],
    counts: { applied: 0, failed: 1, created: 0, changed: 0 }
  });

  const parsed = setDiagramSpecSchema.safeParse(input);
  if (!parsed.success) {
    return errorResult(
      `invalid set_diagram spec: ${parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`
    );
  }
  const spec = parsed.data;

  const viewId = bridge.getCurrentViewId();
  if (!viewId) {
    return errorResult(
      'No active canvas — open a diagram before set_diagram (ADR 0046 §4).'
    );
  }
  const model = bridge.getModel();
  const view = model.views.find((v) => v.id === viewId);
  if (!view) return errorResult(`Active view ${viewId} not found.`);

  const existingIds = new Set((view.items ?? []).map((it) => it.id));
  const specNodeIds = new Set<string>();
  const ops: Op[] = [];

  // Deterministic: iterate the spec in the order given (no Set-order dependency).
  for (const node of spec.nodes ?? []) {
    specNodeIds.add(node.id);
    if (existingIds.has(node.id)) {
      // Reconcile an existing node — identity/placement/style only.
      ops.push({
        op: 'update_node',
        id: node.id,
        ...(node.name !== undefined ? { name: node.name } : {}),
        ...(node.label !== undefined ? { label: node.label } : {}),
        ...(node.notes !== undefined ? { notes: node.notes } : {}),
        ...(node.tile !== undefined ? { tile: node.tile } : {}),
        ...(node.layerId !== undefined ? { layerId: node.layerId } : {}),
        ...(node.style !== undefined ? { style: node.style } : {})
      });
    } else {
      // A new node MUST carry a kind (it resolves to an icon). A missing kind is
      // pushed as create_node kind:'' so applyOps emits the unknown-kind error at
      // the right op index rather than us fabricating a default icon.
      if (!node.kind) {
        ops.push({ op: 'create_node', id: node.id, kind: '' });
        continue;
      }
      ops.push({
        op: 'create_node',
        id: node.id,
        kind: node.kind,
        ...(node.name !== undefined ? { name: node.name } : {}),
        ...(node.label !== undefined ? { label: node.label } : {}),
        ...(node.notes !== undefined ? { notes: node.notes } : {}),
        ...(node.tile !== undefined ? { tile: node.tile } : {}),
        ...(node.layerId !== undefined ? { layerId: node.layerId } : {}),
        ...(node.style !== undefined ? { style: node.style } : {})
      });
    }
  }

  for (const c of spec.connectors ?? []) {
    ops.push({ op: 'connect', ...c });
  }

  // Prune: remove existing view items the spec no longer mentions (redesign).
  if (spec.prune) {
    // Sorted iteration keeps the op order deterministic (ADR 0045 §4).
    for (const id of [...existingIds].sort()) {
      if (!specNodeIds.has(id)) ops.push({ op: 'delete_node', id });
    }
  }

  return applyOps(ops, bridge, { layoutMode: spec.layout });
};
