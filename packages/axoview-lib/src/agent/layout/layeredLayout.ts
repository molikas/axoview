// Deterministic auto-layout engine (ADR 0045 §4, Track B) — the highest-risk
// build item. The agent declares topology; THIS turns it into tile coordinates so
// the agent never computes a tile (invariant 1).
//
// Hand-rolled rank-and-pack (the ADR-0045-§Implementation-notes non-binding
// choice, resolved in favour of a dependency-free engine over elkjs): a layered
// algorithm — longest-path ranking with deterministic cycle-breaking, barycenter
// ordering within each rank, mapped to the iso tile grid, packed to avoid tiles
// already occupied on the canvas (ADR 0023 collision).
//
// DETERMINISM IS LOAD-BEARING (ADR 0045 §4 / ADR 0047 goldens): every traversal
// is over a sorted key, every tie-breaks on id. No Math.random, no Date.now, no
// Set/Map-iteration-order dependency. Same (nodes, edges, occupied, opts) →
// byte-identical tiles.

import { Coords } from 'src/types';

export type LayoutMode = 'layered-lr' | 'layered-tb' | 'grid';

export interface LayoutEdge {
  from: string;
  to: string;
}

export interface LayoutOptions {
  mode?: LayoutMode;
  // Tile gap between successive ranks (the flow direction) and between lanes
  // (across the flow). Both ≥ 1 guarantees distinct tiles → no overlap.
  rankGap?: number;
  laneGap?: number;
}

const DEFAULTS = { mode: 'layered-lr' as LayoutMode, rankGap: 3, laneGap: 2 };

const tileKey = (t: Coords): string => `${t.x},${t.y}`;

// ---------------------------------------------------------------------------
// Grid pack — disconnected sets, or the `grid` mode. Deterministic expanding
// ring walk from the origin, skipping occupied tiles.
// ---------------------------------------------------------------------------

function* ringTiles(): Generator<Coords> {
  yield { x: 0, y: 0 };
  for (let r = 1; ; r += 1) {
    const ring: Coords[] = [];
    for (let x = -r; x <= r; x += 1) {
      for (let y = -r; y <= r; y += 1) {
        if (Math.max(Math.abs(x), Math.abs(y)) === r) ring.push({ x, y });
      }
    }
    ring.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const t of ring) yield t;
  }
}

export const gridPack = (
  ids: string[],
  occupiedKeys: Set<string>
): Map<string, Coords> => {
  const taken = new Set(occupiedKeys);
  const out = new Map<string, Coords>();
  const stream = ringTiles();
  // Deterministic: place in sorted id order.
  for (const id of [...ids].sort()) {
    let next = stream.next();
    while (!next.done && taken.has(tileKey(next.value))) next = stream.next();
    const tile = next.value ?? { x: 0, y: 0 };
    taken.add(tileKey(tile));
    out.set(id, tile);
  }
  return out;
};

// ---------------------------------------------------------------------------
// Weakly-connected components — so multiple disjoint graphs pack as separate
// blocks rather than interleaving.
// ---------------------------------------------------------------------------

const components = (
  nodes: string[],
  adjUndirected: Map<string, string[]>
): string[][] => {
  const seen = new Set<string>();
  const result: string[][] = [];
  // Sorted seed order → deterministic component discovery + ordering.
  for (const seed of [...nodes].sort()) {
    if (seen.has(seed)) continue;
    const stack = [seed];
    const comp: string[] = [];
    seen.add(seed);
    while (stack.length > 0) {
      const n = stack.pop()!;
      comp.push(n);
      for (const m of adjUndirected.get(n) ?? []) {
        if (!seen.has(m)) {
          seen.add(m);
          stack.push(m);
        }
      }
    }
    comp.sort();
    result.push(comp);
  }
  // Order components by their smallest id for a stable packing order.
  result.sort((a, b) => a[0].localeCompare(b[0]));
  return result;
};

// ---------------------------------------------------------------------------
// Longest-path ranking with deterministic cycle-breaking.
// ---------------------------------------------------------------------------

