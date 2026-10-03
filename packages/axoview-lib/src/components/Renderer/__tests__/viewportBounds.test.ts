/**
 * Viewport culling bounds under view rotation (ADR 0049 §6).
 *
 * A rotation pivots about the viewport centre, so in the isometric view the
 * culling bounds must not depend on the angle: if they did, turning the view
 * would change what is mounted and rebuild the geometry mid-motion.
 */
import {
  computeTileBounds,
  VIEWPORT_TILE_PADDING
} from 'src/components/Renderer/viewportBounds';
import {
  cartesian2DStrategy,
  getCanvasModeSwitchScroll,
  makeIsometricStrategy,
  makeScreenToTileFn
} from 'src/utils/coordinateTransforms';
import { UNPROJECTED_TILE_SIZE } from 'src/config';
import type { Scroll } from 'src/types';

const SIZE = { width: 1440, height: 900 };
const ZOOM = 0.8;
const scroll0: Scroll = {
  position: { x: 130, y: -70 },
  offset: { x: 0, y: 0 }
};

// The scroll the store lands on after rotating 0° → θ (the centre pivot).
const scrollAt = (theta: number): Scroll => ({
  ...scroll0,
  position: getCanvasModeSwitchScroll(
    makeIsometricStrategy(0),
    makeIsometricStrategy(theta),
    ZOOM,
    scroll0
  )
});

const isoBounds = (theta: number) =>
  computeTileBounds(scrollAt(theta), ZOOM, SIZE, makeIsometricStrategy(theta));

const corners = [
  { x: 0, y: 0 },
  { x: SIZE.width, y: 0 },
  { x: 0, y: SIZE.height },
  { x: SIZE.width, y: SIZE.height }
];

describe('viewport culling bounds (ADR 0049 §6)', () => {
  it('are the same at every view angle in the isometric view', () => {
    const at0 = isoBounds(0);
    for (const theta of [15, 37, 45, 90, 133, 180, -60, -179]) {
      expect(isoBounds(theta)).toEqual(at0);
    }
  });

  it('still contain every viewport corner, padded, at every angle', () => {
    for (const theta of [0, 37, 90, -120]) {
      const b = isoBounds(theta);
      const toTile = makeScreenToTileFn(makeIsometricStrategy(theta));
      for (const mouse of corners) {
        const t = toTile({
          mouse,
          zoom: ZOOM,
          scroll: scrollAt(theta),
          rendererSize: SIZE
        });
        expect(t.x).toBeGreaterThanOrEqual(
          b.minX + VIEWPORT_TILE_PADDING - 1e-6
        );
        expect(t.x).toBeLessThanOrEqual(b.maxX - VIEWPORT_TILE_PADDING + 1e-6);
        expect(t.y).toBeGreaterThanOrEqual(
          b.minY + VIEWPORT_TILE_PADDING - 1e-6
        );
        expect(t.y).toBeLessThanOrEqual(b.maxY - VIEWPORT_TILE_PADDING + 1e-6);
      }
    }
  });

  it('at 0° mount barely more than the corner box (16:10 viewport)', () => {
    // The corners' continuous (unsnapped) tiles.
    const ts = corners.map(({ x, y }) =>
      makeIsometricStrategy(0).fromCanvasPoint(
        (x - SIZE.width / 2 - scroll0.position.x) / ZOOM,
        (y - SIZE.height / 2 - scroll0.position.y) / ZOOM,
        UNPROJECTED_TILE_SIZE
      )
    );
    const boxW =
      Math.max(...ts.map((t) => t.x)) - Math.min(...ts.map((t) => t.x));
    const b = isoBounds(0);
    expect(b.maxX - b.minX - 2 * VIEWPORT_TILE_PADDING).toBeLessThan(
      boxW * 1.01
    );
  });

  it('keep the plain padded corner box in 2D', () => {
    const toTile = makeScreenToTileFn(cartesian2DStrategy);
    const b = computeTileBounds(scroll0, ZOOM, SIZE, cartesian2DStrategy);
    const ts = corners.map((mouse) =>
      toTile({ mouse, zoom: ZOOM, scroll: scroll0, rendererSize: SIZE })
    );
    expect(b.minX).toBeCloseTo(
      Math.min(...ts.map((t) => t.x)) - VIEWPORT_TILE_PADDING
    );
    expect(b.maxY).toBeCloseTo(
      Math.max(...ts.map((t) => t.y)) + VIEWPORT_TILE_PADDING
    );
  });
});
