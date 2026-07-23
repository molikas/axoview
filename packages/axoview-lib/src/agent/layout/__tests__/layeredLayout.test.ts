// Auto-layout engine tests (ADR 0045 §4). The load-bearing property is
// determinism — a golden diff (ADR 0047) is only stable if the same input yields
// byte-identical tiles. Plus: non-overlap, layered structure, collision-avoidance.

import { computeLayout, LayoutEdge } from '../layeredLayout';

const keyset = (tiles: { x: number; y: number }[]) =>
  new Set(tiles.map((t) => `${t.x},${t.y}`));

describe('computeLayout — deterministic layered placement', () => {
  const chain = (ids: string[]): LayoutEdge[] =>
    ids.slice(0, -1).map((from, i) => ({ from, to: ids[i + 1] }));

  it('places a 6-node connected graph non-overlapping and byte-identical across runs', () => {
    const nodes = ['a', 'b', 'c', 'd', 'e', 'f'];
    const edges: LayoutEdge[] = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
      { from: 'b', to: 'd' },
      { from: 'c', to: 'd' },
      { from: 'd', to: 'e' },
      { from: 'd', to: 'f' }
    ];

    const run = () =>
      [...computeLayout(nodes, edges).entries()].sort((x, y) =>
        x[0].localeCompare(y[0])
      );

    const a = run();
    const b = run();
    expect(a).toEqual(b); // determinism

    const tiles = a.map(([, t]) => t);
    expect(keyset(tiles).size).toBe(6); // non-overlap
  });

  it('ranks a linear chain into strictly increasing flow position (layered-lr → x)', () => {
    const ids = ['n0', 'n1', 'n2', 'n3'];
    const layout = computeLayout(ids, chain(ids), [], { mode: 'layered-lr' });
    const xs = ids.map((id) => layout.get(id)!.x);
    // Each successive node sits in a later rank (greater x).
    for (let i = 1; i < xs.length; i += 1) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  });

  it('honours the layered-tb mode (flow along y)', () => {
    const ids = ['n0', 'n1', 'n2'];
    const layout = computeLayout(ids, chain(ids), [], { mode: 'layered-tb' });
    const ys = ids.map((id) => layout.get(id)!.y);
    for (let i = 1; i < ys.length; i += 1) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
  });

  it('never places on an occupied tile', () => {
    const occupied = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 6, y: 0 }
    ];
    const ids = ['n0', 'n1', 'n2'];
    const layout = computeLayout(ids, chain(ids), occupied, {
      mode: 'layered-lr'
    });
    const occKeys = keyset(occupied);
    for (const t of layout.values()) {
      expect(occKeys.has(`${t.x},${t.y}`)).toBe(false);
    }
  });

  it('breaks a cycle deterministically instead of looping forever', () => {
    const ids = ['a', 'b', 'c'];
    const cyclic: LayoutEdge[] = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'a' } // back edge
    ];
    const layout = computeLayout(ids, cyclic);
    expect(layout.size).toBe(3);
    expect(keyset([...layout.values()]).size).toBe(3);
  });

  it('packs disconnected components into separate, non-overlapping blocks', () => {
    const nodes = ['a1', 'a2', 'b1', 'b2', 'solo'];
    const edges: LayoutEdge[] = [
      { from: 'a1', to: 'a2' },
      { from: 'b1', to: 'b2' }
    ];
    const layout = computeLayout(nodes, edges);
    expect(layout.size).toBe(5);
    expect(keyset([...layout.values()]).size).toBe(5); // all distinct
  });

  it('radial mode places a cycle on a non-overlapping ring, deterministically (L1)', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    // A closed loop a→b→c→d→e→f→a.
    const cycle: LayoutEdge[] = ids.map((from, i) => ({
      from,
      to: ids[(i + 1) % ids.length]
    }));
    const run = () =>
      [...computeLayout(ids, cycle, [], { mode: 'radial' }).entries()].sort(
        (x, y) => x[0].localeCompare(y[0])
      );
    const a = run();
    const b = run();
    expect(a).toEqual(b); // deterministic
    const tiles = a.map(([, t]) => t);
    expect(keyset(tiles).size).toBe(6); // non-overlapping
    // Ring: nodes span a 2D spread (not a single line) — both axes vary.
    const xs = new Set(tiles.map((t) => t.x));
    const ys = new Set(tiles.map((t) => t.y));
    expect(xs.size).toBeGreaterThan(1);
    expect(ys.size).toBeGreaterThan(1);
  });

  it('grid mode ignores edges and packs deterministically', () => {
    const ids = ['x', 'y', 'z'];
    const a = computeLayout(ids, chain(ids), [], { mode: 'grid' });
    const b = computeLayout(ids, chain(ids), [], { mode: 'grid' });
    expect([...a.entries()]).toEqual([...b.entries()]);
    expect(keyset([...a.values()]).size).toBe(3);
  });
});
