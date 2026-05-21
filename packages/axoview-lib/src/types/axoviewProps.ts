import type React from 'react';
import type { EditorModeEnum, MainMenuOptions } from './common';
import type { Model } from './model';
import type { RendererProps } from './rendererProps';

export type InitialData = Model & {
  fitToView?: boolean;
  view?: string;
};

export interface LocaleProps {
  common: {
    exampleText: string;
  };
  mainMenu: {
    undo: string;
    redo: string;
    new: string;
    open: string;
    exportJson: string;
    exportImage: string;
    clearCanvas: string;
    settings: string;
    gitHub: string;
  };
  helpDialog: {
    title: string;
    close: string;
    keyboardShortcuts: string;
    mouseInteractions: string;
    action: string;
    shortcut: string;
    method: string;
    description: string;
    note: string;
    noteContent: string;
    // Keyboard shortcuts
    undoAction: string;
    undoDescription: string;
    redoAction: string;
    redoDescription: string;
    redoAltAction: string;
    redoAltDescription: string;
    helpAction: string;
    helpDescription: string;
    zoomInAction: string;
    zoomInShortcut: string;
    zoomInDescription: string;
    zoomOutAction: string;
    zoomOutShortcut: string;
    zoomOutDescription: string;
    panCanvasAction: string;
    panCanvasShortcut: string;
    panCanvasDescription: string;
    togglePanToolAction: string;
    togglePanToolShortcut: string;
    togglePanToolDescription: string;
    lassoSelectAction: string;
    lassoSelectShortcut: string;
    lassoSelectDescription: string;
    deselectAction: string;
    deselectShortcut: string;
    deselectDescription: string;
    addNodeGroupAction: string;
    addNodeGroupShortcut: string;
    addNodeGroupDescription: string;
    deleteSelectedAction: string;
    deleteSelectedShortcut: string;
    deleteSelectedDescription: string;
    // Mouse interactions
    selectToolAction: string;
    selectToolShortcut: string;
    selectToolDescription: string;
    panToolAction: string;
    panToolShortcut: string;
    panToolDescription: string;
    addItemAction: string;
    addItemShortcut: string;
    addItemDescription: string;
    drawRectangleAction: string;
    drawRectangleShortcut: string;
    drawRectangleDescription: string;
    createConnectorAction: string;
    createConnectorShortcut: string;
    createConnectorDescription: string;
    addTextAction: string;
    addTextShortcut: string;
    addTextDescription: string;
    cutAction: string;
    cutDescription: string;
    copyAction: string;
    copyDescription: string;
    pasteAction: string;
    pasteDescription: string;
  };
  connectorHintTooltip: {
    tipCreatingConnectors: string;
    tipConnectorTools: string;
    clickInstructionStart: string;
    clickInstructionMiddle: string;
    clickInstructionEnd: string;
    nowClickTarget: string;
    dragStart: string;
    dragEnd: string;
    rerouteStart: string;
    rerouteMiddle: string;
    rerouteEnd: string;
  };
  lassoHintTooltip: {
    tipLasso: string;
    tipFreehandLasso: string;
    lassoDragStart: string;
    lassoDragEnd: string;
    freehandDragStart: string;
    freehandDragMiddle: string;
    freehandDragEnd: string;
    freehandComplete: string;
    moveStart: string;
    moveMiddle: string;
    moveEnd: string;
  };
  importHintTooltip: {
    title: string;
    instructionStart: string;
    menuButton: string;
    instructionMiddle: string;
    openButton: string;
    instructionEnd: string;
  };
  connectorRerouteTooltip: {
    title: string;
    instructionStart: string;
    instructionSelect: string;
    instructionMiddle: string;
    instructionClick: string;
    instructionAnd: string;
    instructionDrag: string;
    instructionEnd: string;
  };
  connectorEmptySpaceTooltip: {
    message: string;
    instruction: string;
  };
  settings: {
    zoom: {
      description: string;
      zoomToCursor: string;
      zoomToCursorDesc: string;
    };
    hotkeys: {
      title: string;
      profile: string;
      profileQwerty: string;
      profileSmnrct: string;
      profileNone: string;
      tool: string;
      hotkey: string;
      toolSelect: string;
      toolPan: string;
      toolAddItem: string;
      toolRectangle: string;
      toolConnector: string;
      toolText: string;
      note: string;
      fixedShortcutsTitle: string;
      fixedCut: string;
      fixedCopy: string;
      fixedPaste: string;
      fixedUndo: string;
      fixedRedo: string;
    };
    pan: {
      title: string;
      mousePanOptions: string;
      emptyAreaClickPan: string;
      middleClickPan: string;
      rightClickPan: string;
      ctrlClickPan: string;
      altClickPan: string;
      keyboardPanOptions: string;
      arrowKeys: string;
      wasdKeys: string;
      ijklKeys: string;
      keyboardPanSpeed: string;
      note: string;
    };
    connector: {
      title: string;
      connectionMode: string;
      clickMode: string;
      clickModeDesc: string;
      dragMode: string;
      dragModeDesc: string;
      note: string;
    };
    iconPacks: {
      title: string;
      lazyLoading: string;
      lazyLoadingDesc: string;
      availablePacks: string;
      coreIsoflow: string;
      alwaysEnabled: string;
      awsPack: string;
      gcpPack: string;
      azurePack: string;
      kubernetesPack: string;
      loading: string;
      loaded: string;
      notLoaded: string;
      iconCount: string;
      lazyLoadingDisabledNote: string;
      note: string;
    };
  };
  lazyLoadingWelcome: {
    title: string;
    message: string;
    configPath: string;
    configPath2: string;
    canDisable: string;
    signature: string;
  };
  viewTabs: {
    addPage: string;
    deletePage: string;
    renameDiagram: string;
    addPageDisabled: string;
  };
  nodePanel: {
    details: string;
    style: string;
    notes: string;
    notesModified: string;
    close: string;
    openLink: string;
    caption: string;
    noCaption: string;
    showLabel: string;
    hideLabel: string;
    showName: string;
    hideName: string;
  };
  nodeInfoTab: {
    name: string;
    namePlaceholder: string;
    removeLink: string;
    addLink: string;
    linkPlaceholder: string;
    caption: string;
    captionHint: string;
    openLink: string;
    diagramLink: string;
    diagramLinkPlaceholder: string;
    diagramLinkHint: string;
    openDiagramLink: string;
  };
  nodeStyleTab: {
    icon: string;
    close: string;
    change: string;
    iconSize: string;
    labelFontSize: string;
    labelColor: string;
    labelHeight: string;
  };
  connectorControls: {
    close: string;
    labels: string;
    details: string;
    style: string;
    notes: string;
    notesModified: string;
    name: string;
    namePlaceholder: string;
    additionalLabels: string;
    addLabel: string;
    noLabels: string;
    addLink: string;
    removeLink: string;
    linkPlaceholder: string;
    showLabel: string;
    hideLabel: string;
    showName: string;
    hideName: string;
    color: string;
    width: string;
    lineStyle: string;
    lineType: string;
    useCustomColor: string;
    showArrow: string;
    solid: string;
    dotted: string;
    dashed: string;
    singleLine: string;
    doubleLine: string;
    doubleLineWithCircle: string;
  };
  textBoxControls: {
    close: string;
    name: string;
    namePlaceholder: string;
    text: string;
    textSize: string;
    textColor: string;
    alignment: string;
  };
  rectangleControls: {
    close: string;
    name: string;
    namePlaceholder: string;
    color: string;
    useCustomColor: string;
  };
  labelColorPicker: {
    customColor: string;
  };
  deleteButton: {
    delete: string;
  };
  nodeActionBar: {
    style: string;
    editName: string;
    editLink: string;
    addLink: string;
    editNotes: string;
    addNotes: string;
    startConnector: string;
    delete: string;
  };
  quickAddNodePopover: {
    add: string;
    rectangle: string;
  };
  zoomControls: {
    zoomOut: string;
    zoomIn: string;
    fitToScreen: string;
    help: string;
  };
  labelSettings: {
    description: string;
    expandButtonPadding: string;
    expandButtonPaddingDesc: string;
  };
  iconSelectionControls: {
    close: string;
    importIcons: string;
    addMoreIcons?: string;
    isometricLabel: string;
    isometricHint: string;
    dragHint: string;
    aiPromptTooltip: string;
    aiPromptTitle: string;
    aiPromptBody: string;
    aiPromptCopy: string;
    aiPromptCopied: string;
  };
  searchbox: {
    placeholder: string;
  };
  exportImageDialog: {
    title: string;
    compatibilityTitle: string;
    compatibilityMessage: string;
    cropInstruction: string;
    options: string;
    showGrid: string;
    expandDescriptions: string;
    cropToContent: string;
    backgroundColor: string;
    transparentBackground: string;
    exportQuality: string;
    custom: string;
    recrop: string;
    cropApplied: string;
    applyCrop: string;
    clearSelection: string;
    cropHint: string;
    cancel: string;
    downloadSvg: string;
    downloadPng: string;
    error: string;
  };
  toolMenu: {
    undo: string;
    redo: string;
    select: string;
    lassoSelect: string;
    freehandLasso: string;
    pan: string;
    addItem: string;
    rectangle: string;
    connector: string;
    text: string;
  };
  quickIconSelector: {
    /** @deprecated removed in 2026-05 shake-out; kept optional for non-English locales pending cleanup */
    searchPlaceholder?: string;
    recentlyUsed: string;
    searchResults: string;
    noIconsFound: string;
    /** @deprecated removed in 2026-05 shake-out; kept optional for non-English locales pending cleanup */
    helpSearch?: string;
    /** @deprecated removed in 2026-05 shake-out; kept optional for non-English locales pending cleanup */
    helpBrowse?: string;
  };
  // other namespaces can be added here
}

