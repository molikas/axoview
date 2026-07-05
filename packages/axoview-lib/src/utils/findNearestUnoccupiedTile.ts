import { Coords } from 'src/types';
// Type-only: utils must not carry a runtime edge into hooks/ (layering; the
// value import wired 30 of the 61 madge cycle chains — technical-review-2026-07 §8d).
import type { useScene } from 'src/hooks/useScene';
import { TileIndex, buildTileIndex, itemCollides } from 'src/utils/spatialIndex';

/**
 * Finds the nearest unoccupied tile to the target tile using a spiral search pattern.
 * Uses the TileIndex (O(1) isOccupied) instead of O(N) getItemAtTile per candidate.
 */
export const findNearestUnoccupiedTile = (
  targetTile: Coords,
  scene: ReturnType<typeof useScene>,
  maxDistance: number = 10
): Coords | null => {
  // Build the occupancy index once — O(N) upfront, O(1) per probe (OCCUPANCY-3).
  const index = buildTileIndex(scene.items);

  if (!index.isOccupied(targetTile)) {
    return targetTile;
  }

  // Spiral search pattern: right, down, left, up
  const directions = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 }
  ];

  for (let distance = 1; distance <= maxDistance; distance++) {
    let currentTile = {
      x: targetTile.x - distance,
      y: targetTile.y - distance
    };

    for (let side = 0; side < 4; side++) {
      const direction = directions[side];
      const sideLength = distance * 2;

      for (let step = 0; step < sideLength; step++) {
        currentTile = {
          x: currentTile.x + direction.x,
          y: currentTile.y + direction.y
        };

        if (!index.isOccupied(currentTile)) {
          return currentTile;
        }
      }
    }
  }

  return null;
};

// The pasted block searches integer offsets out to this Chebyshev distance for
// a collision-free placement before giving up and stamping at the target. Big
// enough that any realistic paste finds clear space; bounded so a pathologically
// dense scene can't spin.
const MAX_STAMP_OFFSET = 64;

// Visit the perimeter of the Chebyshev-distance-`d` offset ring and return the
// first offset for which `fits` holds, else null. Walks only the 4 edges — O(d),
// not the O(d²) full (2d+1)² square the old per-tile ring scan iterated (SCANRING).
const firstFittingOffsetOnRing = (
  d: number,
  fits: (offset: Coords) => boolean
): Coords | null => {
  // Top (y = -d) and bottom (y = +d) edges, full width.
  for (let dx = -d; dx <= d; dx += 1) {
    if (fits({ x: dx, y: -d })) return { x: dx, y: -d };
    if (fits({ x: dx, y: d })) return { x: dx, y: d };
  }
  // Left (x = -d) and right (x = +d) edges, excluding the corners covered above.
  for (let dy = -d + 1; dy <= d - 1; dy += 1) {
    if (fits({ x: -d, y: dy })) return { x: -d, y: dy };
    if (fits({ x: d, y: dy })) return { x: d, y: dy };
  }
  return null;
};

/**
 * Rigid-stamp placement for a group of items being pasted/placed (MAXDIST-5).
 *
 * Finds ONE integer offset such that the whole block — every item shifted by the
 * same offset — clears all existing items, searching outward from the target
 * offset. This preserves the block's internal relative layout (a pasted diagram
 * fragment keeps its shape) and never silently stacks: the old per-node spiral
 * capped each node at distance 10 and, when any node could not be placed,
 * returned null — at which point the caller dropped the ENTIRE paste onto the
 * original tiles (every pasted node stacked on its source).
 *
 * Items in `excludeIds` (e.g. the items being moved) are ignored for collision.
 * Returns one resolved tile per input item, in input order; [] for empty input.
 * For a non-empty block it never returns null — if no clear offset exists within
 * the search bound it stamps at the target offset (layout preserved) rather than
 * collapsing the block. (The `| null` return is retained for call-site/mock
 * compatibility.)
 */
export const findNearestUnoccupiedTilesForGroup = (
  items: { id: string; targetTile: Coords; snap?: boolean; collides?: boolean }[],
  scene: ReturnType<typeof useScene>,
  excludeIds: string[] = []
): Coords[] | null => {
  if (items.length === 0) return [];

  const exclude = new Set(excludeIds);
  const index = new TileIndex();
  // Non-colliding scene items (ADR 0023) are not obstacles for placement.
  for (const item of scene.items) {
    if (!exclude.has(item.id) && itemCollides(item)) {
      index.insert(item.id, item.tile);
    }
  }

  // Every input item gets a resolved tile in input order (below), but only
  // COLLIDING movers constrain where the block can land — a non-colliding
  // pasted item never forces the whole block to shift.
  const blockTiles = items.map((it) => it.targetTile);
  const collisionTiles = items
    .filter((it) => itemCollides(it))
    .map((it) => it.targetTile);

  const blockClearsAt = (offset: Coords): boolean => {
    for (const tile of collisionTiles) {
      if (index.isOccupied({ x: tile.x + offset.x, y: tile.y + offset.y })) {
        return false;
      }
    }
    return true;
  };

  // Target offset first, then expand ring by ring.
  if (blockClearsAt({ x: 0, y: 0 })) return blockTiles;

  for (let d = 1; d <= MAX_STAMP_OFFSET; d += 1) {
    const offset = firstFittingOffsetOnRing(d, blockClearsAt);
    if (offset) {
      return blockTiles.map((tile) => ({
        x: tile.x + offset.x,
        y: tile.y + offset.y
      }));
    }
  }

  // No clear offset within the bound — stamp at the target rather than stacking
  // the block onto itself. The internal layout stays intact even though it
  // overlaps the scene.
  return blockTiles;
};
