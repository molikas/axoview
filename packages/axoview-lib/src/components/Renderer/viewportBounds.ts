// Tile-space viewport bounds for the Renderer's culling: which items are close
// enough to the screen to mount.
import { UNPROJECTED_TILE_SIZE } from 'src/config';
import {
  CoordinateTransformStrategy,
  isometricStrategy,
  makeScreenToTileFn
} from 'src/utils/coordinateTransforms';
import type { Scroll, Size } from 'src/types';

// Extra tiles of padding around the screen edges to avoid visible pop-in.
export const VIEWPORT_TILE_PADDING = 4;

export interface TileBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// Snaps a bound so float noise between view angles does not read as a viewport
// change (1/1024 tile is far below anything visible).
const snapBound = (v: number) => Math.round(v * 1024) / 1024;

/**
 * The tile-space bounds to mount for the viewport, padded.
 *
 * Isometric: a view rotation pivots about the viewport centre (ADR 0049 §7)
 * and turns the floor rigidly, so the centre tile and its distance to the
 * viewport corners do not depend on the angle. The bounds are the box around
 * that circle: they contain the viewport at EVERY angle, so turning the view
 * never changes what is mounted — no rebuild mid-motion, nothing turning in
 * blank (ADR 0049 §6). At 0° the box is within ~0.1 % of the corners' own box
 * for a 16:10 viewport, which the iso projection maps to a near-square.
 *
 * 2D: the box around the viewport corners' tiles.
 */
export const computeTileBounds = (
  scroll: Scroll,
  zoom: number,
  rendererSize: Size,
  strategy: CoordinateTransformStrategy
): TileBounds => {
  const { width, height } = rendererSize;
  if (width === 0 || height === 0 || !zoom) {
    return { minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity };
  }

  if (strategy.projectionName === 'ISOMETRIC') {
    const T = UNPROJECTED_TILE_SIZE;
    // The tile under the viewport centre (the SceneLayer origin sits there).
    const c = strategy.fromCanvasPoint(
      -scroll.position.x / zoom,
      -scroll.position.y / zoom,
      T
    );
    // Centre → corner distance, taken through the UNROTATED map: the rotation
    // is rigid in tile space, so it is the same at every angle.
    const o = isometricStrategy.fromCanvasPoint(0, 0, T);
    const hw = width / 2 / zoom;
    const hh = height / 2 / zoom;
    const r =
      Math.max(
        ...[
          [hw, hh],
          [hw, -hh]
        ].map(([x, y]) => {
          const t = isometricStrategy.fromCanvasPoint(x, y, T);
          return Math.hypot(t.x - o.x, t.y - o.y);
        })
      ) + VIEWPORT_TILE_PADDING;
    return {
      minX: snapBound(c.x - r),
      maxX: snapBound(c.x + r),
      minY: snapBound(c.y - r),
      maxY: snapBound(c.y + r)
    };
  }

  const toTile = makeScreenToTileFn(strategy);
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: 0, y: height },
    { x: width, y: height }
  ].map((mouse) => toTile({ mouse, zoom, scroll, rendererSize }));
  const xs = corners.map((t) => t.x);
  const ys = corners.map((t) => t.y);

  return {
    minX: Math.min(...xs) - VIEWPORT_TILE_PADDING,
    maxX: Math.max(...xs) + VIEWPORT_TILE_PADDING,
    minY: Math.min(...ys) - VIEWPORT_TILE_PADDING,
    maxY: Math.max(...ys) + VIEWPORT_TILE_PADDING
  };
};
