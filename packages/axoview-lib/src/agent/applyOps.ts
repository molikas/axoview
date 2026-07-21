// apply_ops — the floor verb (ADR 0045 §1/§3). A typed array of edit ops applied
// atomically in ONE transaction (= one undo entry, invariant 3), with:
//   - forward-referenceable agent-local ids within the single call (invariant 2),
//   - a diff-shaped result, never the full model (invariant 5),
//   - explicit partial success — a bad op lands in errors[] while the valid ops
//     still apply (invariant 6).
//
// Coordinates are optional (invariant 1): coordinate-less create_node ops are
// auto-placed by the (stub, Track-B-pending) layout engine — the agent never
// computes a tile.

import {
  ModelItem,
  ViewItem,
  Connector,
  ConnectorAnchor,
  Coords
} from 'src/types';
import { VIEW_ITEM_DEFAULTS } from 'src/config';
import { opSchema, Op, EndpointRef, NodeStyle } from './opSchemas';
import { resolveKind } from './resolveKind';
import { computeLayout, LayoutMode, LayoutEdge } from './layout';
import { SceneBridge, ApplyOpsResult, OpError } from './types';

export interface ApplyOpsOptions {
  // Auto-layout mode for coordinate-less nodes (ADR 0045 §4). Defaults to the
  // layered left-to-right flow.
  layoutMode?: LayoutMode;
}

interface ValidOp {
  op: Op;
  index: number;
}

const tileKey = (t: Coords): string => `${t.x},${t.y}`;

// nodeStyle field names are identical to the ViewItem's, so a style object drops
// straight onto an updateViewItem / createViewItem payload.
const styleToViewItem = (style?: NodeStyle): Partial<ViewItem> =>
  style ? { ...style } : {};

