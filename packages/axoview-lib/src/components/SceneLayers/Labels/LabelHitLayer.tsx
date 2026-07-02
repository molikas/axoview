import React, { useCallback, useEffect, useRef } from 'react';
import { Label, Coords } from 'src/types';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { useLayerContext } from 'src/hooks/useLayerContext';
import { useUiStateStore, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useSceneActions } from 'src/hooks/useSceneActions';
import { useInlineRename } from 'src/hooks/useInlineRename';
import {
  measureLabelChip,
  labelFontPx,
  LabelChipLayout
} from 'src/utils/labelChip';

// ---------------------------------------------------------------------------
// LabelHitLayer (ADR 0031 §4) — the pixel-accurate DOM hit-proxy over the
// Canvas2D LabelsCanvas paint (mirrors NodeLabelHitLayer). One invisible div per
// visible label, sized to its chip, so the FULL chip width is selectable (not a
// single anchor tile) and a connector passing UNDER the chip stays selectable
// where the chip isn't — labels are deliberately NOT in the tile hit-test
// (hitDetection.ts), the proxy owns label hits.
//
// A press selects the label; a drag past slop moves it via the transient
// `labelMove` preview (LabelsCanvas redraws the chip following the pointer with
// NO per-frame model write, so the proxy divs don't thrash), committing the new
// position ONCE on release (one undo). The divs live in a <SceneLayer>, so they
// are positioned in canvas-px — the same space getTilePosition + the canvas draw
// use — and the SceneLayer CSS transform tracks pan/zoom for free.
// ---------------------------------------------------------------------------

// Below this zoom chips are too small to grab precisely; skip the layer (also
// bounds the div count at low zoom). Mirrors NodeLabelHitLayer.
const HIT_MIN_ZOOM = 0.4;
const DRAG_SLOP_PX = 4;

// Module-level offscreen 2D context for chip measurement (matches the canvas
// renderer's measureText). One per module; never attached to the DOM.
let measureCtx: CanvasRenderingContext2D | null = null;
const getMeasureCtx = (): CanvasRenderingContext2D | null => {
  if (measureCtx) return measureCtx;
  if (typeof document === 'undefined') return null;
  measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
};

// Coarse fallback when no 2D context is available (SSR / test env).
const fallbackChip = (text: string, fontSize: number): LabelChipLayout => {
  const lines = (text || '').split('\n');
  const lineH = fontSize * 1.5;
  return {
    lines,
    lineWidths: lines.map((l) => l.length * fontSize * 0.6),
    lineH,
    chipW: Math.min(320, (text.length || 1) * fontSize * 0.6) + 24,
    chipH: lines.length * lineH + 16
  };
};

