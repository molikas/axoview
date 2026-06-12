// AnnotationLayer — ephemeral free-draw overlay (ADR 0014).
//
// A single screen-space SVG covering the canvas. Strokes are stored in
// scene-canvas coordinates and drawn inside a <g> whose transform mirrors the
// SceneLayer (translate(rendererCenter + scroll) scale(zoom)) — updated by a
// direct store subscription so pan/zoom never re-renders React. Pointer events
// are captured ONLY while a draw tool is active and the overlay is shown, so
// normal canvas selection/pan keep working when the palette is open but idle.
//
// Nothing here ever touches the Model — strokes live only in uiState and are
// excluded from every save/export/zip path (asserted in annotationPersistence
// + projectZip tests).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useUiStateStore, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { shallow } from 'zustand/shallow';
import { AnnotationStroke, AnnotationTool, Coords } from 'src/types';
import { generateId } from 'src/utils';
import {
  screenToSceneCanvas,
  polylinePathD,
  arrowHeadPoints,
  rectFromPoints
} from 'src/utils/annotationGeometry';
import { HIGHLIGHTER_OPACITY } from 'src/config/annotationSettings';

const isShape = (tool: AnnotationStroke['tool']) =>
  tool === 'rectangle' || tool === 'ellipse';
const isSegment = (tool: AnnotationStroke['tool']) =>
  tool === 'line' || tool === 'arrow';

// Per-tool cursors (ADR 0014 polish): the cursor points at the action instead
// of a blanket crosshair. Custom SVGs for freehand/eraser (hotspot at the
// working tip); precise `crosshair` for shape/line tools. No `#` in the SVG so
// the data-URI stays valid inside url().
const svgCursor = (svg: string, hx: number, hy: number) =>
  `url("data:image/svg+xml;utf8,${svg}") ${hx} ${hy}, crosshair`;

const PENCIL_CURSOR = svgCursor(
  "<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 24 24'><path d='M4 20l2.6-.6L17.4 8.6l-2-2L4.6 17.4 4 20z' fill='black' stroke='white' stroke-width='1.4' stroke-linejoin='round'/></svg>",
  5,
  26
);
const HIGHLIGHTER_CURSOR = svgCursor(
  "<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 24 24'><path d='M5 19l3 1 9.5-9.5-4-4L4 16l1 3z' fill='gold' stroke='black' stroke-width='1.1'/></svg>",
  6,
  25
);
const ERASER_CURSOR = svgCursor(
  "<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 24 24'><g transform='rotate(-35 11 13)'><rect x='4' y='9' width='13' height='8' rx='1.5' fill='white' stroke='black' stroke-width='1.4'/><line x1='10.5' y1='9' x2='10.5' y2='17' stroke='black' stroke-width='1.1'/></g></svg>",
  8,
  20
);

const cursorForTool = (tool: AnnotationTool): string => {
  switch (tool) {
    case 'pencil':
      return PENCIL_CURSOR;
    case 'highlighter':
      return HIGHLIGHTER_CURSOR;
    case 'eraser':
      return ERASER_CURSOR;
    case 'line':
    case 'arrow':
    case 'rectangle':
    case 'ellipse':
      return 'crosshair';
    default:
      return 'default';
  }
};

