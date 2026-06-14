import { useCallback, useEffect, useRef, MutableRefObject } from 'react';
import { useModelStoreApi } from 'src/stores/modelStore';
import { useUiStateStore, useUiStateStoreApi } from 'src/stores/uiStateStore';
import {
  ModeActions,
  State,
  SlimMouseEvent,
  Mouse,
  ItemReference
} from 'src/types';
import { DialogTypeEnum, ItemControls } from 'src/types/ui';
import {
  getMouse,
  getItemAtTile,
  generateId,
  incrementZoom,
  decrementZoom,
  CoordsUtils
} from 'src/utils';
import { useResizeObserver } from 'src/hooks/useResizeObserver';
import { useScene } from 'src/hooks/useScene';
import { useHistory } from 'src/hooks/useHistory';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { HOTKEY_PROFILES } from 'src/config/hotkeys';
import { TEXTBOX_DEFAULTS } from 'src/config';
import { useLayerContext } from 'src/hooks/useLayerContext';
import { getConnectorWaypointRefs } from 'src/utils/connectorSelection';
import { Cursor } from './modes/Cursor';
import { DragItems } from './modes/DragItems';
import { DrawRectangle } from './modes/Rectangle/DrawRectangle';
import { TransformRectangle } from './modes/Rectangle/TransformRectangle';
import { Connector } from './modes/Connector';
import { Pan } from './modes/Pan';
import { PlaceIcon } from './modes/PlaceIcon';
import { TextBox } from './modes/TextBox';
import { Lasso } from './modes/Lasso';
import { FreehandLasso } from './modes/FreehandLasso';
import { ReconnectAnchor } from './modes/ReconnectAnchor';
import { CarryItem } from './modes/CarryItem';
import { decideTouchTap } from './touchTap';
import {
  TAP_SLOP_PX,
  TAP_TIME_MS,
  exceedsTapSlop,
  isTapGesture
} from 'src/config/tapGesture';
import { MIN_ZOOM, MAX_ZOOM } from 'src/config';
import { usePanHandlers } from './usePanHandlers';
import { useRAFThrottle } from './useRAFThrottle';
import { useCopyPaste } from 'src/clipboard/useCopyPaste';

const modes: { [k in string]: ModeActions } = {
  CURSOR: Cursor,
  DRAG_ITEMS: DragItems,
  'RECTANGLE.DRAW': DrawRectangle,
  'RECTANGLE.TRANSFORM': TransformRectangle,
  CONNECTOR: Connector,
  PAN: Pan,
  PLACE_ICON: PlaceIcon,
  TEXTBOX: TextBox,
  LASSO: Lasso,
  FREEHAND_LASSO: FreehandLasso,
  RECONNECT_ANCHOR: ReconnectAnchor,
  CARRY_ITEM: CarryItem
};

// Device class of the originating pointer (ADR 0018). The mouse-shaped
// SlimMouseEvent stays the single internal adapter every mode is written
// against; pointerType travels separately so PointerEvent is never leaked into
// modes (behavior-map §0).
type PointerKind = 'mouse' | 'touch' | 'pen';

interface TouchGestureState {
  // Active touch/pen pointers by pointerId → latest client position.
  pointers: Map<number, { x: number; y: number }>;
  phase: 'idle' | 'tap' | 'pan' | 'pinch';
  downScreen: { x: number; y: number };
  downTime: number;
  lastPanScreen: { x: number; y: number };
  pinchLastDistance: number;
  pinchLastCentroid: { x: number; y: number };
}

const pointerDistance = (
  a: { x: number; y: number },
  b: { x: number; y: number }
) => Math.hypot(a.x - b.x, a.y - b.y);

const pointerCentroid = (
  a: { x: number; y: number },
  b: { x: number; y: number }
) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

const getModeFunction = (mode: ModeActions, e: SlimMouseEvent) => {
  switch (e.type) {
    case 'mousemove':
      return mode.mousemove;
    case 'mousedown':
      return mode.mousedown;
    case 'mouseup':
      return mode.mouseup;
    default:
      return null;
  }
};

// ─── keydown handler decomposition ──────────────────────────────────────────
// The window keydown handler was a single ~380-line function (Sonar S3776
// cognitive complexity 131 — the worst in the repo). It is decomposed into the
// module-level helpers below; useInteractionManager's handler (see the keydown
// useEffect) is now a thin dispatcher that threads the live uiState snapshot +
// a stable `KeydownDeps` bundle through them. Behaviour is preserved exactly:
// the gesture order, fall-through semantics, ADR-0006 selection contract, and
// the M-1 dep-array invariant are all unchanged.

type SceneApi = ReturnType<typeof useScene>;

interface KeydownDeps {
  uiStateApi: ReturnType<typeof useUiStateStoreApi>;
  modelStoreApi: ReturnType<typeof useModelStoreApi>;
  sceneRef: MutableRefObject<SceneApi>;
  layerContextRef: MutableRefObject<ReturnType<typeof useLayerContext>>;
  rendererRef: MutableRefObject<HTMLElement | undefined>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  handleCopy: () => void;
  handleCut: () => void;
  handlePaste: () => void;
  createTextBox: SceneApi['createTextBox'];
  deleteSelectedItems: SceneApi['deleteSelectedItems'];
  deleteViewItem: SceneApi['deleteViewItem'];
  deleteConnector: SceneApi['deleteConnector'];
  deleteTextBox: SceneApi['deleteTextBox'];
  deleteRectangle: SceneApi['deleteRectangle'];
  updateViewItem: SceneApi['updateViewItem'];
  commitDragTransaction: SceneApi['commitDragTransaction'];
}

// True when the keystroke target is a text-editing surface — typing there must
// not be hijacked by canvas shortcuts.
const isEditableTarget = (target: HTMLElement): boolean =>
  target.tagName === 'INPUT' ||
  target.tagName === 'TEXTAREA' ||
  target.contentEditable === 'true' ||
  !!target.closest('.ql-editor');

