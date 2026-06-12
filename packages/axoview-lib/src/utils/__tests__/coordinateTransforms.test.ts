import {
  isometricStrategy,
  cartesian2DStrategy,
  makeTilePositionFn,
  makeScreenToTileFn,
  getCanvasModeSwitchScroll
} from 'src/utils/coordinateTransforms';
import { PROJECTED_TILE_SIZE, UNPROJECTED_TILE_SIZE } from 'src/config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TILE_SIZE = UNPROJECTED_TILE_SIZE; // 100
const HALF_W = PROJECTED_TILE_SIZE.width / 2;   // ~70.75
const HALF_H = PROJECTED_TILE_SIZE.height / 2;  // ~40.95

const mockRendererSize = { width: 800, height: 600 };
const mockScroll = { position: { x: 0, y: 0 }, offset: { x: 0, y: 0 } };
const zoom = 1;

// ---------------------------------------------------------------------------
// isometricStrategy.toScreen
// ---------------------------------------------------------------------------

describe('isometricStrategy.toScreen', () => {
  it('maps tile (0,0) to canvas origin (0,0)', () => {
    const { x, y } = isometricStrategy.toScreen(0, 0, TILE_SIZE);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
  });

  it('maps tile (1,0): x positive, y negative (moves top-right in ISO)', () => {
    const { x, y } = isometricStrategy.toScreen(1, 0, TILE_SIZE);
    expect(x).toBeCloseTo(HALF_W, 1);
    expect(y).toBeCloseTo(-HALF_H, 1);
  });

  it('maps tile (0,1): x negative, y negative (moves top-left in ISO)', () => {
    const { x, y } = isometricStrategy.toScreen(0, 1, TILE_SIZE);
    expect(x).toBeCloseTo(-HALF_W, 1);
    expect(y).toBeCloseTo(-HALF_H, 1);
  });

  it('maps tile (2,2) — diagonal — symmetrically', () => {
    const { x, y } = isometricStrategy.toScreen(2, 2, TILE_SIZE);
    // x = halfW*2 - halfW*2 = 0
    expect(x).toBeCloseTo(0, 1);
    // y = -(halfH*2 + halfH*2)
    expect(y).toBeCloseTo(-(HALF_H * 4), 1);
  });
});

// ---------------------------------------------------------------------------
// cartesian2DStrategy.toScreen
// ---------------------------------------------------------------------------