/** Renders one committed/draft stroke as SVG. Pointer-eraseable when `onErase`. */
const StrokeShape = ({
  stroke,
  onErase
}: {
  stroke: AnnotationStroke;
  onErase?: (id: string) => void;
}) => {
  const { tool, color, thickness, points } = stroke;
  const eraseProps = onErase
    ? {
        // Inherit the eraser cursor from the layer; just be hit-testable.
        style: { pointerEvents: 'stroke' as const },
        onPointerDown: (e: React.PointerEvent) => {
          e.stopPropagation();
          onErase(stroke.id);
        }
      }
    : { style: { pointerEvents: 'none' as const } };
  const common = {
    stroke: color,
    strokeWidth: thickness,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...(tool === 'highlighter'
      ? { opacity: HIGHLIGHTER_OPACITY, strokeWidth: thickness * 2.5 }
      : {})
  };

  if (isShape(tool) && points.length >= 2) {
    const r = rectFromPoints(points[0], points[points.length - 1]);
    if (tool === 'rectangle') {
      return <rect x={r.x} y={r.y} width={r.width} height={r.height} {...common} {...eraseProps} />;
    }
    return (
      <ellipse
        cx={r.x + r.width / 2}
        cy={r.y + r.height / 2}
        rx={r.width / 2}
        ry={r.height / 2}
        {...common}
        {...eraseProps}
      />
    );
  }

  const d = polylinePathD(points);
  const head =
    tool === 'arrow' && points.length >= 2
      ? arrowHeadPoints(points[0], points[points.length - 1], thickness * 4)
      : [];

  return (
    <g {...eraseProps}>
      <path d={d} {...common} />
      {head.length === 2 && (
        <path
          d={`M ${head[0].x} ${head[0].y} L ${points[points.length - 1].x} ${points[points.length - 1].y} L ${head[1].x} ${head[1].y}`}
          {...common}
        />
      )}
    </g>
  );
};

