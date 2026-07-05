// @ts-nocheck
import { getAnchorOrdering } from '../modes/Cursor';

// Contract test for the off-path waypoint-ordering fallback in Cursor.ts (F2).
//
// When you grab a connector to add a waypoint, the mousedown tile may sit on the
// connector's hit halo but NOT on an exact path tile (rounding / a fat hit area).
// getAnchorOrdering used to `findIndex` the exact path tile and throw when it was
// -1 — which, in the hot mousemove path, left the mode stuck in CURSOR and
// re-threw every frame. The fix orders the new waypoint by the NEAREST path tile
// instead. This pins: exact hits keep their index, and an off-path grab returns a
// valid in-range nearest index without throwing.
//
// connectorPathTileToGlobal(pathTile, from) reduces to (from - pathTile) — the
// CONNECTOR_SEARCH_OFFSET cancels — so with from = (10, 10) the three path tiles
// (0,0)/(1,0)/(2,0) project to the global tiles (10,10)/(9,10)/(8,10).
const makeConnector = () => ({
  path: {
    tiles: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 }
    ],
    rectangle: { from: { x: 10, y: 10 }, to: { x: 0, y: 0 } }
  },
  anchors: []
});

// A minimal view: getAnchorTile short-circuits on a tile-referenced anchor, so it
// never dereferences view.items / view.connectors.
const view = { items: [], connectors: [] };

const tileAnchor = (x: number, y: number) => ({ id: 'a', ref: { tile: { x, y } } });

describe('Cursor.getAnchorOrdering', () => {
  it('returns the exact path index when the anchor sits on a path tile', () => {
    // Global path tile (9,10) is index 1.
    expect(getAnchorOrdering(tileAnchor(9, 10), makeConnector(), view)).toBe(1);
    // Global path tile (10,10) is index 0 (the from-endpoint).
    expect(getAnchorOrdering(tileAnchor(10, 10), makeConnector(), view)).toBe(0);
  });

  it('off-path grab returns the NEAREST path index instead of throwing', () => {
    // (8.4,10) has no exact path tile; nearest global tile is (8,10) = index 2.
    expect(() =>
      getAnchorOrdering(tileAnchor(8.4, 10), makeConnector(), view)
    ).not.toThrow();
    expect(getAnchorOrdering(tileAnchor(8.4, 10), makeConnector(), view)).toBe(2);
  });

  it('off-path near the middle rounds to the closer neighbour', () => {
    // (9.6,10): dist² to (10,10)=0.16, to (9,10)=0.36 → index 0 wins.
    expect(getAnchorOrdering(tileAnchor(9.6, 10), makeConnector(), view)).toBe(0);
  });

  it('a grab far from every path tile still returns a valid in-range index (no throw)', () => {
    const idx = getAnchorOrdering(tileAnchor(-50, -50), makeConnector(), view);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(3);
  });
});
