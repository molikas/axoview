import {
  resolvePlacement,
  cursorTileResidual,
  connectorEndpointVertexDelta
} from '../resolvePlacement';
import { itemCollides } from '../spatialIndex';

const TILE = { x: 3, y: -2 };
const OFFSET = { x: 7.5, y: -4.25 };

describe('resolvePlacement (ADR 0023)', () => {
  it('snaps (clears offset) when global on and item snapped', () => {
    expect(resolvePlacement(TILE, OFFSET, true, true)).toEqual({ tile: TILE });
    // snap omitted defaults to true
    expect(resolvePlacement(TILE, OFFSET, undefined, true)).toEqual({
      tile: TILE
    });
  });

  it('keeps the px offset when the item is explicitly unsnapped (#20)', () => {
    expect(resolvePlacement(TILE, OFFSET, false, true)).toEqual({
      tile: TILE,
      offset: OFFSET
    });
  });

  it('keeps the px offset when global snap is off (#12)', () => {
    // Even a "snapped" (default) item goes off-grid when the global toggle is off.
    expect(resolvePlacement(TILE, OFFSET, true, false)).toEqual({
      tile: TILE,
      offset: OFFSET
    });
    expect(resolvePlacement(TILE, OFFSET, false, false)).toEqual({
      tile: TILE,
      offset: OFFSET
    });
  });

  it('collapses an absent / zero residual to a clean snapped placement', () => {
    expect(resolvePlacement(TILE, undefined, false, true)).toEqual({
      tile: TILE
    });
    expect(resolvePlacement(TILE, { x: 0, y: 0 }, false, false)).toEqual({
      tile: TILE
    });
  });

  it('always preserves the integer tile (the load-bearing invariant)', () => {
    for (const snap of [true, false, undefined]) {
      for (const global of [true, false]) {
        const { tile } = resolvePlacement(TILE, OFFSET, snap, global);
        expect(tile).toEqual(TILE);
        expect(Number.isInteger(tile.x) && Number.isInteger(tile.y)).toBe(true);
      }
    }
  });
});

describe('itemCollides (ADR 0023 §4)', () => {
  it('defaults to colliding (both fields absent)', () => {
    expect(itemCollides({})).toBe(true);
  });

  it('an unsnapped item implies no collision', () => {
    expect(itemCollides({ snap: false })).toBe(false);
  });

  it('explicit collides overrides the implied value', () => {
    expect(itemCollides({ snap: false, collides: true })).toBe(true);
    expect(itemCollides({ collides: false })).toBe(false);
    expect(itemCollides({ snap: true, collides: false })).toBe(false);
  });
});

describe('cursorTileResidual', () => {
  // 2D keeps the math simple: toScreen({x,y}) = {x*100, -y*100}, and the canvas
  // point is (screen - rendererCentre - scroll)/zoom.
  const scroll = { position: { x: 0, y: 0 }, offset: { x: 0, y: 0 } };
  const rendererSize = { width: 200, height: 200 };

  it('is zero when the cursor sits exactly on the tile centre', () => {
    // Tile {0,0} centre projects to {0,0}; the renderer centre is at screen 100,100.
    const r = cursorTileResidual(
      '2D',
      { x: 100, y: 100 },
      { x: 0, y: 0 },
      1,
      scroll,
      rendererSize
    );
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(0);
  });

  it('is the sub-tile px delta of the cursor from the tile centre', () => {
    const r = cursorTileResidual(
      '2D',
      { x: 130, y: 100 },
      { x: 0, y: 0 },
      1,
      scroll,
      rendererSize
    );
    expect(r.x).toBeCloseTo(30);
    expect(r.y).toBeCloseTo(0);
  });

  it('divides the screen delta by zoom (offset is SceneLayer px)', () => {
    const r = cursorTileResidual(
      '2D',
      { x: 120, y: 100 },
      { x: 0, y: 0 },
      2,
      scroll,
      rendererSize
    );
    // (120 - 100)/2 = 10 SceneLayer px.
    expect(r.x).toBeCloseTo(10);
  });
});

describe('connectorEndpointVertexDelta', () => {
  it('inverts the connector projection so the endpoint follows the offset (2D)', () => {
    expect(connectorEndpointVertexDelta('2D', { x: 10, y: 0 })).toEqual({
      x: -10,
      y: 0
    });
    expect(connectorEndpointVertexDelta('2D', { x: 0, y: 10 })).toEqual({
      x: 0,
      y: 10
    });
  });

  it('is mode-aware (iso uses the strategy projection, no magic constants)', () => {
    // A symmetric down-screen offset maps to equal x/y vertex shift in iso.
    const d = connectorEndpointVertexDelta('ISOMETRIC', { x: 0, y: 10 });
    expect(d.x).toBeCloseTo(d.y);
    expect(d.x).toBeGreaterThan(0);
  });
});
