import { Coords, Size, Scroll } from 'src/types';
import { CoordsUtils, SizeUtils } from 'src/utils';
import {
  PROJECTED_TILE_SIZE,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_INCREMENT
} from 'src/config';
import {
  getGridSubset,
  isWithinBounds,
  screenToIso,
  incrementZoom,
  decrementZoom,
  getItemAtTile
} from '../renderer';

const getRendererSize = (tileSize: Size, zoom: number = 1): Size => {
  const projectedTileSize = SizeUtils.multiply(PROJECTED_TILE_SIZE, zoom);

  return {
    width: projectedTileSize.width * tileSize.width,
    height: projectedTileSize.height * tileSize.height
  };
};

const getScroll = (coords: Coords): Scroll => {
  return {
    position: coords,
    offset: CoordsUtils.zero()
  };
};

describe('Tests renderer utils', () => {
  test('getGridSubset() works correctly', () => {
    const gridSubset = getGridSubset([
      { x: 5, y: 5 },
      { x: 7, y: 7 }
    ]);

    expect(gridSubset).toEqual([
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 5, y: 7 },
      { x: 6, y: 5 },
      { x: 6, y: 6 },
      { x: 6, y: 7 },
      { x: 7, y: 5 },
      { x: 7, y: 6 },
      { x: 7, y: 7 }
    ]);
  });

  test('isWithinBounds() works correctly', () => {
    const bounds: Coords[] = [
      { x: 4, y: 4 },
      { x: 6, y: 6 }
    ];

    const withinBounds = isWithinBounds({ x: 5, y: 5 }, bounds);
    const onBorder = isWithinBounds({ x: 4, y: 4 }, bounds);
    const outsideBounds = isWithinBounds({ x: 3, y: 3 }, bounds);

    expect(withinBounds).toBe(true);
    expect(onBorder).toBe(true);
    expect(outsideBounds).toBe(false);
  });

  test('isWithinBounds() works with reversed bounds (bottom-right to top-left drag)', () => {
    // Lasso dragged from bottom-right to top-left — sortByPosition normalises the order
    const bounds: Coords[] = [
      { x: 6, y: 6 },
      { x: 4, y: 4 }
    ];

    expect(isWithinBounds({ x: 5, y: 5 }, bounds)).toBe(true);
    expect(isWithinBounds({ x: 4, y: 4 }, bounds)).toBe(true);
    expect(isWithinBounds({ x: 6, y: 6 }, bounds)).toBe(true);
    expect(isWithinBounds({ x: 3, y: 5 }, bounds)).toBe(false);
    expect(isWithinBounds({ x: 5, y: 7 }, bounds)).toBe(false);
  });

  test('isWithinBounds() works for a single-tile selection', () => {
    const bounds: Coords[] = [
      { x: 3, y: 3 },
      { x: 3, y: 3 }
    ];

    expect(isWithinBounds({ x: 3, y: 3 }, bounds)).toBe(true);
    expect(isWithinBounds({ x: 3, y: 4 }, bounds)).toBe(false);
    expect(isWithinBounds({ x: 4, y: 3 }, bounds)).toBe(false);
  });

  test('isWithinBounds() — far-corner tiles are included, just-outside tiles are not', () => {
    const bounds: Coords[] = [
      { x: 2, y: 2 },
      { x: 5, y: 5 }
    ];

    // All four corners are inside
    expect(isWithinBounds({ x: 2, y: 2 }, bounds)).toBe(true);
    expect(isWithinBounds({ x: 5, y: 5 }, bounds)).toBe(true);
    expect(isWithinBounds({ x: 2, y: 5 }, bounds)).toBe(true);
    expect(isWithinBounds({ x: 5, y: 2 }, bounds)).toBe(true);

    // One tile outside each edge
    expect(isWithinBounds({ x: 1, y: 3 }, bounds)).toBe(false);
    expect(isWithinBounds({ x: 6, y: 3 }, bounds)).toBe(false);
    expect(isWithinBounds({ x: 3, y: 1 }, bounds)).toBe(false);
    expect(isWithinBounds({ x: 3, y: 6 }, bounds)).toBe(false);
  });

  test('screenToIso() works correctly when mouse is at center of project', () => {
    const zoom = 1;
    const rendererSize = getRendererSize({ width: 10, height: 10 }, zoom);
    const scroll = getScroll({ x: 0, y: 0 });
    const tile = screenToIso({
      mouse: {
        x: rendererSize.width / 2,
        y: rendererSize.height / 2
      },
      zoom,
      scroll,
      rendererSize
    });

    expect(tile).toEqual({ x: 0, y: -0 });
  });

  test('screenToIso() works correctly when mouse is at topLeft corner of project', () => {
    const zoom = 1;
    const rendererSize = getRendererSize({ width: 10, height: 10 }, zoom);
    const scroll = getScroll({ x: 0, y: 0 });
    const tile = screenToIso({
      mouse: {
        x: 0,
        y: 0
      },
      zoom,
      scroll,
      rendererSize
    });

    expect(tile).toEqual({ x: 0, y: 10 });
  });

  test('screenToIso() works correctly when mouse is at topLeft corner of project and zoom is 0.5', () => {
    const zoom = 0.5;
    const rendererSize = getRendererSize({ width: 10, height: 10 }, zoom);
    const scroll = getScroll({ x: 0, y: 0 });
    const tile = screenToIso({
      mouse: {
        x: 0,
        y: 0
      },
      zoom,
      scroll,
      rendererSize
    });

    expect(tile).toEqual({ x: 0, y: 10 });
  });

  test('screenToIso() works correctly when mouse is at center of project and zoom 0.5 and halfway scrolled', () => {
    const zoom = 1;
    const rendererSize = getRendererSize({ width: 10, height: 10 }, zoom);
    const scroll = getScroll({
      x: rendererSize.width / 2,
      y: rendererSize.height / 2
    });
    const tile = screenToIso({
      mouse: {
        x: rendererSize.width / 2,
        y: rendererSize.height / 2
      },
      zoom,
      scroll,
      rendererSize
    });

    expect(tile).toEqual({ x: 0, y: 10 });
  });
});

