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
// 2·padX). Option A: the on-canvas label is the node's `name` only — the rich
// caption (description) folds into Notes and is no longer drawn here.
const LABEL_CHIP_MAX_W = 250;
const PROJ_W = PROJECTED_TILE_SIZE.width;
// D3-3: below this zoom, labels are too small to read — draw icons only and skip
// the whole label block (stalk + measure + chip). The biggest per-frame win when
// zoomed out over a dense scene. Overridden by the readable-labels toggle, which
// deliberately keeps labels legible at low zoom.
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

  // ST-4: painter's-order sort cache. draw() runs on every pan/zoom frame, but
  // the sort depends only on (nodes, layers, visibleIds, skipIds) — none of
  // which change when the user merely pans or zooms. Reuse the sorted array
  // until one of those input identities changes (a real change always produces
  // a fresh array/Set ref from React), so pan/zoom stops re-sorting all nodes.
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

  // D3-1: id→item / id→icon lookup cache. The bare getItemById(model.items, id)
  // per visible node was a linear findIndex — O(N²) per draw, re-run on every
  // pan/zoom frame (same antipattern as the paste freeze, in the render hot
  // path). Memoised on the model.items / model.icons array identity, so it
  // rebuilds only when the model changes and is skipped on pure pan/zoom.
  const itemMapCacheRef = useRef<{
    items: ModelItem[] | null;
    icons: Icon[] | null;
    itemsById: Map<string, ModelItem>;
    iconsById: Map<string, Icon>;
  }>({ items: null, icons: null, itemsById: new Map(), iconsById: new Map() });

  // D3-2: text-layout cache, keyed by the content that determines it
  // (fontSize, name, description). Pan/zoom redraws reuse it instead of
  // re-running measureText/wrapText/chip-dims per node per frame.
  const labelLayoutCacheRef = useRef<Map<string, LabelLayout>>(new Map());

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
      // Present-mode hide-labels override (ADR 0013 addendum) — UI-only; merged
      // through the same single point as the DOM Node path (isLabelVisibleInPreview).
      const inPreview = ui.editorMode === 'EXPLORABLE_READONLY';
      const previewHideLabels = ui.previewHideLabels;
      // Image-export hide-labels override (ADR 0025 §3) — UI-only, export-scoped.
      const exportHideLabels = ui.exportHideLabels;
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
      // O(1) id→item / id→icon lookups (D3-1), rebuilt only when the model's
      // items/icons arrays change (skipped on pure pan/zoom).
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
      // Publish the applied label counter-scale so the readable-labels gate can
      // observe it on the canvas renderer (no per-node DOM label exists in canvas
      // mode). This is the exact value fed to ctx.scale below, not a recomputation.
      canvas.dataset.labelScale = String(counterScale);

      // D3-3: skip the label block (stalk + chip) below the LOD zoom unless
      // readable-labels is on. Computed once per draw, applied per node.
      const drawLabels = readableLabels || zoom >= LABEL_LOD_ZOOM;

      const skipIds = skipIdsRef.current;

      // Painter's order: ascending resolved render order (mirrors Nodes sort).
      // Cached across pan/zoom (ST-4) — only recomputed when the node set,
      // layers, visibility or skip set actually changes.
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
        // O(1) layerId→order lookup, built once per recompute (was a linear
        // findLayer per sort comparison). get(undefined)→undefined→0 preserves
        // the old findLayer(...)?.order ?? 0 semantics for unassigned layers.
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

      let drawn = 0;
      // Count of nodes that actually painted a label chip this frame. Published
      // below so the present-mode hide-labels gate can be observed on the canvas
      // renderer (no per-node DOM label exists in canvas mode) — same idea as
      // data-label-scale / data-draw-count.
      let labelsDrawn = 0;
      // A2: true only when EVERY node that should paint an icon had a decoded
      // bitmap available this frame. getImage returns null for a non-empty icon
      // URL whose Image hasn't finished decoding yet — that node's icon is
      // skipped, so the snapshot would miss it. The image-export flow polls this
      // signal before its first capture (mirrors drawCount/labelsDrawn). Nodes
      // with no icon (DEFAULT_ICON.url === '') resolve to null immediately but
      // have nothing to paint, so they must NOT flip this false — the per-node
      // check below gates on a truthy icon.url first (O(1), no allocation).
      let allIconsDrawn = true;
      for (const node of sorted) {
        const modelItem = itemsById.get(node.id);
        if (!modelItem) continue;
        drawn += 1;
        // ADR 0023: apply the off-grid offset as a final translate AFTER
        // projection so at-rest canvas nodes match the DOM overlay exactly (no
        // jump on select/drag). No-op branch when offset is absent (the common
        // snapped case) — this loop runs every pan/zoom frame, so the snapped
        // path must add no work and no allocation. stalk/icon/label all derive
        // from `pos`, so this single shift offsets the whole node.
        const base = getTilePos({ tile: node.tile, origin: 'CENTER' });
        const pos = node.offset
          ? { x: base.x + node.offset.x, y: base.y + node.offset.y }
          : base;

        // On-canvas label text (ADR 0032 amendment): the `label` field, falling
        // back to the identity `name` when absent (pre-seed / brand-new nodes).
        // Plain text rendered verbatim by the DOM overlay, so decode entities
        // only — never strip tags (a label like `List<T>` must survive and stay
        // identical to the DOM Node it swaps with). A1 / hybrid parity.
        const name = decodeHtmlEntities(modelItem.label ?? modelItem.name);
        const hasLabel =
          isLabelVisibleInPreview(
            node.showLabel !== false,
            inPreview,
            previewHideLabels
          ) &&
          !exportHideLabels &&
          Boolean(name);
        const labelHeight = node.labelHeight ?? DEFAULT_LABEL_HEIGHT;

        // ----- stalk line (D2-1) -----
        // Dotted line from the tile up to the chip's bottom-centre, drawn FIRST
        // so the icon + chip paint over it (the DOM renders the label before the
        // icon). Mirrors the DOM Label stalk exactly: strokeDasharray "0,6",
        // round cap, width 3, black. The canvas drew NO stalk before — at-rest
        // (canvas) nodes showed none and selecting one popped it in via the DOM
        // overlay (the reported "stalk invisible until click").
        // ADR 0024: labelHeight is a SIGNED offset — positive draws the stalk up
        // (legacy), negative draws it down (below-node). `pos.y - labelHeight`
        // handles both; only the zero case (no stalk) is skipped.
        if (hasLabel && labelHeight !== 0 && drawLabels) {
          ctx.save();
          ctx.setLineDash([0, 6]);
          ctx.lineCap = 'round';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'black';
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y);
          ctx.lineTo(pos.x, pos.y - labelHeight);
          ctx.stroke();
          ctx.restore();
        }

        // ----- icon -----
        const icon = resolveIcon(modelItem.icon, iconsById);
        const img = getImage(icon.url);
        // A2: a node that should paint an icon (non-empty URL) but whose bitmap
        // isn't decoded yet (img === null) was skipped this frame. Flag it so the
        // export waits for the icon layer before snapshotting. The icon.url guard
        // excludes the no-icon/DEFAULT_ICON case (url === '') — nothing to draw,
        // so it must not flip the signal. O(1), no allocation.
        if (icon.url && !img) allIconsDrawn = false;
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

        // ----- static label (name only) -----
        // Option A: the on-canvas label is the node's `name` only. The former
        // rich-text caption (description) folds into Notes and is not drawn.
        if (hasLabel && drawLabels) {
          labelsDrawn += 1;
          const chip = chipStyleRef.current;
          const fontSize = node.labelFontSize || LABEL_BASE_FONT_PX;
          const labelBold = node.labelBold;
          const labelItalic = node.labelItalic;
          const labelStrike = node.labelStrikethrough;
          const labelUnder = node.labelUnderline;

          // D3-2: measure once per (fontSize, weight, style, name) and reuse
          // across pan/zoom redraws — chip geometry is content-determined. Bold /
          // italic change the measured width, so they're part of the key. The
          // live counter-scale is applied at draw time below, not baked here.
          const layoutKey = `${fontSize}:${labelBold ? 1 : 0}:${
            labelItalic ? 1 : 0
          }:${name}`;
          let layout = labelLayoutCacheRef.current.get(layoutKey);
          if (!layout) {
            const innerMaxW = LABEL_CHIP_MAX_W - chip.padX * 2;
            const nameFont = `${labelItalic ? 'italic ' : ''}${
              labelBold ? 700 : 600
            } ${fontSize}px ${DEFAULT_FONT_FAMILY}`;
            const nameLineH = fontSize * 1.5;

            ctx.font = nameFont;
            const nameW = ctx.measureText(name).width;

            const innerW = Math.min(innerMaxW, nameW);
            const chipW = innerW + chip.padX * 2;
            const chipH = nameLineH + chip.padY * 2;

            layout = { nameFont, nameLineH, chipW, chipH };
            const cache = labelLayoutCacheRef.current;
            // Bound memory: pan/zoom adds no entries (same labels hit) — only edits
            // do, so this rarely trips; clear wholesale when it does.
            if (cache.size > 4096) cache.clear();
            cache.set(layoutKey, layout);
          }

          const { nameFont, nameLineH, chipW, chipH } = layout;

          ctx.save();
          // Chip is centered horizontally on the tile and floats `labelHeight`
          // from the tile center. ADR 0024: when the offset is negative the chip
          // sits BELOW (y0 = 0, top-center scale); above keeps bottom-center.
          ctx.translate(pos.x, pos.y - labelHeight);
          ctx.scale(counterScale, counterScale);
          const x0 = -chipW / 2;
          const y0 = labelHeight < 0 ? 0 : -chipH;
          roundRectPath(ctx, x0, y0, chipW, chipH, chip.radius);
          ctx.fillStyle = chip.bg;
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = chip.border;
          ctx.stroke();

          // Name (bold), left-aligned inside the (tile-centered) chip.
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          const textX = x0 + chip.padX;
          const textY = y0 + chip.padY;
          ctx.font = nameFont;
          ctx.fillStyle = node.labelColor || chip.text;
          ctx.fillText(name, textX, textY + (nameLineH - fontSize) / 2);
          // Strikethrough / underline: Canvas2D has no text-decoration, so draw
          // the rules manually across the chip's inner width — strike at the
          // line's vertical centre, underline just under the baseline (ADR 0034
          // O1; underline is decoration-only, so the layout cache key is
          // unaffected).
          if (labelStrike || labelUnder) {
            ctx.strokeStyle = node.labelColor || chip.text;
            ctx.lineWidth = Math.max(1, fontSize / 14);
            const innerW = chipW - chip.padX * 2;
            if (labelStrike) {
              const strikeY = textY + nameLineH / 2;
              ctx.beginPath();
              ctx.moveTo(textX, strikeY);
              ctx.lineTo(textX + innerW, strikeY);
              ctx.stroke();
            }
            if (labelUnder) {
              const underY = textY + (nameLineH - fontSize) / 2 + fontSize * 0.95;
              ctx.beginPath();
              ctx.moveTo(textX, underY);
              ctx.lineTo(textX + innerW, underY);
              ctx.stroke();
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
      canvas.dataset.labelsDrawn = String(labelsDrawn);
      // A2: "true" only when no node's icon was skipped this frame for a
      // not-yet-decoded bitmap. The image-export dialog awaits this before its
      // first capture so canvas-drawn icons aren't dropped from the snapshot
      // (connectors are DOM/SVG and survive regardless). Same publish shape as
      // the drawCount/labelsDrawn anti-cheat datasets above.
      canvas.dataset.allIconsDrawn = String(allIconsDrawn);
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
        s.readableLabels === p.readableLabels &&
        s.previewHideLabels === p.previewHideLabels &&
        s.exportHideLabels === p.exportHideLabels &&
        s.editorMode === p.editorMode
      ) {
        return;
      }
      // Pan/zoom must repaint the canvas SYNCHRONOUSLY, in the same store tick as
      // the DOM SceneLayers — Grid.tsx and SceneLayer.tsx apply their CSS
      // transform inline inside this very subscription (no rAF). The mouse-pan
      // path runs setScroll INSIDE the useRAFThrottle rAF callback, so a nested
      // requestAnimationFrame here (scheduleDraw) wouldn't fire until the NEXT
      // frame — leaving the canvas node layer one frame behind the grid,
      // connectors and selected-node overlay for the whole drag. That cross-
      // surface frame skew is the visible "rubber-band" drift on pan. Drawing now
      // keeps every surface on the same frame. The draw is the same O(visible)
      // paint that ran a frame later before, so per-frame cost is unchanged (pan
      // is already throttled to ≤1 scroll write/frame upstream). Non-navigation
      // changes (label/mode visibility toggles) aren't latency-coupled to the DOM
      // transform, so they stay rAF-coalesced.
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
