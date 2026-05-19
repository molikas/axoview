import { Coords, Size, EditorModeEnum, MainMenuOptions } from './common';
import { Icon } from './model';
import { ItemReference } from './scene';
import {
  HotkeyProfile,
  PanSettings,
  ZoomSettings,
  LabelSettings
} from './settings';
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

export interface ContextMenu {
  type: 'ITEM' | 'EMPTY';
  item?: ItemReference;
  tile: Coords;
}

export type ConnectorInteractionMode = 'click' | 'drag';

export interface Notification {
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

export type CanvasMode = 'ISOMETRIC' | '2D';

export interface UiState {
  view: string;
  mainMenuOptions: MainMenuOptions;
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
  isMainMenuOpen: boolean;
  itemControls: ItemControls | null;
  /**
   * Persistent multi-selection on the canvas. Single source of truth for which
   * items are selected. Invariant: when length === 1, itemControls mirrors the
   * single selected item; when 0 or > 1, itemControls is null. See ADR-0006.
   */
  selectedIds: ItemReference[];
  contextMenu: ContextMenu | null;
  zoom: number;
  scroll: Scroll;
  mouse: Mouse;
  rendererEl: HTMLDivElement | null;
  rendererSize: Size;
  enableDebugTools: boolean;
  hotkeyProfile: HotkeyProfile;
  panSettings: PanSettings;
  zoomSettings: ZoomSettings;
  labelSettings: LabelSettings;
  connectorInteractionMode: ConnectorInteractionMode;
  expandLabels: boolean;
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
  /** true when model has changed since last export-to-file or explicit save */
  isDirty: boolean;
  canvasMode: CanvasMode;
}

export interface UiStateActions {
  setView: (view: string) => void;
  setMainMenuOptions: (options: MainMenuOptions) => void;
  setEditorMode: (mode: keyof typeof EditorModeEnum) => void;
  setIconCategoriesState: (iconCategoriesState: IconCollectionState[]) => void;
  setFreshlyLoadedCategoryIds: (ids: string[]) => void;
  resetUiState: () => void;
  setMode: (mode: Mode) => void;
  incrementZoom: () => void;
  decrementZoom: () => void;
  setIsMainMenuOpen: (isOpen: boolean) => void;
  setDialog: (dialog: keyof typeof DialogTypeEnum | null) => void;
  setZoom: (zoom: number) => void;
  setScroll: (scroll: Scroll) => void;
  setItemControls: (itemControls: ItemControls | null) => void;
  /**
   * Replaces the current canvas selection. Internally derives itemControls
   * (single-item case) or clears it (empty / multi-select).
   */
  setSelectedIds: (ids: ItemReference[]) => void;
  /** Adds the item if absent, removes it if present. Updates itemControls accordingly. */
  toggleSelected: (ref: ItemReference) => void;
  /** Convenience: clears selectedIds and itemControls. */
  clearSelection: () => void;
  setContextMenu: (contextMenu: ContextMenu | null) => void;
  setMouse: (mouse: Mouse) => void;
  setRendererEl: (el: HTMLDivElement) => void;
  setRendererSize: (size: Size) => void;
  setEnableDebugTools: (enabled: boolean) => void;
  setHotkeyProfile: (profile: HotkeyProfile) => void;
  setPanSettings: (settings: PanSettings) => void;
  setZoomSettings: (settings: ZoomSettings) => void;
  setLabelSettings: (settings: LabelSettings) => void;
  setConnectorInteractionMode: (mode: ConnectorInteractionMode) => void;
  setExpandLabels: (expand: boolean) => void;
  setIconPackManager: (iconPackManager: IconPackManagerProps | null) => void;
  setIconUsageScan: (scan: IconUsageScan | null) => void;
  setLinkedDiagrams: (diagrams: Array<{ id: string; name: string }>) => void;
  setNotification: (notification: Notification | null) => void;
  setActiveLeftTab: (tab: 'ELEMENTS' | 'LAYERS' | null) => void;
  setRightSidebarOpen: (open: boolean) => void;
  setItemActionBarOpen: (open: boolean) => void;
  setIsDirty: (isDirty: boolean) => void;
  setCanvasMode: (mode: CanvasMode) => void;
}

export type UiStateStore = UiState & {
  actions: UiStateActions;
};