const assignRanks = (
  nodes: string[],
  edges: LayoutEdge[]
): Map<string, number> => {
  const nodeSet = new Set(nodes);
  // Only intra-set edges participate in ranking.
  const intra = edges
    .filter((e) => nodeSet.has(e.from) && nodeSet.has(e.to) && e.from !== e.to)
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  // Break cycles deterministically: a DFS in sorted order marks back edges
  // (targets currently on the recursion stack) — those are dropped from the DAG
  // used for ranking, so longest-path always terminates.
  const outAdj = new Map<string, string[]>();
  for (const n of nodes) outAdj.set(n, []);
  for (const e of intra) outAdj.get(e.from)!.push(e.to);
  for (const n of nodes) outAdj.get(n)!.sort();

  const state = new Map<string, 0 | 1 | 2>(); // 0=unseen,1=on-stack,2=done
  const backEdges = new Set<string>();
  const edgeKey = (f: string, t: string) => `${f}->${t}`;
  const dfs = (u: string) => {
    state.set(u, 1);
    for (const v of outAdj.get(u) ?? []) {
      const s = state.get(v) ?? 0;
      if (s === 1) backEdges.add(edgeKey(u, v));
      else if (s === 0) dfs(v);
    }
    state.set(u, 2);
  };
  for (const n of [...nodes].sort()) if ((state.get(n) ?? 0) === 0) dfs(n);

  const dag = intra.filter((e) => !backEdges.has(edgeKey(e.from, e.to)));

  // Longest-path rank via relaxation over a topological order. Kahn's algorithm
  // with sorted queues keeps it deterministic.
  const indeg = new Map<string, number>();
  const dagOut = new Map<string, string[]>();
  for (const n of nodes) {
    indeg.set(n, 0);
    dagOut.set(n, []);
  }
  for (const e of dag) {
    dagOut.get(e.from)!.push(e.to);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  }
  for (const n of nodes) dagOut.get(n)!.sort();

  const rank = new Map<string, number>();
  for (const n of nodes) rank.set(n, 0);
  // Ready = indeg 0, always drained in sorted order.
  let ready = [...nodes].filter((n) => (indeg.get(n) ?? 0) === 0).sort();
  const remaining = new Map(indeg);
  while (ready.length > 0) {
    const next: string[] = [];
    for (const u of ready) {
      for (const v of dagOut.get(u) ?? []) {
        rank.set(v, Math.max(rank.get(v)!, rank.get(u)! + 1));
        remaining.set(v, remaining.get(v)! - 1);
        if (remaining.get(v) === 0) next.push(v);
      }
    }
    next.sort();
    ready = next;
  }
  return rank;
};

// ---------------------------------------------------------------------------
// Order nodes within each rank by the barycenter of their neighbours in the
// previous rank — the classic crossing-reduction heuristic, made deterministic.
// ---------------------------------------------------------------------------

const orderWithinRanks = (
  nodes: string[],
  edges: LayoutEdge[],
  rank: Map<string, number>
): string[][] => {
  const maxRank = Math.max(0, ...nodes.map((n) => rank.get(n) ?? 0));
  const byRank: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const n of [...nodes].sort()) byRank[rank.get(n) ?? 0].push(n);

  const nodeSet = new Set(nodes);
  const prevNeighbours = new Map<string, string[]>();
  for (const n of nodes) prevNeighbours.set(n, []);
  for (const e of edges) {
    if (!nodeSet.has(e.from) || !nodeSet.has(e.to)) continue;
    const rf = rank.get(e.from) ?? 0;
    const rt = rank.get(e.to) ?? 0;
    if (rt === rf + 1) prevNeighbours.get(e.to)!.push(e.from);
    else if (rf === rt + 1) prevNeighbours.get(e.from)!.push(e.to);
  }

  // One downward barycenter sweep is enough for a stable, decent order.
  const pos = new Map<string, number>();
  byRank[0].forEach((n, i) => pos.set(n, i));
  for (let r = 1; r <= maxRank; r += 1) {
    const layer = byRank[r];
    const bary = new Map<string, number>();
    for (const n of layer) {
      const neigh = prevNeighbours.get(n)!.filter((m) => pos.has(m));
      if (neigh.length === 0) {
        bary.set(n, Number.POSITIVE_INFINITY); // unanchored → sink to the end
      } else {
        const sum = neigh.reduce((acc, m) => acc + pos.get(m)!, 0);
        bary.set(n, sum / neigh.length);
      }
    }
    // Stable sort by barycenter, tie-break on id.
    layer.sort((a, b) => (bary.get(a)! - bary.get(b)!) || a.localeCompare(b));
    layer.forEach((n, i) => pos.set(n, i));
  }
  return byRank;
};

