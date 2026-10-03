// Coordinate transform strategies for ISOMETRIC and 2D canvas modes.
//
// A strategy is a VALUE built from (canvas mode, view rotation θ) — ADR 0049 §2.
// Each one encapsulates:
//   toScreen         — tile (x,y) → projected canvas position (no zoom, no scroll; SceneLayer handles those)
//   fromScreen       — raw screen (x,y) → tile (x,y), accounting for zoom + scroll + renderer center
//   tilePosition     — toScreen + the screen-space origin nudges (LEFT/TOP/…)
//   tileCorner       — a TILE-SPACE corner of a tile, projected (swings with θ)
//   depth            — painter's depth of a tile (ADR 0049 §5)
//   offsetToRender   — a stored off-grid residual → SceneLayer px, M(θ)·o (ADR 0049 §4)
//   offsetFromRender — the inverse, M(−θ)·o, for every offset WRITE
//   projectionName   — discriminator for consumer logic (e.g. whether to apply CSS matrix)
//
// Nothing reads a global angle: θ is baked into the strategy, and consumers get
// the strategy from CanvasModeContext (React), the interaction State (modes) or
// a parameter (pure utilities). `makeIsometricStrategy(0)` IS the shared
// `isometricStrategy` object, so 0° output is bit-identical to the unrotated
// projection (a test pins that).
//
// Both strategies use UNPROJECTED_TILE_SIZE as the canonical tile unit so that
// scene-layer geometry (SVG polylines, etc.) is always drawn in the same coordinate space.

import { PROJECTED_TILE_SIZE, UNPROJECTED_TILE_SIZE } from 'src/config';
import type { Coords, Scroll, Size, TileOrigin } from 'src/types';
import {
  IsoMatrix,
  RotationTrig,
  applyMat2,
  isoPlaneMatrix,
  normaliseDeg,
  offsetMatrix,
  rotateTile,
  rotationTrig,
  unrotateTile
} from 'src/utils/viewRotation';

// SVG imports are inlined as data-URI strings at build time.
// TypeScript may infer them as React.FC (module.d.ts global.d.ts) — cast to string.
import gridTileSvgRaw from 'src/assets/grid-tile-bg.svg';
import gridTile2dSvgRaw from 'src/assets/grid-tile-2d.svg';
const gridTileSvg = gridTileSvgRaw as unknown as string;
const gridTile2dSvg = gridTile2dSvgRaw as unknown as string;

/** A tile-space corner, named by where it sits on screen at 0°. */
export type TileCorner = 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';

// ---------------------------------------------------------------------------
// Strategy interface
// ---------------------------------------------------------------------------

export interface CoordinateTransformStrategy {
  /**
   * Convert tile (x, y) to a canvas-space position.
   * This is the CENTER of the tile. Origin offsets are applied by `tilePosition`.
   * @param tileX  Tile X coordinate
   * @param tileY  Tile Y coordinate
   * @param tileSize  Canonical (unprojected) tile size in px
   */
  toScreen(tileX: number, tileY: number, tileSize: number): { x: number; y: number };

  /**
   * Inverse of {@link toScreen}: convert an (unscaled, scroll-less) canvas-space
   * point back to a *fractional* tile coordinate. Used to find which tile sits
   * under a given canvas point when re-projecting across a canvas-mode switch.
   * @param canvasX  Canvas-space x (same space toScreen returns)
   * @param canvasY  Canvas-space y
   * @param tileSize  Canonical (unprojected) tile size in px
   */
  fromCanvasPoint(canvasX: number, canvasY: number, tileSize: number): Coords;

  /**
   * Convert a screen-space mouse position to tile coordinates.
   * @param screenX  Mouse x relative to renderer left edge
   * @param screenY  Mouse y relative to renderer top edge
   * @param tileSize  Canonical (unprojected) tile size in px
   * @param zoom  Current zoom level (same as CSS scale on SceneLayer)
   * @param scroll  Current scroll position
   * @param rendererSize  Current renderer dimensions
   */
  fromScreen(
    screenX: number,
    screenY: number,
    tileSize: number,
    zoom: number,
    scroll: Scroll,
    rendererSize: Size
  ): Coords;

  /** Path to the SVG tile used as Grid background */
  gridTileUrl: string;

  /** Discriminator — used by useIsoProjection to decide whether to apply the ISO CSS matrix */
  projectionName: 'ISOMETRIC' | '2D';