// Esc inside CONNECTOR mode: abort an in-flight connection and reset the mode.
const handleConnectorEscape = (
  uiState: State['uiState'],
  deps: KeydownDeps
) => {
  if (uiState.mode.type !== 'CONNECTOR') return;
  const connectorMode = uiState.mode;

  const isConnectionInProgress =
    (uiState.connectorInteractionMode === 'click' &&
      connectorMode.isConnecting) ||
    (uiState.connectorInteractionMode === 'drag' && connectorMode.id !== null);

  if (isConnectionInProgress && connectorMode.id) {
    deps.deleteConnector(connectorMode.id);
    // D-4 abort-symmetry: handleClickFirst/handleDragStart opened a drag
    // transaction; aborting without committing would leak the open bracket and
    // suppress saveToHistoryBeforeChange for every later edit (behavior-map
    // §3.1/§4.5). Closing it after the delete nets to zero patches (no spurious
    // history entry) but clears dragInProgress.
    deps.commitDragTransaction();

    uiState.actions.setMode({
      type: 'CONNECTOR',
      showCursor: true,
      id: null,
      startAnchor: undefined,
      isConnecting: false
    });
  }
};

// Escape: clear panel → clear multi-selection → abort connector. Always
// consumes the keystroke. Returns true when handled (Escape pressed).
const handleEscapeKey = (
  e: KeyboardEvent,
  uiState: State['uiState'],
  deps: KeydownDeps
): boolean => {
  if (e.key !== 'Escape') return false;
  e.preventDefault();

  if (uiState.itemControls) {
    uiState.actions.setItemControls(null);
    return true;
  }

  // Multi-selection: Esc clears it when no panel is open
  // (panel-clear path above handles single-selection). ADR-0006.
  if (uiState.selectedIds.length > 0) {
    uiState.actions.clearSelection();
    return true;
  }

  handleConnectorEscape(uiState, deps);
  return true;
};

// Delete the single item currently in itemControls, dispatched by its type.
const deleteItemControlsTarget = (
  uiState: State['uiState'],
  deps: KeydownDeps
) => {
  const ctrl = uiState.itemControls;
  if (!ctrl) return;
  if (ctrl.type === 'ITEM') {
    deps.deleteViewItem(ctrl.id);
  } else if (ctrl.type === 'CONNECTOR') {
    deps.deleteConnector(ctrl.id);
  } else if (ctrl.type === 'TEXTBOX') {
    deps.deleteTextBox(ctrl.id);
  } else if (ctrl.type === 'RECTANGLE') {
    deps.deleteRectangle(ctrl.id);
  }
};

// Delete/Backspace: lasso selection → multi-selection → single itemControls.
// Handled before the text-field guard so it always fires when a canvas
// selection exists (matches how diagram tools like Figma behave), but the
// multi-selection and single-item branches still respect text-field focus so
// editing input/panel text isn't hijacked. Returns true when consumed.
const handleDeleteOrBackspace = (
  e: KeyboardEvent,
  uiState: State['uiState'],
  deps: KeydownDeps
): boolean => {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return false;
  const mode = uiState.mode;

  if (
    (mode.type === 'LASSO' || mode.type === 'FREEHAND_LASSO') &&
    mode.selection?.items?.length
  ) {
    e.preventDefault();
    deps.deleteSelectedItems(mode.selection.items);
    uiState.actions.setMode({
      type: 'CURSOR',
      showCursor: true,
      mousedownItem: null
    });
    uiState.actions.clearSelection();
    return true;
  }

  // Multi-selection (CURSOR mode): delete every selected item.
  if (
    uiState.selectedIds.length > 1 &&
    !isEditableTarget(e.target as HTMLElement)
  ) {
    e.preventDefault();
    deps.deleteSelectedItems(uiState.selectedIds);
    uiState.actions.clearSelection();
    return true;
  }

  // Single-item (properties panel) delete.
  if (
    uiState.itemControls &&
    uiState.itemControls.type !== 'ADD_ITEM' &&
    !isEditableTarget(e.target as HTMLElement)
  ) {
    e.preventDefault();
    deleteItemControlsTarget(uiState, deps);
    uiState.actions.setItemControls(null);
    return true;
  }

  return false;
};

const makeInteractableCheck =
  (lockedIds: ReadonlySet<string>, visibleIds: ReadonlySet<string>) =>
  (id: string) =>
    !lockedIds.has(id) && (visibleIds.size === 0 || visibleIds.has(id));

// Ctrl+A target set: every visible + unlocked item in the active view,
// including connector waypoints (which aren't free — see
// getConnectorWaypointRefs). Respects ux-principles §4.3, mirroring lasso. ADR-0006.
const collectSelectableRefs = (
  scene: SceneApi,
  lockedIds: ReadonlySet<string>,
  visibleIds: ReadonlySet<string>
): ItemReference[] => {
  const isInteractable = makeInteractableCheck(lockedIds, visibleIds);
  const refs: ItemReference[] = [];
  for (const item of scene.items) {
    if (isInteractable(item.id)) refs.push({ type: 'ITEM', id: item.id });
  }
  for (const r of scene.rectangles) {
    if (isInteractable(r.id)) refs.push({ type: 'RECTANGLE', id: r.id });
  }
  for (const tb of scene.textBoxes) {
    if (isInteractable(tb.id)) refs.push({ type: 'TEXTBOX', id: tb.id });
  }
  for (const c of scene.connectors) {
    if (!isInteractable(c.id)) continue;
    refs.push({ type: 'CONNECTOR', id: c.id });
    refs.push(...getConnectorWaypointRefs(c));
  }
  return refs;
};

// Ctrl+A: select all interactable items, switching to CURSOR mode so the
// multi-selection visual + drag work. Reads scene/layer state via refs so the
// keydown effect's dep array stays stable (M-1 perf invariant). ADR-0006.
const handleSelectAll = (uiState: State['uiState'], deps: KeydownDeps) => {
  const { lockedIds, visibleIds } = deps.layerContextRef.current;
  const refs = collectSelectableRefs(
    deps.sceneRef.current,
    lockedIds,
    visibleIds
  );
  // Switch to CURSOR mode so the multi-selection visual + drag work.
  if (uiState.mode.type !== 'CURSOR') {
    uiState.actions.setMode({
      type: 'CURSOR',
      showCursor: true,
      mousedownItem: null
    });
  }
  uiState.actions.setSelectedIds(refs);
};