export const applyOps = (
  input: unknown,
  bridge: SceneBridge,
  opts: ApplyOpsOptions = {}
): ApplyOpsResult => {
  const errors: OpError[] = [];
  const created_ids: string[] = [];
  const changedSet = new Set<string>();
  const id_map: Record<string, string> = {};

  const emptyResult = (): ApplyOpsResult => ({
    created_ids,
    id_map,
    changed: [...changedSet],
    errors,
    counts: {
      applied: 0,
      failed: errors.length,
      created: 0,
      changed: 0
    }
  });

  const viewId = bridge.getCurrentViewId();
  if (!viewId) {
    errors.push({
      index: -1,
      message:
        'No active canvas — open a diagram before applying ops (ADR 0046 §4).'
    });
    return emptyResult();
  }

  if (!Array.isArray(input)) {
    errors.push({ index: -1, message: 'apply_ops expects an array of ops.' });
    return emptyResult();
  }

  // -- Schema pass: per-op parse so one malformed op is a per-op error while the
  //    valid ops still apply (invariant 6 at the schema level too). --
  const validOps: ValidOp[] = [];
  input.forEach((raw, index) => {
    const parsed = opSchema.safeParse(raw);
    if (parsed.success) {
      validOps.push({ op: parsed.data, index });
    } else {
      const opName =
        raw && typeof raw === 'object' && 'op' in raw
          ? String((raw as { op: unknown }).op)
          : undefined;
      errors.push({
        index,
        op: opName as OpError['op'],
        message: parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')
      });
    }
  });

  const model = bridge.getModel();
  const view = model.views.find((v) => v.id === viewId);
  if (!view) {
    errors.push({ index: -1, message: `Active view ${viewId} not found.` });
    return emptyResult();
  }

  // -- Phase 1: pre-register every agent-local id introduced by a create op, so
  //    forward references resolve regardless of op order (invariant 2). --
  const duplicateOps = new Set<number>();
  for (const { op, index } of validOps) {
    let localId: string | undefined;
    if (op.op === 'create_node') localId = op.id;
    else if (op.op === 'connect' && op.id) localId = op.id;
    if (localId === undefined) continue;
    if (id_map[localId] !== undefined) {
      // A later op redeclaring an already-claimed agent-local id — flag it; the
      // apply loop turns it into a per-op error and skips it.
      duplicateOps.add(index);
      continue;
    }
    id_map[localId] = bridge.generateId();
  }

  // agent-local id -> real id; a non-local (already-real) id passes through.
  const resolveId = (ref: string): string => id_map[ref] ?? ref;

  // -- Deterministic placement for coordinate-less create_node ops. Computed up
  //    front (op order → stable) seeded by tiles already occupied in the view +
  //    tiles the batch's explicitly-positioned nodes claim. --
  const occupied: Coords[] = (view.items ?? []).map((it) => it.tile);
  const occupiedKeys = new Set(occupied.map(tileKey));
  const needsPlacement: string[] = [];
  for (const { op, index } of validOps) {
    if (op.op !== 'create_node' || duplicateOps.has(index)) continue;
    const realId = id_map[op.id];
    if (op.tile) {
      if (!occupiedKeys.has(tileKey(op.tile))) {
        occupied.push(op.tile);
        occupiedKeys.add(tileKey(op.tile));
      }
    } else {
      needsPlacement.push(realId);
    }
  }
  // The id an endpoint ref resolves to (for both anchoring and layout topology).
  const endpointId = (ref: EndpointRef): string | undefined => {
    if (typeof ref === 'string') return resolveId(ref);
    if (ref.item !== undefined) return resolveId(ref.item);
    return undefined;
  };

  // Feed the batch's connect topology into the layout engine so connected nodes
  // get a layered layout, not a blind grid pack (ADR 0045 §4).
  const layoutEdges: LayoutEdge[] = [];
  for (const { op } of validOps) {
    if (op.op !== 'connect') continue;
    const from = endpointId(op.from);
    const to = endpointId(op.to);
    if (from !== undefined && to !== undefined) layoutEdges.push({ from, to });
  }
  const placements = computeLayout(needsPlacement, layoutEdges, occupied, {
    mode: opts.layoutMode
  });

  const makeAnchor = (ref: EndpointRef): ConnectorAnchor => {
    const out: { item?: string; anchor?: string; tile?: Coords } = {};
    if (typeof ref === 'string') {
      out.item = resolveId(ref);
    } else {
      if (ref.item !== undefined) out.item = resolveId(ref.item);
      if (ref.anchor !== undefined) out.anchor = ref.anchor;
      if (ref.tile !== undefined) out.tile = ref.tile;
    }
    return { id: bridge.generateId(), ref: out };
  };

  const applyOne = (op: Op): void => {
    switch (op.op) {
      case 'create_node': {
        const realId = id_map[op.id];
        const iconId = resolveKind(op.kind, model.icons);
        if (!iconId) {
          throw new Error(`unknown kind "${op.kind}"`);
        }
        const tile = op.tile ?? placements.get(realId) ?? { x: 0, y: 0 };
        const modelItem: ModelItem = {
          id: realId,
          name: op.name ?? op.label ?? op.kind,
          icon: iconId,
          ...(op.label !== undefined ? { label: op.label } : {}),
          ...(op.notes !== undefined ? { notes: op.notes } : {})
        };
        const viewItem: ViewItem = {
          ...VIEW_ITEM_DEFAULTS,
          id: realId,
          tile,
          ...(op.layerId !== undefined ? { layerId: op.layerId } : {}),
          ...styleToViewItem(op.style)
        };
        bridge.createModelItem(modelItem);
        bridge.createViewItem(viewItem);
        created_ids.push(realId);
        return;
      }
      case 'update_node': {
        const realId = resolveId(op.id);
        const modelUpdates: Partial<ModelItem> = {};
        if (op.name !== undefined) modelUpdates.name = op.name;
        if (op.label !== undefined) modelUpdates.label = op.label;
        if (op.notes !== undefined) modelUpdates.notes = op.notes;
        if (Object.keys(modelUpdates).length > 0) {
          bridge.updateModelItem(realId, modelUpdates);
        }
        const viewUpdates: Partial<ViewItem> = {
          ...(op.tile !== undefined ? { tile: op.tile } : {}),
          ...(op.layerId !== undefined ? { layerId: op.layerId } : {}),
          ...styleToViewItem(op.style)
        };
        if (Object.keys(viewUpdates).length > 0) {
          bridge.updateViewItem(realId, viewUpdates);
        }
        changedSet.add(realId);
        return;
      }
      case 'delete_node': {
        const realId = resolveId(op.id);
        // deleteViewItem cascades connector cleanup in the current view and
        // leaves the shared ModelItem intact for other views (UI semantics).
        bridge.deleteViewItem(realId);
        changedSet.add(realId);
        return;
      }
      case 'connect': {
        const connectorId = op.id ? id_map[op.id] : bridge.generateId();
        const color = op.color ?? model.colors[0]?.id;
        const connector: Connector = {
          id: connectorId,
          ...(color !== undefined ? { color } : {}),
          anchors: [makeAnchor(op.from), makeAnchor(op.to)],
          ...(op.style !== undefined ? { style: op.style } : {}),
          ...(op.lineType !== undefined ? { lineType: op.lineType } : {}),
          ...(op.showArrow !== undefined ? { showArrow: op.showArrow } : {}),
          ...(op.label !== undefined
            ? {
                labels: [
                  { id: bridge.generateId(), text: op.label, position: 50 }
                ]
              }
            : {})
        };
        bridge.createConnector(connector);
        created_ids.push(connectorId);
        return;
      }
      case 'disconnect': {
        const realId = resolveId(op.id);
        bridge.deleteConnector(realId);
        changedSet.add(realId);
        return;
      }
      case 'set_style':
      case 'set_layer': {
        const patch: Partial<ViewItem> =
          op.op === 'set_style'
            ? styleToViewItem(op.style)
            : { layerId: op.layerId };
        // Bulk op — a bad target does not sink the whole op; it records a failed
        // target and the rest still restyle/relayer.
        const failed: string[] = [];
        for (const target of op.targets) {
          const realId = resolveId(target);
          try {
            bridge.updateViewItem(realId, patch);
            changedSet.add(realId);
          } catch (e) {
            failed.push(`${target} (${(e as Error).message})`);
          }
        }
        if (failed.length > 0) {
          throw new Error(`${failed.length} target(s) failed: ${failed.join(', ')}`);
        }
        return;
      }
    }
  };

  let applied = 0;

  bridge.transaction(() => {
    for (const { op, index } of validOps) {
      if (duplicateOps.has(index)) {
        errors.push({
          index,
          op: op.op,
          id: 'id' in op ? op.id : undefined,
          message: `duplicate agent-local id "${'id' in op ? op.id : ''}"`
        });
        continue;
      }
      try {
        applyOne(op);
        applied += 1;
      } catch (e) {
        errors.push({
          index,
          op: op.op,
          id: 'id' in op ? op.id : undefined,
          message: (e as Error).message
        });
      }
    }
  });

  return {
    created_ids,
    id_map,
    changed: [...changedSet],
    errors,
    counts: {
      applied,
      failed: errors.length,
      created: created_ids.length,
      changed: changedSet.size
    }
  };
};