  /**
   * The view rotation baked into this strategy, degrees in (−180, 180]. Always
   * 0 in 2D: θ is retained in uiState there but has no effect (ADR 0049 §1).
   */
  rotation: number;

  /**
   * CSS-matrix components [a, b, c, d, e, f] mapping an element's local
   * UNPROJECTED px axes onto the ground plane, or null when no projection matrix
   * applies (2D). Orientation 'X' = local u → +tile x, v → −tile y; 'Y' = local
   * u → −tile y, v → −tile x.
   */
  projectionMatrix(orientation?: 'X' | 'Y'): IsoMatrix | null;

  /**
   * The tile's projected position plus a SCREEN-space origin nudge (LEFT/TOP/…
   * are ±half the projected tile extent). Right for anything that faces the
   * screen: a sprite's base, popovers, drop ghosts (ADR 0049 §3).
   */
  tilePosition(args: { tile: Coords; origin?: TileOrigin }): Coords;

  /**
   * The projected position of a TILE-SPACE corner of a tile — the anchor of an
   * element whose local axes are the tile axes (a matrix'd rectangle / text box,
   * a selection frame, a flat icon). Swings around the centre as the plane
   * turns; identical to `tilePosition({ origin: corner })` at 0° and in 2D.
   */
  tileCorner(args: { tile: Coords; corner: TileCorner }): Coords;

  /**
   * Painter's depth of a tile: larger = nearer the viewer. `−x − y` in 2D and
   * at 0°; `−(x′ + y′)` with `(x′, y′) = R(θ)·(x, y)` otherwise (ADR 0049 §5).
   * Read through `renderOrder.ts`, which owns the tiebreak.
   */
  depth(tile: Coords): number;

  /**
   * A stored off-grid residual (the unrotated frame) → SceneLayer px:
   * `M(θ)·offset`. Returns its argument unchanged at 0° and in 2D. Only
   * `renderedGeometry.ts` calls this — it is the one composer (ADR 0049 §4).
   */
  offsetToRender(offset: Coords): Coords;

  /**
   * A SceneLayer-px residual → the stored frame: `M(−θ)·offset`. Every offset
   * WRITE goes through it (drag commit, placement residual, label drag).
   */
  offsetFromRender(offset: Coords): Coords;
}

// ---------------------------------------------------------------------------
// Helpers — origin offset applied in tilePosition
// ---------------------------------------------------------------------------

const applyOriginOffset = (
  pos: Coords,
  origin: TileOrigin | undefined,
  halfW: number,
  halfH: number
): Coords => {
  switch (origin) {
    case 'TOP':
      return { x: pos.x, y: pos.y - halfH };
    case 'BOTTOM':
      return { x: pos.x, y: pos.y + halfH };
    case 'LEFT':
      return { x: pos.x - halfW, y: pos.y };
    case 'RIGHT':
      return { x: pos.x + halfW, y: pos.y };
    case 'CENTER':
    default:
      return pos;
  }
};

// Origin-offset half extents. For ISO: halfW ≈ 70.75, halfH ≈ 40.95. For 2D:
// halfW = halfH = 50 (square tiles).
//
// Computed on call, never at module load: mode unit tests mock `src/config`
// with only the constants they need, and this module is imported (through
// `stateStrategy`) by every mode. The expressions are the historical ones, so
// 0° output is bit-identical.
const isoHalfW = () =>
  (UNPROJECTED_TILE_SIZE * (PROJECTED_TILE_SIZE.width / UNPROJECTED_TILE_SIZE)) /
  2;
const isoHalfH = () =>
  (UNPROJECTED_TILE_SIZE *
    (PROJECTED_TILE_SIZE.height / UNPROJECTED_TILE_SIZE)) /
  2;
const squareHalf = () => UNPROJECTED_TILE_SIZE / 2;

/** κ = halfW / halfH of the iso tile — the anisotropy in M(θ). */
export const isoKappa = (): number =>
  PROJECTED_TILE_SIZE.width / PROJECTED_TILE_SIZE.height;

// Tile-space offset of each corner from the tile centre. These are the tile
// corners that sit at screen LEFT/RIGHT/TOP/BOTTOM when the view is unrotated;
// under rotation they swing around with the tile.
const TILE_CORNER_OFFSETS: Record<TileCorner, Coords> = {
  LEFT: { x: -0.5, y: 0.5 },
  RIGHT: { x: 0.5, y: -0.5 },
  TOP: { x: 0.5, y: 0.5 },
  BOTTOM: { x: -0.5, y: -0.5 }
};

