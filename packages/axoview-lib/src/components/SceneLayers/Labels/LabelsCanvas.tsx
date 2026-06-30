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

// ---------------------------------------------------------------------------
// LabelsCanvas (ADR 0031) — imperative Canvas2D draw of the floating Label
// layer. This is the substrate the E-slice perf gate chose (ADR 0031 addendum /
// E3): a DOM chip layer reintroduced the scaling cliff ADR 0019 moved nodes off
// of, while every Canvas2D surface added ≈0 to spawn p95 even at N=1000.
//
// Mounted ABOVE NodesCanvas in the Renderer, so a label can sit OVER a node (the
// cross-layer z-order fix); an explicit `zIndex` orders labels within this layer.
// Billboards: drawn at a px font that scales with zoom via the canvas transform
// (no readable-labels counter-scale — labels carry their own first-class size).
//
// DRAW-ONLY — selection + move are the DOM LabelHitLayer's job (mirrors the
// NodesCanvas / NodeLabelHitLayer split). The transform mirrors the <SceneLayer>
// CSS exactly (see NodesCanvas §3) so getTilePosition output lands identically.
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
  // Chip colours from the live theme (the per-label backgroundColor / color
  // override these at draw time).
  chipColorsRef.current = {
    bg: theme.palette.common.white,
    border: theme.palette.grey[400],
    text: theme.palette.text.primary
  };

  const pendingRef = useRef(false);
  const rafIdRef = useRef(0);
  const destroyedRef = useRef(false);
  const scheduleDrawRef = useRef<() => void>(() => {});

  // Painter's-order sort cache — re-sort only when the labels array identity or
  // the visible-id set changes (a real edit / layer toggle), not per pan frame.
  const sortCacheRef = useRef<{
    labels: Label[] | null;
    visibleIds: ReadonlySet<string> | null;
    sorted: Label[];
  }>({ labels: null, visibleIds: null, sorted: [] });

  // Per-(text, fontSize, bold, italic) chip-layout cache (mirrors NodesCanvas
  // D3-2) — pan/zoom redraws reuse the measured geometry instead of re-running
  // measureText for every visible label every frame.
  const layoutCacheRef = useRef<Map<string, LabelChipLayout>>(new Map());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      pendingRef.current = false;
      const ui = uiApi.getState();
      const { scroll, zoom, rendererSize } = ui;
      const move = ui.labelMove;
      const dpr = window.devicePixelRatio || 1;
      const W = rendererSize.width;
      const H = rendererSize.height;

      const bw = Math.max(1, Math.round(W * dpr));
      const bh = Math.max(1, Math.round(H * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, bw, bh);
      // SceneLayer-equivalent transform (zoom + scroll about the renderer centre).
      ctx.setTransform(
        zoom * dpr,
        0,
        0,
        zoom * dpr,
        (W / 2 + scroll.position.x) * dpr,
        (H / 2 + scroll.position.y) * dpr
      );

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
        // Higher zIndex paints later (on top); stable sort keeps the prior order
        // for equal (default 0) zIndex — only explicit send-to-front/back moves.
        sorted = [...filtered]
          .reverse()
          .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
        sortCacheRef.current = {
          labels: allLabels,
          visibleIds: visible,
          sorted
        };
      }

      let drawn = 0;
      const layoutCache = layoutCacheRef.current;
      for (const label of sorted) {
        // Live move-preview (LabelHitLayer) overrides the model position for the
        // one dragged label, WITHOUT a per-frame model write.
        const moved = move && move.id === label.id ? move : null;
        const tile: Coords = moved ? moved.tile : label.tile;
        const offset: Coords | undefined = moved ? moved.offset : label.offset;
        const pos = getTilePos({ tile, origin: 'CENTER' });
        const cx = pos.x + (offset?.x ?? 0);
        const cy = pos.y + (offset?.y ?? 0);
        // Measure once per content/style; pan/zoom redraws reuse the layout.
        const fontSize = labelFontPx(label);
        const key = `${fontSize}:${label.isBold ? 1 : 0}:${
          label.isItalic ? 1 : 0
        }:${label.text}`;
        let layout = layoutCache.get(key);
        if (!layout) {
          layout = measureLabelChip(
            ctx,
            label.text,
            fontSize,
            label.isBold,
            label.isItalic
          );
          // Bound memory: pan/zoom adds no entries (same labels hit); only edits
          // do, so this rarely trips — clear wholesale when it does.
          if (layoutCache.size > 4096) layoutCache.clear();
          layoutCache.set(key, layout);
        }
        ctx.save();
        drawLabelChip(ctx, cx, cy, label, layout, colors);
        ctx.restore();
        drawn += 1;
      }
      // Draw-count anti-cheat (mirrors NodesCanvas): the perf harness asserts
      // drawn == N at fit-to-view, proving every committed label paints.
      canvas.dataset.drawCount = String(drawn);
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
        s.labelMove === p.labelMove
      ) {
        return;
      }
      // Pan/zoom must repaint synchronously to stay on the same frame as the DOM
      // SceneLayers (see NodesCanvas). The move-preview isn't transform-coupled,
      // so it stays rAF-coalesced.
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
    };
  }, [uiApi]);

  // Bulk model.set / label edit / layer-visibility toggle → one rAF-coalesced
  // redraw of O(visible) chips.
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