// Undo / redo (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z).
const handleHistoryShortcuts = (
  e: KeyboardEvent,
  isCtrlOrCmd: boolean,
  key: string,
  deps: KeydownDeps
) => {
  if (!isCtrlOrCmd) return;

  if (key === 'z' && !e.shiftKey) {
    e.preventDefault();
    if (deps.canUndo) {
      deps.undo();
    }
  }

  if (key === 'y' || (key === 'z' && e.shiftKey)) {
    e.preventDefault();
    if (deps.canRedo) {
      deps.redo();
    }
  }
};

// Clipboard (Ctrl+X / Ctrl+C / Ctrl+V).
const handleClipboardShortcuts = (
  e: KeyboardEvent,
  isCtrlOrCmd: boolean,
  key: string,
  deps: KeydownDeps
) => {
  if (!isCtrlOrCmd) return;

  if (key === 'x') {
    e.preventDefault();
    deps.handleCut();
  }

  if (key === 'c') {
    e.preventDefault();
    deps.handleCopy();
  }

  if (key === 'v') {
    e.preventDefault();
    deps.handlePaste();
  }
};

// F1 opens help; F2 hands off to canvas inline-rename — but only when the
// keystroke originated inside the renderer (MQA #13: F2 from the file-explorer
// tree row must not steal focus into a selected canvas node's editor).
const handleFunctionKeys = (
  e: KeyboardEvent,
  uiState: State['uiState'],
  deps: KeydownDeps
) => {
  if (e.key === 'F1') {
    e.preventDefault();
    uiState.actions.setDialog(DialogTypeEnum.HELP);
  }

  if (e.key === 'F2') {
    const ctrl = uiState.itemControls;
    // MQA #13: F2 originates from outside the renderer (e.g. file-explorer
    // tree row) when the user wants to rename a *diagram*. If a canvas item
    // happens to be selected, we used to steal focus by triggering the node
    // inline-rename — which unmounted the explorer's edit input. Only fire
    // the canvas inline-rename when the keystroke came from inside the
    // renderer (or from the document itself with no other focus target).
    const focusTarget = (e.target as HTMLElement | null) ?? null;
    const renderer = deps.rendererRef.current;
    const cameFromRenderer =
      !focusTarget ||
      focusTarget === document.body ||
      (renderer ? renderer.contains(focusTarget) : false);
    if (
      (ctrl?.type === 'ITEM' ||
        ctrl?.type === 'TEXTBOX' ||
        ctrl?.type === 'CONNECTOR') &&
      uiState.editorMode === 'EDITABLE' &&
      cameFromRenderer
    ) {
      e.preventDefault();
      window.dispatchEvent(
        new CustomEvent('inlineEditNodeName', { detail: { id: ctrl.id } })
      );
    }
  }
};

const TOOL_HOTKEY_ACTIONS = [
  'select',
  'pan',
  'addItem',
  'rectangle',
  'connector',
  'text',
  'lasso',
  'freehandLasso'
] as const;

type ToolHotkeyAction = (typeof TOOL_HOTKEY_ACTIONS)[number];

// Resolve a keystroke to the matching tool-hotkey action for the active
// profile, or null. First match wins (mirrors the original else-if order).
const resolveToolHotkey = (
  key: string,
  mapping: Record<ToolHotkeyAction, string | null>
): ToolHotkeyAction | null => {
  for (const action of TOOL_HOTKEY_ACTIONS) {
    if (mapping[action] && key === mapping[action]) return action;
  }
  return null;
};

// Tool-selection hotkeys (configurable per HOTKEY_PROFILES).
const handleToolHotkeys = (
  e: KeyboardEvent,
  uiState: State['uiState'],
  key: string,
  deps: KeydownDeps
) => {
  const mapping = HOTKEY_PROFILES[uiState.hotkeyProfile];
  const action = resolveToolHotkey(key, mapping);
  if (!action) return;
  e.preventDefault();

  switch (action) {
    case 'select':
      uiState.actions.setMode({
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: null
      });
      break;
    case 'pan':
      uiState.actions.setMode({
        type: 'PAN',
        showCursor: false
      });
      uiState.actions.setItemControls(null);
      break;
    case 'addItem':
      // Open Elements tab in the left dock
      uiState.actions.setActiveLeftTab('ELEMENTS');
      break;
    case 'rectangle':
      uiState.actions.setMode({
        type: 'RECTANGLE.DRAW',
        showCursor: true,
        id: null
      });
      break;
    case 'connector':
      uiState.actions.setMode({
        type: 'CONNECTOR',
        id: null,
        showCursor: true
      });
      break;
    case 'text': {
      const textBoxId = generateId();
      deps.createTextBox({
        ...TEXTBOX_DEFAULTS,
        id: textBoxId,
        tile: uiState.mouse.position.tile
      });
      uiState.actions.setMode({
        type: 'TEXTBOX',
        showCursor: false,
        id: textBoxId
      });
      break;
    }
    case 'lasso':
      uiState.actions.setMode({
        type: 'LASSO',
        showCursor: true,
        selection: null,
        isDragging: false
      });
      break;
    case 'freehandLasso':
      uiState.actions.setMode({
        type: 'FREEHAND_LASSO',
        showCursor: true,
        path: [],
        selection: null,
        isDragging: false
      });
      break;
  }
};

// Z-order: Ctrl+] bring forward, Ctrl+[ send backward (Tier-1 layer feature).
const handleZOrderShortcut = (
  e: KeyboardEvent,
  isCtrlOrCmd: boolean,
  uiState: State['uiState'],
  deps: KeydownDeps
) => {
  if (!isCtrlOrCmd || (e.key !== ']' && e.key !== '[')) return;
  const ctrl = uiState.itemControls;
  if (ctrl?.type !== 'ITEM') return;
  e.preventDefault();

  const modelState = deps.modelStoreApi.getState();
  const currentView = uiState.view
    ? modelState.views.find((v: { id: string }) => v.id === uiState.view)
    : undefined;
  const viewItem = currentView?.items?.find(
    (i: { id: string }) => i.id === ctrl.id
  );
  if (viewItem) {
    const currentZ = viewItem.zIndex ?? 0;
    const delta = e.key === ']' ? 1 : -1;
    deps.updateViewItem(ctrl.id, { zIndex: currentZ + delta });
  }
};

