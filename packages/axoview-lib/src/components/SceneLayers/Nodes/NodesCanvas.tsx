import React, { memo, useEffect, useLayoutEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
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
  // Nodes lifted into a DOM <Node> overlay by the hybrid (the selected node) —
  // skipped here so they aren't drawn twice. Referentially stable (empty list
  // when nothing is selected), so the redraw effect below only fires on an
  // actual selection change.
  skipNodes?: ViewItem[];
}

// Label chip geometry that the DOM path (Label.tsx) reads from the live MUI
// theme is derived from the SAME theme here (see `chipStyleRef` in the component)
// rather than hardcoded — otherwise retuning theme.shape.borderRadius / spacing
// would silently desync the canvas chip from the DOM chip (and the chip visibly
// jumps when the hybrid swaps a node between renderers on select/drag).
interface ChipStyle {
  radius: number; // theme.shape.borderRadius × 2  (sx borderRadius: 2)
  padX: number; // theme.spacing(1.5)
  padY: number; // theme.spacing(1)
  bg: string; // palette.common.white
  border: string; // palette.grey[400]
  text: string; // palette.text.primary
}
// Label chip layout — mirrors ExpandableLabel/Label: maxWidth 250 (inner = 250 −
// 2·padX), the name→description gap (Node.tsx LabelStack gap: 8), and the
// collapsed content area STANDARD_LABEL_HEIGHT (80) before truncation.
const LABEL_CHIP_MAX_W = 250;
const LABEL_STACK_GAP = 8;
const LABEL_MAX_CONTENT_H = 80;
const PROJ_W = PROJECTED_TILE_SIZE.width;
// Shared empty skip-set so an unselected scene reuses one Set instance.
const EMPTY_SKIP: Set<string> = new Set();

// theme.spacing(n) returns a px string (e.g. "9px"); the canvas needs the number.
const spacingPx = (v: string | number): number =>
  typeof v === 'number' ? v : parseFloat(v);

// Rounded-rect path with a manual fallback: ctx.roundRect is unsupported on the
// app's older supported browsers (Safari <16.4, Firefox <112 per browserslist),
// where calling it throws and would blank the whole node layer.
const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void => {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

// Description (modelItem.description is rich-text HTML) → plain text, mirroring
// Node.tsx's strip-and-trim visibility test. Returns '' when there's no visible
// text so the canvas matches the DOM's "render the description only if non-empty".
const getDescriptionText = (html: string | undefined): string => {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// Greedy word-wrap to a pixel width. `ctx.font` must already be set by the
// caller. Long single words overflow rather than breaking mid-word (acceptable —
// matches the DOM chip's word-break default closely enough for the label case).
const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(test).width > maxWidth) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
};
// Fixed iso projection matrix (X-orientation) — mirrors getProjectionCss / the
// NonIsometricIcon transform.
const ISO: [number, number, number, number, number, number] = [
  0.707, -0.409, 0.707, 0.409, 0, -0.816
];

const resolveIcon = (iconId: string | undefined, icons: Icon[]): Icon => {
  if (!iconId) return DEFAULT_ICON;
  return getItemById(icons, iconId)?.value ?? TOMBSTONE_ICON;
};

// Sprite height from the source aspect ratio; guards naturalWidth === 0 (a
// not-yet-decoded / broken image) so we never produce Infinity.
const iconHeight = (img: HTMLImageElement, w: number): number =>
  img.naturalWidth > 0 ? (img.naturalHeight / img.naturalWidth) * w : w;