describe('incrementZoom / decrementZoom — boundary enforcement', () => {
  test('incrementZoom at MAX_ZOOM returns MAX_ZOOM (clamped)', () => {
    expect(incrementZoom(MAX_ZOOM)).toBe(MAX_ZOOM);
  });

  test('incrementZoom above MAX_ZOOM still returns MAX_ZOOM', () => {
    expect(incrementZoom(MAX_ZOOM + 0.5)).toBe(MAX_ZOOM);
  });

  test('decrementZoom at MIN_ZOOM returns MIN_ZOOM (clamped)', () => {
    expect(decrementZoom(MIN_ZOOM)).toBe(MIN_ZOOM);
  });

  test('decrementZoom below MIN_ZOOM still returns MIN_ZOOM', () => {
    expect(decrementZoom(0)).toBe(MIN_ZOOM);
    expect(decrementZoom(-1)).toBe(MIN_ZOOM);
  });

  test('incrementZoom adds ZOOM_INCREMENT from a mid-range value', () => {
    expect(incrementZoom(0.5)).toBeCloseTo(0.5 + ZOOM_INCREMENT, 5);
  });

  test('decrementZoom subtracts ZOOM_INCREMENT from a mid-range value', () => {
    expect(decrementZoom(0.5)).toBeCloseTo(0.5 - ZOOM_INCREMENT, 5);
  });

  test('result never has more than 2 decimal places (no float drift across full range)', () => {
    let zoom = MIN_ZOOM;
    while (zoom < MAX_ZOOM) {
      zoom = incrementZoom(zoom);
      const decimals = zoom.toString().includes('.')
        ? zoom.toString().split('.')[1].length
        : 0;
      expect(decimals).toBeLessThanOrEqual(2);
    }
  });
});