const identityOffset = (offset: Coords): Coords => offset;

// The unrotated iso map and its inverse, shared by the 0° strategy and the
// rotated factory so the two cannot drift.
const isoProject = (tx: number, ty: number, tileSize: number): Coords => {
  // The projected tile dimensions preserve the TILE_PROJECTION_MULTIPLIERS ratio.
  // We re-derive halfW/halfH from tileSize rather than the global constant so
  // this function is self-contained and testable with any tile size.
  const projectedWidth =
    tileSize * (PROJECTED_TILE_SIZE.width / UNPROJECTED_TILE_SIZE);
  const projectedHeight =
    tileSize * (PROJECTED_TILE_SIZE.height / UNPROJECTED_TILE_SIZE);
  const halfW = projectedWidth / 2;
  const halfH = projectedHeight / 2;
  return {
    x: halfW * tx - halfW * ty,
    y: -(halfH * tx + halfH * ty)
  };
};

const isoUnproject = (
  canvasX: number,
  canvasY: number,
  tileSize: number
): Coords => {
  const projectedWidth =
    tileSize * (PROJECTED_TILE_SIZE.width / UNPROJECTED_TILE_SIZE);
  const projectedHeight =
    tileSize * (PROJECTED_TILE_SIZE.height / UNPROJECTED_TILE_SIZE);
  const halfW = projectedWidth / 2;
  const halfH = projectedHeight / 2;
  // Invert toScreen: canvasX = halfW(tx - ty), canvasY = -halfH(tx + ty).
  const diff = canvasX / halfW; // tx - ty
  const sum = -canvasY / halfH; // tx + ty
  return { x: (diff + sum) / 2, y: (sum - diff) / 2 };
};

// ---------------------------------------------------------------------------
// Isometric strategy (θ = 0) — the shared object every 0° consumer gets
// ---------------------------------------------------------------------------

const ISO_0: RotationTrig = { cos: 1, sin: 0 };

export const isometricStrategy: CoordinateTransformStrategy = {
  projectionName: 'ISOMETRIC',
  gridTileUrl: gridTileSvg,
  rotation: 0,

  toScreen(tileX, tileY, tileSize) {
    return isoProject(tileX, tileY, tileSize);
  },

  fromCanvasPoint(canvasX, canvasY, tileSize) {
    return isoUnproject(canvasX, canvasY, tileSize);
  },

  fromScreen(screenX, screenY, tileSize, zoom, scroll, rendererSize) {
    const projectedWidth =
      tileSize * (PROJECTED_TILE_SIZE.width / UNPROJECTED_TILE_SIZE);
    const projectedHeight =
      tileSize * (PROJECTED_TILE_SIZE.height / UNPROJECTED_TILE_SIZE);
    const scaledW = projectedWidth * zoom;
    const scaledH = projectedHeight * zoom;

    const projX = -rendererSize.width * 0.5 + screenX - scroll.position.x;
    const projY = -rendererSize.height * 0.5 + screenY - scroll.position.y;

    return {
      x: Math.floor((projX + scaledW / 2) / scaledW - projY / scaledH),
      y: -Math.floor((projY + scaledH / 2) / scaledH + projX / scaledW) || 0
    };
  },

  projectionMatrix(orientation) {
    return isoPlaneMatrix(orientation, ISO_0);
  },

  tilePosition({ tile, origin }) {
    const center = isoProject(tile.x, tile.y, UNPROJECTED_TILE_SIZE);
    return applyOriginOffset(center, origin, isoHalfW(), isoHalfH());
  },

  tileCorner({ tile, corner }) {
    return isometricStrategy.tilePosition({ tile, origin: corner });
  },

  depth(tile) {
    return -tile.x - tile.y;
  },

  offsetToRender: identityOffset,
  offsetFromRender: identityOffset
};

// ---------------------------------------------------------------------------
// Isometric strategy at θ ≠ 0 — ADR 0049 §2
// ---------------------------------------------------------------------------

