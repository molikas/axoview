import React, { useCallback, useEffect, useRef } from 'react';
import { SxProps } from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  resolveLabelPlacement,
  resolveDraggedOffset
} from 'src/utils/labelPosition';

const CONNECTOR_DOT_SIZE = 3;
// Pointer travel before a press on the label becomes a reposition drag (rather
// than a click / the start of a double-click-to-rename).
const DRAG_SLOP_PX = 4;

export interface LabelReposition {
  /** Current zoom, read lazily so the presentational Label needs no store. */
  getZoom: () => number;
  /** Live preview during the drag — never touches the model. */
  onPreview: (offset: number) => void;
  /** Commit on release — one model write = one history entry. */
  onCommit: (offset: number) => void;
}

export interface Props {
  /** Signed vertical offset (ADR 0024): >0 above the node, <0 below it. */
  labelHeight?: number;
  maxWidth: number;
  maxHeight?: number;
  expandDirection?: 'CENTER' | 'BOTTOM';
  children: React.ReactNode;
  sx?: SxProps;
  showLine?: boolean;
  /**
   * When set, the label chip itself becomes a vertical drag handle (ADR 0024) —
   * drag it above or below the node to reposition. Node labels pass this while
   * selected in EDITABLE mode; ConnectorLabel never does. A plain click / the
   * double-click-to-rename still pass through (drag only engages past slop).
   */
  reposition?: LabelReposition;
}

// T1 wholesale de-emotion (decision-log): the label's positioning wrapper and the
// chip are module-level styled() components — CSS resolved ONCE into a cached
// class, so each of the ~N node/connector labels pays only a className apply, not
// the per-instance MUI sx pipeline (extendSxProp/styleFunctionSx/murmur2) a
// `<Box sx={...}>` re-runs every render. The chip still accepts `sx` (ConnectorLabel
// overrides py/px/whiteSpace); dynamic transform / maxHeight / top / width go inline.

const LabelOuter = styled('div')({ position: 'absolute' });

const LabelChip = styled('div')(({ theme }) => ({
  position: 'absolute',
  display: 'inline-block',
  backgroundColor: theme.palette.common.white, // bgcolor: 'common.white'
  border: '1px solid',
  borderColor: theme.palette.grey[400], // borderColor: 'grey.400'
  borderRadius: (theme.shape.borderRadius as number) * 2, // sx borderRadius: 2
  paddingTop: theme.spacing(1), // py: 1
  paddingBottom: theme.spacing(1),
  paddingLeft: theme.spacing(1.5), // px: 1.5
  paddingRight: theme.spacing(1.5),
  transformOrigin: 'bottom center',
  overflow: 'hidden'
}));

export const Label = ({
  children,
  maxWidth,
  maxHeight,
  expandDirection = 'CENTER',
  labelHeight = 0,
  sx,
  showLine = true,
  reposition
}: Props) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // Signed placement (ADR 0024): positive = above (legacy), negative = below.
  // The stalk + chip re-anchor in both directions and the transform-origin flips
  // so the ADR-0015 counter-scale holds the attachment point fixed.
  const placement = resolveLabelPlacement(labelHeight, expandDirection);

  // ── Label-as-handle drag (ADR 0024) ──────────────────────────────────────
  // The chip IS the reposition handle: press it and drag vertically to move the
  // label above/below the node. The move/up listeners live on `window` for the
  // duration of the gesture (the classic robust drag pattern) so it keeps
  // tracking once the pointer leaves the small chip — pointer capture proved
  // unreliable for a chip this small. A press that never exceeds DRAG_SLOP_PX
  // commits nothing, so a plain click and the double-click-to-rename are
  // untouched. Drag is a pure preview (no per-frame model write); the model is
  // written once, on release.
  const dragRef = useRef<{
    startClientY: number;
    startOffset: number;
    repo: LabelReposition;
    dragging: boolean;
  } | null>(null);

  const winMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.dragging) {
      if (Math.abs(e.clientY - d.startClientY) < DRAG_SLOP_PX) return;
      d.dragging = true; // past slop — this is a reposition drag
    }
    e.preventDefault();
    d.repo.onPreview(
      resolveDraggedOffset({
        startOffset: d.startOffset,
        pointerDeltaScreenY: e.clientY - d.startClientY,
        zoom: d.repo.getZoom()
      })
    );
  }, []);

  const winUp = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      window.removeEventListener('pointermove', winMove);
      window.removeEventListener('pointerup', winUp);
      window.removeEventListener('pointercancel', winUp);
      if (!d || !d.dragging) return;
      d.repo.onCommit(
        resolveDraggedOffset({
          startOffset: d.startOffset,
          pointerDeltaScreenY: e.clientY - d.startClientY,
          zoom: d.repo.getZoom()
        })
      );
    },
    [winMove]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!reposition) return;
      // No preventDefault here — it would swallow the double-click-to-rename.
      // Text selection during an actual drag is suppressed by userSelect:none on
      // the chip + preventDefault in the move handler once past slop.
      dragRef.current = {
        startClientY: e.clientY,
        startOffset: labelHeight,
        repo: reposition,
        dragging: false
      };
      window.addEventListener('pointermove', winMove);
      window.addEventListener('pointerup', winUp);
      window.addEventListener('pointercancel', winUp);
    },
    [reposition, labelHeight, winMove, winUp]
  );

  // Safety net: drop any window listeners if the label unmounts mid-drag.
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', winMove);
      window.removeEventListener('pointerup', winUp);
      window.removeEventListener('pointercancel', winUp);
    };
  }, [winMove, winUp]);

  return (
    <LabelOuter style={{ width: maxWidth }}>
      {placement.showStalk && showLine && (
        <svg
          viewBox={`0 0 ${CONNECTOR_DOT_SIZE} ${placement.stalkLength}`}
          width={CONNECTOR_DOT_SIZE}
          style={{
            position: 'absolute',
            top: placement.stalkTop,
            left: -CONNECTOR_DOT_SIZE / 2,
            pointerEvents: 'none'
          }}
        >
          <line
            x1={CONNECTOR_DOT_SIZE / 2}
            y1={0}
            x2={CONNECTOR_DOT_SIZE / 2}
            y2={placement.stalkLength}
            strokeDasharray={`0, ${CONNECTOR_DOT_SIZE * 2}`}
            stroke="black"
            strokeWidth={CONNECTOR_DOT_SIZE}
            strokeLinecap="round"
          />
        </svg>
      )}

      <LabelChip
        ref={contentRef}
        sx={sx}
        data-axoview-id={reposition ? 'canvas-label-chip' : undefined}
        onPointerDown={reposition ? onPointerDown : undefined}
        // The optional `--axoview-label-scale` counter-scale (ADR 0015, set by
        // ExpandableLabel when "keep labels readable" is on) composes after the
        // translate; scaling about the (flipped) attachment origin holds the
        // stalk-attachment point fixed. Defaults to 1 (no-op) for other
        // consumers, e.g. ConnectorLabel.
        style={{
          maxHeight,
          top: placement.chipTop,
          transformOrigin: placement.transformOrigin,
          transform: `translate(-50%, ${placement.chipTranslateY}) scale(var(--axoview-label-scale, 1))`,
          cursor: reposition ? 'grab' : undefined,
          touchAction: reposition ? 'none' : undefined,
          userSelect: reposition ? 'none' : undefined,
          WebkitUserSelect: reposition ? 'none' : undefined
        }}
      >
        {children}
      </LabelChip>
    </LabelOuter>
  );
};
