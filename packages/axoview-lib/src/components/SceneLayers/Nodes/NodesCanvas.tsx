import React, { memo, useEffect, useLayoutEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import { ViewItem, Icon, Layer, ModelItem } from 'src/types';
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
import { useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useModelStoreApi } from 'src/stores/modelStore';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { useLayerContext } from 'src/hooks/useLayerContext';
import { resolveRenderOrder } from 'src/utils/renderOrder';
import { decodeHtmlEntities } from 'src/utils/htmlToPlainText';
import { isLabelVisibleInPreview } from 'src/utils/previewLabelVisibility';
import { LABEL_LINK_COLOR } from 'src/utils/labelChip';
import {
  createGLCompositor,
  GLCompositor,
  Corners
} from 'src/webgl/glCompositor';
import {
  rasterizeNodeChip,
  makeDotCanvas,
  CHIP_SUPERSAMPLE
} from 'src/webgl/itemRaster';

// ---------------------------------------------------------------------------
// NodesCanvas — WebGL bulk draw of the node layer (icon sprite + name-chip +
// stalk), replacing the per-node React DOM subtree (~14 elements × N) with one
// GPU-composited <canvas> + O(visible) textured quads.
//
// WebGL SPIKE (this file): the icon is a textured quad straight from the cached
// HTMLImageElement; the name-chip (rounded rect + text + underline/strike) is
// rasterised ONCE by Canvas2D into a content-keyed, mipmapped GL texture (so the
// glyph pixels are byte-identical to the old Canvas2D path — see itemRaster.ts)
// and re-blitted every frame by the GPU; the dotted stalk is emitted as tinted
// dot quads. Pan/zoom re-emit only the O(visible) quad corners (all textures are
// cache hits), so no glyphs are re-rasterised on navigation.
//
// The imperative Canvas2D draw() is kept verbatim below as an automatic FALLBACK
// (drawCanvas2D) for environments without WebGL2 — the component transparently
// picks the GL path when a compositor is available and the Canvas2D path when it
// is not, so nothing regresses where GPU compositing is unavailable.
//
// DRAW-ONLY. Hit-testing/selection/drag stay in the stores + the invisible
// `canvas-interactions` box (unchanged). The hybrid keeps DOM for the
// selected/editing node's live label — deferred, as before.
//
// Transform model (unchanged): the SceneLayer CSS is
//   translate(scroll) scale(zoom) about the renderer centre.
// The Canvas2D path mirrors it with setTransform; the GL path maps tile-space
// point (tx,ty) → device px as ((zoom·tx + W/2 + scroll.x)·dpr, …) per corner.
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
// would silently desync the canvas chip from the DOM chip.
interface ChipStyle {
  radius: number; // theme.shape.borderRadius × 2  (sx borderRadius: 2)
  padX: number; // theme.spacing(1.5)
  padY: number; // theme.spacing(1)
  bg: string; // palette.common.white
  border: string; // palette.grey[400]
  text: string; // palette.text.primary
}
// Label chip layout — mirrors ExpandableLabel/Label: maxWidth 250 (inner = 250 −
// 2·padX). Option A: the on-canvas label is the node's `name` only.
const LABEL_CHIP_MAX_W = 250;
const PROJ_W = PROJECTED_TILE_SIZE.width;
// D3-3: below this zoom, labels are too small to read — draw icons only.
const LABEL_LOD_ZOOM = 0.25;

// D3-2: per-node label layout, measured once and reused across pan/zoom redraws.
interface LabelLayout {
  nameFont: string;
  nameLineH: number;
  chipW: number;
  chipH: number;
}
// Shared empty skip-set so an unselected scene reuses one Set instance.
const EMPTY_SKIP: Set<string> = new Set();

// theme.spacing(n) returns a px string (e.g. "9px"); the canvas needs the number.
const spacingPx = (v: string | number): number =>
  typeof v === 'number' ? v : parseFloat(v);

// Rounded-rect path with a manual fallback (used by the Canvas2D fallback path).
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

// Fixed iso projection matrix (X-orientation) — mirrors getProjectionCss / the
// NonIsometricIcon transform.
const ISO: [number, number, number, number, number, number] = [
  0.707, -0.409, 0.707, 0.409, 0, -0.816
];

const resolveIcon = (
  iconId: string | undefined,
  iconsById: Map<string, Icon>
): Icon => {
  if (!iconId) return DEFAULT_ICON;
  return iconsById.get(iconId) ?? TOMBSTONE_ICON;
};

// Sprite height from the source aspect ratio; guards naturalWidth === 0.
const iconHeight = (img: HTMLImageElement, w: number): number =>
  img.naturalWidth > 0 ? (img.naturalHeight / img.naturalWidth) * w : w;

// Compute the node-name text/chip layout (shared by both render paths).
const measureNodeLabel = (
  ctx: CanvasRenderingContext2D,
  name: string,
  fontSize: number,
  bold: boolean,
  italic: boolean,
  chip: ChipStyle
): LabelLayout => {
  const innerMaxW = LABEL_CHIP_MAX_W - chip.padX * 2;
  const nameFont = `${italic ? 'italic ' : ''}${
    bold ? 700 : 600
  } ${fontSize}px ${DEFAULT_FONT_FAMILY}`;
  const nameLineH = fontSize * 1.5;
  ctx.font = nameFont;
  const nameW = ctx.measureText(name).width;
  const innerW = Math.min(innerMaxW, nameW);
  return {
    nameFont,
    nameLineH,
    chipW: innerW + chip.padX * 2,
    chipH: nameLineH + chip.padY * 2
  };
};

export const NodesCanvas = memo(({ nodes, skipNodes }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uiApi = useUiStateStoreApi();
  const modelApi = useModelStoreApi();
  const theme = useTheme();
  const { getTilePosition, strategy } = useCanvasMode();
  const { layers, visibleIds } = useLayerContext();

  const nodesRef = useRef(nodes);
  const layersRef = useRef(layers);
  const visibleIdsRef = useRef(visibleIds);
  const getTilePositionRef = useRef(getTilePosition);
  const projectionRef = useRef(strategy.projectionName);
  const skipIdsRef = useRef<Set<string>>(new Set());
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

  // Icon-bitmap cache: one decoded HTMLImageElement per icon URL. In the GL path
  // it also seeds the per-url GL texture on first draw.
  const iconCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const pendingRef = useRef(false);
  const rafIdRef = useRef(0);
  const destroyedRef = useRef(false);
  const scheduleDrawRef = useRef<() => void>(() => {});
  const drawNowRef = useRef<() => void>(() => {});

  // ST-4: painter's-order sort cache (shared by both paths).
  const sortCacheRef = useRef<{
    nodes: ViewItem[] | null;
    layers: Layer[] | null;
    visibleIds: ReadonlySet<string> | null;
    skipIds: ReadonlySet<string> | null;
    sorted: ViewItem[];
  }>({
    nodes: null,
    layers: null,
    visibleIds: null,
    skipIds: null,
    sorted: []
  });

  // D3-1: id→item / id→icon lookup cache.
  const itemMapCacheRef = useRef<{
    items: ModelItem[] | null;
    icons: Icon[] | null;
    itemsById: Map<string, ModelItem>;
    iconsById: Map<string, Icon>;
  }>({ items: null, icons: null, itemsById: new Map(), iconsById: new Map() });

  // D3-2: text-layout cache, keyed by the content that determines it.
  const labelLayoutCacheRef = useRef<Map<string, LabelLayout>>(new Map());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Prefer WebGL2; fall back to Canvas2D where it's unavailable. A canvas can
    // only ever hold one context type, so try GL first and only ask for '2d'
    // when GL is null (the canvas is still uncommitted at that point).
    const compositor: GLCompositor | null = createGLCompositor(canvas);
    const ctx: CanvasRenderingContext2D | null = compositor
      ? null
      : canvas.getContext('2d');
    if (!compositor && !ctx) return;

    // A throwaway 2D context purely for measureText in the GL path (the visible
    // canvas is owned by WebGL and has no 2D context).
    const measureCtx: CanvasRenderingContext2D | null = compositor
      ? document.createElement('canvas').getContext('2d')
      : ctx;

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

    // ----- shared per-frame scene state (both paths) -----
    const frameState = () => {
      const ui = uiApi.getState();
      const { scroll, zoom, rendererSize, readableLabels } = ui;
      const inPreview = ui.editorMode === 'EXPLORABLE_READONLY';
      const previewHideLabels = ui.previewHideLabels;
      const exportHideLabels = ui.exportHideLabels;
      const dpr = window.devicePixelRatio || 1;
      const W = rendererSize.width;
      const H = rendererSize.height;
      const bw = Math.max(1, Math.round(W * dpr));
      const bh = Math.max(1, Math.round(H * dpr));

      const model = modelApi.getState();
      const items = model.items;
      const icons = model.icons;
      const mapCache = itemMapCacheRef.current;
      let itemsById = mapCache.itemsById;
      let iconsById = mapCache.iconsById;
      if (mapCache.items !== items || mapCache.icons !== icons) {
        itemsById = new Map(items.map((i) => [i.id, i]));
        iconsById = new Map(icons.map((ic) => [ic.id, ic]));
        itemMapCacheRef.current = { items, icons, itemsById, iconsById };
      }
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
      canvas.dataset.labelScale = String(counterScale);
      const drawLabels = readableLabels || zoom >= LABEL_LOD_ZOOM;
      const skipIds = skipIdsRef.current;

      // Painter's order (ST-4 cache).
      const cache = sortCacheRef.current;
      let sorted: ViewItem[];
      if (
        cache.nodes === nodesRef.current &&
        cache.layers === layersNow &&
        cache.visibleIds === visibleNow &&
        cache.skipIds === skipIds
      ) {
        sorted = cache.sorted;
      } else {
        const layerOrder = new Map(layersNow.map((l) => [l.id, l.order]));
        const orderOf = (n: ViewItem) =>
          resolveRenderOrder(
            n.layerId ? (layerOrder.get(n.layerId) ?? 0) : 0,
            n.zIndex ?? 0,
            -n.tile.x - n.tile.y
          );
        const visible = nodesRef.current.filter(
          (n) =>
            (visibleNow.size === 0 || visibleNow.has(n.id)) &&
            !skipIds.has(n.id)
        );
        sorted = visible.sort((a, b) => orderOf(a) - orderOf(b));
        sortCacheRef.current = {
          nodes: nodesRef.current,
          layers: layersNow,
          visibleIds: visibleNow,
          skipIds,
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
        inPreview,
        previewHideLabels,
        exportHideLabels,
        itemsById,
        iconsById,
        getTilePos,
        isIso,
        counterScale,
        drawLabels,
        sorted
      };
    };

    // ------------------------------------------------------------------
    // WebGL draw path.
    // ------------------------------------------------------------------
    const drawGL = (comp: GLCompositor) => {
      pendingRef.current = false;
      const f = frameState();
      canvas.style.width = `${f.W}px`;
      canvas.style.height = `${f.H}px`;
      comp.begin(f.bw, f.bh);

      const { scroll, zoom, W, H, dpr } = f;
      const originX = W / 2 + scroll.position.x;
      const originY = H / 2 + scroll.position.y;
      // tile-space → device px.
      const dX = (tx: number) => (zoom * tx + originX) * dpr;
      const dY = (ty: number) => (zoom * ty + originY) * dpr;
      // Build device Corners from 4 tile-space points (TL,TR,BR,BL).
      const cn = (
        ax: number,
        ay: number,
        bx: number,
        by: number,
        cx: number,
        cy: number,
        ex: number,
        ey: number
      ): Corners => ({
        tlx: dX(ax),
        tly: dY(ay),
        trx: dX(bx),
        try_: dY(by),
        brx: dX(cx),
        bry: dY(cy),
        blx: dX(ex),
        bly: dY(ey)
      });

      const ss = dpr * CHIP_SUPERSAMPLE;
      const dotTex = comp.canvasTexture('__stalk_dot__', 0, makeDotCanvas);
      const mctx = measureCtx;

      let drawn = 0;
      let labelsDrawn = 0;
      let linkedLabelsDrawn = 0;
      let allIconsDrawn = true;

      for (const node of f.sorted) {
        const modelItem = f.itemsById.get(node.id);
        if (!modelItem) continue;
        drawn += 1;

        const base = f.getTilePos({ tile: node.tile, origin: 'CENTER' });
        const pos = node.offset
          ? { x: base.x + node.offset.x, y: base.y + node.offset.y }
          : base;

        const name = decodeHtmlEntities(modelItem.label ?? modelItem.name);
        const hasLabel =
          isLabelVisibleInPreview(
            node.showLabel !== false,
            f.inPreview,
            f.previewHideLabels
          ) &&
          !f.exportHideLabels &&
          Boolean(name);
        const labelHeight = node.labelHeight ?? DEFAULT_LABEL_HEIGHT;

        // ----- stalk (dotted, drawn first) -----
        if (hasLabel && labelHeight !== 0 && f.drawLabels && dotTex) {
          const len = Math.abs(labelHeight);
          const sign = labelHeight >= 0 ? 1 : -1;
          const rDot = 1.5; // diameter 3 tile px (matches lineWidth 3)
          for (let d = 0; d <= len; d += 6) {
            const cx = pos.x;
            const cy = pos.y - sign * d;
            comp.drawTexturedQuad(
              dotTex,
              cn(
                cx - rDot,
                cy - rDot,
                cx + rDot,
                cy - rDot,
                cx + rDot,
                cy + rDot,
                cx - rDot,
                cy + rDot
              ),
              0,
              0,
              0,
              1
            );
          }
        }

        // ----- icon -----
        const icon = resolveIcon(modelItem.icon, f.iconsById);
        const img = getImage(icon.url);
        if (icon.url && !img) allIconsDrawn = false;
        if (img) {
          const tex = comp.imageTexture(icon.url, img);
          if (tex) {
            const scale = icon.scale || 1;
            if (icon.isIsometric) {
              const w = PROJ_W * 0.8 * scale;
              const h = iconHeight(img, w);
              comp.drawTexturedQuad(
                tex,
                cn(
                  pos.x - w / 2,
                  pos.y - h / 2,
                  pos.x + w / 2,
                  pos.y - h / 2,
                  pos.x + w / 2,
                  pos.y + h / 2,
                  pos.x - w / 2,
                  pos.y + h / 2
                )
              );
            } else if (f.isIso) {
              const w = PROJ_W * 0.7 * scale;
              const h = iconHeight(img, w);
              const ox = pos.x - PROJ_W / 2;
              const oy = pos.y;
              // local (lx,ly) → iso: (ISO0·lx+ISO2·ly+ISO4, ISO1·lx+ISO3·ly+ISO5)
              const px = (lx: number, ly: number) =>
                ox + ISO[0] * lx + ISO[2] * ly + ISO[4];
              const py = (lx: number, ly: number) =>
                oy + ISO[1] * lx + ISO[3] * ly + ISO[5];
              comp.drawTexturedQuad(
                tex,
                cn(
                  px(0, 0),
                  py(0, 0),
                  px(w, 0),
                  py(w, 0),
                  px(w, h),
                  py(w, h),
                  px(0, h),
                  py(0, h)
                )
              );
            } else {
              const w = PROJ_W * 0.7 * scale;
              const h = iconHeight(img, w);
              comp.drawTexturedQuad(
                tex,
                cn(
                  pos.x - w / 2,
                  pos.y - h / 2,
                  pos.x + w / 2,
                  pos.y - h / 2,
                  pos.x + w / 2,
                  pos.y + h / 2,
                  pos.x - w / 2,
                  pos.y + h / 2
                )
              );
            }
          }
        }

        // ----- name chip -----
        if (hasLabel && f.drawLabels && mctx) {
          labelsDrawn += 1;
          const chip = chipStyleRef.current;
          const fontSize = node.labelFontSize || LABEL_BASE_FONT_PX;
          const labelBold = !!node.labelBold;
          const labelItalic = !!node.labelItalic;
          const labelStrike = !!node.labelStrikethrough;
          const linked = !!modelItem.headerLink;
          if (linked) linkedLabelsDrawn += 1;
          const labelUnder = !!node.labelUnderline || linked;
          const textColor =
            node.labelColor || (linked ? LABEL_LINK_COLOR : chip.text);

          const layoutKey = `${fontSize}:${labelBold ? 1 : 0}:${
            labelItalic ? 1 : 0
          }:${name}`;
          let layout = labelLayoutCacheRef.current.get(layoutKey);
          if (!layout) {
            layout = measureNodeLabel(
              mctx,
              name,
              fontSize,
              labelBold,
              labelItalic,
              chip
            );
            const lc = labelLayoutCacheRef.current;
            if (lc.size > 4096) lc.clear();
            lc.set(layoutKey, layout);
          }
          const { nameFont, nameLineH, chipW, chipH } = layout;

          // Content-keyed chip texture (theme colours are in the key, so a theme
          // change re-rasterises). Lazy factory: a cache hit (every pan/zoom
          // frame) skips rasterisation entirely.
          const texKey = `node|${fontSize}|${labelBold ? 1 : 0}|${
            labelItalic ? 1 : 0
          }|${labelStrike ? 1 : 0}|${labelUnder ? 1 : 0}|${textColor}|${
            chip.bg
          }|${chip.border}|${chip.radius}|${chip.padX}|${chip.padY}|${name}`;
          const chipTex = comp.canvasTexture(texKey, 0, () =>
            rasterizeNodeChip(
              name,
              chipW,
              chipH,
              {
                radius: chip.radius,
                padX: chip.padX,
                padY: chip.padY,
                bg: chip.bg,
                border: chip.border,
                fontSize,
                nameFont,
                nameLineH,
                textColor,
                underline: labelUnder,
                strike: labelStrike
              },
              ss
            )
          );

          if (chipTex) {
            const cs = f.counterScale;
            const anchorX = pos.x;
            const anchorY = pos.y - labelHeight;
            const x0 = -chipW / 2;
            const y0 = labelHeight < 0 ? 0 : -chipH;
            comp.drawTexturedQuad(
              chipTex,
              cn(
                anchorX + cs * x0,
                anchorY + cs * y0,
                anchorX + cs * (x0 + chipW),
                anchorY + cs * y0,
                anchorX + cs * (x0 + chipW),
                anchorY + cs * (y0 + chipH),
                anchorX + cs * x0,
                anchorY + cs * (y0 + chipH)
              )
            );
          }
        }
      }

      comp.end();
      canvas.dataset.drawCount = String(drawn);
      canvas.dataset.labelsDrawn = String(labelsDrawn);
      canvas.dataset.linkedLabelsDrawn = String(linkedLabelsDrawn);
      canvas.dataset.allIconsDrawn = String(allIconsDrawn);
    };

    // ------------------------------------------------------------------
    // Canvas2D FALLBACK path (verbatim from the pre-WebGL implementation).
    // ------------------------------------------------------------------
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
      let labelsDrawn = 0;
      let linkedLabelsDrawn = 0;
      let allIconsDrawn = true;
      for (const node of f.sorted) {
        const modelItem = f.itemsById.get(node.id);
        if (!modelItem) continue;
        drawn += 1;
        const base = f.getTilePos({ tile: node.tile, origin: 'CENTER' });
        const pos = node.offset
          ? { x: base.x + node.offset.x, y: base.y + node.offset.y }
          : base;

        const name = decodeHtmlEntities(modelItem.label ?? modelItem.name);
        const hasLabel =
          isLabelVisibleInPreview(
            node.showLabel !== false,
            f.inPreview,
            f.previewHideLabels
          ) &&
          !f.exportHideLabels &&
          Boolean(name);
        const labelHeight = node.labelHeight ?? DEFAULT_LABEL_HEIGHT;

        if (hasLabel && labelHeight !== 0 && f.drawLabels) {
          c2d.save();
          c2d.setLineDash([0, 6]);
          c2d.lineCap = 'round';
          c2d.lineWidth = 3;
          c2d.strokeStyle = 'black';
          c2d.beginPath();
          c2d.moveTo(pos.x, pos.y);
          c2d.lineTo(pos.x, pos.y - labelHeight);
          c2d.stroke();
          c2d.restore();
        }

        const icon = resolveIcon(modelItem.icon, f.iconsById);
        const img = getImage(icon.url);
        if (icon.url && !img) allIconsDrawn = false;
        if (img) {
          const scale = icon.scale || 1;
          c2d.save();
          c2d.translate(pos.x, pos.y);
          if (icon.isIsometric) {
            const w = PROJ_W * 0.8 * scale;
            const h = iconHeight(img, w);
            c2d.drawImage(img, -w / 2, -h / 2, w, h);
          } else if (f.isIso) {
            c2d.translate(-PROJ_W / 2, 0);
            c2d.transform(ISO[0], ISO[1], ISO[2], ISO[3], ISO[4], ISO[5]);
            const w = PROJ_W * 0.7 * scale;
            const h = iconHeight(img, w);
            c2d.drawImage(img, 0, 0, w, h);
          } else {
            const w = PROJ_W * 0.7 * scale;
            const h = iconHeight(img, w);
            c2d.drawImage(img, -w / 2, -h / 2, w, h);
          }
          c2d.restore();
        }

        if (hasLabel && f.drawLabels) {
          labelsDrawn += 1;
          const chip = chipStyleRef.current;
          const fontSize = node.labelFontSize || LABEL_BASE_FONT_PX;
          const labelBold = node.labelBold;
          const labelItalic = node.labelItalic;
          const labelStrike = node.labelStrikethrough;
          const linked = !!modelItem.headerLink;
          if (linked) linkedLabelsDrawn += 1;
          const labelUnder = node.labelUnderline || linked;
          const textColor =
            node.labelColor || (linked ? LABEL_LINK_COLOR : chip.text);

          const layoutKey = `${fontSize}:${labelBold ? 1 : 0}:${
            labelItalic ? 1 : 0
          }:${name}`;
          let layout = labelLayoutCacheRef.current.get(layoutKey);
          if (!layout) {
            layout = measureNodeLabel(
              c2d,
              name,
              fontSize,
              !!labelBold,
              !!labelItalic,
              chip
            );
            const lc = labelLayoutCacheRef.current;
            if (lc.size > 4096) lc.clear();
            lc.set(layoutKey, layout);
          }
          const { nameFont, nameLineH, chipW, chipH } = layout;

          c2d.save();
          c2d.translate(pos.x, pos.y - labelHeight);
          c2d.scale(f.counterScale, f.counterScale);
          const x0 = -chipW / 2;
          const y0 = labelHeight < 0 ? 0 : -chipH;
          roundRectPath(c2d, x0, y0, chipW, chipH, chip.radius);
          c2d.fillStyle = chip.bg;
          c2d.fill();
          c2d.lineWidth = 1;
          c2d.strokeStyle = chip.border;
          c2d.stroke();

          c2d.textAlign = 'left';
          c2d.textBaseline = 'top';
          const textX = x0 + chip.padX;
          const textY = y0 + chip.padY;
          c2d.font = nameFont;
          c2d.fillStyle = textColor;
          c2d.fillText(name, textX, textY + (nameLineH - fontSize) / 2);
          if (labelStrike || labelUnder) {
            c2d.strokeStyle = textColor;
            c2d.lineWidth = Math.max(1, fontSize / 14);
            const innerW = chipW - chip.padX * 2;
            if (labelStrike) {
              const strikeY = textY + nameLineH / 2;
              c2d.beginPath();
              c2d.moveTo(textX, strikeY);
              c2d.lineTo(textX + innerW, strikeY);
              c2d.stroke();
            }
            if (labelUnder) {
              const underY =
                textY + (nameLineH - fontSize) / 2 + fontSize * 0.95;
              c2d.beginPath();
              c2d.moveTo(textX, underY);
              c2d.lineTo(textX + innerW, underY);
              c2d.stroke();
            }
          }
          c2d.restore();
        }
      }
      canvas.dataset.drawCount = String(drawn);
      canvas.dataset.labelsDrawn = String(labelsDrawn);
      canvas.dataset.linkedLabelsDrawn = String(linkedLabelsDrawn);
      canvas.dataset.allIconsDrawn = String(allIconsDrawn);
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
    drawNowRef.current = drawNow;

    scheduleDraw();
    const unsubUi = uiApi.subscribe((s, p) => {
      if (
        s.scroll === p.scroll &&
        s.zoom === p.zoom &&
        s.rendererSize === p.rendererSize &&
        s.readableLabels === p.readableLabels &&
        s.previewHideLabels === p.previewHideLabels &&
        s.exportHideLabels === p.exportHideLabels &&
        s.editorMode === p.editorMode
      ) {
        return;
      }
      if (s.scroll !== p.scroll || s.zoom !== p.zoom) {
        drawNow();
      } else {
        scheduleDraw();
      }
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
      compositor?.destroy();
    };
  }, [uiApi, modelApi]);

  useEffect(() => {
    scheduleDrawRef.current();
  }, [nodes, layers, visibleIds, strategy.projectionName]);

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
