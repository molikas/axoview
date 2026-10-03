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

import React, { createContext, useContext, useMemo } from 'react';
import { useUiStateStore } from 'src/stores/uiStateStore';
import {
  CoordinateTransformStrategy,
  TileCorner,
  getStrategy,
  makeTilePositionFn,
  makeTileCornerFn,
  makeScreenToTileFn
} from 'src/utils/coordinateTransforms';
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
}

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

  // getStrategy returns the SAME object for the same (mode, θ) — and maps every
  // θ to one strategy in 2D — so its identity is the memo key.
  const strategy = getStrategy(canvasMode, viewRotationBase);

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
      getProjectionCss
    };
  }, [strategy]);

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