// ---------------------------------------------------------------------------
// The public entry point.
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic tile for every id in `nodes`, laying out `edges` as a
 * layered graph and avoiding every tile in `occupied`. Ids not touched by any
 * edge are grid-packed after the connected blocks.
 */
export const computeLayout = (
  nodes: string[],
  edges: LayoutEdge[],
  occupied: Coords[] = [],
  opts: LayoutOptions = {}
): Map<string, Coords> => {
  const mode = opts.mode ?? DEFAULTS.mode;
  const rankGap = opts.rankGap ?? DEFAULTS.rankGap;
  const laneGap = opts.laneGap ?? DEFAULTS.laneGap;

  const occupiedKeys = new Set(occupied.map(tileKey));
  const result = new Map<string, Coords>();

  if (nodes.length === 0) return result;
  if (mode === 'grid') return gridPack(nodes, occupiedKeys);

  // Undirected adjacency for component discovery.
  const nodeSet = new Set(nodes);
  const adjU = new Map<string, string[]>();
  for (const n of nodes) adjU.set(n, []);
  for (const e of edges) {
    if (!nodeSet.has(e.from) || !nodeSet.has(e.to) || e.from === e.to) continue;
    adjU.get(e.from)!.push(e.to);
    adjU.get(e.to)!.push(e.from);
  }

  const comps = components(nodes, adjU);

  // A running cursor that offsets each block so blocks don't overlap. In LR the
  // flow is along x and blocks stack down y; in TB the flow is along y and
  // blocks stack across x.
  let blockOffset = 0;

  const singletons: string[] = [];

  for (const comp of comps) {
    if (comp.length === 1) {
      singletons.push(comp[0]);
      continue;
    }
    const rank = assignRanks(comp, edges);
    const byRank = orderWithinRanks(comp, edges, rank);

    // Lay the block out at local coords, then translate by blockOffset + a base
    // shift that clears occupied tiles.
    const local = new Map<string, Coords>();
    let maxLane = 0;
    byRank.forEach((layer, r) => {
      maxLane = Math.max(maxLane, layer.length - 1);
      layer.forEach((n, lane) => {
        const along = r * rankGap;
        const across = lane * laneGap;
        local.set(
          n,
          mode === 'layered-lr'
            ? { x: along, y: across + blockOffset }
            : { x: across + blockOffset, y: along }
        );
      });
    });

    // Deterministically shift the whole block until no tile collides with an
    // occupied tile — occupiedKeys already folds in every earlier block placed
    // this pass, so this covers block-vs-block overlap too.
    let shift = 0;
    const collides = (s: number): boolean => {
      for (const t of local.values()) {
        const shifted =
          mode === 'layered-lr'
            ? { x: t.x, y: t.y + s }
            : { x: t.x + s, y: t.y };
        if (occupiedKeys.has(tileKey(shifted))) return true;
      }
      return false;
    };
    while (collides(shift)) shift += 1;

    for (const [id, t] of local) {
      const finalTile =
        mode === 'layered-lr'
          ? { x: t.x, y: t.y + shift }
          : { x: t.x + shift, y: t.y };
      result.set(id, finalTile);
      occupiedKeys.add(tileKey(finalTile));
    }

    blockOffset += (maxLane + 1) * laneGap + laneGap; // gap between blocks
  }

  // Grid-pack the singletons after the connected blocks (they avoid every tile
  // used above via the shared occupiedKeys set).
  if (singletons.length > 0) {
    const packed = gridPack(singletons, occupiedKeys);
    for (const [id, t] of packed) result.set(id, t);
  }

  return result;
};
