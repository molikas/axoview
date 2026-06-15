import React, { memo, useEffect, useRef } from 'react';
import { ViewItem, Icon } from 'src/types';
import {
  PROJECTED_TILE_SIZE,
  DEFAULT_LABEL_HEIGHT,
  DEFAULT_FONT_FAMILY,
  DEFAULT_ICON,
  TOMBSTONE_ICON
} from 'src/config';
import {
  LABEL_BASE_FONT_PX,
  LABEL_MIN_READABLE_PX,
  LABEL_MAX_COUNTER_SCALE
} from 'src/config/labelSettings';
import { computeLabelCounterScale } from 'src/utils/labelScale';
import { getItemById } from 'src/utils';
import { useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useModelStoreApi } from 'src/stores/modelStore';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { useLayerContext } from 'src/hooks/useLayerContext';
import { resolveRenderOrder, findLayer } from 'src/utils/renderOrder';

// ---------------------------------------------------------------------------
// NodesCanvas — T2 PoC. Imperative Canvas2D draw of the node layer (icon image
// + static label text), replacing the per-node React DOM subtree (~14 elements
// × N) with one <canvas> + O(visible) draw calls.
//
// DRAW-ONLY. Hit-testing/selection/drag stay in the stores + the invisible
// `canvas-interactions` box (unchanged). The hybrid keeps DOM for the
// selected/editing node's live label (readable-labels counter-scale + F2 inline
// edit) — deferred from this PoC, whose job is to measure the spawn cost of the
// canvas node-draw, not to be pixel-complete (mirrors the connector-PoC scope:
// representative case only — description richtext, notes/link badges, the label
// stalk line and expand button are deferred to the production pass).
//
// Transform model (t2-design §3): the canvas owns its transform so 1px text/
// strokes stay crisp under zoom. Each frame:
//   setTransform(zoom·dpr, 0, 0, zoom·dpr, (W/2+scroll.x)·dpr, (H/2+scroll.y)·dpr)
// mirrors the <SceneLayer> CSS (`top/left:50%` + `translate(scroll) scale(zoom)`),
// so drawing in tile-canvas coords (getTilePosition output) lands identically to
// the DOM path. Non-isometric icons in ISOMETRIC mode additionally get the fixed
// iso matrix per icon (mirrors NonIsometricIcon).
// ---------------------------------------------------------------------------

interface Props {
  nodes: ViewItem[];
}

// MUI defaults baked once (the PoC does not read the live theme): text.primary,
// grey[400] border, theme.shape.borderRadius (4) × 2, theme.spacing(1)/(1.5).
const TEXT_PRIMARY = 'rgba(0, 0, 0, 0.87)';
const CHIP_BORDER = '#bdbdbd';
const CHIP_BG = '#ffffff';
const CHIP_RADIUS = 8;
const CHIP_PAD_X = 12;
const CHIP_PAD_Y = 8;
const PROJ_W = PROJECTED_TILE_SIZE.width;
// Fixed iso projection matrix (X-orientation) — mirrors getProjectionCss / the
// NonIsometricIcon transform.
const ISO: [number, number, number, number, number, number] = [
  0.707, -0.409, 0.707, 0.409, 0, -0.816
];

const resolveIcon = (iconId: string | undefined, icons: Icon[]): Icon => {
  if (!iconId) return DEFAULT_ICON;
  return getItemById(icons, iconId)?.value ?? TOMBSTONE_ICON;
};