const buildRotatedIsometricStrategy = (
  theta: number
): CoordinateTransformStrategy => {
  const t = rotationTrig(theta);
  const kappa = isoKappa();
  const toRender = offsetMatrix(t, kappa);
  const fromRender = offsetMatrix({ cos: t.cos, sin: -t.sin }, kappa);

  const toScreen = (tileX: number, tileY: number, tileSize: number): Coords => {
    const r = rotateTile(tileX, tileY, t);
    return isoProject(r.x, r.y, tileSize);
  };
  const fromCanvasPoint = (
    canvasX: number,
    canvasY: number,
    tileSize: number
  ): Coords => {
    const r = isoUnproject(canvasX, canvasY, tileSize);
    return unrotateTile(r.x, r.y, t);
  };

  return {
    projectionName: 'ISOMETRIC',
    gridTileUrl: gridTileSvg,
    rotation: theta,

    toScreen,
    fromCanvasPoint,

    fromScreen(screenX, screenY, tileSize, zoom, scroll, rendererSize) {
      // Fractional tile under the pointer in the ROTATED frame, un-rotated back
      // into model tile space, then snapped with the same half-tile convention
      // as the 0° formula (x = floor(· + ½), y = ceil(· − ½)).
      const canvasX =
        (-rendererSize.width * 0.5 + screenX - scroll.position.x) / zoom;
      const canvasY =
        (-rendererSize.height * 0.5 + screenY - scroll.position.y) / zoom;
      const f = fromCanvasPoint(canvasX, canvasY, tileSize);
      return {
        x: Math.floor(f.x + 0.5),
        y: Math.ceil(f.y - 0.5) || 0
      };
    },

    projectionMatrix(orientation) {
      return isoPlaneMatrix(orientation, t);
    },

    tilePosition({ tile, origin }) {
      const center = toScreen(tile.x, tile.y, UNPROJECTED_TILE_SIZE);
      return applyOriginOffset(center, origin, isoHalfW(), isoHalfH());
    },

    tileCorner({ tile, corner }) {
      const off = TILE_CORNER_OFFSETS[corner];
      return toScreen(tile.x + off.x, tile.y + off.y, UNPROJECTED_TILE_SIZE);
    },

    depth(tile) {
      const r = rotateTile(tile.x, tile.y, t);
      return -r.x - r.y;
    },

    offsetToRender(offset) {
      return applyMat2(toRender, offset);
    },

    offsetFromRender(offset) {
      return applyMat2(fromRender, offset);
    }
  };
};

// Strategies are values, but memos key on their IDENTITY, so the same θ should
// hand back the same object. Bounded: a long Alt+drag visits many angles.
const ROTATED_CACHE_LIMIT = 64;
const rotatedCache = new Map<number, CoordinateTransformStrategy>();

/**
 * The isometric strategy for view rotation `theta` (degrees, any range).
 * θ = 0 returns the shared {@link isometricStrategy} itself.
 */
export const makeIsometricStrategy = (
  theta: number
): CoordinateTransformStrategy => {
  const d = normaliseDeg(theta);
  if (d === 0) return isometricStrategy;
  const hit = rotatedCache.get(d);
  if (hit) return hit;
  if (rotatedCache.size >= ROTATED_CACHE_LIMIT) rotatedCache.clear();
  const built = buildRotatedIsometricStrategy(d);
  rotatedCache.set(d, built);
  return built;
};

// ---------------------------------------------------------------------------
// Cartesian 2D strategy
// ---------------------------------------------------------------------------

const toScreen2D = (tileX: number, tileY: number, tileSize: number): Coords => ({
  // Negative Y matches the ISO convention: positive tileY goes UP on screen.
  // This keeps diagram spatial relationships identical between modes —
  // elements that were "north" in ISO stay north in 2D.
  // `+ 0` avoids the JS -0 oddity when tileY === 0.
  x: tileX * tileSize,
  y: -tileY * tileSize + 0
});

export const cartesian2DStrategy: CoordinateTransformStrategy = {
  projectionName: '2D',
  gridTileUrl: gridTile2dSvg,
  rotation: 0,

  toScreen: toScreen2D,

  fromCanvasPoint(canvasX, canvasY, tileSize) {
    // Invert toScreen: canvasX = tx * tileSize, canvasY = -ty * tileSize.
    return { x: canvasX / tileSize, y: -canvasY / tileSize || 0 };
  },

  fromScreen(screenX, screenY, tileSize, zoom, scroll, rendererSize) {
    const scaledTile = tileSize * zoom;
    const half = scaledTile / 2;
    const relX = -rendererSize.width * 0.5 + screenX - scroll.position.x;
    const relY = -rendererSize.height * 0.5 + screenY - scroll.position.y;
    return {
      // +half matches the ISO convention: tile snaps at boundaries (midpoints
      // between tile centers) rather than at the tile centers themselves.
      x: Math.floor((relX + half) / scaledTile),
      // Invert Y to match toScreen's -tileY convention, apply same +half correction.
      // `|| 0` converts -0 to 0.
      y: Math.floor((-relY + half) / scaledTile) || 0
    };
  },

  projectionMatrix() {
    return null;
  },

  tilePosition({ tile, origin }) {
    const center = toScreen2D(tile.x, tile.y, UNPROJECTED_TILE_SIZE);
    return applyOriginOffset(center, origin, squareHalf(), squareHalf());
  },

  tileCorner({ tile, corner }) {
    return cartesian2DStrategy.tilePosition({ tile, origin: corner });
  },

  depth(tile) {
    return -tile.x - tile.y;
  },

  offsetToRender: identityOffset,
  offsetFromRender: identityOffset
};