// 2D uses the same Y convention as ISO: positive tileY goes UP on screen
// (y_screen = -tileY * tileSize). This preserves spatial relationships
// when switching between modes — "north" in ISO stays "north" in 2D.
describe('cartesian2DStrategy.toScreen', () => {
  it('maps tile (0,0) to (0,0)', () => {
    const { x, y } = cartesian2DStrategy.toScreen(0, 0, TILE_SIZE);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });

  it('maps tile (1,0) to (tileSize, 0) — only x changes', () => {
    const { x, y } = cartesian2DStrategy.toScreen(1, 0, TILE_SIZE);
    expect(x).toBe(TILE_SIZE);
    expect(y).toBe(0);
  });

  it('maps tile (0,1) to (0, -tileSize) — positive tileY goes UP (negative screen y)', () => {
    const { x, y } = cartesian2DStrategy.toScreen(0, 1, TILE_SIZE);
    expect(x).toBe(0);
    expect(y).toBe(-TILE_SIZE);
  });

  it('maps tile (3,4) to (300, -400)', () => {
    const { x, y } = cartesian2DStrategy.toScreen(3, 4, TILE_SIZE);
    expect(x).toBe(300);
    expect(y).toBe(-400);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: toScreen → fromScreen recovers original tile (both modes)
// ---------------------------------------------------------------------------

describe('round-trip toScreen → fromScreen', () => {
  it('isometric strategy: round-trips tile (3, 5)', () => {
    const screenFn = makeScreenToTileFn(isometricStrategy);
    const screen = isometricStrategy.toScreen(3, 5, TILE_SIZE);

    // fromScreen takes a screen-space mouse position. In round-trip tests, we
    // pass the center of the renderer so that the renderer-center offset cancels.
    // To simulate: mouseX = rendererCenter.x + screen.x, etc.
    const mouseX = mockRendererSize.width / 2 + screen.x;
    const mouseY = mockRendererSize.height / 2 + screen.y;

    const tile = screenFn({
      mouse: { x: mouseX, y: mouseY },
      zoom,
      scroll: mockScroll,
      rendererSize: mockRendererSize
    });

    expect(tile.x).toBe(3);
    expect(tile.y).toBe(5);
  });

  it('cartesian 2D strategy: round-trips tile (4, 2)', () => {
    // toScreen(4,2) = {x:400, y:-200} (inverted Y), so mouseY = center.y + (-200) = 100
    const screenFn = makeScreenToTileFn(cartesian2DStrategy);
    const screen = cartesian2DStrategy.toScreen(4, 2, TILE_SIZE);

    expect(screen.x).toBe(400);
    expect(screen.y).toBe(-200); // inverted Y: tileY=2 → y=-200

    const mouseX = mockRendererSize.width / 2 + screen.x;
    const mouseY = mockRendererSize.height / 2 + screen.y;

    const tile = screenFn({
      mouse: { x: mouseX, y: mouseY },
      zoom,
      scroll: mockScroll,
      rendererSize: mockRendererSize
    });

    expect(tile.x).toBe(4);
    expect(tile.y).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// fromCanvasPoint — inverse of toScreen (both modes)
// ---------------------------------------------------------------------------

describe('fromCanvasPoint round-trips toScreen', () => {
  for (const [name, strategy] of [
    ['isometric', isometricStrategy],
    ['cartesian 2D', cartesian2DStrategy]
  ] as const) {
    it(`${name}: toScreen → fromCanvasPoint recovers the tile`, () => {
      for (const tile of [
        { x: 0, y: 0 },
        { x: 3, y: 5 },
        { x: -4, y: 2 },
        { x: 2.5, y: -1.5 } // fractional tiles must round-trip too
      ]) {
        const c = strategy.toScreen(tile.x, tile.y, TILE_SIZE);
        const back = strategy.fromCanvasPoint(c.x, c.y, TILE_SIZE);
        expect(back.x).toBeCloseTo(tile.x, 6);
        expect(back.y).toBeCloseTo(tile.y, 6);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// getCanvasModeSwitchScroll — preserve zoom + viewport center across iso↔2D
// ---------------------------------------------------------------------------

describe('getCanvasModeSwitchScroll', () => {
  // The canvas point under the viewport center is -scroll/zoom; after the
  // switch the SAME tile must land back at the center, i.e. the new scroll
  // must satisfy newScroll = -zoom · toScreen_new(centerTile).
  const expectTileStaysCentered = (
    from: typeof isometricStrategy,
    to: typeof isometricStrategy,
    zoom: number,
    scroll: { position: { x: number; y: number }; offset: { x: number; y: number } }
  ) => {
    const centerTile = from.fromCanvasPoint(
      -scroll.position.x / zoom,
      -scroll.position.y / zoom,
      TILE_SIZE
    );
    const newScroll = getCanvasModeSwitchScroll(from, to, zoom, scroll);
    const recoveredCenterTile = to.fromCanvasPoint(
      -newScroll.x / zoom,
      -newScroll.y / zoom,
      TILE_SIZE
    );
    expect(recoveredCenterTile.x).toBeCloseTo(centerTile.x, 6);
    expect(recoveredCenterTile.y).toBeCloseTo(centerTile.y, 6);
  };

  it('keeps the center tile centered: iso → 2D', () => {
    expectTileStaysCentered(isometricStrategy, cartesian2DStrategy, 0.65, {
      position: { x: -340, y: 120 },
      offset: { x: 0, y: 0 }
    });
  });

  it('keeps the center tile centered: 2D → iso', () => {
    expectTileStaysCentered(cartesian2DStrategy, isometricStrategy, 1.3, {
      position: { x: 200, y: -90 },
      offset: { x: 0, y: 0 }
    });
  });

  it('preserves zoom implicitly — scroll scales linearly with zoom for a fixed center tile', () => {
    const scroll = { position: { x: -210, y: 75 }, offset: { x: 0, y: 0 } };
    // Same center tile at two zooms ⇒ new scroll scales by the zoom ratio.
    const a = getCanvasModeSwitchScroll(isometricStrategy, cartesian2DStrategy, 1, scroll);
    const b = getCanvasModeSwitchScroll(isometricStrategy, cartesian2DStrategy, 2, {
      position: { x: scroll.position.x * 2, y: scroll.position.y * 2 },
      offset: { x: 0, y: 0 }
    });
    expect(b.x).toBeCloseTo(a.x * 2, 6);
    expect(b.y).toBeCloseTo(a.y * 2, 6);
  });

  it('is identity when from and to strategies are the same', () => {
    const scroll = { position: { x: -123, y: 456 }, offset: { x: 0, y: 0 } };
    const result = getCanvasModeSwitchScroll(
      isometricStrategy,
      isometricStrategy,
      0.8,
      scroll
    );
    expect(result.x).toBeCloseTo(scroll.position.x, 6);
    expect(result.y).toBeCloseTo(scroll.position.y, 6);
  });

  it('returns the current scroll unchanged when zoom is 0 (degenerate)', () => {
    const scroll = { position: { x: 17, y: -42 }, offset: { x: 0, y: 0 } };
    const result = getCanvasModeSwitchScroll(
      isometricStrategy,
      cartesian2DStrategy,
      0,
      scroll
    );
    expect(result).toEqual({ x: 17, y: -42 });
  });
});

// ---------------------------------------------------------------------------
// cartesian2DStrategy.fromScreen — specific known values
// ---------------------------------------------------------------------------

describe('cartesian2DStrategy.fromScreen (known pixel → expected tile)', () => {
  const screenFn = makeScreenToTileFn(cartesian2DStrategy);
  const center = { x: mockRendererSize.width / 2, y: mockRendererSize.height / 2 };

  it('center of renderer → tile (0,0)', () => {
    const tile = screenFn({
      mouse: center,
      zoom,
      scroll: mockScroll,
      rendererSize: mockRendererSize
    });
    expect(tile.x).toBe(0);
    expect(tile.y).toBe(0);
  });

  it('mouse one tile RIGHT → tileX+1; mouse one tile UP (screen y decreases) → tileY+1', () => {
    // With inverted Y: moving screen y upward (negative direction) = increasing tileY.
    const tile = screenFn({
      mouse: { x: center.x + TILE_SIZE, y: center.y - TILE_SIZE },
      zoom,
      scroll: mockScroll,
      rendererSize: mockRendererSize
    });
    expect(tile.x).toBe(1);
    expect(tile.y).toBe(1);
  });

  it('mouse one tile DOWN (screen y increases) → tileY−1', () => {
    // Moving down on screen = south = negative tileY (consistent with ISO convention).
    const tile = screenFn({
      mouse: { x: center.x, y: center.y + TILE_SIZE },
      zoom,
      scroll: mockScroll,
      rendererSize: mockRendererSize
    });
    expect(tile.x).toBe(0);
    expect(tile.y).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// isometricStrategy.fromScreen — specific known values
// ---------------------------------------------------------------------------

describe('isometricStrategy.fromScreen (known pixel → expected tile)', () => {
  const screenFn = makeScreenToTileFn(isometricStrategy);
  const center = { x: mockRendererSize.width / 2, y: mockRendererSize.height / 2 };

  it('center of renderer → tile (0,0)', () => {
    const tile = screenFn({
      mouse: center,
      zoom,
      scroll: mockScroll,
      rendererSize: mockRendererSize
    });
    expect(tile.x).toBe(0);
    expect(tile.y).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// makeTilePositionFn — origin offsets
// ---------------------------------------------------------------------------

describe('makeTilePositionFn — 2D origin offsets', () => {
  const tilePosFn = makeTilePositionFn(cartesian2DStrategy);
  const tile = { x: 0, y: 0 };
  const HALF = UNPROJECTED_TILE_SIZE / 2;

  it('CENTER: returns (0,0) for tile (0,0)', () => {
    const pos = tilePosFn({ tile });
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });

  it('TOP: y offset by -halfH', () => {
    const pos = tilePosFn({ tile, origin: 'TOP' });
    expect(pos.y).toBe(-HALF);
  });

  it('BOTTOM: y offset by +halfH', () => {
    const pos = tilePosFn({ tile, origin: 'BOTTOM' });
    expect(pos.y).toBe(HALF);
  });

  it('LEFT: x offset by -halfW', () => {
    const pos = tilePosFn({ tile, origin: 'LEFT' });
    expect(pos.x).toBe(-HALF);
  });

  it('RIGHT: x offset by +halfW', () => {
    const pos = tilePosFn({ tile, origin: 'RIGHT' });
    expect(pos.x).toBe(HALF);
  });
});

// ---------------------------------------------------------------------------
// Strategy metadata
// ---------------------------------------------------------------------------

describe('strategy metadata', () => {
  it('isometricStrategy has projectionName ISOMETRIC', () => {
    expect(isometricStrategy.projectionName).toBe('ISOMETRIC');
  });

  it('cartesian2DStrategy has projectionName 2D', () => {
    expect(cartesian2DStrategy.projectionName).toBe('2D');
  });

  it('both strategies have non-empty gridTileUrl', () => {
    expect(isometricStrategy.gridTileUrl).toBeTruthy();
    expect(cartesian2DStrategy.gridTileUrl).toBeTruthy();
  });

  // NOTE: In the test environment, SVG files are mocked to a stub string so
  // both URLs resolve to the same value. The distinction is verified at build
  // time (rslib inlines each file separately). Skip the equality check here.
  it.skip('strategies have different gridTileUrls (skipped in test env — SVGs are mocked)', () => {
    expect(isometricStrategy.gridTileUrl).not.toBe(cartesian2DStrategy.gridTileUrl);
  });
});
