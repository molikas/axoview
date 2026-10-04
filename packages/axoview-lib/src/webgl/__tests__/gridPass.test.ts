/**
 * The procedural grid pass (ADR 0050 §5). Its shader takes every pixel back to
 * tile space through `sceneToTile`; if that is not the exact inverse of the
 * projection, the grid drifts off the content it frames at some angle. CI is
 * pixel-blind, so the inverse itself is what can be pinned here.
 */
import { gridPassFor, GRID_COLOR } from 'src/webgl/scene/gridPass';
import { getStrategy } from 'src/utils/coordinateTransforms';
import { UNPROJECTED_TILE_SIZE } from 'src/config';

const apply = (m: readonly number[], v: { x: number; y: number }) => ({
  x: m[0] * v.x + m[1] * v.y,
  y: m[2] * v.x + m[3] * v.y
});

describe('gridPassFor', () => {
  it.each([0, 15, 37, 90, 137, 180, -60])(
    'its inverse view round-trips with toScreen at %i° (iso)',
    (deg) => {
      const s = getStrategy('ISOMETRIC', deg);
      const { sceneToTile } = gridPassFor(s, 1);
      for (const tile of [
        { x: 0, y: 0 },
        { x: 3.5, y: -2 },
        { x: -7, y: 11.25 }
      ]) {
        const scene = s.toScreen(tile.x, tile.y, UNPROJECTED_TILE_SIZE);
        const back = apply(sceneToTile, scene);
        expect(back.x).toBeCloseTo(tile.x, 9);
        expect(back.y).toBeCloseTo(tile.y, 9);
      }
    }
  );

  it('round-trips in 2D, where θ is inert', () => {
    const s = getStrategy('2D', 120);
    const { sceneToTile } = gridPassFor(s, 1);
    const scene = s.toScreen(4, -3, UNPROJECTED_TILE_SIZE);
    const back = apply(sceneToTile, scene);
    expect(back.x).toBeCloseTo(4, 9);
    expect(back.y).toBeCloseTo(-3, 9);
  });

  it('reproduces the SVG tile look at 0°: black 15 %, ≈ zoom px lines', () => {
    expect(GRID_COLOR).toEqual([0, 0, 0, 0.15]);
    expect(gridPassFor(getStrategy('ISOMETRIC'), 2).lineWidth).toBe(2);
    // The 2D SVG drew its lines on the clipped tile edge — half as wide.
    expect(gridPassFor(getStrategy('2D'), 2).lineWidth).toBe(1);
  });
});
