import { useCallback, useRef } from 'react';
import { useUiStateStore, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { getItemAtTile, setWindowCursor } from 'src/utils';
import { useScene } from 'src/hooks/useScene';
import { useLayerContext } from 'src/hooks/useLayerContext';
import { SlimMouseEvent } from 'src/types';

// Pixels the mouse must travel while right-button held before pan activates.
// Below this threshold a right-press+release is treated as a deselect click.
const RIGHT_DRAG_THRESHOLD = 4;

export const usePanHandlers = () => {
  const modeType = useUiStateStore((state) => state.mode.type);
  const actions = useUiStateStore((state) => state.actions);
  const rendererEl = useUiStateStore((state) => state.rendererEl);
  const uiStateApi = useUiStateStoreApi();
  const scene = useScene();
  const layerContext = useLayerContext();

  // Stable scene callbacks (useScene() returns a fresh wrapper object each
  // render, but these members come from useSceneActions useCallbacks and keep a
  // stable identity). Used to abort an in-flight connector on right-click so the
  // drag transaction it opened doesn't leak (D-4).
  const { deleteConnector, commitDragTransaction } = scene;

  const isPanningRef = useRef(false);
  const panMethodRef = useRef<string | null>(null);

  // Stores the mode type active when right-button went down so we can restore it.
  const previousModeTypeRef = useRef<string | null>(null);

  // Right-click deferred pan: don't enter PAN immediately — wait for drag threshold.
  const rightDownRef = useRef(false);
  const rightDownPositionRef = useRef<{ x: number; y: number } | null>(null);

  // D-4 abort-symmetry: aborting out of CONNECTOR while a connection is in
  // flight must delete the provisional connector AND close the drag transaction
  // opened by Connector.handleClickFirst/handleDragStart. A leaked open bracket
  // suppresses saveToHistoryBeforeChange for every later edit (behavior-map
  // §3.1/§4.5). commitDragTransaction is a no-op when no drag is open, so it is
  // safe to call on every right-click restore.
  const abortInFlightConnector = useCallback(() => {
    const uiState = uiStateApi.getState();
    if (uiState.mode.type === 'CONNECTOR' && uiState.mode.id) {
      deleteConnector(uiState.mode.id);
    }
    commitDragTransaction();
  }, [uiStateApi, deleteConnector, commitDragTransaction]);

  // Reconstruct a clean (non-mid-action) mode from a type string for restoration.
  const restorePreviousMode = useCallback(() => {
    const prevType = previousModeTypeRef.current;
    previousModeTypeRef.current = null;
    switch (prevType) {
      case 'CONNECTOR':
        abortInFlightConnector();
        actions.setMode({ type: 'CONNECTOR', id: null, showCursor: true });
        break;
      case 'LASSO':
        actions.setMode({
          type: 'LASSO',
          showCursor: true,
          selection: null,
          isDragging: false
        });
        break;
      case 'FREEHAND_LASSO':
        actions.setMode({
          type: 'FREEHAND_LASSO',
          showCursor: true,
          path: [],
          selection: null,
          isDragging: false
        });
        break;
      case 'RECTANGLE.DRAW':
        actions.setMode({ type: 'RECTANGLE.DRAW', showCursor: true, id: null });
        break;
      case 'PLACE_ICON':
        actions.setMode({ type: 'PLACE_ICON', showCursor: true, id: null });
        break;
      default:
        actions.setMode({
          type: 'CURSOR',
          showCursor: true,
          mousedownItem: null
        });
    }
  }, [actions, abortInFlightConnector]);

  const startPan = useCallback(
    (method: string) => {
      if (modeType !== 'PAN') {
        isPanningRef.current = true;
        panMethodRef.current = method;
        actions.setMode({
          type: 'PAN',
          showCursor: false
        });
      }
    },
    [modeType, actions]
  );

  const endPan = useCallback(() => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setWindowCursor('default');
      const wasRightClick = panMethodRef.current === 'right';
      panMethodRef.current = null;
      rightDownRef.current = false;
      rightDownPositionRef.current = null;

      if (wasRightClick) {
        // Clear stale mousedown so Cursor.mousemove can't trigger lasso on the
        // first move after the right-drag pan ends (Cursor.mouseup never fires
        // to clear it because the right mouseup is consumed by handleMouseUp).
        const uiState = uiStateApi.getState();
        uiState.actions.setMouse({ ...uiState.mouse, mousedown: null });
        restorePreviousMode();
      } else {
        actions.setMode({
          type: 'CURSOR',
          showCursor: true,
          mousedownItem: null
        });
      }
    }
  }, [actions, restorePreviousMode, uiStateApi]);

  // Fixed pan model (ADR 0022 §6): middle-click and right-click drag both pan,
  // always — no settings. The ctrl/alt/empty-area click-pan options were removed
  // (they conflicted with Ctrl+click multi-select, Alt+click waypoint removal,
  // and empty-area lasso/clear).
  const handleMouseDown = useCallback(
    (e: SlimMouseEvent): boolean => {
      // Left-click while in pan mode (keyboard-activated) exits to cursor
      if (e.button === 0 && modeType === 'PAN') {
        endPan();
        return true;
      }

      if (e.button === 1) {
        e.preventDefault();
        startPan('middle');
        return true;
      }

      if (e.button === 2) {
        e.preventDefault();
        // Don't enter PAN immediately — defer until the drag threshold is
        // exceeded. On release without drag this becomes a context-menu tap
        // (ADR 0027) handled by handleRightButtonUp.
        rightDownRef.current = true;
        rightDownPositionRef.current = { x: e.clientX, y: e.clientY };
        previousModeTypeRef.current = modeType;
        // Always consume right mousedown — prevents it reaching Cursor.mousedown.
        return true;
      }

      return false;
    },
    [modeType, startPan, endPan]
  );

  // Called on every mousemove. Returns true to suppress processMouseUpdate while right
  // button is held (prevents Cursor.mousemove from triggering lasso on right-drag).
  // Once the drag threshold is exceeded, starts pan and returns false so Pan.mousemove
  // can handle scrolling via the normal processMouseUpdate path.
  const handleMouseMove = useCallback(
    (e: SlimMouseEvent): boolean => {
      if (!rightDownRef.current) return false;

      // Already panning — let processMouseUpdate handle scrolling via Pan.mousemove
      if (isPanningRef.current) return false;

      if (rightDownPositionRef.current) {
        const dx = Math.abs(e.clientX - rightDownPositionRef.current.x);
        const dy = Math.abs(e.clientY - rightDownPositionRef.current.y);
        if (dx > RIGHT_DRAG_THRESHOLD || dy > RIGHT_DRAG_THRESHOLD) {
          startPan('right');
          return false; // Pan mode now active — let processMouseUpdate run
        }
      }

      // Right is down but below threshold — suppress processMouseUpdate so
      // Cursor.mousemove can't trigger lasso from the stale mouse.mousedown state.
      return true;
    },
    [startPan]
  );

  // After a right-click deselect, reset the active selection-tool mode to its
  // clean state (lasso/freehand cleared; connector falls back to cursor).
  const restoreModeAfterRightClick = useCallback(
    (currentModeType: string) => {
      if (currentModeType === 'LASSO') {
        actions.setMode({
          type: 'LASSO',
          showCursor: true,
          selection: null,
          isDragging: false
        });
      } else if (currentModeType === 'FREEHAND_LASSO') {
        actions.setMode({
          type: 'FREEHAND_LASSO',
          showCursor: true,
          path: [],
          selection: null,
          isDragging: false
        });
      } else if (currentModeType === 'CONNECTOR') {
        abortInFlightConnector();
        actions.setMode({
          type: 'CURSOR',
          showCursor: true,
          mousedownItem: null
        });
      }
    },
    [actions, abortInFlightConnector]
  );

  const handleRightButtonUp = useCallback(
    (e: SlimMouseEvent): boolean => {
      const wasDragging =
        isPanningRef.current && panMethodRef.current === 'right';

      rightDownRef.current = false;
      rightDownPositionRef.current = null;

      // Right-DRAG past threshold = pan (ADR 0022 §1) — never a menu.
      if (wasDragging) {
        endPan();
        return true;
      }

      // Right-TAP below threshold (ADR 0027 §2). previousModeTypeRef was seeded
      // on right-down only when right-click-pan was armed; null means a stray
      // right mouseup we still consume to keep it off Cursor.mouseup.
      if (previousModeTypeRef.current === null) return true;
      previousModeTypeRef.current = null;

      const uiState = uiStateApi.getState();
      const currentModeType = uiState.mode.type;

      // In a tool mode (lasso / freehand / connector …) a right-tap ABORTS the
      // in-flight tool action and restores a clean mode — the long-standing
      // "right-click cancels the tool" behavior. The context menu is a
      // CURSOR-mode affordance, so it does not open here.
      if (currentModeType !== 'CURSOR') {
        uiState.actions.setItemControls(null);
        uiState.actions.setMouse({ ...uiState.mouse, mousedown: null });
        restoreModeAfterRightClick(currentModeType);
        return true;
      }

      // CURSOR mode: open the context menu at the click point (screen px). An
      // interactable item under the cursor → item menu (select it first so the
      // clipboard / delete commands act on it); empty / locked / hidden →
      // canvas menu. Locked + hidden items are non-interactable across every
      // path (UX §4.3) — they fall through to the canvas menu.
      const tile = uiState.mouse.position.tile;
      const item = getItemAtTile({ tile, scene });
      const { lockedIds, visibleIds } = layerContext;
      const itemInteractable =
        !!item &&
        !lockedIds.has(item.id) &&
        (visibleIds.size === 0 || visibleIds.has(item.id));
      // Clear the stale mousedown so Cursor.mousemove can't start a lasso from
      // it on the next frame.
      uiState.actions.setMouse({ ...uiState.mouse, mousedown: null });
      const anchor = { x: e.clientX, y: e.clientY };
      if (item && itemInteractable) {
        uiState.actions.setSelectedIds([{ type: item.type, id: item.id }]);
        uiState.actions.openContextMenu({
          anchor,
          target: { type: item.type, id: item.id }
        });
      } else {
        uiState.actions.openContextMenu({ anchor, target: null });
      }
      return true;
    },
    [endPan, uiStateApi, scene, layerContext, restoreModeAfterRightClick]
  );

  const handleMouseUp = useCallback(
    (e: SlimMouseEvent): boolean => {
      if (e.button === 2) {
        return handleRightButtonUp(e);
      }

      if (!isPanningRef.current) return false;
      endPan();
      return true;
    },
    [endPan, handleRightButtonUp]
  );

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    isPanning: isPanningRef.current
  };
};
