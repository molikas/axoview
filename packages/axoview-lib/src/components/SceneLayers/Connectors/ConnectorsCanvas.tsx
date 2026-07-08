import React, { memo, useEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import chroma from 'chroma-js';
import { Connector, Coords } from 'src/types';
import { CONNECTOR_DEFAULTS, UNPROJECTED_TILE_SIZE } from 'src/config';
import { connectorPathTileToGlobal } from 'src/utils/isoMath';
import { useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useModelStoreApi } from 'src/stores/modelStore';
import { useSceneStoreApi } from 'src/stores/sceneStore';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { useLayerContext } from 'src/hooks/useLayerContext';
import {
  createSpriteBatch,
  SpriteBatch,
  UVRect
} from 'src/webgl/glSpriteBatch';

// ---------------------------------------------------------------------------
// ConnectorsCanvas — WebGL2 INSTANCED draw of the connector BODIES (halo + core
// polyline, round joins, arrowhead), replacing the per-connector DOM/SVG
// <Connector> for the BULK. Picking stays geometric (getItemAtTile over
// hitConnectors — mapping 2026-07-08), so removing the visible SVG doesn't touch
// selection; the DOM <Connectors> layer now renders only the sparse hybrid set
// (selected + degenerate-dot + unroutable — which own the selection halo / dot /
// error visuals). Pan/zoom = one uniform + one instanced draw (O(1) CPU).
//
// Geometry: each path tile → scene point via getTilePosition(
// connectorPathTileToGlobal(...)) — the SAME space ConnectorLabel resolves, so
// bodies and labels line up. Each segment is a tinted quad (white texel); round
// joins/caps are dots at each vertex; the arrow is a packed sprite. Dashed/dotted
// + double-line styles fall back to the DOM hybrid for now (documented).
// ---------------------------------------------------------------------------

interface Props {
  // The connectors to draw on the GPU (the bulk — Renderer excludes the hybrid
  // set: selected + degenerate + unroutable, which stay DOM).
  connectors: Connector[];
}

// A right-pointing arrowhead sprite (+x), black fill + white outline — mirrors
// the DOM connector arrow polygon. Rotated per-connector to the last segment.
const makeArrowCanvas = (): HTMLCanvasElement => {
  const S = 64;
  const cnv = document.createElement('canvas');
  cnv.width = S;
  cnv.height = S;
  const ctx = cnv.getContext('2d')!;
  ctx.clearRect(0, 0, S, S);
  // Triangle pointing +x: apex at (right, mid), base on the left.
  ctx.beginPath();
  ctx.moveTo(S * 0.92, S * 0.5);
  ctx.lineTo(S * 0.12, S * 0.12);
  ctx.lineTo(S * 0.12, S * 0.88);
  ctx.closePath();
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = S * 0.11;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fill();
  return cnv;
};

// Parse a css colour to a WebGL [r,g,b] triple (0..1), memo-free (called only on
// a geometry rebuild). Falls back to mid-grey on a parse miss.
const glRGB = (css: string): [number, number, number] => {
  try {
    const [r, g, b] = chroma(css).gl();
    return [r, g, b];
  } catch {
    return [0.5, 0.5, 0.5];
  }
};

export const ConnectorsCanvas = memo(({ connectors }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uiApi = useUiStateStoreApi();
  const modelApi = useModelStoreApi();
  const sceneApi = useSceneStoreApi();
  const theme = useTheme();
  const { getTilePosition } = useCanvasMode();
  const { visibleIds } = useLayerContext();

  const connectorsRef = useRef(connectors);
  const getTilePosRef = useRef(getTilePosition);
  const visibleIdsRef = useRef<ReadonlySet<string>>(visibleIds);
  connectorsRef.current = connectors;
  getTilePosRef.current = getTilePosition;
  visibleIdsRef.current = visibleIds;

  const pendingRef = useRef(false);
  const rafIdRef = useRef(0);
  const destroyedRef = useRef(false);
  const geomDirtyRef = useRef(true);
  const scheduleDrawRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Bodies need only the white + dot + arrow texels → a tiny atlas.
    const batch: SpriteBatch | null = createSpriteBatch(canvas, 512);
    if (!batch) return; // no WebGL2 → the DOM <Connectors> layer stays the renderer
    const arrowUV: UVRect =
      batch.putCanvas('__arrow__', 0, makeArrowCanvas) ?? batch.white;
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

    const buildInstances = (b: SpriteBatch) => {
      const model = modelApi.getState();
      const scenePaths = sceneApi.getState().connectors;
      const colorsById = new Map(model.colors.map((c) => [c.id, c.value]));
      const getTilePos = getTilePosRef.current;
      const visible = visibleIdsRef.current;
      const dot = b.dot;
      const white = b.white;
      let drawn = 0;

      b.beginInstances();

      // A thick segment quad from p0→p1 of width w, tinted (r,g,b,a).
      const segment = (
        p0: Coords,
        p1: Coords,
        w: number,
        uv: UVRect,
        r: number,
        g: number,
        bl: number,
        a: number
      ) => {
        const ax = p1.x - p0.x;
        const ay = p1.y - p0.y;
        const len = Math.hypot(ax, ay) || 1;
        const px = (-ay / len) * w; // perpendicular × width
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
          uv,
          r,
          g,
          bl,
          a,
          0
        );
      };
      // A round cap/join dot of radius rad at p.
      const cap = (
        p: Coords,
        rad: number,
        r: number,
        g: number,
        bl: number,
        a: number
      ) => {
        b.addSprite(
          p.x,
          p.y,
          -rad,
          -rad,
          2 * rad,
          0,
          0,
          2 * rad,
          dot,
          r,
          g,
          bl,
          a,
          0
        );
      };

      for (const connector of connectorsRef.current) {
        if (visible.size !== 0 && !visible.has(connector.id)) continue;
        const scene = scenePaths[connector.id];
        const path = scene?.path;
        if (!path?.tiles || path.tiles.length < 2 || scene?.unroutable)
          continue;

        const pts = path.tiles.map((t) =>
          getTilePos({
            tile: connectorPathTileToGlobal(t, path.rectangle.from)
          })
        );

        const colorValue =
          connector.customColor ||
          colorsById.get(connector.color ?? '') ||
          '#9e9e9e';
        const [cr, cg, cb] = glRGB(
          chroma(colorValue).darken(1).saturate(1).css()
        );
        const w =
          (UNPROJECTED_TILE_SIZE / 100) *
          (connector.width ?? CONNECTOR_DEFAULTS.width ?? 15);
        const haloW = w * 1.4;

        // Halo (white, translucent) UNDER the core: segments then round caps.
        for (let i = 0; i < pts.length - 1; i++)
          segment(pts[i], pts[i + 1], haloW, white, 1, 1, 1, 0.7);
        for (let i = 0; i < pts.length; i++)
          cap(pts[i], haloW / 2, 1, 1, 1, 0.7);
        // Core (dark colour), on top.
        for (let i = 0; i < pts.length - 1; i++)
          segment(pts[i], pts[i + 1], w, white, cr, cg, cb, 1);
        for (let i = 0; i < pts.length; i++) cap(pts[i], w / 2, cr, cg, cb, 1);

        // Arrowhead at the second-to-last point, aimed along the last segment
        // (mirrors getConnectorDirectionIcon's tiles[length-2] convention).
        if (connector.showArrow !== false && pts.length >= 2) {
          const tip = pts[pts.length - 2];
          const nxt = pts[pts.length - 1];
          const dx = nxt.x - tip.x;
          const dy = nxt.y - tip.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const size = Math.max(20, w * 2.2); // ≈ the DOM arrow footprint
          // Rotated quad: u = dir·size, v = perp·size, centred on `tip`.
          b.addSprite(
            tip.x,
            tip.y,
            (-ux - -uy) * (size / 2),
            (-uy - ux) * (size / 2),
            ux * size,
            uy * size,
            -uy * size,
            ux * size,
            arrowUV,
            0,
            0,
            0,
            1,
            0
          );
        }
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
    // Pan/zoom → render only; scene-path/color changes → rebuild geometry.
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
    const unsubScene = sceneApi.subscribe((s, p) => {
      if (s.connectors === p.connectors) return;
      geomDirtyRef.current = true;
      scheduleDraw();
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
      unsubScene();
      unsubModel();
      batch.destroy();
    };
  }, [uiApi, modelApi, sceneApi]);

  useEffect(() => {
    geomDirtyRef.current = true;
    scheduleDrawRef.current();
  }, [connectors, visibleIds, getTilePosition, theme]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="axoview-connectors-canvas"
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