// ---------------------------------------------------------------------------
// Bound helper factories — used by CanvasModeContext
// ---------------------------------------------------------------------------

/**
 * The strategy's `tilePosition`, as the standalone function every consumer
 * calls `getTilePosition`. Matches the existing isoMath.ts getTilePosition
 * signature exactly.
 */
export const makeTilePositionFn = (strategy: CoordinateTransformStrategy) =>
  strategy.tilePosition;

/**
 * The strategy's `tileCorner` (see the interface): distinct from
 * `getTilePosition({ origin })`, whose LEFT/TOP/… offsets are SCREEN-space
 * nudges from the tile centre (ADR 0049 §3).
 */
export const makeTileCornerFn = (strategy: CoordinateTransformStrategy) =>
  strategy.tileCorner;

/**
 * Returns a screenToTile function bound to the given strategy.
 * Matches the existing isoMath.ts screenToIso calling convention.
 */
export const makeScreenToTileFn =
  (strategy: CoordinateTransformStrategy) =>
  ({
    mouse,
    zoom,
    scroll,
    rendererSize
  }: {
    mouse: Coords;
    zoom: number;
    scroll: Scroll;
    rendererSize: Size;
  }): Coords =>
    strategy.fromScreen(
      mouse.x,
      mouse.y,
      UNPROJECTED_TILE_SIZE,
      zoom,
      scroll,
      rendererSize
    );

/**
 * The transform strategy for a canvas mode at a view rotation (ADR 0049 §2).
 * θ has no effect in 2D. Omitting θ means 0° — the unrotated projection, which
 * is what the iso↔2D residual re-projection deliberately uses.
 */
export const getStrategy = (
  canvasMode: 'ISOMETRIC' | '2D',
  viewRotation = 0
): CoordinateTransformStrategy =>
  canvasMode === '2D'
    ? cartesian2DStrategy
    : makeIsometricStrategy(viewRotation);

/**
 * The strategy the INTERACTION pipeline projects with: (mode, LIVE view
 * rotation), read from the store at event time (ADR 0049 §2). React consumers
 * read the settled angle through CanvasModeContext instead — while a rotation
 * is in motion the two differ, and input must resolve against what is on
 * screen. Tolerates the partial `uiState` mocks mode unit tests construct.
 */
export const getLiveStrategy = (ui: {
  canvasMode?: 'ISOMETRIC' | '2D';
  viewRotation?: number;
}): CoordinateTransformStrategy =>
  getStrategy(ui.canvasMode ?? 'ISOMETRIC', ui.viewRotation ?? 0);

/**
 * The strategy an interaction mode should project with: the one the manager
 * injected on `State`, else the live one from the state's `uiState` (the
 * fallback keeps hand-built test States working).
 */
export const stateStrategy = (state: {
  strategy?: CoordinateTransformStrategy;
  uiState: { canvasMode?: 'ISOMETRIC' | '2D'; viewRotation?: number };
}): CoordinateTransformStrategy =>
  state.strategy ?? getLiveStrategy(state.uiState);

/**
 * The unprojected (pre-zoom, pre-scroll) canvas point under a screen-space
 * cursor — the inverse of the SceneLayer's `translate(scroll) scale(zoom)`.
 * `toScreen`/`fromCanvasPoint` operate in this space, so it is the bridge from
 * a raw mouse position to the off-grid residual (ADR 0023 resolvePlacement).
 */
export const screenToCanvasPoint = (
  screen: Coords,
  zoom: number,
  scroll: Scroll,
  rendererSize: Size
): Coords => ({
  x: (screen.x - rendererSize.width * 0.5 - scroll.position.x) / zoom,
  y: (screen.y - rendererSize.height * 0.5 - scroll.position.y) / zoom
});

