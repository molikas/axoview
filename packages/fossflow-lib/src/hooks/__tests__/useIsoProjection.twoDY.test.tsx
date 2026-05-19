// @ts-nocheck
/**
 * Regression tests for MQA #11 — 2D-Y orientation rotation.
 *
 * Pins the css.transform that useIsoProjection emits for the three relevant
 * combinations of canvas mode + orientation. Without these, regressing to
 * "no rotation in 2D-Y" or "iso matrix in 2D" would silently re-introduce
 * the bug the user reported (vertical-orientation textbox renders as a
 * horizontal text strip in 2D mode while the dashed selection box draws a
 * vertical region — a visible mismatch).
 *
 * Strategy mocking: useCanvasMode reads from uiStateStore.canvasMode and
 * the strategy object; we mock the whole hook so the test doesn't depend on
 * provider wiring.
 */

import { renderHook } from '@testing-library/react';
import { useIsoProjection } from 'src/hooks/useIsoProjection';

// ---------------------------------------------------------------------------
// useCanvasMode mock — set per-test via setMode().
// ---------------------------------------------------------------------------

let currentMode: 'ISOMETRIC' | '2D' = 'ISOMETRIC';

jest.mock('src/contexts/CanvasModeContext', () => ({
  useCanvasMode: () => {
    // Minimal strategy stub. UNPROJECTED_TILE_SIZE is 100 in this repo;
    // toScreen for 2D returns { tileX * 100, -tileY * 100 } per
    // coordinateTransforms.ts. We replicate just enough for getTilePosition
    // to return deterministic values useIsoProjection can consume.
    const TILE = 100;
    const toScreen2D = (tileX: number, tileY: number) => ({
      x: tileX * TILE,
      y: -tileY * TILE
    });
    const toScreenIso = (tileX: number, tileY: number) => ({
      // Doesn't matter for transform assertions — only position values are
      // affected, and we assert only on transform here.
      x: tileX * TILE,
      y: -tileY * TILE
    });

    const strategy = {
      projectionName: currentMode,
      gridTileUrl: '',
      toScreen: currentMode === '2D' ? toScreen2D : toScreenIso,
      fromScreen: () => ({ x: 0, y: 0 })
    };

    return {
      strategy,
      getTilePosition: ({ tile }: { tile: { x: number; y: number } }) =>
        strategy.toScreen(tile.x, tile.y),
      screenToTile: () => ({ x: 0, y: 0 }),
      getProjectionCss: (orientation?: 'X' | 'Y') => {
        if (currentMode === '2D') return '';
        const base = [0.707, -0.409, 0.707, 0.409, 0, -0.816];
        if (orientation === 'Y') {
          return `matrix(${[base[0], -base[1], -base[2], base[3], base[4], base[5]].join(', ')})`;
        }
        return `matrix(${base.join(', ')})`;
      }
    };
  }
}));

const setMode = (mode: 'ISOMETRIC' | '2D') => {
  currentMode = mode;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const renderProjection = (orientation: 'X' | 'Y' | undefined) =>
  renderHook(() =>
    useIsoProjection({
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      orientation
    })
  ).result.current;

describe('useIsoProjection — 2D-Y rotation (MQA #11)', () => {
  describe('2D mode', () => {
    beforeEach(() => setMode('2D'));

    it('orientation X → no transform applied (text renders horizontal)', () => {
      const { css } = renderProjection('X');
      // Either undefined or absent; useIsoProjection spreads the transform
      // key only when non-empty.
      expect(css.transform).toBeUndefined();
    });

    it('orientation Y → rotate(90deg) + translateX rotation transform', () => {
      const { css } = renderProjection('Y');
      expect(css.transform).toBeDefined();
      expect(css.transform).toContain('rotate(90deg)');
      // translateX uses pxSize.height to slide the rotated content into
      // the +x region from the textbox tile origin (matching the dashed
      // selection box position).
      expect(css.transform).toMatch(/translateX\(\d+px\)/);
    });

    it('orientation Y transform order: translateX BEFORE rotate (CSS applies right-to-left)', () => {
      const { css } = renderProjection('Y');
      // CSS evaluates right-to-left: rotate executes first, then translate
      // shifts the rotated content. Verify lexical ordering.
      const idxTranslate = css.transform.indexOf('translateX');
      const idxRotate = css.transform.indexOf('rotate');
      expect(idxTranslate).toBeGreaterThanOrEqual(0);
      expect(idxRotate).toBeGreaterThan(idxTranslate);
    });

    it('orientation undefined → no transform', () => {
      const { css } = renderProjection(undefined);
      expect(css.transform).toBeUndefined();
    });

    it('transformOrigin is top-left so the rotation pivots at the textbox tile corner', () => {
      const { css } = renderProjection('Y');
      expect(css.transformOrigin).toBe('top left');
    });
  });

  describe('ISOMETRIC mode (rotation logic must not leak)', () => {
    beforeEach(() => setMode('ISOMETRIC'));

    it('orientation X → iso projection matrix (unchanged from pre-MQA #11)', () => {
      const { css } = renderProjection('X');
      expect(css.transform).toContain('matrix(');
      expect(css.transform).not.toContain('rotate(90deg)');
    });

    it('orientation Y → iso Y-variant matrix (unchanged from pre-MQA #11)', () => {
      const { css } = renderProjection('Y');
      expect(css.transform).toContain('matrix(');
      expect(css.transform).not.toContain('rotate(90deg)');
      expect(css.transform).not.toContain('translateX');
    });
  });
});
