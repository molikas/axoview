import { Coords, Size, EditorModeEnum } from './common';
import { Icon } from './model';
import { ItemReference } from './scene';
import { ZoomSettings, LabelSettings } from './settings';
import { IconPackManagerProps, IconUsageScan } from './axoviewProps';

interface AddItemControls {
  type: 'ADD_ITEM';
}

export type ItemControls = (ItemReference & { tile?: Coords }) | AddItemControls;

export interface Mouse {
  position: {
    screen: Coords;
    tile: Coords;
  };
  mousedown: {
    screen: Coords;
    tile: Coords;
  } | null;
  delta: {
    screen: Coords;
    tile: Coords;
  } | null;
  /**
   * Most recent keyboard modifiers seen on a canvas mouse event. Optional so
   * existing test mocks that construct a Mouse object continue to compile.
   * Mode actions read this to branch on Ctrl/Shift/Meta without needing the
   * event passed through every layer.
   */
  modifiers?: {
    ctrl: boolean;
    shift: boolean;
    meta: boolean;
    alt: boolean;
  };
  /**
   * data-anchor-id of the DOM element under the cursor, if any. Captured by
   * useInteractionManager from each mouse event's target so mode actions can
   * identify the clicked connector anchor by id rather than by tile match
   * (the tile match is fragile near boundaries and at low zoom).
   */
  targetAnchorId?: string | null;
}

// Mode types
export interface InteractionsDisabled {
  type: 'INTERACTIONS_DISABLED';
  showCursor: boolean;
}

export interface CursorMode {
  type: 'CURSOR';
  showCursor: boolean;
  mousedownItem: ItemReference | null;
  mousedownHandled?: boolean;
}

export interface DragItemsMode {
  type: 'DRAG_ITEMS';
  showCursor: boolean;
  items: ItemReference[];
  initialTiles: Record<string, Coords>; // nodes + textboxes: id -> tile at drag start
  initialRectangles: Record<string, { from: Coords; to: Coords }>; // rectangles: id -> bounds at drag start
}

export interface PanMode {
  type: 'PAN';
  showCursor: boolean;
}

export interface PlaceIconMode {
  type: 'PLACE_ICON';
  showCursor: boolean;
  id: string | null;
  /**
   * Touch only: hide the drag-preview ghost until the drag actually engages.
   * On touch there is no hover, so an armed placement would otherwise paint the
   * ghost at a stale tile the moment the panel icon is tapped (before any drag).
   * The touch machine sets this true on palette-arm and clears it on first move.
   * Undefined on desktop (hover keeps the preview position fresh), so the ghost
   * shows as before.
   */
  suppressPreview?: boolean;
}

export interface ConnectorMode {
  type: 'CONNECTOR';
  showCursor: boolean;
  id: string | null;
  // For click-based connection mode
  startAnchor?: {
    tile?: Coords;
    itemId?: string;
  };
  isConnecting?: boolean;
  // When true, completing a connection returns to CURSOR mode instead of staying in CONNECTOR
  returnToCursor?: boolean;
}

export interface DrawRectangleMode {
  type: 'RECTANGLE.DRAW';
  showCursor: boolean;
  id: string | null;
}

export const AnchorPositionOptions = {
  BOTTOM_LEFT: 'BOTTOM_LEFT',
  BOTTOM_RIGHT: 'BOTTOM_RIGHT',
  TOP_RIGHT: 'TOP_RIGHT',
  TOP_LEFT: 'TOP_LEFT'
} as const;

export type AnchorPosition = keyof typeof AnchorPositionOptions;

export interface TransformRectangleMode {
  type: 'RECTANGLE.TRANSFORM';
  showCursor: boolean;
  id: string;
  selectedAnchor: AnchorPosition | null;
}

export interface TextBoxMode {
  type: 'TEXTBOX';
  showCursor: boolean;
  id: string | null;
}

export interface LassoMode {
  type: 'LASSO';
  showCursor: boolean;
  selection: {
    startTile: Coords;
    endTile: Coords;
    items: ItemReference[];
  } | null;
  isDragging: boolean;
}

export interface FreehandLassoMode {
  type: 'FREEHAND_LASSO';
  showCursor: boolean;
  path: Coords[]; // Screen coordinates of the drawn path
  selection: {
    pathTiles: Coords[]; // Tile coordinates of the path points
    items: ItemReference[];
  } | null;
  isDragging: boolean;
}

export interface ReconnectAnchorMode {
  type: 'RECONNECT_ANCHOR';
  showCursor: boolean;
  connectorId: string;
  anchorId: string;
  anchorIndex: number;
}

export type Mode =
  | InteractionsDisabled
  | CursorMode
  | PanMode
  | PlaceIconMode
  | ConnectorMode
  | DrawRectangleMode
  | TransformRectangleMode
  | DragItemsMode
  | TextBoxMode
  | LassoMode
  | FreehandLassoMode
  | ReconnectAnchorMode;
// End mode types

export interface Scroll {
  position: Coords;
  offset: Coords;
}

