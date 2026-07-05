import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ViewItem } from 'src/types';
import { DEFAULT_LABEL_HEIGHT, DEFAULT_FONT_FAMILY } from 'src/config';
import { LABEL_BASE_FONT_PX } from 'src/config/labelSettings';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { useModelStore } from 'src/stores/modelStore';
import { useUiStateStore, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useSceneActions } from 'src/hooks/useSceneActions';
import { resolveDraggedOffset } from 'src/utils/labelPosition';
import {
  EDIT_ELEMENT_LINK_EVENT,
  HIDE_ELEMENT_LINK_EVENT
} from 'src/utils/quillLinkShortcut';

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
// the label's NAME chip (the primary grab target).
//
// Track P (T6 fix): a drag promotes the node into the DOM overlay via the
// transient `uiState.labelDrag` (Renderer.hybridIds), then pushes the live
// offset there each frame — so the label follows the pointer as a SINGLE-node
// DOM re-render. The model is written ONCE on release (one undo). The earlier
// implementation wrote the model every pointermove, which redrew EVERY visible
// canvas node per frame (~10 fps at 1000 visible nodes; perf-results/decision-log
// Track P) — the regression this fix removes.

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
  /** Last previewed offset — the value committed to the model on release. */
  lastOffset: number;
}

export const NodeLabelHitLayer = ({ nodes }: Props) => {
  const { getTilePosition } = useCanvasMode();
  const uiStoreApi = useUiStateStoreApi();
  // Only the single on-release commit touches the model now (T6 fix); the live
  // drag is a transient DOM preview via uiStore.actions.setLabelDrag.
  const { updateViewItem } = useSceneActions();
  // Coarse zoom + mode gates — boolean selectors so this only re-renders when
  // the gate flips, not on every zoom tick.
  const active = useUiStateStore(
    (s) => s.editorMode === 'EDITABLE' && s.zoom >= HIT_MIN_ZOOM
  );
  const modelItems = useModelStore((s) => s.items);

  // ADR 0032 amendment: the on-canvas chip shows `label` (fallback `name`), so
  // size the hit box from that text to match the drawn chip. Carries headerLink
  // too (owner 2026-07-05) so this UNSELECTED-node layer can raise the same
  // hover link card the DOM/selected overlay shows — the canvas paint has no
  // pointer events of its own to hang it off.
  const metaById = useMemo(() => {
    const m = new Map<string, { name: string; headerLink?: string }>();
    for (const it of modelItems) {
      const text = it.label ?? it.name;
      if (text) m.set(it.id, { name: text, headerLink: it.headerLink });
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
        // Past slop: promote the node into the DOM overlay (via labelDrag), so the
        // label now moves as a single-node DOM re-render. A plain click never gets
        // here, so it neither promotes nor commits.
        uiStoreApi.getState().actions.setLabelDrag(d.id, d.startOffset);
      }
      e.preventDefault();
      const offset = resolveDraggedOffset({
        startOffset: d.startOffset,
        pointerDeltaScreenY: e.clientY - d.startClientY,
        zoom: uiStoreApi.getState().zoom
      });
      d.lastOffset = offset;
      // Transient preview only — NO model write, so the canvas is NOT redrawn each
      // frame (the old per-frame updateViewItem redrew every visible node → ~10 fps
      // at 1000 visible). Committed once on release below.
      uiStoreApi.getState().actions.setLabelDrag(d.id, offset);
    },
    [uiStoreApi]
  );

  const onWindowUp = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    window.removeEventListener('pointermove', onWindowMove);
    window.removeEventListener('pointerup', onWindowUp);
    window.removeEventListener('pointercancel', onWindowUp);
    if (d?.started) {
      // One model write = one history entry; then drop the preview so the node
      // returns to the canvas drawn at its committed height.
      updateViewItem(d.id, { labelHeight: d.lastOffset });
      uiStoreApi.getState().actions.clearLabelDrag();
    }
  }, [onWindowMove, updateViewItem, uiStoreApi]);

  // Double-click a node's on-canvas label to edit it (parity with connector
  // labels, which are DOM and already double-click-editable). At rest a node
  // label is Canvas2D with no DOM element, so the edit gesture never reached it;
  // this proxy sits over the label, so a double-click here selects the node
  // (promoting it into the DOM overlay) and then asks that overlay to enter
  // inline-rename via the same event F2 uses. Dispatched on the next frame so
  // the just-mounted node is listening.
  const onLabelDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, node: ViewItem) => {
      e.stopPropagation();
      const ui = uiStoreApi.getState();
      if (ui.editorMode !== 'EDITABLE') return;
      ui.actions.setSelectedIds?.([{ type: 'ITEM', id: node.id }]);
      requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent('inlineEditNodeName', { detail: { id: node.id } })
        );
      });
    },
    [uiStoreApi]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, node: ViewItem) => {
      // Don't let the press fall through to the canvas hit-test / pan.
      e.stopPropagation();
      const startOffset = node.labelHeight ?? DEFAULT_LABEL_HEIGHT;
      dragRef.current = {
        id: node.id,
        startClientY: e.clientY,
        startOffset,
        started: false,
        lastOffset: startOffset
      };
      window.addEventListener('pointermove', onWindowMove);
      window.addEventListener('pointerup', onWindowUp);
      window.addEventListener('pointercancel', onWindowUp);
    },
    [onWindowMove, onWindowUp]
  );

  // Safety net: if the layer unmounts mid-drag, drop the window listeners and any
  // stale promotion so a node can't get stuck in the overlay.
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowUp);
      if (dragRef.current) {
        dragRef.current = null;
        uiStoreApi.getState().actions.clearLabelDrag();
      }
    };
  }, [onWindowMove, onWindowUp, uiStoreApi]);

  if (!active) return null;

  return (
    <>
      {nodes.map((node) => {
        if (node.showLabel === false) return null;
        const meta = metaById.get(node.id);
        if (!meta) return null;
        const { name, headerLink } = meta;
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
            onDoubleClick={(e) => onLabelDoubleClick(e, node)}
            // Hovering a LINKED, unselected node's name raises the element link
            // card as a view chip (ADR 0034 addendum 2026-07-05) — parity with
            // the floating Label hit-proxy and the selected node's own DOM
            // anchor, which already do this.
            onPointerEnter={
              headerLink
                ? (e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    window.dispatchEvent(
                      new CustomEvent(EDIT_ELEMENT_LINK_EVENT, {
                        detail: {
                          target: { kind: 'NODE', id: node.id },
                          rect: {
                            left: r.left,
                            top: r.top,
                            width: r.width,
                            height: r.height
                          },
                          mode: 'view',
                          hover: true
                        }
                      })
                    );
                  }
                : undefined
            }
            onPointerLeave={
              headerLink
                ? () =>
                    window.dispatchEvent(
                      new CustomEvent(HIDE_ELEMENT_LINK_EVENT)
                    )
                : undefined
            }
            style={{
              position: 'absolute',
              left: pos.x - chip.width / 2,
              top: pos.y - offset + y0,
              width: chip.width,
              height: chip.height,
              pointerEvents: 'auto',
              cursor: headerLink ? 'pointer' : 'grab',
              touchAction: 'none'
            }}
          />
        );
      })}
    </>
  );
};