/**
 * The cursor's canvas point for ADR 0023 pixel-accurate hit-testing, or
 * `undefined` when the viewport state needed to compute it isn't there. The real
 * store always populates zoom/scroll/rendererSize; the mode-action unit tests
 * construct partial `uiState` mocks, and hit-testing must not throw on those.
 * `getItemAtTile` treats an absent `point` as "use the raw integer tile", which
 * is exactly the pre-off-grid behaviour those tests assert.
 */
export const cursorCanvasPoint = (
  viewport: { zoom?: number; scroll?: Scroll; rendererSize?: Size },
  screen: Coords | undefined
): Coords | undefined => {
  if (!screen || !viewport.scroll?.position || !viewport.rendererSize) {
    return undefined;
  }
  return screenToCanvasPoint(
    screen,
    viewport.zoom || 1,
    viewport.scroll,
    viewport.rendererSize
  );
};

// ---------------------------------------------------------------------------
// Canvas-mode (iso↔2D) switch — preserve zoom + viewport center
// ---------------------------------------------------------------------------

/**
 * Compute the `scroll.position` that keeps the tile currently under the viewport
 * center centered after a projection swap, preserving the user's zoom.
 *
 * The SceneLayer renders a tile at screen `rendererCenter + scroll.position +
 * zoom · toScreen(tile)`, so the canvas point under the viewport center is
 * `-scroll.position / zoom` — independent of renderer size. We map that point
 * back to a (fractional) tile under the *old* projection, re-project it under
 * the *new* one, and choose the scroll that lands it back at the center.
 *
 * Replaces the old `fitToView()` force-fit on canvas-mode change (ADR-tracked
 * locked decision #6) which discarded the user's zoom and recentred the whole
 * diagram. The same pivot keeps the viewport centre fixed when the VIEW
 * ROTATION changes (`setViewRotation`, ADR 0049 §7): there the two strategies
 * are the iso projection at the old and the new angle.
 */
export const getCanvasModeSwitchScroll = (
  fromStrategy: CoordinateTransformStrategy,
  toStrategy: CoordinateTransformStrategy,
  zoom: number,
  scroll: Scroll,
  tileSize: number = UNPROJECTED_TILE_SIZE
): Coords => {
  // Degenerate zoom — nothing meaningful to preserve; keep the current scroll.
  if (!zoom) return { ...scroll.position };

  const centerTile = fromStrategy.fromCanvasPoint(
    -scroll.position.x / zoom,
    -scroll.position.y / zoom,
    tileSize
  );
  const newCanvas = toStrategy.toScreen(centerTile.x, centerTile.y, tileSize);

  return { x: -zoom * newCanvas.x, y: -zoom * newCanvas.y };
};

/**
 * The same off-grid residual, expressed in the NEW projection's screen plane.
 *
 * R1/PROJ-07, ruled 2026-07-30. `offset` (ADR 0023) is a POST-projection
 * SceneLayer-px residual, so it does not survive a projection change: a real
 * drag committed (58, 0) px, which is inside the ISO tile diamond (58/70.75 =
 * 0.82) but outside the 2D tile square (58 > 50). Carrying it byte-identical
 * through an iso→2D switch drew an item that had been inside its own cell
 * mostly over the NEIGHBOURING cell — where tile-based collision will happily
 * let a second item sit, because the model tile never changed.
 *
 * `toScreen_new(fromCanvasPoint_old(o))` is the ruling's formula and the same
 * map the viewport centre already uses ({@link getCanvasModeSwitchScroll}): read
 * the residual as a fractional tile under the OLD projection, then re-project it
 * under the NEW one. Both are linear, and they are an exact inverse pair, so
 * ISO→2D→ISO restores the original value and repeated toggling cannot drift.
 *
 * Callers pass the UNROTATED strategies (`getStrategy(mode)`): a stored offset
 * lives in the unrotated frame (ADR 0049 §4), so the view angle must not enter
 * this model write.
 */
export const reprojectOffset = (
  fromStrategy: CoordinateTransformStrategy,
  toStrategy: CoordinateTransformStrategy,
  offset: Coords,
  tileSize: number = UNPROJECTED_TILE_SIZE
): Coords => {
  const asTile = fromStrategy.fromCanvasPoint(offset.x, offset.y, tileSize);
  return toStrategy.toScreen(asTile.x, asTile.y, tileSize);
};