// ---------------------------------------------------------------------------
// getItemAtTile() — stacked rectangle selection (Bug fix: z-order hit-test)
// ---------------------------------------------------------------------------
describe('getItemAtTile() — stacked rectangle z-order', () => {
  const emptyScene = {
    items: [],
    textBoxes: [],
    connectors: [],
    hitConnectors: [],
    rectangles: []
  };

  // NB: Rectangles.tsx paints reversed-insertion then sorted by zIndex asc, so
  // the VISUAL top is (a) the highest zIndex, else (b) index 0 (the most recent
  // draw — createRectangle unshifts). The hit-test must match that, or a click
  // on an overlap grabs the rectangle underneath. These reproduce the reported
  // bug: both FAIL against the old insertion-order `.reverse().find`.

  test('honours zIndex — the higher-z rectangle (visually on top) is selected even when it is earlier in the array', () => {
    const scene = {
      ...emptyScene,
      rectangles: [
        { id: 'r-high', from: { x: 0, y: 0 }, to: { x: 5, y: 5 }, zIndex: 3 },
        { id: 'r-low', from: { x: 0, y: 0 }, to: { x: 5, y: 5 }, zIndex: 0 }
      ]
    };
    expect(
      getItemAtTile({ tile: { x: 2, y: 2 }, scene } as any)?.id
    ).toBe('r-high');
  });

  test('equal zIndex overlap — the newest rectangle (index 0, painted on top) is selected, not the older one underneath', () => {
    const scene = {
      ...emptyScene,
      rectangles: [
        { id: 'r-newest', from: { x: 0, y: 0 }, to: { x: 5, y: 5 } }, // on top
        { id: 'r-older', from: { x: 0, y: 0 }, to: { x: 5, y: 5 } }
      ]
    };
    const result = getItemAtTile({ tile: { x: 2, y: 2 }, scene } as any);
    expect(result).toEqual({ type: 'RECTANGLE', id: 'r-newest' });
  });

  test('single rectangle — hit-test still works', () => {
    const scene = {
      ...emptyScene,
      rectangles: [{ id: 'solo', from: { x: 1, y: 1 }, to: { x: 4, y: 4 } }]
    };
    expect(getItemAtTile({ tile: { x: 2, y: 2 }, scene } as any)).toEqual({
      type: 'RECTANGLE',
      id: 'solo'
    });
    expect(getItemAtTile({ tile: { x: 5, y: 5 }, scene } as any)).toBeNull();
  });

  test('tile outside all rectangles — returns null', () => {
    const scene = {
      ...emptyScene,
      rectangles: [
        { id: 'r1', from: { x: 0, y: 0 }, to: { x: 3, y: 3 } },
        { id: 'r2', from: { x: 5, y: 5 }, to: { x: 8, y: 8 } }
      ]
    };
    expect(getItemAtTile({ tile: { x: 4, y: 4 }, scene } as any)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getItemAtTile() — connector hit tolerance near node-anchored endpoints
// (shake-out 2026-06-23). A node-bound connector ends ON the node's tile; the ±1
// click-tolerance halo (B5) ballooned the connector's hit region into the ring of
// empty tiles AROUND the connected node, so a left-click just beside the node
// selected the connector (and opened its context menu) instead of clearing the
// selection. The halo is suppressed in the 8-neighbourhood of a node-anchored
// endpoint (exact match only there) but kept for the open line and for
// free-floating (tile) endpoints. The first two tests fail on the pre-fix code.
// ---------------------------------------------------------------------------
describe('getItemAtTile() — connector tolerance near node endpoints', () => {
  // connectorPathTileToGlobal(tile, origin) === origin - tile (the search offset
  // cancels), so with origin {0,0} a path tile is just the negation of its global
  // tile — build the path straight from the global tiles it should occupy.
  const pathFromGlobals = (globals: Coords[]) => ({
    tiles: globals.map((g) => ({ x: -g.x, y: -g.y })),
    rectangle: { from: { x: 0, y: 0 } }
  });

  // Node A (0,0) → Node B (5,0): a straight horizontal connector through y=0,
  // both ends anchored to a node.
  const nodeToNodeScene = {
    items: [
      { id: 'A', tile: { x: 0, y: 0 } },
      { id: 'B', tile: { x: 5, y: 0 } }
    ],
    textBoxes: [],
    connectors: [],
    rectangles: [],
    hitConnectors: [
      {
        id: 'c1',
        path: pathFromGlobals([
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
          { x: 3, y: 0 },
          { x: 4, y: 0 },
          { x: 5, y: 0 }
        ])
      }
    ]
  };

  test('empty tile beside a connected node does NOT select the connector', () => {
    // (5,1) sits directly above node B — empty, off the line. Pre-fix it fell in
    // the ±1 halo of the endpoint at (5,0) and wrongly returned the connector.
    expect(
      getItemAtTile({ tile: { x: 5, y: 1 }, scene: nodeToNodeScene } as any)
    ).toBeNull();
    // The far side of the node too (opposite the incoming line) — matches the
    // reported cursor-on-the-far-side-still-selects-connector symptom.
    expect(
      getItemAtTile({ tile: { x: 6, y: 0 }, scene: nodeToNodeScene } as any)
    ).toBeNull();
  });

  test('the node tile itself still selects the node', () => {
    expect(
      getItemAtTile({ tile: { x: 5, y: 0 }, scene: nodeToNodeScene } as any)
    ).toEqual({ type: 'ITEM', id: 'B' });
  });

  test('an exact tile on the line still selects the connector', () => {
    expect(
      getItemAtTile({ tile: { x: 2, y: 0 }, scene: nodeToNodeScene } as any)
    ).toEqual({ type: 'CONNECTOR', id: 'c1' });
  });

  test('±1 tolerance is preserved in the open middle of the line', () => {
    // (2,1) is one tile off the line, far from both nodes — still clickable.
    expect(
      getItemAtTile({ tile: { x: 2, y: 1 }, scene: nodeToNodeScene } as any)
    ).toEqual({ type: 'CONNECTOR', id: 'c1' });
  });

  test('a free-floating (tile) endpoint keeps its ±1 halo', () => {
    // Node A (0,0) → free tile (5,5) with NO node there: the loose end keeps the
    // tolerance, so a click beside it still selects the connector.
    const freeEndScene = {
      ...nodeToNodeScene,
      items: [{ id: 'A', tile: { x: 0, y: 0 } }],
      hitConnectors: [
        {
          id: 'c2',
          path: pathFromGlobals([
            { x: 0, y: 0 },
            { x: 1, y: 1 },
            { x: 2, y: 2 },
            { x: 3, y: 3 },
            { x: 4, y: 4 },
            { x: 5, y: 5 }
          ])
        }
      ]
    };
    expect(
      getItemAtTile({ tile: { x: 5, y: 6 }, scene: freeEndScene } as any)
    ).toEqual({ type: 'CONNECTOR', id: 'c2' });
  });

  // #5 (UX sweep 2026-06-30): click-SELECTION uses connectorMatch:'exact' so an
  // empty tile beside an OPEN segment (not just near node endpoints) no longer
  // grabs the connector. Hover / reconnect keep the default ±1 halo.
  describe('connectorMatch: exact (click-selection, #5)', () => {
    test('an empty tile beside the open middle does NOT select under exact', () => {
      // (2,1) is one off the open line — the default halo selects it (preserved
      // for hover/reconnect), but exact click-selection must clear instead.
      expect(
        getItemAtTile({
          tile: { x: 2, y: 1 },
          scene: nodeToNodeScene,
          connectorMatch: 'exact'
        } as any)
      ).toBeNull();
      // The default still grabs it — the halo is intact for hover/reconnect.
      expect(
        getItemAtTile({ tile: { x: 2, y: 1 }, scene: nodeToNodeScene } as any)
      ).toEqual({ type: 'CONNECTOR', id: 'c1' });
    });

    test('an exact path tile still selects the connector under exact', () => {
      expect(
        getItemAtTile({
          tile: { x: 2, y: 0 },
          scene: nodeToNodeScene,
          connectorMatch: 'exact'
        } as any)
      ).toEqual({ type: 'CONNECTOR', id: 'c1' });
    });
  });
});