export const AnnotationLayer = () => {
  const uiStoreApi = useUiStateStoreApi();
  const actions = useUiStateStore((s) => s.actions);
  const { open, tool, color, thickness, strokes } = useUiStateStore(
    (s) => ({
      open: s.annotation.open,
      tool: s.annotation.tool,
      color: s.annotation.color,
      thickness: s.annotation.thickness,
      strokes: s.annotation.strokes
    }),
    shallow
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const gRef = useRef<SVGGElement>(null);
  // draftRef is the source of truth for the in-progress stroke; `draft` state
  // only drives re-render. Commit happens OUTSIDE any setState updater so it
  // never double-runs under React StrictMode (which double-invokes updaters).
  const draftRef = useRef<AnnotationStroke | null>(null);
  const [draft, setDraft] = useState<AnnotationStroke | null>(null);
  const drawingRef = useRef(false);

  const setDraftBoth = useCallback((next: AnnotationStroke | null) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  // Strokes are visible whenever the overlay is open (the pen toggle). The
  // overlay only CAPTURES pointer input while a draw tool is active — in
  // `select` mode it's fully pass-through (canvas interactive), and `eraser`
  // mode lets clicks fall through except on the strokes themselves.
  const shown = open;
  const isDrawTool = tool !== 'select' && tool !== 'eraser';
  const capturing = shown && isDrawTool;
  const eraserActive = shown && tool === 'eraser';

  // Esc / V returns to Select while a draw or eraser tool is active — the quick
  // "stop drawing, let me interact" gesture (Excalidraw's V). Gated on a
  // non-select tool so Esc still closes the view-mode popover when not drawing.
  useEffect(() => {
    if (!shown || tool === 'select') return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'Escape' || e.key === 'v' || e.key === 'V') {
        actions.setAnnotationTool('select');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown, tool, actions]);

  // While a draw/eraser tool is active, swallow LEFT-button mouse events at the
  // layer so they never reach the window-level interaction manager (which would
  // otherwise pan in preview's PAN mode, or select in edit). React's
  // stopPropagation can't stop a native `window` listener, so we attach native
  // listeners here. Right-button (pan) and wheel (zoom) are left untouched, so
  // canvas navigation stays available while drawing.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || (!capturing && !eraserActive)) return;
    const stopLeftButton = (e: MouseEvent) => {
      if (e.button === 0) e.stopPropagation();
    };
    const stopLeftDrag = (e: MouseEvent) => {
      // eslint-disable-next-line no-bitwise
      if (e.buttons & 1) e.stopPropagation();
    };
    el.addEventListener('mousedown', stopLeftButton);
    el.addEventListener('mousemove', stopLeftDrag);
    el.addEventListener('mouseup', stopLeftButton);
    return () => {
      el.removeEventListener('mousedown', stopLeftButton);
      el.removeEventListener('mousemove', stopLeftDrag);
      el.removeEventListener('mouseup', stopLeftButton);
    };
  }, [capturing, eraserActive]);

  // Mirror the SceneLayer transform onto the <g> via a direct store
  // subscription — pan/zoom updates the attribute without re-rendering React.
  useEffect(() => {
    const apply = () => {
      const g = gRef.current;
      if (!g) return;
      const { scroll, zoom, rendererSize } = uiStoreApi.getState();
      const tx = rendererSize.width / 2 + scroll.position.x;
      const ty = rendererSize.height / 2 + scroll.position.y;
      g.setAttribute('transform', `translate(${tx}, ${ty}) scale(${zoom})`);
    };
    apply();
    return uiStoreApi.subscribe((state, prev) => {
      if (
        state.scroll === prev.scroll &&
        state.zoom === prev.zoom &&
        state.rendererSize === prev.rendererSize
      ) {
        return;
      }
      apply();
    });
  }, [uiStoreApi, shown]);

  const toScene = useCallback(
    (e: React.PointerEvent): Coords => {
      const rect = rootRef.current!.getBoundingClientRect();
      const { scroll, zoom, rendererSize } = uiStoreApi.getState();
      return screenToSceneCanvas(
        { x: e.clientX - rect.left, y: e.clientY - rect.top },
        rendererSize,
        scroll.position,
        zoom
      );
    },
    [uiStoreApi]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!capturing || e.button !== 0) return;
      e.stopPropagation();
      rootRef.current?.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      const p = toScene(e);
      const drawTool = tool as AnnotationStroke['tool'];
      setDraftBoth({
        id: generateId(),
        tool: drawTool,
        color,
        thickness,
        points: isShape(drawTool) || isSegment(drawTool) ? [p, p] : [p]
      });
    },
    [capturing, toScene, tool, color, thickness, setDraftBoth]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drawingRef.current) return;
      const cur = draftRef.current;
      if (!cur) return;
      const p = toScene(e);
      const next =
        isShape(cur.tool) || isSegment(cur.tool)
          ? { ...cur, points: [cur.points[0], p] }
          : { ...cur, points: [...cur.points, p] };
      setDraftBoth(next);
    },
    [toScene, setDraftBoth]
  );

  const endStroke = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const cur = draftRef.current;
    if (cur) {
      const isShapeOrSeg = isShape(cur.tool) || isSegment(cur.tool);
      // Drop zero-extent shapes/segments (a click without a drag).
      const hasExtent = isShapeOrSeg
        ? cur.points[0].x !== cur.points[1].x ||
          cur.points[0].y !== cur.points[1].y
        : cur.points.length >= 1;
      if (hasExtent) actions.addAnnotationStroke(cur);
    }
    setDraftBoth(null);
  }, [actions, setDraftBoth]);

  if (!shown) return null;

  let layerCursor = 'default';
  if (capturing) layerCursor = cursorForTool(tool);
  else if (eraserActive) layerCursor = cursorForTool('eraser');

  return (
    <div
      ref={rootRef}
      data-axoview-id="annotation-layer"
      style={{
        position: 'absolute',
        inset: 0,
        // Capture pointers while drawing or erasing; in Select mode the layer is
        // fully pass-through so the canvas handles pointers normally. Right-drag
        // pan + wheel zoom always bubble to the window handlers (we only act on
        // left-button draws), so canvas navigation stays available while drawing.
        pointerEvents: capturing || eraserActive ? 'auto' : 'none',
        cursor: layerCursor,
        zIndex: 6,
        touchAction: 'none'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
      >
        <g ref={gRef}>
          {strokes.map((s) => (
            <StrokeShape
              key={s.id}
              stroke={s}
              onErase={tool === 'eraser' ? actions.eraseAnnotationStroke : undefined}
            />
          ))}
          {draft && <StrokeShape stroke={draft} />}
        </g>
      </svg>
    </div>
  );
};
