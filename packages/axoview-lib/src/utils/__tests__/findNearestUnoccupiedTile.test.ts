import {
  findNearestUnoccupiedTile,
  findNearestUnoccupiedTilesForGroup
} from '../findNearestUnoccupiedTile';

// ---------------------------------------------------------------------------
// Mock renderer (getItemAtTile used in findNearestUnoccupiedTile)
// ---------------------------------------------------------------------------
const mockGetItemAtTile = jest.fn<any, any>(() => null);

jest.mock('../renderer', () => ({
  getItemAtTile: (...args: any[]) => mockGetItemAtTile(...args)
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeScene(
  items: Array<{ id: string; tile: { x: number; y: number } }> = []
) {
  return { items, textBoxes: [], connectors: [], rectangles: [] } as any;
}

/**
 * Returns a mockGetItemAtTile implementation that returns an ITEM for any
 * tile occupied by one of the given items.
 */
function occupyTiles(
  items: Array<{ id: string; tile: { x: number; y: number } }>
) {
  const map = new Map(items.map((i) => [`${i.tile.x},${i.tile.y}`, i]));
  return ({ tile }: any) => {
    const item = map.get(`${tile.x},${tile.y}`);
    return item ? { type: 'ITEM', id: item.id } : null;
  };
}

// ---------------------------------------------------------------------------
// findNearestUnoccupiedTile
// ---------------------------------------------------------------------------
describe('findNearestUnoccupiedTile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItemAtTile.mockReturnValue(null);
  });

  it('returns target tile when it is unoccupied', () => {
    const target = { x: 5, y: 5 };
    const result = findNearestUnoccupiedTile(target, makeScene());
    expect(result).toEqual(target);
  });

  it('returns target tile when getItemAtTile returns non-ITEM (e.g. rectangle)', () => {
    mockGetItemAtTile.mockReturnValue({ type: 'RECTANGLE', id: 'r1' });
    const target = { x: 5, y: 5 };
    const result = findNearestUnoccupiedTile(target, makeScene());
    expect(result).toEqual(target); // non-ITEM doesn't block placement
  });

  it('finds a nearby tile when target is occupied', () => {
    // Target (5,5) is occupied; surrounding tiles are free
    const items = [{ id: 'n1', tile: { x: 5, y: 5 } }];
    mockGetItemAtTile.mockImplementation(occupyTiles(items));

    const result = findNearestUnoccupiedTile({ x: 5, y: 5 }, makeScene(items));
    expect(result).not.toBeNull();
    expect(result).not.toEqual({ x: 5, y: 5 });
  });

  it('returns null when all tiles within maxDistance are occupied', () => {
    // Fill a 3x3 grid (distance 1 ring) — the target plus all ring tiles
    const allTiles: Array<{ id: string; tile: { x: number; y: number } }> = [];
    for (let x = 3; x <= 7; x++) {
      for (let y = 3; y <= 7; y++) {
        allTiles.push({ id: `n-${x}-${y}`, tile: { x, y } });
      }
    }
    mockGetItemAtTile.mockImplementation(occupyTiles(allTiles));

    const result = findNearestUnoccupiedTile(
      { x: 5, y: 5 },
      makeScene(allTiles),
      1
    );
    expect(result).toBeNull();
  });

  it('respects maxDistance — does not search beyond the limit', () => {
    // Target occupied, distance-1 ring all occupied, distance-2 free
    const ring0 = [{ id: 'center', tile: { x: 5, y: 5 } }];
    const ring1: typeof ring0 = [];
    for (let x = 4; x <= 6; x++) {
      for (let y = 4; y <= 6; y++) {
        if (x !== 5 || y !== 5)
          ring1.push({ id: `r1-${x}-${y}`, tile: { x, y } });
      }
    }
    const allOccupied = [...ring0, ...ring1];
    mockGetItemAtTile.mockImplementation(occupyTiles(allOccupied));

    // maxDistance 1 → cannot find a free tile → null
    expect(
      findNearestUnoccupiedTile({ x: 5, y: 5 }, makeScene(allOccupied), 1)
    ).toBeNull();

    // maxDistance 2 → finds a tile in the outer ring
    jest.clearAllMocks();
    mockGetItemAtTile.mockImplementation(occupyTiles(allOccupied));
    const result = findNearestUnoccupiedTile(
      { x: 5, y: 5 },
      makeScene(allOccupied),
      2
    );
    expect(result).not.toBeNull();
  });

  it('returns a tile within maxDistance of the target', () => {
    const items = [{ id: 'n1', tile: { x: 5, y: 5 } }];
    mockGetItemAtTile.mockImplementation(occupyTiles(items));

    const result = findNearestUnoccupiedTile(
      { x: 5, y: 5 },
      makeScene(items),
      3
    );
    expect(result).not.toBeNull();
    const dx = Math.abs(result!.x - 5);
    const dy = Math.abs(result!.y - 5);
    expect(Math.max(dx, dy)).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// findNearestUnoccupiedTilesForGroup
// ---------------------------------------------------------------------------
describe('findNearestUnoccupiedTilesForGroup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItemAtTile.mockReturnValue(null);
  });

  it('returns target tiles when all are unoccupied', () => {
    const scene = makeScene();
    const items = [
      { id: 'a', targetTile: { x: 1, y: 1 } },
      { id: 'b', targetTile: { x: 3, y: 3 } }
    ];
    const result = findNearestUnoccupiedTilesForGroup(items, scene);
    expect(result).toEqual([
      { x: 1, y: 1 },
      { x: 3, y: 3 }
    ]);
  });

  it('returns empty array for empty input', () => {
    const result = findNearestUnoccupiedTilesForGroup([], makeScene());
    expect(result).toEqual([]);
  });

  it('finds alternative tile when target is occupied by existing scene item', () => {
    const sceneItems = [{ id: 'existing', tile: { x: 5, y: 5 } }];
    const scene = makeScene(sceneItems);
    // The group-function uses scene.items directly, not getItemAtTile, for the
    // initial occupancy set — so mock is only needed for the fallback scan:
    mockGetItemAtTile.mockImplementation(({ tile }: any) => {
      // Only (5,5) is occupied by existing
      if (tile.x === 5 && tile.y === 5) return { type: 'ITEM', id: 'existing' };
      return null;
    });

    const items = [{ id: 'new', targetTile: { x: 5, y: 5 } }];
    const result = findNearestUnoccupiedTilesForGroup(items, scene);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0]).not.toEqual({ x: 5, y: 5 });
  });

  it('excludes items with excludeIds from the occupancy check', () => {
    // Item 'moving' is at (5,5) but we exclude it, so (5,5) should be free
    const sceneItems = [{ id: 'moving', tile: { x: 5, y: 5 } }];
    const scene = makeScene(sceneItems);

    const items = [{ id: 'moving', targetTile: { x: 5, y: 5 } }];
    const result = findNearestUnoccupiedTilesForGroup(items, scene, ['moving']);
    expect(result).toEqual([{ x: 5, y: 5 }]);
  });

  it('places the block in free space outside a fully-occupied region (never stacks)', () => {
    // RIGID-STAMP (MAXDIST-5): the old algorithm capped each node's ring search
    // at distance 10 and returned null when it could not place an item — at
    // which point the caller dropped the whole paste onto the source tiles.
    // Rigid-stamp instead shifts the block out to clear space, so the item
    // lands on a genuinely free tile rather than stacking.
    const sceneItems: Array<{ id: string; tile: { x: number; y: number } }> =
      [];
    const occupied = new Set<string>();
    for (let x = -15; x <= 25; x++) {
      for (let y = -15; y <= 25; y++) {
        sceneItems.push({ id: `n-${x}-${y}`, tile: { x, y } });
        occupied.add(`${x},${y}`);
      }
    }
    const scene = makeScene(sceneItems);
    const items = [{ id: 'new', targetTile: { x: 5, y: 5 } }];
    const result = findNearestUnoccupiedTilesForGroup(items, scene);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    // The placed tile is genuinely free — not stacked on an existing item.
    expect(occupied.has(`${result![0].x},${result![0].y}`)).toBe(false);
  });

  it('preserves the block relative layout when shifting (rigid stamp)', () => {
    // Two items at distinct targets that both collide with existing items. The
    // whole block shifts by a single offset, so the output preserves the input
    // relative layout exactly and neither lands on an existing item.
    const sceneItems = [
      { id: 'x1', tile: { x: 5, y: 5 } },
      { id: 'x2', tile: { x: 6, y: 5 } }
    ];
    const scene = makeScene(sceneItems);
    const items = [
      { id: 'a', targetTile: { x: 5, y: 5 } },
      { id: 'b', targetTile: { x: 6, y: 5 } } // relative offset (1, 0) from a
    ];
    const result = findNearestUnoccupiedTilesForGroup(items, scene);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    const [t1, t2] = result!;
    // Relative layout preserved (same (1,0) offset between the two tiles).
    expect(t2.x - t1.x).toBe(1);
    expect(t2.y - t1.y).toBe(0);
    // Neither overlaps an existing item.
    const occupied = new Set(sceneItems.map((i) => `${i.tile.x},${i.tile.y}`));
    expect(occupied.has(`${t1.x},${t1.y}`)).toBe(false);
    expect(occupied.has(`${t2.x},${t2.y}`)).toBe(false);
  });

  it('shifts a block pasted on top of itself to clear space (never stacks)', () => {
    // The reported scenario, in miniature: a 3-node row pasted exactly on top
    // of the source row. Rigid-stamp moves the whole block to free tiles; none
    // of the pasted tiles land on an existing node.
    const sceneItems = [
      { id: 's0', tile: { x: 0, y: 0 } },
      { id: 's1', tile: { x: 1, y: 0 } },
      { id: 's2', tile: { x: 2, y: 0 } }
    ];
    const scene = makeScene(sceneItems);
    const items = [
      { id: 'p0', targetTile: { x: 0, y: 0 } },
      { id: 'p1', targetTile: { x: 1, y: 0 } },
      { id: 'p2', targetTile: { x: 2, y: 0 } }
    ];
    const result = findNearestUnoccupiedTilesForGroup(items, scene);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(3);
    const occupied = new Set(sceneItems.map((i) => `${i.tile.x},${i.tile.y}`));
    for (const t of result!) {
      expect(occupied.has(`${t.x},${t.y}`)).toBe(false);
    }
    // Layout preserved — still a contiguous horizontal row.
    expect(result![1].x - result![0].x).toBe(1);
    expect(result![2].x - result![1].x).toBe(1);
    expect(result![0].y).toBe(result![1].y);
    expect(result![1].y).toBe(result![2].y);
  });
});
