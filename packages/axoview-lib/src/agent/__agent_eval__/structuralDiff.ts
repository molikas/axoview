// Structural diff (ADR 0047 §Implementation notes) — normalize a Model into a
// placement-equivalence structural form (topology + labels + icon), so a golden
// comparison is stable across runs and tolerant of layout coordinates (ADR 0045 §4
// determinism is what makes the equivalence class tight but fair).
//
// Node identity is the label (falling back to name) — real ids are generated
// UUIDs and carry no cross-run meaning, but labels are authored by the transcript
// and are stable. Edges are label pairs. Everything is sorted → deterministic.

import { Model } from 'src/types';

export interface StructuralNode {
  label: string;
  icon?: string;
}

export interface StructuralGraph {
  nodes: StructuralNode[];
  edges: [string, string][];
}

const labelOf = (item: { label?: string; name: string }): string =>
  item.label ?? item.name;

export const normalize = (model: Model, viewId: string): StructuralGraph => {
  const view = model.views.find((v) => v.id === viewId);
  if (!view) return { nodes: [], edges: [] };

  // id -> label, for the items placed in this view.
  const idToLabel = new Map<string, string>();
  const nodes: StructuralNode[] = [];
  for (const vi of view.items ?? []) {
    const mi = model.items.find((m) => m.id === vi.id);
    if (!mi) continue;
    const label = labelOf(mi);
    idToLabel.set(vi.id, label);
    nodes.push({ label, icon: mi.icon });
  }
  nodes.sort((a, b) => a.label.localeCompare(b.label));

  const edges: [string, string][] = [];
  for (const c of view.connectors ?? []) {
    const ends = c.anchors
      .map((a) => (a.ref.item ? idToLabel.get(a.ref.item) : undefined))
      .filter((x): x is string => x !== undefined);
    if (ends.length === 2) {
      // Undirected identity for comparison: sort the pair.
      edges.push([ends[0], ends[1]].sort() as [string, string]);
    }
  }
  edges.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

  return { nodes, edges };
};

export interface DiffResult {
  equal: boolean;
  missingNodes: string[];
  extraNodes: string[];
  missingEdges: string[];
  extraEdges: string[];
}

const edgeKey = (e: [string, string]) => `${e[0]}—${e[1]}`;

export const diff = (
  actual: StructuralGraph,
  golden: StructuralGraph
): DiffResult => {
  const aNodes = new Set(actual.nodes.map((n) => n.label));
  const gNodes = new Set(golden.nodes.map((n) => n.label));
  const aEdges = new Set(actual.edges.map(edgeKey));
  const gEdges = new Set(golden.edges.map(edgeKey));

  const missingNodes = [...gNodes].filter((n) => !aNodes.has(n));
  const extraNodes = [...aNodes].filter((n) => !gNodes.has(n));
  const missingEdges = [...gEdges].filter((e) => !aEdges.has(e));
  const extraEdges = [...aEdges].filter((e) => !gEdges.has(e));

  return {
    equal:
      missingNodes.length === 0 &&
      extraNodes.length === 0 &&
      missingEdges.length === 0 &&
      extraEdges.length === 0,
    missingNodes,
    extraNodes,
    missingEdges,
    extraEdges
  };
};