export const NodesCanvas = memo(({ nodes }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uiApi = useUiStateStoreApi();
  const modelApi = useModelStoreApi();
  const { getTilePosition, strategy } = useCanvasMode();
  const { layers, visibleIds } = useLayerContext();

  // Latest render inputs, read by the imperative draw (avoids re-subscribing on
  // every prop change).
  const nodesRef = useRef(nodes);
  const layersRef = useRef(layers);
  const visibleIdsRef = useRef(visibleIds);
  const getTilePositionRef = useRef(getTilePosition);
  const projectionRef = useRef(strategy.projectionName);
  nodesRef.current = nodes;
  layersRef.current = layers;
  visibleIdsRef.current = visibleIds;
  getTilePositionRef.current = getTilePosition;
  projectionRef.current = strategy.projectionName;

  // Icon-bitmap cache (the key spawn win): one decoded HTMLImageElement per icon
  // URL, drawn N times — vs N DOM <img> elements. Survives across redraws.
  const iconCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const pendingRef = useRef(false);
  // Exposed by the main effect so the prop-change effect can request a redraw.
  const scheduleDrawRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const getImage = (url: string): HTMLImageElement | null => {
      if (!url) return null;
      const cache = iconCacheRef.current;
      const existing = cache.get(url);
      if (existing) return existing.complete ? existing : null;
      const img = new Image();
      img.onload = () => scheduleDraw();
      img.src = url;
      cache.set(url, img);
      return img.complete ? img : null;
    };

    const draw = () => {
      pendingRef.current = false;
      const ui = uiApi.getState();
      const { scroll, zoom, rendererSize, readableLabels } = ui;
      const dpr = window.devicePixelRatio || 1;
      const W = rendererSize.width;
      const H = rendererSize.height;

      // Size the backing store to the renderer × dpr; CSS size stays in px.
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
      // SceneLayer-equivalent transform (zoom + scroll about the renderer center).
      ctx.setTransform(
        zoom * dpr,
        0,
        0,
        zoom * dpr,
        (W / 2 + scroll.position.x) * dpr,
        (H / 2 + scroll.position.y) * dpr
      );

      const model = modelApi.getState();
      const items = model.items;
      const icons = model.icons;
      const layersNow = layersRef.current;
      const visibleNow = visibleIdsRef.current;
      const getTilePos = getTilePositionRef.current;
      const isIso = projectionRef.current === 'ISOMETRIC';

      const counterScale = computeLabelCounterScale(zoom, {
        enabled: readableLabels,
        baseFontPx: LABEL_BASE_FONT_PX,
        minReadablePx: LABEL_MIN_READABLE_PX,
        maxCounterScale: LABEL_MAX_COUNTER_SCALE
      });

      // Painter's order: ascending resolved render order (mirrors Nodes sort).
      const visible = nodesRef.current.filter(
        (n) => visibleNow.size === 0 || visibleNow.has(n.id)
      );
      const sorted = [...visible].sort((a, b) => {
        const oa = resolveRenderOrder(
          findLayer(a.layerId, layersNow)?.order ?? 0,
          a.zIndex ?? 0,
          -a.tile.x - a.tile.y
        );
        const ob = resolveRenderOrder(
          findLayer(b.layerId, layersNow)?.order ?? 0,
          b.zIndex ?? 0,
          -b.tile.x - b.tile.y
        );
        return oa - ob;
      });

      for (const node of sorted) {
        const modelItem = getItemById(items, node.id)?.value;
        if (!modelItem) continue;
        const pos = getTilePos({ tile: node.tile, origin: 'CENTER' });

        // ----- icon -----
        const icon = resolveIcon(modelItem.icon, icons);
        const img = getImage(icon.url);
        if (img) {
          const scale = icon.scale || 1;
          ctx.save();
          ctx.translate(pos.x, pos.y);
          if (icon.isIsometric) {
            // Flat isometric sprite drawn at the tile-center origin (mirrors
            // IsometricIcon: position:absolute, no transform), width projW·0.8.
            const w = PROJ_W * 0.8 * scale;
            const h = (img.naturalHeight / img.naturalWidth) * w || w;
            ctx.drawImage(img, 0, 0, w, h);
          } else if (isIso) {
            // NonIsometricIcon ISO path: inner box at left:-projW/2, iso matrix
            // about its top-left, img width projW·0.7.
            ctx.translate(-PROJ_W / 2, 0);
            ctx.transform(ISO[0], ISO[1], ISO[2], ISO[3], ISO[4], ISO[5]);
            const w = PROJ_W * 0.7 * scale;
            const h = (img.naturalHeight / img.naturalWidth) * w || w;
            ctx.drawImage(img, 0, 0, w, h);
          } else {
            // 2D mode: flat sprite, width projW·0.7.
            const w = PROJ_W * 0.7 * scale;
            const h = (img.naturalHeight / img.naturalWidth) * w || w;
            ctx.drawImage(img, 0, 0, w, h);
          }
          ctx.restore();
        }

        // ----- static label (name) -----
        const name = modelItem.name;
        if (node.showLabel !== false && name) {
          const fontSize = node.labelFontSize || LABEL_BASE_FONT_PX;
          const labelHeight = node.labelHeight ?? DEFAULT_LABEL_HEIGHT;
          ctx.font = `600 ${fontSize}px ${DEFAULT_FONT_FAMILY}`;
          const textW = ctx.measureText(name).width;
          const chipW = textW + CHIP_PAD_X * 2;
          const lineH = fontSize * 1.5;
          const chipH = lineH + CHIP_PAD_Y * 2;

          ctx.save();
          // Chip is centered horizontally on the tile and floats `labelHeight`
          // above the tile center; counter-scale is about its bottom-center.
          ctx.translate(pos.x, pos.y - labelHeight);
          ctx.scale(counterScale, counterScale);
          const x0 = -chipW / 2;
          const y0 = -chipH;
          ctx.beginPath();
          // roundRect is available in the Chromium the app/harness targets.
          ctx.roundRect(x0, y0, chipW, chipH, CHIP_RADIUS);
          ctx.fillStyle = CHIP_BG;
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = CHIP_BORDER;
          ctx.stroke();
          ctx.fillStyle = node.labelColor || TEXT_PRIMARY;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(name, 0, y0 + chipH / 2);
          ctx.restore();
        }
      }
    };

    const scheduleDraw = () => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      requestAnimationFrame(draw);
    };
    scheduleDrawRef.current = scheduleDraw;

    // Initial draw + subscriptions (imperative, no React render on pan/zoom or
    // per-frame scene writes — all redraws are rAF-coalesced).
    scheduleDraw();
    const unsubUi = uiApi.subscribe((s, p) => {
      if (
        s.scroll === p.scroll &&
        s.zoom === p.zoom &&
        s.rendererSize === p.rendererSize &&
        s.readableLabels === p.readableLabels
      ) {
        return;
      }
      scheduleDraw();
    });
    const unsubModel = modelApi.subscribe((s, p) => {
      if (s.items === p.items && s.icons === p.icons) return;
      scheduleDraw();
    });

    return () => {
      unsubUi();
      unsubModel();
    };
  }, [uiApi, modelApi]);

  // Redraw when the visible-node set (or its derived inputs) changes — this is
  // the spawn path: a bulk model.set re-renders Renderer → new `nodes` prop →
  // one rAF-coalesced canvas redraw of O(visible) draw calls.
  useEffect(() => {
    scheduleDrawRef.current();
  }, [nodes, layers, visibleIds]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="axoview-nodes-canvas"
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
