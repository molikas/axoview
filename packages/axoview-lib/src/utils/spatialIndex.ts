import { Coords } from 'src/types';

const tileKey = (x: number, y: number) => `${x},${y}`;

/**
 * Uniform grid hash keyed by integer tile (OCCUPANCY-3). O(1) point queries
 * (at / isOccupied), O(1) incremental insert/move/remove, and a range() bbox
 * query for batch work (e.g. the block-placement collision check in
 * findNearestUnoccupiedTile / the rigid-stamp paste placement).
 *
 * Stores item IDS, not items — recover the item from your own id→item map when
 * you need the object. A tile can legitimately hold more than one id (items can
 * share a tile mid-operation), so at() returns an array and the buckets are
 * Set-valued.
 *
 * DERIVE IT — DO NOT HAND-MAINTAIN ACROSS UNDO/REDO. The model store's undo/redo
 * apply immer patches directly to the store (see modelStore.tsx), bypassing the
 * reducers entirely. An index mutated only from the create/move/delete reducers
 * would therefore silently desync the moment the user hits undo. Build it from
 * the current items array (buildTileIndex) so it is correct by construction and
 * recomputed when that array changes; treat insert/move/remove as building
 * blocks for transient, locally-owned indexes (group placement, a per-marquee
 * cache), not as a store-resident structure poked from scattered mutation paths.
 */
export class TileIndex {
  private byTile = new Map<string, Set<string>>();
  private itemTile = new Map<string, string>();

  // Insert or relocate `id` to `tile`. Idempotent for an unchanged position.
  insert(id: string, tile: Coords): void {
    const k = tileKey(tile.x, tile.y);
    const existing = this.itemTile.get(id);
    if (existing === k) return;
    if (existing !== undefined) this.removeFromBucket(id, existing);

    let bucket = this.byTile.get(k);
    if (!bucket) {
      bucket = new Set();
      this.byTile.set(k, bucket);
    }
    bucket.add(id);
    this.itemTile.set(id, k);
  }

  // Relocate a known id (alias of insert, which already relocates).
  move(id: string, tile: Coords): void {
    this.insert(id, tile);
  }

  remove(id: string): void {
    const k = this.itemTile.get(id);
    if (k === undefined) return;
    this.removeFromBucket(id, k);
    this.itemTile.delete(id);
  }

  // All ids at a tile (empty array if none).
  at(tile: Coords): string[] {
    const bucket = this.byTile.get(tileKey(tile.x, tile.y));
    return bucket ? [...bucket] : [];
  }

  isOccupied(tile: Coords): boolean {
    const bucket = this.byTile.get(tileKey(tile.x, tile.y));
    return bucket !== undefined && bucket.size > 0;
  }

  // Ids whose tile falls within the inclusive [min, max] bounding box. Iterates
  // occupied buckets (O(distinct tiles)), so it is cheap when the scene is
  // sparse relative to the queried area.
  range(min: Coords, max: Coords): string[] {
    const ids: string[] = [];
    for (const [k, bucket] of this.byTile) {
      if (bucket.size === 0) continue;
      const comma = k.indexOf(',');
      const x = Number(k.slice(0, comma));
      const y = Number(k.slice(comma + 1));
      if (x >= min.x && x <= max.x && y >= min.y && y <= max.y) {
        for (const id of bucket) ids.push(id);
      }
    }
    return ids;
  }

  private removeFromBucket(id: string, k: string): void {
    const bucket = this.byTile.get(k);
    if (!bucket) return;
    bucket.delete(id);
    if (bucket.size === 0) this.byTile.delete(k);
  }
}

// Build a fresh index from the current items. O(N) — call when the items array
// changes (e.g. memoised on the array reference), not per frame.
export const buildTileIndex = (
  items: ReadonlyArray<{ id: string; tile: Coords }>
): TileIndex => {
  const index = new TileIndex();
  for (const item of items) index.insert(item.id, item.tile);
  return index;
};
