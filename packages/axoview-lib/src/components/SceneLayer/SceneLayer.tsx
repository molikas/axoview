import React, { useRef, useLayoutEffect, memo } from 'react';
import { Box, SxProps } from '@mui/material';
import { useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { isoKappa } from 'src/utils/coordinateTransforms';
import { offsetMatrix, rotationTrig } from 'src/utils/viewRotation';
import type { UiStateStore } from 'src/types';

interface Props {
  children?: React.ReactNode;
  order?: number;
  sx?: SxProps;
  disableAnimation?: boolean; // kept for API compatibility, no longer used
  /**
   * What this layer does while a view rotation is in MOTION (ADR 0049 §6).
   *
   * - `'follow'` (default): CONTENT — text boxes, connector labels, the DOM
   *   node / rectangle / connector hybrids. The layer's transform gains the
   *   motion matrix `M(θ − θ₀)`, so the children (rendered at θ₀) follow the
   *   floor with a transform-only update and no React re-render.
   * - `'billboard'`: content whose elements stay UPRIGHT (connector label
   *   chips). No layer matrix — that would shear them; instead each descendant
   *   carrying `data-billboard-x/-y` (its anchor, SceneLayer px) is moved by
   *   `(M − I)·anchor` through the CSS `translate` property: the anchor follows
   *   the floor, the chip does not turn (ADR 0050 §1).
   * - `'pause'`: INTERACTION-only chrome — hit proxies, transform handles,
   *   hover outlines, the cursor tile, placement ghosts. Hidden while in motion
   *   (it would sit at θ₀ positions) and shown again, re-synced, at settle.
   */
  rotationMotion?: 'follow' | 'billboard' | 'pause';
}

/** The motion matrix M(θ − θ₀) as row-major [m0, m1, m2, m3], or null at rest. */
const motionMatrix = (
  state: Pick<UiStateStore, 'canvasMode' | 'viewRotation'>,
  renderedIso: boolean,
  renderedRotation: number
) => {
  if (!renderedIso || state.canvasMode !== 'ISOMETRIC') return null;
  const d = state.viewRotation - renderedRotation;
  if (d === 0) return null;
  return offsetMatrix(rotationTrig(d), isoKappa());
};

// CSS for the motion transform, '' at rest. M is row-major [[m0, m1], [m2, m3]];
// CSS matrix(a, b, c, d) maps (x, y) → (a·x + c·y, b·x + d·y).
const motionCss = (m: readonly number[] | null): string =>
  m ? ` matrix(${m[0]}, ${m[2]}, ${m[1]}, ${m[3]}, 0, 0)` : '';

// Move every billboard anchor in `root` by (M − I)·anchor — or clear the move.
const applyBillboardMotion = (root: HTMLElement, m: readonly number[] | null) => {
  const els = root.querySelectorAll<HTMLElement>('[data-billboard-x]');
  els.forEach((el) => {
    if (!m) {
      if (el.style.translate) el.style.translate = '';
      return;
    }
    const x = Number(el.dataset.billboardX);
    const y = Number(el.dataset.billboardY);
    const dx = m[0] * x + m[1] * y - x;
    const dy = m[2] * x + m[3] * y - y;
    el.style.translate = `${dx}px ${dy}px`;
  });
};

export const SceneLayer = memo(
  ({ children, order = 0, sx, rotationMotion = 'follow' }: Props) => {
    const elementRef = useRef<HTMLDivElement>(null);
    const storeApi = useUiStateStoreApi();
    // The angle this layer's children were RENDERED at — the context's settled
    // strategy. Relative to it, not to the store's `viewRotationBase`: the two
    // differ between a settle and the re-render that follows it, and a layout
    // effect keyed on the strategy re-applies the transform in the SAME commit
    // the children re-render in, so the hand-over never shows a frame at the
    // wrong angle.
    const { strategy } = useCanvasMode();
    const renderedIso = strategy.projectionName === 'ISOMETRIC';
    const renderedRotation = strategy.rotation;

    useLayoutEffect(() => {
      const el = elementRef.current;
      if (!el) return;
      // True on (re)subscribe so the first apply always syncs: after a settle the
      // chips persist across the re-render, and React never touches `translate`.
      let billboardsMoved = true;
      const apply = (state: UiStateStore) => {
        const { scroll, zoom } = state;
        const m = motionMatrix(state, renderedIso, renderedRotation);
        el.style.transform = `translateX(${scroll.position.x}px) translateY(${
          scroll.position.y
        }px) scale(${zoom})${rotationMotion === 'follow' ? motionCss(m) : ''}`;
        if (rotationMotion === 'pause') {
          el.style.visibility = state.viewRotationInMotion ? 'hidden' : '';
        } else if (rotationMotion === 'billboard' && (m || billboardsMoved)) {
          applyBillboardMotion(el, m);
          billboardsMoved = m !== null;
        }
      };

      // Apply current values immediately on mount
      apply(storeApi.getState());

      // Subscribe to future scroll/zoom/rotation changes — bypasses React render
      // cycle entirely
      return storeApi.subscribe((state, prev) => {
        if (
          state.scroll === prev.scroll &&
          state.zoom === prev.zoom &&
          state.viewRotation === prev.viewRotation &&
          state.viewRotationInMotion === prev.viewRotationInMotion &&
          state.canvasMode === prev.canvasMode
        ) {
          return;
        }
        apply(state);
      });
    }, [storeApi, renderedIso, renderedRotation, rotationMotion]);

    return (
      <Box
        ref={elementRef}
        sx={{
          position: 'absolute',
          zIndex: order,
          top: '50%',
          left: '50%',
          width: 0,
          height: 0,
          userSelect: 'none',
          willChange: 'transform',
          ...sx
        }}
      >
        {children}
      </Box>
    );
  }
);