export interface IconCollectionState {
  id?: string;
  isExpanded: boolean;
}

export type IconCollectionStateWithIcons = IconCollectionState & {
  icons: Icon[];
};

export const DialogTypeEnum = {
  EXPORT_IMAGE: 'EXPORT_IMAGE',
  HELP: 'HELP',
  SETTINGS: 'SETTINGS'
} as const;

export type ConnectorInteractionMode = 'click' | 'drag';

export interface Notification {
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

export type CanvasMode = 'ISOMETRIC' | '2D';

export interface UiState {
  view: string;
  editorMode: keyof typeof EditorModeEnum;
  iconCategoriesState: IconCollectionState[];
  /**
   * Ids of icon categories that became visible during the most recent
   * incremental load (e.g. a pack toggled on from the "Add more icons" panel).
   * Drives the soft pulse on the category header so users notice freshly-arrived
   * icons. Cleared on a short timer after the animation runs.
   */
  freshlyLoadedCategoryIds: string[];
  mode: Mode;
  dialog: keyof typeof DialogTypeEnum | null;
  itemControls: ItemControls | null;
  /**
   * Persistent multi-selection on the canvas. Single source of truth for which
   * items are selected. Invariant: when length === 1, itemControls mirrors the
   * single selected item; when 0 or > 1, itemControls is null. See ADR-0006.
   */
  selectedIds: ItemReference[];
  zoom: number;
  scroll: Scroll;
  mouse: Mouse;
  rendererEl: HTMLDivElement | null;
  rendererSize: Size;
  enableDebugTools: boolean;
  zoomSettings: ZoomSettings;
  labelSettings: LabelSettings;
  connectorInteractionMode: ConnectorInteractionMode;
  expandLabels: boolean;
  /**
   * Opt-in "keep labels readable" toggle (ADR 0015). When on, node name labels
   * counter-scale up to a legible floor below a zoom threshold so they stay
   * readable when zoomed out. Off by default; persisted across reload.
   */
  readableLabels: boolean;
  iconPackManager: IconPackManagerProps | null;
  iconUsageScan: IconUsageScan | null;
  linkedDiagrams: Array<{ id: string; name: string }>;
  notification: Notification | null;
  activeLeftTab: 'ELEMENTS' | 'LAYERS' | null;
  rightSidebarOpen: boolean;
  /** true when the right sidebar was opened automatically by node selection (not manually pinned) */
  rightSidebarAutoOpened: boolean;
  /**
   * Floating NodeActionBar visibility. The bar is opened by an explicit
   * right-click on an item (mqa-results.md #1), not by every left-click
   * selection. Cleared whenever the selection changes or is dismissed.
   */
  itemActionBarOpen: boolean;
  /**
   * Canvas context menu (ADR 0027) — the per-item / empty-canvas command
   * surface. `null` = closed. Opened by a right-click TAP (mouse) or a touch
   * long-press; right-DRAG pans instead (ADR 0022 §1). `target` is the item the
   * menu acts on, or `null` for the empty-canvas menu. `anchor` is screen-space
   * (client px) — the MUI Menu portals to the document root, so no §8.8
   * counter-scale is needed.
   */
  contextMenu: ContextMenuState | null;
  /** true when model has changed since last export-to-file or explicit save */
  isDirty: boolean;
  canvasMode: CanvasMode;
  /**
   * Preview-mode (EXPLORABLE_READONLY) layer visibility override (ADR 0013).
   * A UI-only override that never mutates the model's `layer.visible` and is
   * never persisted/saved — presenting a diagram can't dirty it. Cleared when
   * leaving preview or switching view. Ignored entirely in EDITABLE.
   */
  previewLayerOverrides: PreviewLayerOverrides;
  /** Ephemeral annotation overlay (ADR 0014). Never persisted. */
  annotation: AnnotationState;
}

/** Canvas context-menu state (ADR 0027). */
export interface ContextMenuState {
  /** Screen-space anchor (client px) for the MUI Menu's anchorPosition. */
  anchor: { x: number; y: number };
  /** The item the menu commands act on; `null` → empty-canvas menu. */
  target: ItemReference | null;
}

/** UI-only preview layer override (ADR 0013). */
export interface PreviewLayerOverrides {
  /** Layers the presenter has toggled off (subtracted from `layer.visible`). */
  hiddenLayerIds: string[];
  /** When set, only this layer is shown (solo wins over hidden + layer.visible). */
  soloLayerId: string | null;
}

// --- Ephemeral annotation overlay (ADR 0014) --------------------------------

/**
 * Annotation tool modes. `select` is the pass-through mode — the overlay does
 * not capture pointer input, so the canvas stays interactive (Excalidraw-style
 * tool strip). `eraser` removes a whole stroke; the rest draw.
 */
export type AnnotationTool =
  | 'select'
  | 'pencil'
  | 'highlighter'
  | 'line'
  | 'arrow'
  | 'rectangle'
  | 'ellipse'
  | 'eraser';

/** A single annotation stroke, stored in scene-canvas coordinates. */
export interface AnnotationStroke {
  id: string;
  tool: Exclude<AnnotationTool, 'select' | 'eraser'>;
  color: string;
  thickness: number;
  /** Scene-canvas points: freehand = many; line/arrow/shapes = [start, end]. */
  points: Coords[];
}

/**
 * Ephemeral annotation state (ADR 0014). Session-scoped, in-memory, and
 * **never** persisted — it lives only in uiState, never in the Model, so no
 * save/export/zip path can reach it. `open` is the single pen-driven toggle:
 * open ⇒ palette + drawing shown; closed ⇒ both hidden but strokes retained
 * (close ≠ discard; only Clear wipes). `tool` decides whether the overlay
 * captures input (`select` = canvas interactive).
 */
export interface AnnotationState {
  open: boolean;
  tool: AnnotationTool;
  color: string;
  thickness: number;
  strokes: AnnotationStroke[];
  /** Strokes available to redo (cleared by any new stroke / erase / clear). */
  redoStack: AnnotationStroke[];
}

export interface UiStateActions {
  setView: (view: string) => void;
  setEditorMode: (mode: keyof typeof EditorModeEnum) => void;
  setIconCategoriesState: (iconCategoriesState: IconCollectionState[]) => void;
  setFreshlyLoadedCategoryIds: (ids: string[]) => void;
  resetUiState: () => void;
  setMode: (mode: Mode) => void;
  incrementZoom: () => void;
  decrementZoom: () => void;
  setDialog: (dialog: keyof typeof DialogTypeEnum | null) => void;
  setZoom: (zoom: number) => void;
  setScroll: (scroll: Scroll) => void;
  /**
   * Sets the item the right Properties panel + action bar target.
   *
   * `options.openPanel` (default `true`) mounts the Properties dock — the
   * explicit "open details" gesture (double-click / panel events / layer-row
   * double-click). Pass `false` for **select-only** (ADR 0022 §3): the panel
   * target + action bar update, but the dock is NOT mounted. Passing `null`
   * always clears.
   */
  setItemControls: (
    itemControls: ItemControls | null,
    options?: { openPanel?: boolean }
  ) => void;
  /**
   * Replaces the current canvas selection. Internally derives itemControls
   * (single-item case) or clears it (empty / multi-select). Per ADR 0022 §3 a
   * single selection drives highlight + action bar only — it no longer mounts
   * the Properties panel (that is the double-click / setItemControls path).
   */
  setSelectedIds: (ids: ItemReference[]) => void;
  /** Adds the item if absent, removes it if present. Updates itemControls accordingly. */
  toggleSelected: (ref: ItemReference) => void;
  /** Convenience: clears selectedIds and itemControls. */
  clearSelection: () => void;
  setMouse: (mouse: Mouse) => void;
  setRendererEl: (el: HTMLDivElement) => void;
  setRendererSize: (size: Size) => void;
  setEnableDebugTools: (enabled: boolean) => void;
  setZoomSettings: (settings: ZoomSettings) => void;
  setLabelSettings: (settings: LabelSettings) => void;
  setConnectorInteractionMode: (mode: ConnectorInteractionMode) => void;
  setExpandLabels: (expand: boolean) => void;
  setReadableLabels: (readable: boolean) => void;
  /** Toggle a layer's preview visibility override (no-op on the model). */
  togglePreviewLayerHidden: (layerId: string) => void;
  /** Solo a layer in preview (pass the current solo id again, or null, to clear). */
  setPreviewSoloLayer: (layerId: string | null) => void;
  /** Reset all preview layer overrides (e.g. on leaving preview / view switch). */
  clearPreviewLayerOverrides: () => void;
  // --- Annotation overlay (ADR 0014) ---
  setAnnotationOpen: (open: boolean) => void;
  setAnnotationTool: (tool: AnnotationTool) => void;
  setAnnotationColor: (color: string) => void;
  setAnnotationThickness: (thickness: number) => void;
  addAnnotationStroke: (stroke: AnnotationStroke) => void;
  undoAnnotationStroke: () => void;
  redoAnnotationStroke: () => void;
  eraseAnnotationStroke: (id: string) => void;
  clearAnnotations: () => void;
  setIconPackManager: (iconPackManager: IconPackManagerProps | null) => void;
  setIconUsageScan: (scan: IconUsageScan | null) => void;
  setLinkedDiagrams: (diagrams: Array<{ id: string; name: string }>) => void;
  setNotification: (notification: Notification | null) => void;
  setActiveLeftTab: (tab: 'ELEMENTS' | 'LAYERS' | null) => void;
  setRightSidebarOpen: (open: boolean) => void;
  setItemActionBarOpen: (open: boolean) => void;
  /** Open the canvas context menu (ADR 0027). */
  openContextMenu: (menu: ContextMenuState) => void;
  /** Close the canvas context menu. */
  closeContextMenu: () => void;
  setIsDirty: (isDirty: boolean) => void;
  setCanvasMode: (mode: CanvasMode) => void;
}

export type UiStateStore = UiState & {
  actions: UiStateActions;
};
