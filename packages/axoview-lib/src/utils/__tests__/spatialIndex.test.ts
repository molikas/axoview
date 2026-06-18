import { TileIndex, buildTileIndex } from '../spatialIndex';
import { Coords } from 'src/types';

describe('TileIndex', () => {
  it('reports occupancy and ids at a tile', () => {
    const idx = new TileIndex();
    expect(idx.isOccupied({ x: 1, y: 1 })).toBe(false);
    expect(idx.at({ x: 1, y: 1 })).toEqual([]);

    idx.insert('a', { x: 1, y: 1 });
    expect(idx.isOccupied({ x: 1, y: 1 })).toBe(true);
    expect(idx.at({ x: 1, y: 1 })).toEqual(['a']);
  });

  it('handles multiple ids on the same tile', () => {
    const idx = new TileIndex();
    idx.insert('a', { x: 0, y: 0 });
    idx.insert('b', { x: 0, y: 0 });
    expect(idx.at({ x: 0, y: 0 }).sort()).toEqual(['a', 'b']);

    idx.remove('a');
    expect(idx.at({ x: 0, y: 0 })).toEqual(['b']);
    expect(idx.isOccupied({ x: 0, y: 0 })).toBe(true);

    idx.remove('b');
    expect(idx.isOccupied({ x: 0, y: 0 })).toBe(false);
  });

  it('move/insert relocates an id and clears its old tile', () => {
    const idx = new TileIndex();
    idx.insert('a', { x: 2, y: 3 });
    idx.move('a', { x: 5, y: 6 });
    expect(idx.isOccupied({ x: 2, y: 3 })).toBe(false);
    expect(idx.at({ x: 5, y: 6 })).toEqual(['a']);

    // insert to the same tile is idempotent
    idx.insert('a', { x: 5, y: 6 });
    expect(idx.at({ x: 5, y: 6 })).toEqual(['a']);
  });

  it('remove of an unknown id is a no-op', () => {
    const idx = new TileIndex();
    expect(() => idx.remove('ghost')).not.toThrow();
  });

  it('range returns ids within an inclusive bbox, including negative coords', () => {
    const idx = buildTileIndex([
      { id: 'in1', tile: { x: -2, y: -2 } },
      { id: 'in2', tile: { x: 0, y: 0 } },
      { id: 'edge', tile: { x: 2, y: 2 } },
      { id: 'out', tile: { x: 3, y: 0 } }
    ]);
    expect(idx.range({ x: -2, y: -2 }, { x: 2, y: 2 }).sort()).toEqual([
      'edge',
      'in1',
      'in2'
    ]);
  });

  it('buildTileIndex indexes every item', () => {
    const items = [
      { id: 'a', tile: { x: 1, y: 1 } },
      { id: 'b', tile: { x: 1, y: 2 } }
    ];
    const idx = buildTileIndex(items);
    expect(idx.at({ x: 1, y: 1 })).toEqual(['a']);
    expect(idx.at({ x: 1, y: 2 })).toEqual(['b']);
  });

  // The risk register's invariant: after a random sequence of insert/move/remove
  // the index must agree with a brute-force scan of a ground-truth id→tile map.
  it('matches a brute-force occupancy scan after random ops (invariant)', () => {
    // Deterministic LCG so a failure reproduces (no Math.random / Date.now).
    let seed = 0x1234abcd;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    const randInt = (n: number) => Math.floor(rand() * n);

    const SPAN = 8; // tiles in [-4, 3] on each axis
    const IDS = 12;
    const lo = -4;
    const hi = SPAN + lo - 1; // 3

    const idx = new TileIndex();
    const truth = new Map<string, Coords>();

    for (let step = 0; step < 3000; step += 1) {
      const id = `i${randInt(IDS)}`;
      const op = randInt(3); // 0,1 = insert/move ; 2 = remove
      if (op === 2) {
        idx.remove(id);
        truth.delete(id);
      } else {
        const tile = { x: randInt(SPAN) + lo, y: randInt(SPAN) + lo };
        idx.insert(id, tile);
        truth.set(id, tile);
      }
    }

    // Every tile in the span must agree with the ground truth.
    for (let x = lo; x <= hi; x += 1) {
      for (let y = lo; y <= hi; y += 1) {
        const brute = [...truth.entries()]
          .filter(([, t]) => t.x === x && t.y === y)
          .map(([id]) => id)
          .sort();
        expect(idx.at({ x, y }).sort()).toEqual(brute);
        expect(idx.isOccupied({ x, y })).toBe(brute.length > 0);
      }
    }

    // A range over the whole span is exactly the live id set.
    expect(idx.range({ x: lo, y: lo }, { x: hi, y: hi }).sort()).toEqual(
      [...truth.keys()].sort()
    );
  });
});
