import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useUiStateStoreApi } from 'src/stores/uiStateStore';
import { PROJECTED_TILE_SIZE, UNPROJECTED_TILE_SIZE } from 'src/config';
import { SizeUtils } from 'src/utils/sizeUtils';
import { useResizeObserver } from 'src/hooks/useResizeObserver';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';

// Grid-line colour/width of the rotated grid. grid-tile-bg.svg is black @ 15%,
// 1px, but that tile is rasterised ONCE so every line looks identical. Here each
// line is stroked separately at its own sub-pixel phase, and a 1px AA line then
// ranges from one crisp pixel to two half-faint ones (measured peak alpha 10..38
// across lines → visibly uneven / "noisy" near the axis-aligned angles). A wider,
// proportionally fainter stroke keeps the peak coverage near-constant at any
// phase (a 1.5px line always fully covers at least ~0.75 of a pixel) so the grid
// reads evenly, at about the same overall ink as the unrotated grid.
const ROTATED_GRID_STROKE = 'rgba(0, 0, 0, 0.11)';
const ROTATED_GRID_LINE_WIDTH = 1.5;
// Above this many lines per axis the rotated grid is skipped (extreme zoom-out).
const MAX_ROTATED_GRID_LINES = 600;

export const Grid = () => {
  const elementRef = useRef<HTMLDivElement>(null);
  const rotatedCanvasRef = useRef<HTMLCanvasElement>(null);
  const { size } = useResizeObserver(elementRef.current);
  const storeApi = useUiStateStoreApi();
  const { strategy } = useCanvasMode();

  useEffect(() => {
    const el = elementRef.current;
    const rotatedCanvas = rotatedCanvasRef.current;
    if (!el) return;

    const isIso = strategy.projectionName === 'ISOMETRIC';
    // POC view rotation: a repeating SVG tile can't represent a rotated grid, so
    // while the ground plane is rotated the grid is drawn as projected lines on a
    // canvas instead (and the tiled background is hidden).
    const isRotated = isIso && strategy.rotation !== 0;
    el.style.display = isRotated ? 'none' : '';
    if (rotatedCanvas) rotatedCanvas.style.display = isRotated ? '' : 'none';

    const drawRotatedGrid = (
      scrollX: number,
      scrollY: number,
      zoom: number
    ) => {
      if (!rotatedCanvas) return;
      // The tiled background element is display:none while rotated (its observed
      // size collapses to 0), so size from the canvas' own box / the renderer.
      const rs = storeApi.getState().rendererSize;
      const elW = rs.width || rotatedCanvas.clientWidth;
      const elH = rs.height || rotatedCanvas.clientHeight;
      if (!elW || !elH) return;
      const dpr = window.devicePixelRatio || 1;
      const bw = Math.max(1, Math.round(elW * dpr));
      const bh = Math.max(1, Math.round(elH * dpr));
      if (rotatedCanvas.width !== bw) rotatedCanvas.width = bw;
      if (rotatedCanvas.height !== bh) rotatedCanvas.height = bh;
      const ctx = rotatedCanvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, elW, elH);

      // Screen point → fractional tile (bridge through the unprojected canvas
      // space the SceneLayer transform works in).
      const cx = elW / 2 + scrollX;
      const cy = elH / 2 + scrollY;
      const toTile = (sx: number, sy: number) =>
        strategy.fromCanvasPoint(
          (sx - cx) / zoom,
          (sy - cy) / zoom,
          UNPROJECTED_TILE_SIZE
        );
      const corners = [
        toTile(0, 0),
        toTile(elW, 0),
        toTile(0, elH),
        toTile(elW, elH)
      ];
      const minX = Math.floor(Math.min(...corners.map((c) => c.x))) - 1;
      const maxX = Math.ceil(Math.max(...corners.map((c) => c.x))) + 1;
      const minY = Math.floor(Math.min(...corners.map((c) => c.y))) - 1;
      const maxY = Math.ceil(Math.max(...corners.map((c) => c.y))) + 1;
      if (
        maxX - minX > MAX_ROTATED_GRID_LINES ||
        maxY - minY > MAX_ROTATED_GRID_LINES
      )
        return;

      const toScreenPt = (tx: number, ty: number) => {
        const p = strategy.toScreen(tx, ty, UNPROJECTED_TILE_SIZE);
        return { x: cx + p.x * zoom, y: cy + p.y * zoom };
      };

      ctx.strokeStyle = ROTATED_GRID_STROKE;
      ctx.lineWidth = ROTATED_GRID_LINE_WIDTH;
      ctx.beginPath();
      // Tile centres sit on integers, so cell boundaries are the half-integers.
      for (let i = minX; i <= maxX + 1; i++) {
        const a = toScreenPt(i - 0.5, minY - 0.5);
        const b = toScreenPt(i - 0.5, maxY + 0.5);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      for (let j = minY; j <= maxY + 1; j++) {
        const a = toScreenPt(minX - 0.5, j - 0.5);
        const b = toScreenPt(maxX + 0.5, j - 0.5);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    };

    const applyBackground = (
      scrollX: number,
      scrollY: number,
      zoom: number
    ) => {
      if (isRotated) {
        drawRotatedGrid(scrollX, scrollY, zoom);
        return;
      }
      // Use the ResizeObserver-tracked size rather than reading
      // getBoundingClientRect() here. applyBackground runs on every scroll/zoom
      // write (every pan frame), and a layout read inside that synchronous
      // notification chain forced a reflow per frame. `size` is an effect
      // dependency, so a resize re-runs this with fresh dimensions. clientWidth/
      // Height is only a fallback for the first frame before the observer has
      // reported (size is 0×0 on mount).
      const elW = size.width || el.clientWidth;
      const elH = size.height || el.clientHeight;
      if (isIso) {
        const tileSize = SizeUtils.multiply(PROJECTED_TILE_SIZE, zoom);
        el.style.backgroundSize = `${tileSize.width}px ${tileSize.height * 2}px`;
        el.style.backgroundPosition = `${elW / 2 + scrollX + tileSize.width / 2}px ${elH / 2 + scrollY}px`;
      } else {
        // 2D: square tiles at UNPROJECTED_TILE_SIZE.
        // The SVG draws grid lines at the tile's top-left corner (x=0, y=0).
        // Subtract half a tile so the tile CENTER (not its corner) aligns with
        // the world origin — otherwise nodes sit on grid intersections instead
        // of centered inside cells.
        const tilePx = UNPROJECTED_TILE_SIZE * zoom;
        el.style.backgroundSize = `${tilePx}px ${tilePx}px`;
        el.style.backgroundPosition = `${elW / 2 + scrollX - tilePx / 2}px ${elH / 2 + scrollY - tilePx / 2}px`;
      }
    };

    // Apply immediately on mount / resize
    const { scroll, zoom } = storeApi.getState();
    applyBackground(scroll.position.x, scroll.position.y, zoom);

    // Subscribe to scroll/zoom changes — bypasses React render cycle entirely
    const unsubscribe = storeApi.subscribe((state, prev) => {
      if (
        state.scroll === prev.scroll &&
        state.zoom === prev.zoom &&
        // rotated grid sizes itself from rendererSize (see drawRotatedGrid)
        !(isRotated && state.rendererSize !== prev.rendererSize)
      )
        return;
      applyBackground(
        state.scroll.position.x,
        state.scroll.position.y,
        state.zoom
      );
    });

    return unsubscribe;
  }, [storeApi, size, strategy]); // strategy (mode + rotation) change triggers re-calculation

  return (
    <Box
      sx={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none'
      }}
    >
      <Box
        ref={elementRef}
        sx={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: `repeat url("${strategy.gridTileUrl}")`
        }}
      />
      <canvas
        ref={rotatedCanvasRef}
        data-testid="axoview-rotated-grid"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          display: 'none'
        }}
      />
    </Box>
  );
};
