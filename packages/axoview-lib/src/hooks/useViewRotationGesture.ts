import { RefObject, useEffect } from 'react';
import { useUiStateStoreApi } from 'src/stores/uiStateStore';

// POC — Alt + left-drag on the canvas orbits the ground plane about the vertical
// axis (turntable). Degrees of rotation per horizontal pixel dragged; dragging
// right brings the near side of the scene to the right.
const DEG_PER_PX = 0.4;

export const useViewRotationGesture = (
  containerRef: RefObject<HTMLElement | null>
) => {
  const storeApi = useUiStateStoreApi();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let dragging = false;
    let lastX = 0;
    let prevCursor = '';

    // Capture phase on the canvas container: swallow the press BEFORE the
    // interaction manager's window-level listeners see it, so Alt+drag never
    // also starts a selection / lasso / node drag.
    const onDown = (e: PointerEvent) => {
      if (!e.altKey || e.button !== 0) return;
      if (storeApi.getState().canvasMode !== 'ISOMETRIC') return;
      dragging = true;
      lastX = e.clientX;
      prevCursor = document.body.style.cursor;
      document.body.style.cursor = 'ew-resize';
      e.stopPropagation();
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      e.stopPropagation();
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      const { viewRotation, actions } = storeApi.getState();
      actions.setViewRotation(viewRotation + dx * DEG_PER_PX);
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor = prevCursor;
      e.stopPropagation();
    };

    el.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    return () => {
      el.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      if (dragging) document.body.style.cursor = prevCursor;
    };
  }, [containerRef, storeApi]);
};
