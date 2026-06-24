import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useUiStateStoreApi } from 'src/stores/uiStateStore';
import { PROJECTED_TILE_SIZE, UNPROJECTED_TILE_SIZE } from 'src/config';
import { SizeUtils } from 'src/utils/sizeUtils';
import { useResizeObserver } from 'src/hooks/useResizeObserver';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';

export const Grid = () => {
  const elementRef = useRef<HTMLDivElement>(null);
  const { size } = useResizeObserver(elementRef.current);
  const storeApi = useUiStateStoreApi();
  const { strategy } = useCanvasMode();

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const isIso = strategy.projectionName === 'ISOMETRIC';

    const applyBackground = (
      scrollX: number,
      scrollY: number,
      zoom: number
    ) => {
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
      if (state.scroll === prev.scroll && state.zoom === prev.zoom) return;
      applyBackground(
        state.scroll.position.x,
        state.scroll.position.y,
        state.zoom
      );
    });

    return unsubscribe;
  }, [storeApi, size, strategy]); // strategy change triggers re-calculation

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
    </Box>
  );
};
