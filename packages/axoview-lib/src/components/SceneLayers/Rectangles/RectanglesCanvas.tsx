import React, { memo, useEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import chroma from 'chroma-js';
import { Coords, Rectangle as RectangleType } from 'src/types';
import { UNPROJECTED_TILE_SIZE } from 'src/config';
import { getColorVariant } from 'src/utils';
import { useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useModelStoreApi } from 'src/stores/modelStore';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import {
  createSpriteBatch,
  SpriteBatch,
  UVRect
} from 'src/webgl/glSpriteBatch';

// ---------------------------------------------------------------------------
// RectanglesCanvas — WebGL2 INSTANCED draw of grouping-rectangle FILLS + BORDERS
// (the bulk), replacing the per-rectangle DOM/SVG <Rectangle> for everything not
// currently being DRAGGED. Picking is geometric (getItemAtTile over
// rectangles[].from/to — mapping 2026-07-08), so the bulk needs no DOM; the DOM
// <Rectangles> layer keeps only the dragged rect (its [data-drag-id] element is
// what DragItems mutates for the live move preview) + resize handles are separate
// TransformControls overlays (unaffected). Pan/zoom = one instanced draw (O(1)).
//
// Geometry: the tile rect [from..to] projects to a scene-space parallelogram —
// the same linear iso map getTilePosition uses, so fills line up with nodes and
// connectors. Corner radius (rounded rects) + dashed/dotted borders fall back to
// approximation (sharp corners / solid) for now — documented; the shipping
// grouping rects read fine, and a selected/edited rect can still show DOM chrome.
// ---------------------------------------------------------------------------

interface Props {
  // Rectangles to draw on the GPU (Renderer excludes the dragged ones).
  rectangles: RectangleType[];
}

// X-orientation iso matrix (a,b,c,d); e,f translation is sub-pixel, ignored.
const ISO_A = 0.707;
const ISO_B = -0.409;
const ISO_C = 0.707;
const ISO_D = 0.409;

const glRGB = (css: string): [number, number, number] => {
  try {
    const [r, g, b] = chroma(css).gl();
    return [r, g, b];
  } catch {
    return [0.5, 0.5, 0.5];
  }
};

export const RectanglesCanvas = memo(({ rectangles }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uiApi = useUiStateStoreApi();
  const modelApi = useModelStoreApi();
  const theme = useTheme();
  const { getTilePosition, strategy } = useCanvasMode();

  const rectsRef = useRef(rectangles);
  const getTilePosRef = useRef(getTilePosition);
  const isIsoRef = useRef(strategy.projectionName === 'ISOMETRIC');
  rectsRef.current = rectangles;
  getTilePosRef.current = getTilePosition;
  isIsoRef.current = strategy.projectionName === 'ISOMETRIC';

  const pendingRef = useRef(false);
  const rafIdRef = useRef(0);
  const destroyedRef = useRef(false);
  const geomDirtyRef = useRef(true);
  const scheduleDrawRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const batch: SpriteBatch | null = createSpriteBatch(canvas, 512);
    if (!batch) return;
    let buildCount = 0; // data-build-count — must stay flat during pan (no CPU/frame)

    const view = () => {
      const ui = uiApi.getState();
      const { scroll, zoom, rendererSize } = ui;
      const dpr = window.devicePixelRatio || 1;
      const W = rendererSize.width;
      const H = rendererSize.height;
      return {
        scroll,
        zoom,
        W,
        H,
        dpr,
        bw: Math.max(1, Math.round(W * dpr)),
        bh: Math.max(1, Math.round(H * dpr))
      };
    };

    const corners = (
      from: Coords,
      to: Coords,
      getTilePos: (a: { tile: Coords; origin?: 'LEFT' | 'CENTER' }) => Coords,
      isIso: boolean
    ): [Coords, Coords, Coords, Coords] => {
      const lowX = Math.min(from.x, to.x);
      const highX = Math.max(from.x, to.x);
      const lowY = Math.min(from.y, to.y);
      const highY = Math.max(from.y, to.y);
      const W = (highX - lowX + 1) * UNPROJECTED_TILE_SIZE;
      const H = (highY - lowY + 1) * UNPROJECTED_TILE_SIZE;
      if (isIso) {
        const p = getTilePos({ tile: { x: lowX, y: highY }, origin: 'LEFT' });
        return [
          p,
          { x: p.x + ISO_A * W, y: p.y + ISO_B * W },
          { x: p.x + ISO_A * W + ISO_C * H, y: p.y + ISO_B * W + ISO_D * H },
          { x: p.x + ISO_C * H, y: p.y + ISO_D * H }
        ];
      }
      const c = getTilePos({ tile: { x: lowX, y: highY }, origin: 'CENTER' });
      const p = {
        x: c.x - UNPROJECTED_TILE_SIZE / 2,
        y: c.y - UNPROJECTED_TILE_SIZE / 2
      };
      return [
        p,
        { x: p.x + W, y: p.y },
        { x: p.x + W, y: p.y + H },
        { x: p.x, y: p.y + H }
      ];
    };

    const buildInstances = (b: SpriteBatch) => {
      const model = modelApi.getState();
      const colorsById = new Map(model.colors.map((c) => [c.id, c.value]));
      const getTilePos = getTilePosRef.current;
      const isIso = isIsoRef.current;
      const white = b.white;
      const dot = b.dot;
      let drawn = 0;

      b.beginInstances();

      const segment = (
        p0: Coords,
        p1: Coords,
        w: number,
        r: number,
        g: number,
        bl: number,
        a: number
      ) => {
        const ax = p1.x - p0.x;
        const ay = p1.y - p0.y;
        const len = Math.hypot(ax, ay) || 1;
        const px = (-ay / len) * w;
        const py = (ax / len) * w;
        b.addSprite(
          p0.x,
          p0.y,
          -px / 2,
          -py / 2,
          ax,
          ay,
          px,
          py,
          white,
          r,
          g,
          bl,
          a,
          0
        );
      };

      for (const rect of rectsRef.current) {
        const fillValue = rect.customColor || colorsById.get(rect.color ?? '');
        if (!fillValue) continue;
        const isTransparent = fillValue === 'transparent';
        const [c0, c1, c2, c3] = corners(rect.from, rect.to, getTilePos, isIso);

        // Fill (skip for an explicit transparent choice — outline only).
        if (!isTransparent) {
          const [fr, fg, fb] = glRGB(fillValue);
          b.addSprite(
            c0.x,
            c0.y,
            0,
            0,
            c1.x - c0.x,
            c1.y - c0.y,
            c3.x - c0.x,
            c3.y - c0.y,
            white as UVRect,
            fr,
            fg,
            fb,
            rect.fillOpacity ?? 1,
            0
          );
        }

        // Border.
        const strokeColor =
          rect.borderColor ||
          (isTransparent
            ? '#9e9e9e'
            : getColorVariant(fillValue, 'dark', { grade: 2 }));
        const strokeW = rect.borderWidth ?? (isTransparent ? 2 : 1);
        const [sr, sg, sb] = glRGB(strokeColor);
        const sa = rect.borderOpacity ?? 1;
        segment(c0, c1, strokeW, sr, sg, sb, sa);
        segment(c1, c2, strokeW, sr, sg, sb, sa);
        segment(c2, c3, strokeW, sr, sg, sb, sa);
        segment(c3, c0, strokeW, sr, sg, sb, sa);
        // Round join dots so corners meet cleanly.
        const jr = strokeW / 2;
        for (const c of [c0, c1, c2, c3])
          b.addSprite(
            c.x,
            c.y,
            -jr,
            -jr,
            2 * jr,
            0,
            0,
            2 * jr,
            dot,
            sr,
            sg,
            sb,
            sa,
            0
          );

        drawn += 1;
      }

      b.commitInstances();
      canvas.dataset.drawCount = String(drawn);
      canvas.dataset.buildCount = String(++buildCount);
    };

    const drawGLBatch = (b: SpriteBatch) => {
      pendingRef.current = false;
      const v = view();
      if (geomDirtyRef.current) {
        buildInstances(b);
        geomDirtyRef.current = false;
      }
      canvas.style.width = `${v.W}px`;
      canvas.style.height = `${v.H}px`;
      const originXDev = (v.W / 2 + v.scroll.position.x) * v.dpr;
      const originYDev = (v.H / 2 + v.scroll.position.y) * v.dpr;
      b.render(v.bw, v.bh, v.zoom * v.dpr, originXDev, originYDev, 1);
    };

    const scheduleDraw = () => {
      if (pendingRef.current || destroyedRef.current) return;
      pendingRef.current = true;
      rafIdRef.current = requestAnimationFrame(() => drawGLBatch(batch));
    };
    const drawNow = () => {
      if (destroyedRef.current) return;
      pendingRef.current = false;
      cancelAnimationFrame(rafIdRef.current);
      drawGLBatch(batch);
    };
    destroyedRef.current = false;
    pendingRef.current = false;
    scheduleDrawRef.current = scheduleDraw;

    scheduleDraw();
    const unsubUi = uiApi.subscribe((s, p) => {
      if (
        s.scroll === p.scroll &&
        s.zoom === p.zoom &&
        s.rendererSize === p.rendererSize
      )
        return;
      if (s.scroll !== p.scroll || s.zoom !== p.zoom) drawNow();
      else scheduleDraw();
    });
    const unsubModel = modelApi.subscribe((s, p) => {
      if (s.colors === p.colors) return;
      geomDirtyRef.current = true;
      scheduleDraw();
    });

    return () => {
      destroyedRef.current = true;
      cancelAnimationFrame(rafIdRef.current);
      unsubUi();
      unsubModel();
      batch.destroy();
    };
  }, [uiApi, modelApi]);

  useEffect(() => {
    geomDirtyRef.current = true;
    scheduleDrawRef.current();
  }, [rectangles, getTilePosition, strategy.projectionName, theme]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="axoview-rectangles-canvas"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 0
      }}
    />
  );
});