export const NodesCanvas = memo(({ nodes, skipNodes }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uiApi = useUiStateStoreApi();
  const modelApi = useModelStoreApi();
  const theme = useTheme();
  const { getTilePosition, strategy } = useCanvasMode();
  const { layers, visibleIds } = useLayerContext();

  // Latest render inputs, read by the imperative draw (avoids re-subscribing on
  // every prop change).
  const nodesRef = useRef(nodes);
  const layersRef = useRef(layers);
  const visibleIdsRef = useRef(visibleIds);
  const getTilePositionRef = useRef(getTilePosition);
  const projectionRef = useRef(strategy.projectionName);
  const skipIdsRef = useRef<Set<string>>(new Set());
  // Chip geometry/colours derived from the SAME live theme the DOM Label reads,
  // so the two renderers can't drift (Label.tsx: borderRadius ×2, py spacing(1),
  // px spacing(1.5), grey[400] border, white bg, text.primary).
  const chipStyleRef = useRef<ChipStyle>({
    radius: 0,
    padX: 0,
    padY: 0,
    bg: '',
    border: '',
    text: ''
  });
  nodesRef.current = nodes;
  layersRef.current = layers;
  visibleIdsRef.current = visibleIds;
  getTilePositionRef.current = getTilePosition;
  projectionRef.current = strategy.projectionName;
  skipIdsRef.current =
    skipNodes && skipNodes.length > 0
      ? new Set(skipNodes.map((n) => n.id))
      : EMPTY_SKIP;
  chipStyleRef.current = {
    radius: (theme.shape.borderRadius as number) * 2,
    padX: spacingPx(theme.spacing(1.5)),
    padY: spacingPx(theme.spacing(1)),
    bg: theme.palette.common.white,
    border: theme.palette.grey[400],
    text: theme.palette.text.primary
  };

  // Icon-bitmap cache (the key spawn win): one decoded HTMLImageElement per icon
  // URL, drawn N times — vs N DOM <img> elements. Survives across redraws.
  const iconCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const pendingRef = useRef(false);
  const rafIdRef = useRef(0);
  const destroyedRef = useRef(false);
  // Exposed by the main effect so the prop-change effects can request a redraw
  // (rAF-coalesced) or force a synchronous one (the select/deselect path).
  const scheduleDrawRef = useRef<() => void>(() => {});
  const drawNowRef = useRef<() => void>(() => {});

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
      img.onload = () => {
        if (!destroyedRef.current) scheduleDraw();
      };
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
      // Publish the applied label counter-scale so the readable-labels gate can
      // observe it on the canvas renderer (no per-node DOM label exists in canvas
      // mode). This is the exact value fed to ctx.scale below, not a recomputation.
      canvas.dataset.labelScale = String(counterScale);

      const skipIds = skipIdsRef.current;

      // Painter's order: ascending resolved render order (mirrors Nodes sort).
      const visible = nodesRef.current.filter(
        (n) =>
          (visibleNow.size === 0 || visibleNow.has(n.id)) && !skipIds.has(n.id)
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

      let drawn = 0;
      for (const node of sorted) {
        const modelItem = getItemById(items, node.id)?.value;
        if (!modelItem) continue;
        drawn += 1;
        const pos = getTilePos({ tile: node.tile, origin: 'CENTER' });

        // ----- icon -----
        const icon = resolveIcon(modelItem.icon, icons);
        const img = getImage(icon.url);
        if (img) {
          const scale = icon.scale || 1;
          ctx.save();
          ctx.translate(pos.x, pos.y);
          if (icon.isIsometric) {
            // IsometricIcon is position:absolute with NO top/left inside a
            // flex(center,center) IconWrap, so the browser CENTRES the sprite on
            // the tile — the canvas must draw it centred too (the PoC's top-left
            // anchor offset every isometric node by ~half a sprite, breaking
            // click hit-testing / drag / lasso). Width projW·0.8.
            const w = PROJ_W * 0.8 * scale;
            const h = iconHeight(img, w);
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
          } else if (isIso) {
            // NonIsometricIcon ISO path: inner box at an EXPLICIT left:-projW/2,
            // top:0, iso matrix about its top-left — so this branch keeps the
            // top-left anchor (it mirrors that explicit offset, not flex-centring).
            ctx.translate(-PROJ_W / 2, 0);
            ctx.transform(ISO[0], ISO[1], ISO[2], ISO[3], ISO[4], ISO[5]);
            const w = PROJ_W * 0.7 * scale;
            const h = iconHeight(img, w);
            ctx.drawImage(img, 0, 0, w, h);
          } else {
            // 2D NonIsometricIcon: position:absolute, no top/left, flex-centred —
            // centre the sprite on the tile (same fix as the isometric branch).
            const w = PROJ_W * 0.7 * scale;
            const h = iconHeight(img, w);
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
          }
          ctx.restore();
        }

        // ----- static label (name + description) -----
        const name = modelItem.name;
        const descText = getDescriptionText(modelItem.description);
        if (node.showLabel !== false && (name || descText)) {
          const chip = chipStyleRef.current;
          const innerMaxW = LABEL_CHIP_MAX_W - chip.padX * 2;
          const fontSize = node.labelFontSize || LABEL_BASE_FONT_PX;
          const labelHeight = node.labelHeight ?? DEFAULT_LABEL_HEIGHT;
          const nameFont = `600 ${fontSize}px ${DEFAULT_FONT_FAMILY}`;
          // Description renders at the base body size (the RichTextEditor is not
          // affected by the node's labelFontSize), regular weight.
          const descFont = `400 ${LABEL_BASE_FONT_PX}px ${DEFAULT_FONT_FAMILY}`;
          const nameLineH = fontSize * 1.5;
          const descLineH = LABEL_BASE_FONT_PX * 1.4;

          ctx.font = nameFont;
          const nameW = name ? ctx.measureText(name).width : 0;

          // Wrap the description to the chip's inner max width, then clip to the
          // collapsed content height (the DOM truncates with a gradient at 80px;
          // the canvas simply drops the overflow lines).
          let descLines: string[] = [];
          if (descText) {
            ctx.font = descFont;
            descLines = wrapText(ctx, descText, innerMaxW);
            const budget =
              LABEL_MAX_CONTENT_H -
              (name ? nameLineH + LABEL_STACK_GAP : 0);
            const maxLines = Math.max(1, Math.floor(budget / descLineH));
            if (descLines.length > maxLines) descLines = descLines.slice(0, maxLines);
          }
          let descW = 0;
          for (const line of descLines) {
            descW = Math.max(descW, ctx.measureText(line).width);
          }

          const innerW = Math.min(innerMaxW, Math.max(nameW, descW));
          const chipW = innerW + chip.padX * 2;
          const contentH =
            (name ? nameLineH : 0) +
            (descLines.length
              ? (name ? LABEL_STACK_GAP : 0) + descLines.length * descLineH
              : 0);
          const chipH = contentH + chip.padY * 2;

          ctx.save();
          // Chip is centered horizontally on the tile and floats `labelHeight`
          // above the tile center; counter-scale is about its bottom-center.
          ctx.translate(pos.x, pos.y - labelHeight);
          ctx.scale(counterScale, counterScale);
          const x0 = -chipW / 2;
          const y0 = -chipH;
          roundRectPath(ctx, x0, y0, chipW, chipH, chip.radius);
          ctx.fillStyle = chip.bg;
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = chip.border;
          ctx.stroke();

          // Text is left-aligned inside the (tile-centered) chip, mirroring the
          // DOM LabelStack column. Name (bold) then description lines.
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          const textX = x0 + chip.padX;
          let textY = y0 + chip.padY;
          if (name) {
            ctx.font = nameFont;
            ctx.fillStyle = node.labelColor || chip.text;
            ctx.fillText(name, textX, textY + (nameLineH - fontSize) / 2);
            textY += nameLineH + (descLines.length ? LABEL_STACK_GAP : 0);
          }
          if (descLines.length) {
            ctx.font = descFont;
            ctx.fillStyle = chip.text;
            for (const line of descLines) {
              ctx.fillText(line, textX, textY + (descLineH - LABEL_BASE_FONT_PX) / 2);
              textY += descLineH;
            }
          }
          ctx.restore();
        }
      }

      // Draw-count anti-cheat (ADR 0019): the perf harness asserts drawn == N at
      // fit-to-view, proving the canvas paints every node the scene committed (no
      // accidental cull shrinking the benchmark) — the canvas-mode replacement for
      // the DOM `[data-drag-id]` shell count, which reads ~0 with the bulk DOM path
      // gone.
      canvas.dataset.drawCount = String(drawn);
    };

    const scheduleDraw = () => {
      if (pendingRef.current || destroyedRef.current) return;
      pendingRef.current = true;
      rafIdRef.current = requestAnimationFrame(draw);
    };
    // Synchronous redraw for the select/deselect path (see the useLayoutEffect
    // below): the DOM overlay mounts/unmounts synchronously, so the canvas must
    // repaint the swapped node before paint or it flickers for one frame.
    const drawNow = () => {
      if (destroyedRef.current) return;
      pendingRef.current = false;
      cancelAnimationFrame(rafIdRef.current);
      draw();
    };
    // Reset both flags on (re)mount — StrictMode double-invokes effects: the
    // first mount sets pendingRef + schedules a rAF, the cleanup cancels that rAF
    // (so draw never runs to clear pendingRef), and without this reset the second
    // mount's scheduleDraw would early-return on the stale pendingRef and the
    // canvas would never paint.
    destroyedRef.current = false;
    pendingRef.current = false;
    scheduleDrawRef.current = scheduleDraw;
    drawNowRef.current = drawNow;

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
      destroyedRef.current = true;
      cancelAnimationFrame(rafIdRef.current);
      unsubUi();
      unsubModel();
    };
  }, [uiApi, modelApi]);

  // Spawn / pan-independent redraw triggers: a bulk model.set re-renders Renderer
  // → new `nodes` prop → one rAF-coalesced canvas redraw of O(visible) draws.
  // `strategy.projectionName` is here so an ISO↔2D toggle repaints (the geometry
  // changes) instead of relying on an incidental pan to trigger it.
  useEffect(() => {
    scheduleDrawRef.current();
  }, [nodes, layers, visibleIds, strategy.projectionName]);

  // Select/deselect (skipNodes) → the lifted node moves between the canvas and
  // the DOM overlay. Redraw SYNCHRONOUSLY before paint (useLayoutEffect) so the
  // node is never absent from both surfaces for a frame.
  useLayoutEffect(() => {
    drawNowRef.current();
  }, [skipNodes]);

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
