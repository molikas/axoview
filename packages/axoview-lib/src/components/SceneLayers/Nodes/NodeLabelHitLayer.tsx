import React, { useCallback, useMemo, useRef } from 'react';
import { ViewItem } from 'src/types';
import { DEFAULT_LABEL_HEIGHT, DEFAULT_FONT_FAMILY } from 'src/config';
import { LABEL_BASE_FONT_PX } from 'src/config/labelSettings';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { useModelStore } from 'src/stores/modelStore';
import { useUiStateStore, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useSceneActions } from 'src/hooks/useSceneActions';
import { resolveDraggedOffset } from 'src/utils/labelPosition';

// Invisible hit targets over each UNSELECTED node's name label so it can be
// dragged to reposition (ADR 0024) WITHOUT first selecting the node — the
// label is a direct-manipulation target like any other (build feedback,
// 2026-06-20). The selected/dragged node keeps its own DOM label handle
// (Label.tsx `reposition`); this layer covers the rest, which are drawn on the
// canvas (ADR 0019) and so have no DOM element to grab.
//
// The divs live in a <SceneLayer>, so they're positioned in canvas-px (the same
// space `getTilePosition` + the canvas draw use) and the SceneLayer's CSS
// transform tracks pan/zoom for free — no per-frame React. Each div is sized to
// the label's NAME chip (the primary grab target); a press starts a live
// reposition that writes the model inside one drag transaction (one undo), so
// the canvas redraws the label following the pointer with no preview plumbing.

// Below this zoom labels are too small to grab precisely; skip the layer (also
// bounds the div count — at very low zoom the whole diagram can be on screen).
const HIT_MIN_ZOOM = 0.4;
// Mirror Label/NodesCanvas chip padding (theme.spacing(1.5) / spacing(1)) and
// the 250px max chip width, so the hit box matches the drawn name chip.
const CHIP_PAD_X = 12;
const CHIP_PAD_Y = 8;
const CHIP_MAX_W = 250;
const DRAG_SLOP_PX = 4;

// Module-level offscreen 2D context for name-width measurement (matches the
// canvas renderer's measureText). One per module; never attached to the DOM.
let measureCtx: CanvasRenderingContext2D | null = null;
const getMeasureCtx = (): CanvasRenderingContext2D | null => {
  if (measureCtx) return measureCtx;
  if (typeof document === 'undefined') return null;
  measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
};

interface NameChip {
  width: number;
  height: number;
}

const measureNameChip = (name: string, fontSize: number): NameChip => {
  const ctx = getMeasureCtx();
  const nameLineH = fontSize * 1.5;
  const height = nameLineH + CHIP_PAD_Y * 2;
  if (!ctx) {
    return { width: Math.min(CHIP_MAX_W, name.length * fontSize * 0.6), height };
  }
  ctx.font = `600 ${fontSize}px ${DEFAULT_FONT_FAMILY}`;
  const width = Math.min(CHIP_MAX_W, ctx.measureText(name).width + CHIP_PAD_X * 2);
  return { width, height };
};

interface Props {
  /** Visible nodes NOT in the DOM overlay (i.e. unselected + not dragging). */
  nodes: ViewItem[];
}

interface DragState {
  id: string;
  startClientY: number;
  startOffset: number;
  started: boolean;
}

export const NodeLabelHitLayer = ({ nodes }: Props) => {
  const { getTilePosition } = useCanvasMode();
  const uiStoreApi = useUiStateStoreApi();
  const { beginDragTransaction, commitDragTransaction, updateViewItem } =
    useSceneActions();
  // Coarse zoom + mode gates — boolean selectors so this only re-renders when
  // the gate flips, not on every zoom tick.
  const active = useUiStateStore(
    (s) => s.editorMode === 'EDITABLE' && s.zoom >= HIT_MIN_ZOOM
  );
  const modelItems = useModelStore((s) => s.items);

  const namesById = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of modelItems) {
      if (it.name) m.set(it.id, it.name);
    }
    return m;
  }, [modelItems]);

  const dragRef = useRef<DragState | null>(null);

  const onWindowMove = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.started) {
        if (Math.abs(e.clientY - d.startClientY) < DRAG_SLOP_PX) return;
        d.started = true;
        // Open the history bracket only once the gesture is really a drag, so a
        // plain click commits nothing.
        beginDragTransaction();
      }
      e.preventDefault();
      const offset = resolveDraggedOffset({
        startOffset: d.startOffset,
        pointerDeltaScreenY: e.clientY - d.startClientY,
        zoom: uiStoreApi.getState().zoom
      });
      updateViewItem(d.id, { labelHeight: offset });
    },
    [beginDragTransaction, updateViewItem, uiStoreApi]
  );

  const onWindowUp = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    window.removeEventListener('pointermove', onWindowMove);
    window.removeEventListener('pointerup', onWindowUp);
    window.removeEventListener('pointercancel', onWindowUp);
    if (d?.started) commitDragTransaction();
  }, [onWindowMove, commitDragTransaction]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, node: ViewItem) => {
      // Don't let the press fall through to the canvas hit-test / pan.
      e.stopPropagation();
      dragRef.current = {
        id: node.id,
        startClientY: e.clientY,
        startOffset: node.labelHeight ?? DEFAULT_LABEL_HEIGHT,
        started: false
      };
      window.addEventListener('pointermove', onWindowMove);
      window.addEventListener('pointerup', onWindowUp);
      window.addEventListener('pointercancel', onWindowUp);
    },
    [onWindowMove, onWindowUp]
  );

  if (!active) return null;

  return (
    <>
      {nodes.map((node) => {
        if (node.showLabel === false) return null;
        const name = namesById.get(node.id);
        if (!name) return null;
        const fontSize = node.labelFontSize || LABEL_BASE_FONT_PX;
        const chip = measureNameChip(name, fontSize);
        const offset = node.labelHeight ?? DEFAULT_LABEL_HEIGHT;
        const pos = getTilePosition({ tile: node.tile, origin: 'CENTER' });
        // Match the canvas chip rect: anchored at the node centre, floated by the
        // signed offset; above → chip sits above the anchor, below → at it.
        const y0 = offset < 0 ? 0 : -chip.height;
        return (
          <div
            key={node.id}
            data-axoview-id="canvas-label-hit"
            data-label-hit-id={node.id}
            onPointerDown={(e) => onPointerDown(e, node)}
            style={{
              position: 'absolute',
              left: pos.x - chip.width / 2,
              top: pos.y - offset + y0,
              width: chip.width,
              height: chip.height,
              pointerEvents: 'auto',
              cursor: 'grab',
              touchAction: 'none'
            }}
          />
        );
      })}
    </>
  );
};
