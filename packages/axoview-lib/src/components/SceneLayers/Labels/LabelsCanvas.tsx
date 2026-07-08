import React, { memo, useEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import { Label, Coords } from 'src/types';
import { useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { useLayerContext } from 'src/hooks/useLayerContext';
import {
  measureLabelChip,
  labelFontPx,
  ChipColors,
  LabelChipLayout
} from 'src/utils/labelChip';
import { createSpriteBatch, SpriteBatch } from 'src/webgl/glSpriteBatch';
import { attachContextLossRecovery } from 'src/webgl/contextLoss';
import { rasterizeLabelChip, CHIP_SUPERSAMPLE } from 'src/webgl/itemRaster';

// ---------------------------------------------------------------------------
// LabelsCanvas (ADR 0031) — WebGL2 INSTANCED draw of the floating Label layer.
// Each chip (rounded rect + text + decorations, via the shared drawLabelChip) is
// rasterised ONCE into a content-keyed atlas entry and drawn as one instanced
// quad — glyph pixels identical to the old Canvas2D path. Geometry is rebuilt
// only on a scene / move / edit change; pan & zoom just update the view uniform
// and issue one draw call (see glSpriteBatch / NodesCanvas for the model).
//
// Mounted ABOVE NodesCanvas in the Renderer, so a label can sit OVER a node.
// DRAW-ONLY — selection + move are the DOM LabelHitLayer's job. WebGL2 is the
// sole render substrate (Phase C); a browser without it is gated upstream by the
// Renderer's WebGLUnsupportedScreen and never mounts this component.
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
  const geomDirtyRef = useRef(true);
  const scheduleDrawRef = useRef<() => void>(() => {});

  // Painter's-order sort cache.
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

    let batch: SpriteBatch | null = createSpriteBatch(canvas);
    if (!batch) {
      // WebGL2 passed the gate probe but the batch failed here (shader/link or
      // context exhaustion). Surface it — the floating-label layer has no fallback.
      console.warn(
        '[LabelsCanvas] WebGL2 sprite batch unavailable — floating labels will not render'
      );
      return;
    }
    // Context-loss recovery: rebuild the batch on restore so a lost GPU context
    // doesn't blank the floating-label layer permanently.
    let contextLost = false;

    // Throwaway 2D context for measureText (the visible canvas is owned by WebGL).
    const measureCtx: CanvasRenderingContext2D | null =
      document.createElement('canvas').getContext('2d');

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
        sortCacheRef.current = {
          labels: allLabels,
          visibleIds: visible,
          sorted
        };
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

    // Per-label geometry: resolves the live move-preview and the layout cache,
    // returns the chip centre (cx,cy) in tile space + layout.
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

    // ----- WebGL instanced path -----
    let buildCount = 0; // data-build-count — must stay flat during pan (no CPU/frame)
    const buildInstances = (b: SpriteBatch) => {
      const f = frameState();
      // Clamp effective dpr at 2 for chip rasterisation (see NodesCanvas) so a
      // 3x device doesn't rasterise chips at 6x.
      const ss = Math.min(f.dpr, 2) * CHIP_SUPERSAMPLE;
      const mctx = measureCtx;
      let drawn = 0;
      if (mctx) {
        b.beginInstances();
        for (const label of f.sorted) {
          if (label.id === f.editingId) continue;
          const { cx, cy, layout } = resolveLabel(
            label,
            f.move,
            f.getTilePos,
            mctx
          );
          const linked = !!label.headerLink;
          const texKey = `label|${labelFontPx(label)}|${
            label.isBold ? 1 : 0
          }|${label.isItalic ? 1 : 0}|${label.isStrikethrough ? 1 : 0}|${
            label.isUnderline ? 1 : 0
          }|${linked ? 1 : 0}|${label.color || ''}|${
            label.backgroundColor || ''
          }|${label.backgroundOpacity ?? 1}|${f.colors.bg}|${f.colors.border}|${
            f.colors.text
          }|${label.text}`;
          const uv = b.putCanvas(texKey, 0, () =>
            rasterizeLabelChip(label, layout, f.colors, ss)
          );
          if (uv) {
            const w = layout.chipW;
            const h = layout.chipH;
            b.addSprite(cx, cy, -w / 2, -h / 2, w, 0, 0, h, uv, 1, 1, 1, 1, 0);
            drawn += 1;
          }
        }
        b.commitInstances();
      }
      canvas.dataset.drawCount = String(drawn);
      canvas.dataset.buildCount = String(++buildCount);
    };

    const drawGLBatch = (b: SpriteBatch) => {
      pendingRef.current = false;
      if (contextLost) return;
      const ui = uiApi.getState();
      const { scroll, zoom, rendererSize } = ui;
      const dpr = window.devicePixelRatio || 1;
      const W = rendererSize.width;
      const H = rendererSize.height;
      const bw = Math.max(1, Math.round(W * dpr));
      const bh = Math.max(1, Math.round(H * dpr));

      if (geomDirtyRef.current) {
        buildInstances(b);
        geomDirtyRef.current = false;
      }
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      const originXDev = (W / 2 + scroll.position.x) * dpr;
      const originYDev = (H / 2 + scroll.position.y) * dpr;
      b.render(bw, bh, zoom * dpr, originXDev, originYDev, 1);
    };

    const draw = () => {
      if (batch) drawGLBatch(batch);
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
      // A live move-preview or an edit-skip change what's drawn → rebuild;
      // scroll/zoom alone just re-render the cached instances.
      if (
        s.labelMove !== p.labelMove ||
        s.inlineEditLabelId !== p.inlineEditLabelId
      ) {
        geomDirtyRef.current = true;
      }
      if (s.scroll !== p.scroll || s.zoom !== p.zoom) {
        drawNow();
      } else {
        scheduleDraw();
      }
    });

    const detachLoss = attachContextLossRecovery(canvas, {
      onLost: () => {
        contextLost = true;
      },
      onRestored: () => {
        const rebuilt = createSpriteBatch(canvas);
        if (!rebuilt) return;
        batch = rebuilt;
        contextLost = false;
        geomDirtyRef.current = true;
        drawNow();
      }
    });

    return () => {
      destroyedRef.current = true;
      cancelAnimationFrame(rafIdRef.current);
      unsubUi();
      detachLoss();
      batch?.destroy();
    };
  }, [uiApi]);

  useEffect(() => {
    geomDirtyRef.current = true;
    scheduleDrawRef.current();
  }, [labels, visibleIds, theme]);

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
