import React, { memo, useEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import { Label, Coords } from 'src/types';
import { useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { useLayerContext } from 'src/hooks/useLayerContext';
import {
  drawLabelChip,
  measureLabelChip,
  labelFontPx,
  ChipColors,
  LabelChipLayout
} from 'src/utils/labelChip';
import {
  createGLCompositor,
  GLCompositor,
  Corners
} from 'src/webgl/glCompositor';
import { rasterizeLabelChip, CHIP_SUPERSAMPLE } from 'src/webgl/itemRaster';

// ---------------------------------------------------------------------------
// LabelsCanvas (ADR 0031) — WebGL draw of the floating Label layer (this spike).
// Each chip (rounded rect + text + decorations, via the shared drawLabelChip) is
// rasterised ONCE into a content-keyed, mipmapped GL texture and re-blitted every
// frame as a textured quad — glyph pixels identical to the old Canvas2D path.
//
// Mounted ABOVE NodesCanvas in the Renderer, so a label can sit OVER a node.
// DRAW-ONLY — selection + move are the DOM LabelHitLayer's job. The transform
// mirrors the <SceneLayer> CSS exactly (see NodesCanvas). The imperative
// Canvas2D draw is kept below as an automatic FALLBACK where WebGL2 is absent.
// ---------------------------------------------------------------------------

interface Props {
  // Viewport-culled candidate labels (Renderer). This layer additionally filters
  // by layer visibility and sorts by zIndex.
  labels: Label[];
}

export const LabelsCanvas = memo(({ labels }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uiApi = useUiStateStoreApi();
  const theme = useTheme();
  const { getTilePosition } = useCanvasMode();
  const { visibleIds } = useLayerContext();

  const labelsRef = useRef(labels);
  const getTilePositionRef = useRef(getTilePosition);
  const visibleIdsRef = useRef(visibleIds);
  const chipColorsRef = useRef<ChipColors>({ bg: '', border: '', text: '' });
  labelsRef.current = labels;
  getTilePositionRef.current = getTilePosition;
  visibleIdsRef.current = visibleIds;
  chipColorsRef.current = {
    bg: theme.palette.common.white,
    border: theme.palette.grey[400],
    text: theme.palette.text.primary
  };

  const pendingRef = useRef(false);
  const rafIdRef = useRef(0);
  const destroyedRef = useRef(false);
  const scheduleDrawRef = useRef<() => void>(() => {});

  // Painter's-order sort cache (shared by both paths).
  const sortCacheRef = useRef<{
    labels: Label[] | null;
    visibleIds: ReadonlySet<string> | null;
    sorted: Label[];
  }>({ labels: null, visibleIds: null, sorted: [] });

  // Per-(text, fontSize, bold, italic) chip-layout cache.
  const layoutCacheRef = useRef<Map<string, LabelChipLayout>>(new Map());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const compositor: GLCompositor | null = createGLCompositor(canvas);
    const ctx: CanvasRenderingContext2D | null = compositor
      ? null
      : canvas.getContext('2d');
    if (!compositor && !ctx) return;

    // Throwaway 2D context for measureText in the GL path.
    const measureCtx: CanvasRenderingContext2D | null = compositor
      ? document.createElement('canvas').getContext('2d')
      : ctx;

    // Shared per-frame state (sizes, transform inputs, sorted labels).
    const frameState = () => {
      const ui = uiApi.getState();
      const { scroll, zoom, rendererSize } = ui;
      const move = ui.labelMove;
      const editingId = ui.inlineEditLabelId;
      const dpr = window.devicePixelRatio || 1;
      const W = rendererSize.width;
      const H = rendererSize.height;
      const bw = Math.max(1, Math.round(W * dpr));
      const bh = Math.max(1, Math.round(H * dpr));

      const allLabels = labelsRef.current;
      const visible = visibleIdsRef.current;
      const getTilePos = getTilePositionRef.current;
      const colors = chipColorsRef.current;

      const cache = sortCacheRef.current;
      let sorted = cache.sorted;
      if (cache.labels !== allLabels || cache.visibleIds !== visible) {
        const filtered = allLabels.filter(
          (l) => visible.size === 0 || visible.has(l.id)
        );
        sorted = [...filtered]
          .reverse()
          .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
        sortCacheRef.current = { labels: allLabels, visibleIds: visible, sorted };
      }

      return {
        scroll,
        zoom,
        W,
        H,
        bw,
        bh,
        dpr,
        move,
        editingId,
        getTilePos,
        colors,
        sorted
      };
    };

    // Per-label geometry shared by both paths: resolves the live move-preview and
    // the layout cache, returns the chip centre (cx,cy) in tile space + layout.
    const resolveLabel = (
      label: Label,
      move: { id: string; tile: Coords; offset?: Coords } | null | undefined,
      getTilePos: (a: { tile: Coords; origin: 'CENTER' }) => {
        x: number;
        y: number;
      },
      mctx: CanvasRenderingContext2D
    ) => {
      const moved = move && move.id === label.id ? move : null;
      const tile: Coords = moved ? moved.tile : label.tile;
      const offset: Coords | undefined = moved ? moved.offset : label.offset;
      const pos = getTilePos({ tile, origin: 'CENTER' });
      const cx = pos.x + (offset?.x ?? 0);
      const cy = pos.y + (offset?.y ?? 0);
      const fontSize = labelFontPx(label);
      const key = `${fontSize}:${label.isBold ? 1 : 0}:${
        label.isItalic ? 1 : 0
      }:${label.text}`;
      let layout = layoutCacheRef.current.get(key);
      if (!layout) {
        layout = measureLabelChip(
          mctx,
          label.text,
          fontSize,
          label.isBold,
          label.isItalic
        );
        const lc = layoutCacheRef.current;
        if (lc.size > 4096) lc.clear();
        lc.set(key, layout);
      }
      return { cx, cy, layout };
    };

    // ----- WebGL path -----
    const drawGL = (comp: GLCompositor) => {
      pendingRef.current = false;
      const f = frameState();
      canvas.style.width = `${f.W}px`;
      canvas.style.height = `${f.H}px`;
      comp.begin(f.bw, f.bh);

      const { scroll, zoom, W, H, dpr } = f;
      const originX = W / 2 + scroll.position.x;
      const originY = H / 2 + scroll.position.y;
      const dX = (tx: number) => (zoom * tx + originX) * dpr;
      const dY = (ty: number) => (zoom * ty + originY) * dpr;
      const cornersOf = (cx: number, cy: number, w: number, h: number): Corners => {
        const x0 = cx - w / 2;
        const y0 = cy - h / 2;
        const x1 = cx + w / 2;
        const y1 = cy + h / 2;
        return {
          tlx: dX(x0),
          tly: dY(y0),
          trx: dX(x1),
          try_: dY(y0),
          brx: dX(x1),
          bry: dY(y1),
          blx: dX(x0),
          bly: dY(y1)
        };
      };

      const ss = dpr * CHIP_SUPERSAMPLE;
      const mctx = measureCtx;
      let drawn = 0;
      if (mctx) {
        for (const label of f.sorted) {
          if (label.id === f.editingId) continue;
          const { cx, cy, layout } = resolveLabel(
            label,
            f.move,
            f.getTilePos,
            mctx
          );
          const linked = !!label.headerLink;
          const texKey = `label|${labelFontPx(label)}|${label.isBold ? 1 : 0}|${
            label.isItalic ? 1 : 0
          }|${label.isStrikethrough ? 1 : 0}|${label.isUnderline ? 1 : 0}|${
            linked ? 1 : 0
          }|${label.color || ''}|${label.backgroundColor || ''}|${
            label.backgroundOpacity ?? 1
          }|${f.colors.bg}|${f.colors.border}|${f.colors.text}|${label.text}`;
          const tex = comp.canvasTexture(texKey, 0, () =>
            rasterizeLabelChip(label, layout, f.colors, ss)
          );
          if (tex) {
            comp.drawTexturedQuad(
              tex,
              cornersOf(cx, cy, layout.chipW, layout.chipH)
            );
            drawn += 1;
          }
        }
      }
      comp.end();
      canvas.dataset.drawCount = String(drawn);
    };

    // ----- Canvas2D FALLBACK path (verbatim from the pre-WebGL implementation) -----
    const drawCanvas2D = (c2d: CanvasRenderingContext2D) => {
      pendingRef.current = false;
      const f = frameState();
      const { bw, bh, W, H, dpr, scroll, zoom } = f;
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
      }
      c2d.setTransform(1, 0, 0, 1, 0, 0);
      c2d.clearRect(0, 0, bw, bh);
      c2d.setTransform(
        zoom * dpr,
        0,
        0,
        zoom * dpr,
        (W / 2 + scroll.position.x) * dpr,
        (H / 2 + scroll.position.y) * dpr
      );

      let drawn = 0;
      for (const label of f.sorted) {
        if (label.id === f.editingId) continue;
        const { cx, cy, layout } = resolveLabel(label, f.move, f.getTilePos, c2d);
        c2d.save();
        drawLabelChip(c2d, cx, cy, label, layout, f.colors);
        c2d.restore();
        drawn += 1;
      }
      canvas.dataset.drawCount = String(drawn);
    };

    const draw = () => {
      if (compositor) drawGL(compositor);
      else if (ctx) drawCanvas2D(ctx);
    };

    const scheduleDraw = () => {
      if (pendingRef.current || destroyedRef.current) return;
      pendingRef.current = true;
      rafIdRef.current = requestAnimationFrame(draw);
    };
    const drawNow = () => {
      if (destroyedRef.current) return;
      pendingRef.current = false;
      cancelAnimationFrame(rafIdRef.current);
      draw();
    };
    destroyedRef.current = false;
    pendingRef.current = false;
    scheduleDrawRef.current = scheduleDraw;

    scheduleDraw();
    const unsubUi = uiApi.subscribe((s, p) => {
      if (
        s.scroll === p.scroll &&
        s.zoom === p.zoom &&
        s.rendererSize === p.rendererSize &&
        s.labelMove === p.labelMove &&
        s.inlineEditLabelId === p.inlineEditLabelId
      ) {
        return;
      }
      if (s.scroll !== p.scroll || s.zoom !== p.zoom) {
        drawNow();
      } else {
        scheduleDraw();
      }
    });

    return () => {
      destroyedRef.current = true;
      cancelAnimationFrame(rafIdRef.current);
      unsubUi();
      compositor?.destroy();
    };
  }, [uiApi]);

  useEffect(() => {
    scheduleDrawRef.current();
  }, [labels, visibleIds]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="axoview-labels-canvas"
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