// Keyboard-pan unit vectors. Arrow keys match on the raw e.key; wasd / ijkl on
// the lowercased key. Each group is independently gated by panSettings.
const ARROW_PAN_VECTORS: Record<string, { x: number; y: number }> = {
  ArrowUp: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: -1 },
  ArrowLeft: { x: 1, y: 0 },
  ArrowRight: { x: -1, y: 0 }
};
const WASD_PAN_VECTORS: Record<string, { x: number; y: number }> = {
  w: { x: 0, y: 1 },
  s: { x: 0, y: -1 },
  a: { x: 1, y: 0 },
  d: { x: -1, y: 0 }
};
const IJKL_PAN_VECTORS: Record<string, { x: number; y: number }> = {
  i: { x: 0, y: 1 },
  k: { x: 0, y: -1 },
  j: { x: 1, y: 0 },
  l: { x: -1, y: 0 }
};

// Resolve a keystroke to a pan delta (in scroll units) given the enabled pan
// schemes. Last enabled match wins — mirrors the original sequential overwrite
// of panDx/panDy across the three setting blocks (the schemes use disjoint keys
// in practice, so order is immaterial).
const resolvePanDelta = (
  e: KeyboardEvent,
  key: string,
  panSettings: State['uiState']['panSettings']
): { x: number; y: number } | null => {
  const speed = panSettings.keyboardPanSpeed;
  let unit: { x: number; y: number } | undefined;
  if (panSettings.arrowKeysPan && ARROW_PAN_VECTORS[e.key]) {
    unit = ARROW_PAN_VECTORS[e.key];
  }
  if (panSettings.wasdPan && WASD_PAN_VECTORS[key]) {
    unit = WASD_PAN_VECTORS[key];
  }
  if (panSettings.ijklPan && IJKL_PAN_VECTORS[key]) {
    unit = IJKL_PAN_VECTORS[key];
  }
  if (!unit) return null;
  return { x: unit.x * speed, y: unit.y * speed };
};

// Keyboard pan (arrow / wasd / ijkl) — consolidated here from usePanHandlers.
const handleKeyboardPan = (e: KeyboardEvent, uiState: State['uiState']) => {
  const delta = resolvePanDelta(e, e.key.toLowerCase(), uiState.panSettings);
  if (!delta) return;
  e.preventDefault();
  const currentScroll = uiState.scroll;
  uiState.actions.setScroll({
    position: CoordsUtils.add(currentScroll.position, {
      x: delta.x,
      y: delta.y
    }),
    offset: currentScroll.offset
  });
};

