// CanvasModeContext — provides the active coordinate transform strategy and
// pre-bound helper functions derived from the current canvasMode in uiStateStore.
//
// Mount <CanvasModeContext.Provider> once inside the UiStateProvider tree.
// Consumers call useCanvasMode() to get mode-aware tile/screen helpers.

import React, { createContext, useContext, useMemo } from 'react';
import { useUiStateStore } from 'src/stores/uiStateStore';
import {
  CoordinateTransformStrategy,
  isometricStrategy,
  cartesian2DStrategy,
  makeTilePositionFn,
  makeTileCornerFn,
  makeScreenToTileFn
} from 'src/utils/coordinateTransforms';
import type { Coords, Scroll, Size, TileOrigin } from 'src/types';

// ---------------------------------------------------------------------------
// Context value shape
// ---------------------------------------------------------------------------

export interface CanvasModeContextValue {
  /** The raw strategy object — carry if you need gridTileUrl or projectionName */
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
  getTileCorner: (args: {
    tile: Coords;
    corner: 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';
  }) => Coords;

  /** POC horizontal view rotation (degrees). A dep for layers that rebuild on it. */
  viewRotation: number;

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
  // POC view rotation: a new angle mints a new context value (→ new
  // getTilePosition identity), which is what makes every projection-dependent
  // layer (WebGL bulk rebuilds, DOM overlays, culling) recompute.
  const viewRotation = useUiStateStore((state) => state.viewRotation);

  const value = useMemo<CanvasModeContextValue>(() => {
    const strategy =
      canvasMode === '2D' ? cartesian2DStrategy : isometricStrategy;

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
      viewRotation,
      screenToTile,
      getProjectionCss
    };
  }, [canvasMode, viewRotation]);

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