// Inline contentEditable editor for a floating Label (double-click / F2). It
// overlays the chip at the same canvas-px rect the hit-proxy uses; while it is
// mounted LabelsCanvas skips painting this label (uiState.inlineEditLabelId) so
// the text isn't drawn twice. Left-click-away / Enter commit; right-click-away /
// Escape cancel (useInlineRename's shared contract).
const LabelInlineEditor = ({
  label,
  left,
  top,
  width,
  fontSize,
  onDone
}: {
  label: Label;
  left: number;
  top: number;
  width: number;
  fontSize: number;
  onDone: () => void;
}) => {
  const { updateLabel } = useSceneActions();
  const commit = useCallback(
    (raw: string) => {
      const text = raw.replace(/\n+$/, '');
      // Empty text has no reason to draw — revert (keep the old text) rather than
      // leaving a blank chip; the user can delete the label with Delete instead.
      if (text.trim() && text !== label.text) {
        updateLabel(label.id, { text });
      }
      onDone();
    },
    [updateLabel, label.id, label.text, onDone]
  );
  const inline = useInlineRename({
    active: true,
    commit,
    cancel: onDone,
    multiline: true
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: left - 8,
        top: top - 4,
        minWidth: width + 16,
        zIndex: 20,
        pointerEvents: 'auto'
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        contentEditable
        suppressContentEditableWarning
        data-testid="label-inline-editor"
        ref={inline.setRef as unknown as React.Ref<HTMLDivElement>}
        onBlur={inline.onBlur}
        onKeyDown={inline.onKeyDown}
        onDoubleClick={(e) => e.stopPropagation()}
        style={{
          font: `${label.isItalic ? 'italic ' : ''}${
            label.isBold ? 700 : 400
          } ${fontSize}px Roboto, Arial, sans-serif`,
          color: label.color || '#222',
          background: label.backgroundColor || '#fff',
          border: '1px solid #90caf9',
          borderRadius: 4,
          padding: '4px 8px',
          textAlign: 'center',
          outline: 'none',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          cursor: 'text',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
        }}
      >
        {label.text}
      </div>
    </div>
  );
};

interface Props {
  labels: Label[];
}

interface DragState {
  id: string;
  startTile: Coords;
  startOffset: Coords;
  startClient: { x: number; y: number };
  started: boolean;
  /** Last previewed offset — committed to the model on release. */
  last: Coords;
}

export const LabelHitLayer = ({ labels }: Props) => {
  const { getTilePosition } = useCanvasMode();
  const { visibleIds, lockedIds } = useLayerContext();
  const uiStoreApi = useUiStateStoreApi();
  const { updateLabel } = useSceneActions();
  // Coarse zoom + mode gate — boolean selector so this only re-renders when the
  // gate flips, not on every zoom tick.
  const active = useUiStateStore(
    (s) => s.editorMode === 'EDITABLE' && s.zoom >= HIT_MIN_ZOOM
  );
  const inlineEditLabelId = useUiStateStore((s) => s.inlineEditLabelId);

  const dragRef = useRef<DragState | null>(null);

  // Double-click a label chip → inline-edit it (parity with node / connector
  // labels; owner 2026-07-02). F2 on a selected label routes here too (via
  // setInlineEditLabelId in the interaction manager).
  const onDoubleClick = useCallback(
    (e: React.MouseEvent, label: Label) => {
      e.stopPropagation();
      const actions = uiStoreApi.getState().actions;
      actions.setItemControls({ type: 'LABEL', id: label.id }, { openPanel: false });
      actions.setInlineEditLabelId(label.id);
    },
    [uiStoreApi]
  );

  const endInlineEdit = useCallback(() => {
    uiStoreApi.getState().actions.setInlineEditLabelId(null);
  }, [uiStoreApi]);

  const onWindowMove = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startClient.x;
      const dy = e.clientY - d.startClient.y;
      if (!d.started) {
        if (Math.abs(dx) < DRAG_SLOP_PX && Math.abs(dy) < DRAG_SLOP_PX) return;
        d.started = true;
      }
      e.preventDefault();
      const zoom = uiStoreApi.getState().zoom || 1;
      // Screen delta → canvas-space residual (the offset is applied inside the
      // zoom-scaled SceneLayer, so divide by zoom). The chip floats off its
      // original tile by the accumulated offset.
      const offset: Coords = {
        x: d.startOffset.x + dx / zoom,
        y: d.startOffset.y + dy / zoom
      };
      d.last = offset;
      // Transient preview only — NO model write, so the proxy divs don't
      // re-render each frame. Committed once on release below.
      uiStoreApi.getState().actions.setLabelMove(d.id, d.startTile, offset);
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
      // One model write = one history entry; then drop the preview so the chip
      // redraws from its committed position.
      updateLabel(d.id, { offset: d.last, snap: false });
      uiStoreApi.getState().actions.clearLabelMove();
    }
  }, [onWindowMove, updateLabel, uiStoreApi]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, label: Label) => {
      // Don't fall through to the canvas-interactions box (which would clear the
      // selection / start a pan).
      e.stopPropagation();
      // Full-chip select (ADR 0031 §4): the press selects the label.
      uiStoreApi
        .getState()
        .actions.setItemControls({ type: 'LABEL', id: label.id });
      dragRef.current = {
        id: label.id,
        startTile: label.tile,
        startOffset: label.offset ?? { x: 0, y: 0 },
        startClient: { x: e.clientX, y: e.clientY },
        started: false,
        last: label.offset ?? { x: 0, y: 0 }
      };
      window.addEventListener('pointermove', onWindowMove);
      window.addEventListener('pointerup', onWindowUp);
      window.addEventListener('pointercancel', onWindowUp);
    },
    [onWindowMove, onWindowUp, uiStoreApi]
  );

  // Safety net: if the layer unmounts mid-drag, drop the window listeners and any
  // stale preview so a label can't get stuck following the pointer.
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowUp);
      if (dragRef.current) {
        dragRef.current = null;
        uiStoreApi.getState().actions.clearLabelMove();
      }
    };
  }, [onWindowMove, onWindowUp, uiStoreApi]);

  if (!active) return null;

  return (
    <>
      {labels.map((label) => {
        if (visibleIds.size > 0 && !visibleIds.has(label.id)) return null;
        if (lockedIds.has(label.id)) return null;
        const fontSize = labelFontPx(label);
        const ctx = getMeasureCtx();
        const chip = ctx
          ? measureLabelChip(
              ctx,
              label.text,
              fontSize,
              label.isBold,
              label.isItalic
            )
          : fallbackChip(label.text, fontSize);
        const pos = getTilePosition({ tile: label.tile, origin: 'CENTER' });
        const cx = pos.x + (label.offset?.x ?? 0);
        const cy = pos.y + (label.offset?.y ?? 0);
        const left = cx - chip.chipW / 2;
        const top = cy - chip.chipH / 2;
        if (label.id === inlineEditLabelId) {
          return (
            <LabelInlineEditor
              key={`${label.id}-edit`}
              label={label}
              left={left}
              top={top}
              width={chip.chipW}
              fontSize={fontSize}
              onDone={endInlineEdit}
            />
          );
        }
        return (
          <div
            key={label.id}
            data-axoview-id="canvas-label-hit"
            data-label-hit-id={label.id}
            onPointerDown={(e) => onPointerDown(e, label)}
            onDoubleClick={(e) => onDoubleClick(e, label)}
            style={{
              position: 'absolute',
              left,
              top,
              width: chip.chipW,
              height: chip.chipH,
              pointerEvents: 'auto',
              cursor: 'move',
              touchAction: 'none'
            }}
          />
        );
      })}
    </>
  );
};