export const useInteractionManager = () => {
  const rendererRef = useRef<HTMLElement | undefined>(undefined);
  const reducerTypeRef = useRef<string | undefined>(undefined);
  // Device class of the pointer for the in-flight gesture (ADR 0018). Set on
  // every pointer event before dispatch; read by processMouseUpdate (→ State)
  // and by onMouseEvent (to route touch/pen around the mouse-only pan handlers).
  // A ref, not store state, so it never re-renders the SceneLayers (perf §3.3).
  const pointerTypeRef = useRef<PointerKind>('mouse');
  // Touch/pen multi-pointer gesture state (ADR 0018 D-12). Held in a ref so it
  // survives effect re-runs and never triggers a render. phase: 'tap' is the
  // tentative single-finger state that promotes to 'pan' past TAP_SLOP_PX or
  // resolves to a tap on lift; 'pinch' is two-finger zoom+pan.
  const touchStateRef = useRef<TouchGestureState>({
    pointers: new Map(),
    phase: 'idle',
    downScreen: { x: 0, y: 0 },
    downTime: 0,
    lastPanScreen: { x: 0, y: 0 },
    pinchLastDistance: 0,
    pinchLastCentroid: { x: 0, y: 0 }
  });

  const modeType = useUiStateStore((state) => state.mode.type);
  const rendererEl = useUiStateStore((state) => state.rendererEl);

  const uiStateApi = useUiStateStoreApi();
  const modelStoreApi = useModelStoreApi();
  const scene = useScene();
  const layerContext = useLayerContext();
  // Ref mirrors of scene / layerContext for the keydown effect — keeps the
  // effect's dep array stable (M-1 perf invariant) while still letting Ctrl+A
  // and other handlers read live scene/layer data on each keypress.
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const layerContextRef = useRef(layerContext);
  layerContextRef.current = layerContext;
  // Single ResizeObserver for rendererEl — result is stored in the Zustand store
  // so UiOverlay and useDiagramUtils can read it without creating their own observers.
  const { size: rendererSize } = useResizeObserver(rendererEl);
  const { undo, redo, canUndo, canRedo } = useHistory();
  const { handleCopy, handleCut, handlePaste } = useCopyPaste();
  const { screenToTile } = useCanvasMode();
  const {
    createTextBox,
    deleteSelectedItems,
    deleteViewItem,
    deleteConnector,
    deleteTextBox,
    deleteRectangle,
    updateViewItem,
    commitDragTransaction
  } = scene;
  const {
    handleMouseDown: handlePanMouseDown,
    handleMouseMove: handlePanMouseMove,
    handleMouseUp: handlePanMouseUp
  } = usePanHandlers();
  const { scheduleUpdate, flushUpdate, cleanup } = useRAFThrottle();

  // Sync the single rendererEl measurement into the store so UiOverlay and
  // useDiagramUtils can read rendererSize without creating their own observers.
  useEffect(() => {
    uiStateApi.getState().actions.setRendererSize(rendererSize);
  }, [rendererSize, uiStateApi]);

  useEffect(() => {
    // Stable-per-effect-run bundle of the live store APIs + scene/history
    // callbacks the keydown helpers need. Rebuilt whenever the effect re-runs
    // (its members are the dep array below), so each helper sees current values.
    const deps: KeydownDeps = {
      uiStateApi,
      modelStoreApi,
      sceneRef,
      layerContextRef,
      rendererRef,
      undo,
      redo,
      canUndo,
      canRedo,
      handleCopy,
      handleCut,
      handlePaste,
      createTextBox,
      deleteSelectedItems,
      deleteViewItem,
      deleteConnector,
      deleteTextBox,
      deleteRectangle,
      updateViewItem,
      commitDragTransaction
    };

    // Thin dispatcher — the gesture order, fall-through semantics, and early
    // returns mirror the original ~380-line handler exactly. Each delegate
    // returns true only where the original `return`ed; the un-guarded calls
    // (history/clipboard/function-keys/hotkeys/z-order/pan) fall through just as
    // the original sequential `if` blocks did.
    const handleKeyDown = (e: KeyboardEvent) => {
      const uiState = uiStateApi.getState();

      if (handleEscapeKey(e, uiState, deps)) return;
      if (handleDeleteOrBackspace(e, uiState, deps)) return;
      if (isEditableTarget(e.target as HTMLElement)) return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      handleHistoryShortcuts(e, isCtrlOrCmd, key, deps);
      handleClipboardShortcuts(e, isCtrlOrCmd, key, deps);

      // Ctrl+A: select all visible + unlocked items in the active view. ADR-0006.
      if (isCtrlOrCmd && key === 'a') {
        e.preventDefault();
        handleSelectAll(uiState, deps);
        return;
      }

      handleFunctionKeys(e, uiState, deps);
      handleToolHotkeys(e, uiState, key, deps);
      handleZOrderShortcut(e, isCtrlOrCmd, uiState, deps);
      handleKeyboardPan(e, uiState);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      return window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    undo,
    redo,
    canUndo,
    canRedo,
    uiStateApi,
    modelStoreApi,
    createTextBox,
    deleteSelectedItems,
    deleteViewItem,
    deleteConnector,
    deleteTextBox,
    deleteRectangle,
    handleCopy,
    handleCut,
    handlePaste,
    updateViewItem,
    commitDragTransaction
  ]);

  const processMouseUpdate = useCallback(
    (nextMouse: Mouse, e: SlimMouseEvent) => {
      if (!rendererRef.current) return;

      const uiState = uiStateApi.getState();
      const model = modelStoreApi.getState();

      const mode = modes[uiState.mode.type];
      const modeFunction = getModeFunction(mode, e);

      if (!modeFunction) return;

      // Capture keyboard modifiers per mouse event so mode actions can branch
      // (e.g. Ctrl+click → toggle selection; Alt+click on waypoint → remove).
      // See ADR-0006.
      nextMouse.modifiers = {
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        meta: e.metaKey,
        alt: e.altKey
      };
      uiState.actions.setMouse(nextMouse);

      const { lockedIds, visibleIds } = layerContext;
      // An item is interactable only if its layer is unlocked AND visible.
      // `visibleIds.size === 0` is the "no layers configured" fallback (matches
      // the SceneLayers render guards). mqa-results.md #2.
      const isItemInteractable = (ref: { id: string; type?: unknown }) =>
        !lockedIds.has(ref.id) &&
        (visibleIds.size === 0 || visibleIds.has(ref.id));
      // Anchor overlay elements (data-anchor-id) need pointerEvents:'auto'
      // so MUI Tooltip can detect hover, but they're conceptually part of
      // the canvas — treat clicks on them as renderer interactions so
      // Cursor.mousedown still runs its anchor-hit logic.
      const target = e.target as HTMLElement | null;
      const anchorTargetEl =
        target && typeof target.closest === 'function'
          ? (target.closest('[data-anchor-id]') as HTMLElement | null)
          : null;
      const isAnchorOverlay = anchorTargetEl !== null;
      // Propagate the clicked anchor id via uiState.mouse so Cursor.mousedown
      // can identify which anchor was hit without a fragile tile-equality
      // check (the visual + hit ring extends beyond one tile at low zoom).
      nextMouse.targetAnchorId =
        anchorTargetEl?.dataset.anchorId ?? null;
      const baseState: State = {
        model,
        scene,
        uiState,
        rendererRef: rendererRef.current,
        rendererSize,
        isRendererInteraction:
          rendererRef.current === e.target || isAnchorOverlay,
        isItemInteractable,
        pointerType: pointerTypeRef.current,
        screenToTile
      };

      if (reducerTypeRef.current !== uiState.mode.type) {
        const prevReducer = reducerTypeRef.current
          ? modes[reducerTypeRef.current]
          : null;

        if (prevReducer && prevReducer.exit) {
          prevReducer.exit(baseState);
        }

        if (mode.entry) {
          mode.entry(baseState);
        }
      }

      modeFunction(baseState);
      reducerTypeRef.current = uiState.mode.type;
    },
    [uiStateApi, modelStoreApi, scene, rendererSize, layerContext, screenToTile]
  );

  const onMouseEvent = useCallback(
    (e: SlimMouseEvent) => {
      if (!rendererRef.current) return;

      // usePanHandlers is e.button-shaped (mouse-only): a touch/pen pointerdown
      // carries button:0 and would trip emptyAreaClickPan. Touch/pen navigation
      // (one-finger pan, two-finger pinch) is owned by the touch state machine
      // (ADR 0018 D-12), so route non-mouse pointers straight to the dispatcher.
      const isMousePointer = pointerTypeRef.current === 'mouse';

      if (isMousePointer && e.type === 'mousedown' && handlePanMouseDown(e)) {
        // Still update mouse state so Pan mode can track mousedown position for drag
        const uiState = uiStateApi.getState();
        const nextMouse = getMouse({
          interactiveElement: rendererRef.current,
          zoom: uiState.zoom,
          scroll: uiState.scroll,
          lastMouse: uiState.mouse,
          mouseEvent: e,
          rendererSize,
          screenToTileFn: screenToTile
        });
        uiState.actions.setMouse(nextMouse);
        return;
      }
      if (isMousePointer && e.type === 'mouseup' && handlePanMouseUp(e)) {
        return;
      }

      const uiState = uiStateApi.getState();

      const nextMouse = getMouse({
        interactiveElement: rendererRef.current,
        zoom: uiState.zoom,
        scroll: uiState.scroll,
        lastMouse: uiState.mouse,
        mouseEvent: e,
        rendererSize,
        screenToTileFn: screenToTile
      });

      if (e.type === 'mousemove') {
        scheduleUpdate(nextMouse, e, (update) => {
          // handlePanMouseMove returns true while right button is held below threshold —
          // suppress processMouseUpdate to prevent Cursor.mousemove triggering lasso.
          // Mouse-only (see isMousePointer above).
          if (isMousePointer && handlePanMouseMove(update.event)) {
            return;
          }
          processMouseUpdate(update.mouse, update.event);
        });
      } else {
        flushUpdate();
        processMouseUpdate(nextMouse, e);
      }
    },
    [
      uiStateApi,
      rendererSize,
      screenToTile,
      handlePanMouseDown,
      handlePanMouseMove,
      handlePanMouseUp,
      scheduleUpdate,
      flushUpdate,
      processMouseUpdate
    ]
  );

  const onContextMenu = useCallback(
    (e: SlimMouseEvent) => {
      e.preventDefault();
      const uiState = uiStateApi.getState();
      // During a touch/pen carry, a long-press contextmenu must not raise the OS
      // menu or open the action bar — suppress entirely (ADR 0018 guardrail 3).
      if (uiState.mode.type === 'CARRY_ITEM') return;
      const tile = uiState.mouse.position.tile;
      const item = getItemAtTile({ tile, scene });
      // Locked or hidden items are non-interactive (mqa-results.md #2) — fall
      // through to the empty-canvas branch so right-click can't open their
      // action bar.
      const { lockedIds, visibleIds } = layerContext;
      const itemIsInteractable =
        !!item &&
        !lockedIds.has(item.id) &&
        (visibleIds.size === 0 || visibleIds.has(item.id));
      if (item && itemIsInteractable) {
        // Right-click on an item selects it AND opens the floating action bar.
        // This is the only path that opens the bar — left-click only selects
        // (mqa-results.md #1).
        const controls: ItemControls =
          item.type === 'CONNECTOR'
            ? { type: 'CONNECTOR', id: item.id, tile }
            : { type: item.type, id: item.id };
        uiState.actions.setItemControls(controls);
        uiState.actions.setItemActionBarOpen(true);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional fine-grained deps on the layerContext Sets read here; whole layerContext over-invalidates
    [uiStateApi, scene, layerContext.lockedIds, layerContext.visibleIds]
  );

  useEffect(() => {
    if (modeType === 'INTERACTIONS_DISABLED') return;
    // No rendererEl yet (first paint) — nothing to bind to. The effect re-runs
    // once setRendererEl lands the container.
    if (!rendererEl) return;

    // The interactions Box. setPointerCapture is taken on IT (not the container)
    // so e.target retargets to it mid-gesture and the isRendererInteraction gate
    // (=== interactions box) stays true across element boundaries — replacing
    // the old "moves fire on window" property (ADR 0018; behavior-map §0.2).
    const interactionsEl = rendererRef.current;

    // PointerEvent → mouse-shaped SlimMouseEvent. SlimMouseEvent stays the single
    // internal adapter every mode is written against — PointerEvent is NOT leaked
    // into modes (behavior-map §0). pointerType travels via pointerTypeRef.
    const toSlim = (
      e: PointerEvent,
      type: 'mousedown' | 'mousemove' | 'mouseup'
    ): SlimMouseEvent => ({
      clientX: e.clientX,
      clientY: e.clientY,
      target: e.target,
      type,
      preventDefault: () => e.preventDefault(),
      button: e.button,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey
    });

    const releaseCapture = (e: PointerEvent) => {
      if (interactionsEl && interactionsEl.hasPointerCapture?.(e.pointerId)) {
        try {
          interactionsEl.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
      }
    };

    // ─── touch / pen gesture machine (ADR 0018 Decision 4 + D-12) ────────────
    // Owned entirely here so the pointerType branch stays in one place: pan +
    // pinch drive setScroll/setZoom straight through the store (render-free),
    // and taps are forwarded to the mode dispatcher as a synthetic mouse click
    // so SELECT reuses the existing Cursor path (preserving I-1/I-2/I-3).

    // A canvas-targeted, mouse-shaped event for forwarding a touch tap. target
    // is the interactions box so isRendererInteraction holds for the dispatch.
    const tapEvent = (
      e: PointerEvent,
      type: 'mousedown' | 'mousemove' | 'mouseup'
    ): SlimMouseEvent => ({
      clientX: e.clientX,
      clientY: e.clientY,
      target: interactionsEl ?? e.target,
      type,
      preventDefault: () => e.preventDefault(),
      button: 0,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey
    });

    // Abort an in-flight carry (pointercancel / 2nd finger): the node stays at
    // its origin (model was never written — D-2, node carry only). Return to
    // SELECT with the node still selected.
    const abortCarry = () => {
      const uiState = uiStateApi.getState();
      if (uiState.mode.type !== 'CARRY_ITEM') return;
      const { item } = uiState.mode;
      uiState.actions.setMode({
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: null
      });
      if (uiState.actions.setSelectedIds) {
        uiState.actions.setSelectedIds([{ type: item.type, id: item.id }]);
      }
    };

    const handleTouchTap = (e: PointerEvent) => {
      const before = uiStateApi.getState();
      // A mousemove seeds uiState.mouse.position BEFORE the mousedown — the mode
      // reducers read the position from the uiState snapshot captured at the top
      // of processMouseUpdate, which is stale until a move/down updates the
      // store. Real flows (and CanvasPOM.clickAt) always send a move first; the
      // mousedown's flushUpdate processes this seed synchronously.
      // While carrying, any tap places the node (CARRY_ITEM.mouseup).
      if (before.mode.type === 'CARRY_ITEM') {
        onMouseEvent(tapEvent(e, 'mousemove'));
        onMouseEvent(tapEvent(e, 'mousedown'));
        onMouseEvent(tapEvent(e, 'mouseup'));
        return;
      }
      // mousedown resolves the tapped tile + item (Cursor sets mousedownItem,
      // filtered through isItemInteractable).
      const preSelection = before.selectedIds ?? [];
      onMouseEvent(tapEvent(e, 'mousemove'));
      onMouseEvent(tapEvent(e, 'mousedown'));
      const afterDown = uiStateApi.getState();
      const tappedItem =
        afterDown.mode.type === 'CURSOR'
          ? afterDown.mode.mousedownItem
          : null;
      const decision = decideTouchTap({
        modeType: afterDown.mode.type,
        tappedItem,
        selectedIds: preSelection,
        // Cursor.mousedown already applied isItemInteractable when setting
        // mousedownItem, so a present tappedItem is interactable.
        isInteractable: !!tappedItem
      });
      if (decision === 'grab' && tappedItem) {
        // GRAB — enter the carry state; do not complete the click.
        afterDown.actions.setMode({
          type: 'CARRY_ITEM',
          showCursor: true,
          item: { type: tappedItem.type, id: tappedItem.id }
        });
        return;
      }
      // SELECT (or reconnect/other mode entered on mousedown) — complete the
      // click so Cursor.mouseup resolves selection / clears.
      onMouseEvent(tapEvent(e, 'mouseup'));
    };

    // RAF-coalesce touch pan/pinch to ≤1 store write per frame (perf §3.7 —
    // pointermove fires far denser than the frame rate).
    let touchRaf: number | null = null;
    const runTouchFrame = () => {
      touchRaf = null;
      const ts = touchStateRef.current;
      const uiState = uiStateApi.getState();
      const pts = [...ts.pointers.values()];

      if (ts.phase === 'pinch' && pts.length >= 2) {
        const dist = pointerDistance(pts[0], pts[1]);
        const centroid = pointerCentroid(pts[0], pts[1]);
        if (ts.pinchLastDistance > 0 && interactionsEl && rendererSize) {
          const rect = interactionsEl.getBoundingClientRect();
          const oldZoom = uiState.zoom;
          const scaleRatio = dist / ts.pinchLastDistance;
          const newZoom = Math.max(
            MIN_ZOOM,
            Math.min(MAX_ZOOM, oldZoom * scaleRatio)
          );
          // Anchor the world point under the OLD centroid to the NEW centroid at
          // the new zoom — this folds zoom-to-centroid + two-finger pan into one
          // transform (mirrors the wheel zoom-to-cursor math).
          const oldRelX =
            ts.pinchLastCentroid.x - rect.left - rendererSize.width / 2;
          const oldRelY =
            ts.pinchLastCentroid.y - rect.top - rendererSize.height / 2;
          const newRelX = centroid.x - rect.left - rendererSize.width / 2;
          const newRelY = centroid.y - rect.top - rendererSize.height / 2;
          const worldX = (oldRelX - uiState.scroll.position.x) / oldZoom;
          const worldY = (oldRelY - uiState.scroll.position.y) / oldZoom;
          uiState.actions.setZoom(newZoom);
          uiState.actions.setScroll({
            position: {
              x: newRelX - worldX * newZoom,
              y: newRelY - worldY * newZoom
            },
            offset: uiState.scroll.offset
          });
        }
        ts.pinchLastDistance = dist;
        ts.pinchLastCentroid = centroid;
        return;
      }

      if (ts.phase === 'pan' && pts.length >= 1) {
        const cur = pts[pts.length - 1];
        const dx = cur.x - ts.lastPanScreen.x;
        const dy = cur.y - ts.lastPanScreen.y;
        ts.lastPanScreen = { x: cur.x, y: cur.y };
        uiState.actions.setScroll({
          position: {
            x: uiState.scroll.position.x + dx,
            y: uiState.scroll.position.y + dy
          },
          offset: uiState.scroll.offset
        });
      }
    };
    const scheduleTouchFrame = () => {
      if (touchRaf === null) touchRaf = requestAnimationFrame(runTouchFrame);
    };

    const onTouchPointerDown = (e: PointerEvent) => {
      const ts = touchStateRef.current;
      ts.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (interactionsEl) {
        try {
          interactionsEl.setPointerCapture(e.pointerId);
        } catch {
          /* synthetic / inactive pointer */
        }
      }

      if (ts.pointers.size >= 2) {
        // Second finger. During a carry it aborts (Decision 6 precedence);
        // otherwise it begins a pinch (suspending any single-finger pan).
        if (uiStateApi.getState().mode.type === 'CARRY_ITEM') {
          abortCarry();
          ts.phase = 'idle';
          return;
        }
        const pts = [...ts.pointers.values()];
        ts.phase = 'pinch';
        ts.pinchLastDistance = pointerDistance(pts[0], pts[1]);
        ts.pinchLastCentroid = pointerCentroid(pts[0], pts[1]);
        return;
      }

      // First finger — tentative tap until it moves past the slop or lifts.
      ts.phase = 'tap';
      ts.downScreen = { x: e.clientX, y: e.clientY };
      ts.downTime = Date.now();
      ts.lastPanScreen = { x: e.clientX, y: e.clientY };
    };

    const onTouchPointerMove = (e: PointerEvent) => {
      const ts = touchStateRef.current;
      if (!ts.pointers.has(e.pointerId)) return;
      ts.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (ts.phase === 'tap') {
        // Promote to pan once past the slop radius (graceful: a 2nd finger
        // landing already switched phase to 'pinch' before this runs).
        if (exceedsTapSlop(ts.downScreen, { x: e.clientX, y: e.clientY })) {
          ts.phase = 'pan';
          ts.lastPanScreen = { x: e.clientX, y: e.clientY };
        } else {
          return;
        }
      }
      if (ts.phase === 'pan' || ts.phase === 'pinch') scheduleTouchFrame();
    };

    const onTouchPointerUp = (e: PointerEvent) => {
      const ts = touchStateRef.current;
      const wasPhase = ts.phase;
      const upPos = { x: e.clientX, y: e.clientY };
      ts.pointers.delete(e.pointerId);
      releaseCapture(e);

      if (wasPhase === 'pinch') {
        // Lift back to one finger → resume single-finger pan (not a tap; the
        // gesture already moved). Two fingers gone → idle.
        if (ts.pointers.size === 1) {
          const remaining = [...ts.pointers.values()][0];
          ts.phase = 'pan';
          ts.lastPanScreen = { x: remaining.x, y: remaining.y };
        } else {
          ts.phase = 'idle';
        }
        return;
      }
      if (wasPhase === 'pan') {
        if (ts.pointers.size === 0) ts.phase = 'idle';
        return;
      }
      if (wasPhase === 'tap') {
        ts.phase = 'idle';
        const isTap = isTapGesture({
          downScreen: ts.downScreen,
          upScreen: upPos,
          downTime: ts.downTime,
          upTime: Date.now(),
          slop: TAP_SLOP_PX,
          timeMs: TAP_TIME_MS
        });
        if (isTap) handleTouchTap(e);
      }
    };

    const onTouchPointerCancel = (e: PointerEvent) => {
      const ts = touchStateRef.current;
      ts.pointers.delete(e.pointerId);
      releaseCapture(e);
      // OS reclaimed the gesture mid-carry → abort (node stays at origin).
      abortCarry();
      if (ts.pointers.size === 0) ts.phase = 'idle';
    };

    // True when the pointerdown landed on the canvas (the interactions box, a
    // node, an anchor — anything inside the Renderer container). Listeners are
    // on `window`, so we must NOT capture/engage for off-canvas presses
    // (toolbar/panel buttons) — capturing those would steal the click.
    const downOnCanvas = (e: PointerEvent): boolean => {
      const t = e.target as Node | null;
      return (
        !!rendererEl &&
        !!t &&
        (rendererEl === t || rendererEl.contains(t))
      );
    };

    const onPointerDown = (e: PointerEvent) => {
      const kind = (e.pointerType || 'mouse') as PointerKind;
      pointerTypeRef.current = kind;
      const onCanvas = downOnCanvas(e);
      if (kind !== 'mouse') {
        // Off-canvas touch (toolbar/panel) is left to the element's own compat
        // mouse events — the touch gesture machine only owns canvas presses.
        if (onCanvas) onTouchPointerDown(e);
        return;
      }
      // Mouse path — unchanged press-drag-release. Capture only canvas-initiated
      // gestures (keeps isRendererInteraction true mid-drag); an off-canvas press
      // (e.g. an Elements-panel drag-to-place) is NOT captured so its events
      // still flow to window and the button/panel keeps working. Throws
      // harmlessly for synthetic e2e events (which already target the box).
      if (onCanvas && interactionsEl) {
        try {
          interactionsEl.setPointerCapture(e.pointerId);
        } catch {
          /* synthetic / inactive pointer */
        }
      }
      onMouseEvent(toSlim(e, 'mousedown'));
    };

    const onPointerMove = (e: PointerEvent) => {
      const kind = (e.pointerType || 'mouse') as PointerKind;
      pointerTypeRef.current = kind;
      if (kind !== 'mouse') {
        onTouchPointerMove(e);
        return;
      }
      onMouseEvent(toSlim(e, 'mousemove'));
    };

    const onPointerUp = (e: PointerEvent) => {
      const kind = (e.pointerType || 'mouse') as PointerKind;
      pointerTypeRef.current = kind;
      if (kind !== 'mouse') {
        onTouchPointerUp(e);
        return;
      }
      onMouseEvent(toSlim(e, 'mouseup'));
      releaseCapture(e);
    };

    // pointercancel (OS reclaims the gesture: scroll/zoom/edge-swipe/app-switch).
    const onPointerCancel = (e: PointerEvent) => {
      const kind = (e.pointerType || 'mouse') as PointerKind;
      pointerTypeRef.current = kind;
      if (kind !== 'mouse') {
        onTouchPointerCancel(e);
        return;
      }
      // Mouse: end the gesture cleanly so no mode is left mid-drag.
      onMouseEvent(toSlim(e, 'mouseup'));
      releaseCapture(e);
    };

    const onScroll = (e: WheelEvent) => {
      const uiState = uiStateApi.getState();
      const zoomToCursor = uiState.zoomSettings.zoomToCursor;
      const oldZoom = uiState.zoom;

      let newZoom: number;
      if (e.deltaY > 0) {
        newZoom = decrementZoom(oldZoom);
      } else {
        newZoom = incrementZoom(oldZoom);
      }

      if (newZoom === oldZoom) {
        return;
      }

      if (zoomToCursor && rendererRef.current && rendererSize) {
        const rect = rendererRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const mouseRelativeToCenterX = mouseX - rendererSize.width / 2;
        const mouseRelativeToCenterY = mouseY - rendererSize.height / 2;

        const worldX =
          (mouseRelativeToCenterX - uiState.scroll.position.x) / oldZoom;
        const worldY =
          (mouseRelativeToCenterY - uiState.scroll.position.y) / oldZoom;

        const newScrollX = mouseRelativeToCenterX - worldX * newZoom;
        const newScrollY = mouseRelativeToCenterY - worldY * newZoom;

        uiState.actions.setZoom(newZoom);
        uiState.actions.setScroll({
          position: {
            x: newScrollX,
            y: newScrollY
          },
          offset: uiState.scroll.offset
        });
      } else {
        uiState.actions.setZoom(newZoom);
      }
    };

    const onDragStart = (e: DragEvent) => e.preventDefault();

    // One Pointer Events layer. The mouse `mousedown/move/up` listeners +
    // touch→mouse synthesis are GONE (REPLACE, not ADD) — `pointerType` carries
    // the device class natively, so the (0,0) drop bug and the synthesis layer
    // disappear by construction.
    //
    // Bound to `window`, NOT `rendererEl`. ADR 0018 specified the Renderer
    // container as the surface, but a mouse drag that STARTS off-canvas — the
    // Elements-panel drag-to-place, or a node drag released over a panel — takes
    // implicit pointer capture to the off-canvas element, so its move/up events
    // retarget there and bubble to `window`, never reaching `rendererEl`.
    // `setPointerCapture` (taken on the interactions box for canvas-initiated
    // gestures) cannot help a gesture the canvas never saw start. `window` is a
    // superset of the container, so it also covers the sibling anchor/label
    // SceneLayers the ADR's rendererEl correction cared about, and the
    // `isRendererInteraction` gate still scopes canvas reactions. The four CSS
    // guardrails stay on the container (Phase B). See the deviation note in the
    // tactical wrap-up. wheel/dragstart stay on `rendererEl` (canvas-scoped).
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('contextmenu', onContextMenu);
    rendererEl.addEventListener('wheel', onScroll, { passive: true });
    rendererEl.addEventListener('dragstart', onDragStart);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('contextmenu', onContextMenu);
      rendererEl.removeEventListener('wheel', onScroll);
      rendererEl.removeEventListener('dragstart', onDragStart);
      if (touchRaf !== null) cancelAnimationFrame(touchRaf);
      cleanup();
    };
  }, [
    modeType,
    onMouseEvent,
    onContextMenu,
    rendererEl,
    rendererSize,
    uiStateApi,
    cleanup
  ]);

  const setInteractionsElement = useCallback((element: HTMLElement) => {
    rendererRef.current = element;
  }, []);

  return {
    setInteractionsElement
  };
};
