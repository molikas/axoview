// CanvasModeContext — provides the active coordinate transform strategy and
// pre-bound helper functions derived from the current canvasMode and view
// rotation in uiStateStore.
//
// The strategy is built at the SETTLED view rotation θ₀ (`viewRotationBase`),
// not the live one (ADR 0049 §6): while a rotation is in motion, every consumer
// keeps its θ₀ geometry and the scene is carried to the live angle by the
// motion transform (SceneLayer CSS + a SceneCanvas uniform). The context value
// therefore changes once per settle, never per frame — 29 consumers re-render
// once, not 60 times a second.
//
// Mount <CanvasModeContext.Provider> once inside the UiStateProvider tree.
// Consumers call useCanvasMode() to get mode-aware tile/screen helpers.

import React, { createContext, useContext, useMemo, useRef } from 'react';
import { useUiStateStore } from 'src/stores/uiStateStore';
import {
  CoordinateTransformStrategy,
  TileCorner,
  getStrategy,
  makeTilePositionFn,
  makeTileCornerFn,
  makeScreenToTileFn
} from 'src/utils/coordinateTransforms';
import { keepUprightFlip } from 'src/utils/viewRotation';
import type { Coords, Scroll, Size, TileOrigin } from 'src/types';

// ---------------------------------------------------------------------------
// Context value shape
// ---------------------------------------------------------------------------

export interface CanvasModeContextValue {
  /**
   * The strategy at (canvas mode, settled view rotation). Memos that depend on
   * the projection key on THIS identity, never on `projectionName` alone —
   * the angle changes the projection without changing the name (finding F6).
   */
  strategy: CoordinateTransformStrategy;

  /**
   * Mode-aware getTilePosition.
   * Drop-in replacement for isoMath.getTilePosition at component level.
   */
  getTilePosition: (args: { tile: Coords; origin?: TileOrigin }) => Coords;

  /**
   * Projected position of a TILE-SPACE corner of a tile (see makeTileCornerFn).
   * Use this — not `getTilePosition({ origin })`, whose offsets are screen-space —
   * to anchor an element whose local axes are the tile axes (matrix'd rectangles,
   * text boxes, selection frames) so it stays glued to the tile under view rotation.
   */
  getTileCorner: (args: { tile: Coords; corner: TileCorner }) => Coords;

  /**
   * Mode-aware screenToTile.
   * Drop-in replacement for isoMath.screenToIso at component level.
   */
  screenToTile: (args: {
    mouse: Coords;
    zoom: number;
    scroll: Scroll;
    rendererSize: Size;
  }) => Coords;

  /**
   * Returns the ISO projection CSS matrix string when in ISOMETRIC mode,
   * or an empty string in 2D mode (no projection transform needed).
   */
  getProjectionCss: (orientation?: 'X' | 'Y') => string;

  /**
   * Keep-upright (ADR 0050 §2): per orientation, whether FLOOR-READABLE content
   * — text boxes, flat icons — is drawn rotated 180° within its own plane at
   * the settled view angle, so it never reads upside-down. Always false in 2D
   * and at |θ| < 45°. Decided at the settled angle with hysteresis, so a flip
   * lands at settle (ADR 0049 §6) and never flickers at a boundary.
   */
  uprightFlip: { X: boolean; Y: boolean };
}

const NO_FLIP = { X: false, Y: false } as const;

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------

const CanvasModeContext = createContext<CanvasModeContextValue | null>(null);

interface ProviderProps {
  children: React.ReactNode;
}

export const CanvasModeProvider = ({ children }: ProviderProps) => {
  const canvasMode = useUiStateStore((state) => state.canvasMode);
  // θ₀, not the live angle — see the header. In 2D the strategy ignores it, so
  // a 2D canvas never re-renders for a rotation.
  const viewRotationBase = useUiStateStore((state) => state.viewRotationBase);

  // Its identity is the memo key for every consumer and the SceneCanvas rebuild,
  // so it is PINNED to (mode, θ₀) here: the strategy cache is shared with the
  // live per-frame strategies and evicts during a long orbit, and a re-render
  // that fetched a fresh object for the same θ₀ would rebuild mid-motion.
  const strategy = useMemo(
    () => getStrategy(canvasMode, viewRotationBase),
    [canvasMode, viewRotationBase]
  );

  // The flip carries HYSTERESIS, so it depends on the previous decision — kept
  // per provider (per instance), never module state. Recomputing for the same
  // strategy is idempotent (a decided state re-decides to itself).
  const flipRef = useRef<{ X: boolean; Y: boolean }>(NO_FLIP);
  const uprightFlip = useMemo(() => {
    if (strategy.projectionName !== 'ISOMETRIC' || strategy.rotation === 0) {
      flipRef.current = NO_FLIP;
      return NO_FLIP;
    }
    const prev = flipRef.current;
    const X = keepUprightFlip('X', strategy.rotation, prev.X);
    const Y = keepUprightFlip('Y', strategy.rotation, prev.Y);
    const next = X === prev.X && Y === prev.Y ? prev : { X, Y };
    flipRef.current = next;
    return next;
  }, [strategy]);

  const value = useMemo<CanvasModeContextValue>(() => {
    const getTilePosition = makeTilePositionFn(strategy);
    const getTileCorner = makeTileCornerFn(strategy);
    const screenToTile = makeScreenToTileFn(strategy);

    const getProjectionCss = (orientation?: 'X' | 'Y'): string => {
      const m = strategy.projectionMatrix(orientation);
      return m ? `matrix(${m.join(', ')})` : '';
    };

    return {
      strategy,
      getTilePosition,
      getTileCorner,
      screenToTile,
      getProjectionCss,
      uprightFlip
    };
  }, [strategy, uprightFlip]);

  return (
    <CanvasModeContext.Provider value={value}>
      {children}
    </CanvasModeContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

export const useCanvasMode = (): CanvasModeContextValue => {
  const ctx = useContext(CanvasModeContext);
  if (ctx === null) {
    throw new Error('useCanvasMode must be used within a CanvasModeProvider');
  }
  return ctx;
};