/**
 * Per-diagram usage report for a single icon id. Returned by IconUsageScan.
 * `count` is the number of items in the diagram that reference the icon id.
 */
export interface IconUsageReport {
  diagramId: string;
  diagramName: string;
  count: number;
}

/**
 * Workspace-wide scan for icon usage. Implemented by the consuming app since
 * the lib has no notion of "other diagrams" — only the currently loaded model.
 * The result must include the current diagram if it uses the icon.
 *
 * When unset, ElementsPanel falls back to a current-diagram-only scan.
 */
export type IconUsageScan = (iconId: string) => Promise<IconUsageReport[]>;

export interface IconPackManagerProps {
  lazyLoadingEnabled: boolean;
  onToggleLazyLoading: (enabled: boolean) => void;
  packInfo: Array<{
    name: string;
    displayName: string;
    loaded: boolean;
    loading: boolean;
    error: string | null;
    iconCount: number;
  }>;
  enabledPacks: string[];
  onTogglePack: (packName: string, enabled: boolean) => void;
}

export interface AxoviewProps {
  initialData?: InitialData;
  mainMenuOptions?: MainMenuOptions;
  onModelUpdated?: (Model: Model) => void;
  width?: number | string;
  height?: number | string;
  enableDebugTools?: boolean;
  editorMode?: keyof typeof EditorModeEnum;
  renderer?: RendererProps;
  locale?: LocaleProps;
  iconPackManager?: IconPackManagerProps;
  /**
   * Optional workspace-wide icon usage scan. When supplied, the imported-icon
   * delete confirmation dialog lists every diagram that references the icon
   * before allowing the user to proceed. See ADR-0002 lifecycle section.
   */
  iconUsageScan?: IconUsageScan;
  /** Diagrams available for node-to-diagram linking (Phase 2C). Each entry is {id, name}. */
  linkedDiagrams?: Array<{ id: string; name: string }>;
  /** Slot rendered inside the Settings dialog as a "Language" tab — pass your own language-picker component. */
  languageSelector?: React.ReactNode;
  /** Portal target for the MainMenu hamburger button (left zone). */
  toolbarPortalTarget?: HTMLElement | null;
  /** Portal target for the sidebar toggle buttons (right zone). When omitted, toggles render alongside MainMenu in toolbarPortalTarget. */
  sidebarTogglePortalTarget?: HTMLElement | null;
  /** @deprecated use toolbarPortalTarget */
  menuPortalTarget?: HTMLElement | null;
  /** Extra content rendered at the right end of the BottomDock (after the help icon). */
  bottomDockEnd?: React.ReactNode;
  /** When true, the first-load welcome notification is hidden (pass true when a diagram is open). */
  suppressOnboardingHints?: boolean;
  /** Whether the file-explorer panel is open (controlled by the app layer). */
  fileExplorerOpen?: boolean;
  /** Called when the user clicks the 📁 File Explorer button in the left strip. */
  onFileExplorerToggle?: () => void;
  /** When true, the LeftDock's Elements/Layers icons are disabled (e.g. no diagram is loaded yet). */
  disableLeftDockWorkingTabs?: boolean;
}

export interface LoadOptions {
  /** When true, zoom and scroll are preserved instead of being reset to defaults. */
  preserveViewport?: boolean;
}

export interface AxoviewRef {
  load: (data: InitialData, options?: LoadOptions) => void;
  /** Opens the built-in image export dialog for the currently-loaded diagram. */
  openExportImageDialog: () => void;
}
