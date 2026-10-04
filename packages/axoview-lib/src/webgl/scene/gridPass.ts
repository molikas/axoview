import { UNPROJECTED_TILE_SIZE } from 'src/config';
import type { CoordinateTransformStrategy } from 'src/utils/coordinateTransforms';
import type { GridPass } from 'src/webgl/glSpriteBatch';

// ---------------------------------------------------------------------------
// The procedural grid pass's per-frame inputs (ADR 0050 §5).
//
// Look at 0° — today's SVG tile, reproduced to the eye: black at 15 %, a line
// ≈ zoom px wide (the 2D tile's edge lines were half-clipped by the SVG
// viewport, so half that). Colour is a uniform, ready for a dark theme.
// ---------------------------------------------------------------------------

export const GRID_COLOR: GridPass['color'] = [0, 0, 0, 0.15];
const GRID_LINE_PX = { ISOMETRIC: 1, '2D': 0.5 } as const;

/**
 * The grid pass at a view: the INVERSE of the strategy's tile→scene map, so
 * the shader can take any pixel back to tile space. Built from the LIVE
 * strategy every frame, the grid turns with the floor during a rotation
 * without a rebuild — pan, zoom and rotation are all uniforms.
 */
export const gridPassFor = (
  strategy: Pick<CoordinateTransformStrategy, 'toScreen' | 'projectionName'>,
  zoomDpr: number
): GridPass => {
  // The map is linear with tile (0,0) at the scene origin, so its columns are
  // the images of the unit tile steps.
  const e1 = strategy.toScreen(1, 0, UNPROJECTED_TILE_SIZE);
  const e2 = strategy.toScreen(0, 1, UNPROJECTED_TILE_SIZE);
  const det = e1.x * e2.y - e2.x * e1.y || 1;
  return {
    sceneToTile: [e2.y / det, -e2.x / det, -e1.y / det, e1.x / det],
    color: GRID_COLOR,
    lineWidth: GRID_LINE_PX[strategy.projectionName] * zoomDpr
  };
};
