import { LocaleProps } from '../types/axoviewProps';

const locale: LocaleProps = {
  common: {
    exampleText: 'This is an example text'
  },
  helpDialog: {
    title: 'Keyboard Shortcuts & Help',
    close: 'Close',
    keyboardShortcuts: 'Keyboard Shortcuts',
    mouseInteractions: 'Mouse Interactions',
    action: 'Action',
    shortcut: 'Shortcut',
    method: 'Method',
    description: 'Description',
    note: 'Note:',
    noteContent:
      'Keyboard shortcuts are disabled when typing in input fields, text areas, or content-editable elements to prevent conflicts.',
    // Keyboard shortcuts
    undoAction: 'Undo',
    undoDescription: 'Undo the last action',
    redoAction: 'Redo',
    redoDescription: 'Redo the last undone action',
    redoAltAction: 'Redo (Alternative)',
    redoAltDescription: 'Alternative redo shortcut',
    helpAction: 'Help',
    helpDescription: 'Open help dialog with keyboard shortcuts',
    zoomInAction: 'Zoom In',
    zoomInShortcut: 'Mouse Wheel Up',
    zoomInDescription: 'Zoom in on the canvas',
    zoomOutAction: 'Zoom Out',
    zoomOutShortcut: 'Mouse Wheel Down',
    zoomOutDescription: 'Zoom out from the canvas',
    panCanvasAction: 'Pan Canvas',
    panCanvasShortcut: 'Right-click + Drag',
    panCanvasDescription: 'Pan the canvas when in Pan mode',
    togglePanToolAction: 'Toggle Pan Tool',
    togglePanToolShortcut: 'Right-click',
    togglePanToolDescription:
      'Toggle pan mode on/off; left-click to return to select mode',
    lassoSelectAction: 'Lasso Select',
    lassoSelectShortcut: 'Left-click + Drag (empty area)',
    lassoSelectDescription:
      'Draw a rectangular selection box to select multiple items',
    deselectAction: 'Deselect',
    deselectShortcut: 'Left-click (empty area)',
    deselectDescription:
      'Deselect the current selection and return to select mode',
    // Mouse interactions
    selectToolAction: 'Select Tool',
    selectToolShortcut: 'Click Select button',
    selectToolDescription: 'Switch to selection mode',
    panToolAction: 'Pan Tool',
    panToolShortcut: 'Click Pan button or Right-click',
    panToolDescription:
      'Switch to pan mode for moving the canvas; right-click toggles on/off',
    addItemAction: 'Add Item',
    addItemShortcut: 'Click Add item button',
    addItemDescription: 'Open icon picker to add new items',
    drawRectangleAction: 'Draw Rectangle',
    drawRectangleShortcut: 'Click Rectangle button',
    drawRectangleDescription: 'Switch to rectangle drawing mode',
    createConnectorAction: 'Create Connector',
    createConnectorShortcut: 'Click Connector button',
    createConnectorDescription: 'Switch to connector mode',
    addTextAction: 'Add Text',
    addTextShortcut: 'Click Text button',
    addTextDescription: 'Create a new text box',
    deleteSelectedAction: 'Delete Selected',
    deleteSelectedShortcut: 'Delete (Backspace on Mac)',
    deleteSelectedDescription:
      'Delete the selected item or all items in a lasso selection; supports undo/redo',
    cutAction: 'Cut',
    cutDescription:
      'Cut selected item(s) to clipboard — items are removed and can be pasted elsewhere; supports undo/redo',
    copyAction: 'Copy',
    copyDescription: 'Copy selected item(s) to clipboard',
    pasteAction: 'Paste',
    pasteDescription:
      'Paste clipboard items at mouse position; offsets to avoid overlap',
    // D10 — Select all row
    selectAllAction: 'Select all',
    selectAllShortcut: 'Ctrl+A',
    selectAllDescription:
      'Select every visible, unlocked item in the active view (items, rectangles, text boxes, connectors + their waypoints)',
    // D10 — tool-activation keys (ADR 0022 §6)
    keyRenameAction: 'Rename',
    keyRenameShortcut: 'F2',
    keyRenameDescription: 'Rename the selected item or diagram inline',
    keyAddItemAction: 'Add item / Elements',
    keyAddItemShortcut: 'N',
    keyAddItemDescription: 'Toggle the Elements panel to place a new item',
    keyConnectorAction: 'Connector',
    keyConnectorShortcut: 'C',
    keyConnectorDescription: 'Switch to the connector tool',
    keyLassoAction: 'Lasso select',
    keyLassoShortcut: 'L',
    keyLassoDescription: 'Switch to the lasso selection tool',
    keySelectAction: 'Select',
    keySelectShortcut: 'S',
    keySelectDescription: 'Switch to the select tool',
    // D10 — mouse interactions
    miSelectAction: 'Select',
    miSelectMethod: 'Left-click',
    miSelectDescription:
      'Click an item to select it (highlights it and shows the floating action bar). Click empty canvas to clear the selection.',
    miOpenDetailsAction: 'Open details',
    miOpenDetailsMethod: 'Double-click',
    miOpenDetailsDescription:
      'Double-click an item to open its details panel — the same as the “Details…” context-menu entry.',
    miToggleSelectionAction: 'Toggle selection',
    miToggleSelectionMethod: 'Ctrl/Cmd + Left-click',
    miToggleSelectionDescription:
      'Add or remove an item from the multi-selection; a connector toggles together with its waypoints.',
    miPanAction: 'Pan',
    miPanMethod: 'Right-click + drag',
    miPanDescription:
      'Hold the right button and drag to pan the canvas. Middle-click drag pans too; arrow keys nudge it.',
    miContextMenuAction: 'Context menu',
    miContextMenuMethod: 'Right-click (tap)',
    miContextMenuDescription:
      'A right-click without dragging opens the context menu — the item menu over an item, or the canvas menu over empty space. On touch, long-press.',
    miRemoveWaypointAction: 'Remove waypoint',
    miRemoveWaypointMethod: 'Alt + Left-click',
    miRemoveWaypointDescription:
      'Alt+click a connector waypoint to splice it out (no need to select the connector first); endpoint anchors are preserved.',
    miZoomAction: 'Zoom',
    miZoomMethod: 'Scroll wheel',
    miZoomDescription: 'Scroll to zoom toward the cursor.'
  },
  connectorHintTooltip: {
    tipCreatingConnectors: 'Tip: Creating Connectors',
    tipConnectorTools: 'Tip: Connector Tools',
    clickInstructionStart: 'Click',
    clickInstructionMiddle: 'on the first node or point, then',
    clickInstructionEnd: 'on the second node or point to create a connection.',
    nowClickTarget: 'Now click on the target to complete the connection.',
    dragStart: 'Drag',
    dragEnd: 'from the first node to the second node to create a connection.',
    rerouteStart: 'To reroute a connector,',
    rerouteMiddle: 'left-click',
    rerouteEnd:
      'on any point along the connector line and drag to create or move anchor points.'
  },
  lassoHintTooltip: {
    tipLasso: 'Tip: Lasso Selection',
    tipFreehandLasso: 'Tip: Freehand Lasso Selection',
    lassoDragStart: 'Click and drag',
    lassoDragEnd:
      'to draw a rectangular selection box around items you want to select.',
    freehandDragStart: 'Click and drag',
    freehandDragMiddle: 'to draw a',
    freehandDragEnd: 'freeform shape',
    freehandComplete:
      'around items. Release to select all items inside the shape.',
    moveStart: 'Once selected,',
    moveMiddle: 'click inside the selection',
    moveEnd: 'and drag to move all selected items together.'
  },
  importHintTooltip: {
    title: 'Import Diagrams',
    instructionStart: 'To import diagrams, click the',
    menuButton: 'menu button',
    instructionMiddle: '(☰) in the top left corner, then select',
    openButton: '"Open"',
    instructionEnd: 'to load your diagram files.'
  },
  connectorRerouteTooltip: {
    title: 'Tip: Reroute Connectors',
    instructionStart:
      'Once your connectors are placed you can reroute them as you please.',
    instructionSelect: 'Select the connector',
    instructionMiddle: 'first, then',
    instructionClick: 'click on the connector path',
    instructionAnd: 'and',
    instructionDrag: 'drag',
    instructionEnd: 'to change it!'
  },
  connectorEmptySpaceTooltip: {
    message: 'To connect this connector to a node,',
    instruction:
      'left-click on the end of the connector and drag it to the desired node.'
  },
  settings: {
    // D3 — SettingsDialog chrome
    title: 'Settings',
    close: 'Close',
    canvas: 'Canvas',
    language: 'Language',
    about: 'About',
    languageDescription:
      'Select the display language for the application interface.',
    zoomSection: 'Zoom',
    labelsSection: 'Labels',
    zoom: {
      description: 'Configure zoom behavior when using the mouse wheel.',
      zoomToCursor: 'Zoom to Cursor',
      zoomToCursorDesc:
        'When enabled, zoom in/out centered on the mouse cursor position. When disabled, zoom is centered on the canvas.'
    },
    hotkeys: {
      title: 'Keyboard shortcuts',
      profile: 'Hotkey Profile',
      profileQwerty: 'QWERTY (Q, W, E, R, T, Y)',
      profileSmnrct: 'SMNRCT (S, M, N, R, C, T)',
      profileNone: 'No Hotkeys',
      tool: 'Tool',
      hotkey: 'Hotkey',
      toolSelect: 'Select',
      toolPan: 'Pan',
      toolAddItem: 'Add Item',
      toolRectangle: 'Rectangle',
      toolConnector: 'Connector',
      toolText: 'Text',
      note: 'Note: Hotkeys work when not typing in text fields',
      fixedShortcutsTitle: 'Fixed Shortcuts (Always Active)',
      fixedCut: 'Cut',
      fixedCopy: 'Copy',
      fixedPaste: 'Paste',
      fixedUndo: 'Undo',
      fixedRedo: 'Redo'
    },
    connector: {
      title: 'Connector Settings',
      connectionMode: 'Connection Creation Mode',
      clickMode: 'Click Mode (Recommended)',
      clickModeDesc:
        'Click the first node, then click the second node to create a connection',
      dragMode: 'Drag Mode',
      dragModeDesc: 'Click and drag from the first node to the second node',
      note: 'Note: You can change this setting at any time. The selected mode will be used when the Connector tool is active.'
    },
    iconPacks: {
      title: 'Icon Pack Management',
      lazyLoading: 'Enable Lazy Loading',
      lazyLoadingDesc: 'Load icon packs on demand for faster startup',
      availablePacks: 'Available Icon Packs',
      coreIsoflow: 'Core Isoflow (Always Loaded)',
      alwaysEnabled: 'Always enabled',
      awsPack: 'AWS Icons',
      gcpPack: 'Google Cloud Icons',
      azurePack: 'Azure Icons',
      kubernetesPack: 'Kubernetes Icons',
      loading: 'Loading...',
      loaded: 'Loaded',
      notLoaded: 'Not loaded',
      iconCount: '{count} icons',
      lazyLoadingDisabledNote:
        'Lazy loading is disabled. All icon packs are loaded at startup.',
      note: 'Icon packs can be enabled or disabled based on your needs. Disabled packs will reduce memory usage and improve performance.'
    }
  },
  lazyLoadingWelcome: {
    title: 'Welcome to Axoview',
    message:
      "Axoview is a community-modified fork of FossFLOW (itself forked from Isoflow) with additional features and improvements. Learn more about what's changed and find the source at https://github.com/molikas/axoview — found a bug or have a feature request? Open an issue on GitHub!",
    configPath: 'Click on the Hamburger icon',
    configPath2: 'in the top left to access Configuration.',
    canDisable: 'Happy diagramming!',
    signature: '— Axoview'
  },
  viewTabs: {
    addPage: 'Add page',
    deletePage: 'Delete page',
    renameDiagram: 'Rename diagram',
    addPageDisabled: 'Page limit reached (5)'
  },
  nodePanel: {
    details: 'Details',
    style: 'Style',
    notes: 'Notes',
    notesModified: 'Notes ●',
    close: 'Close',
    openLink: 'Open link',
    caption: 'Caption',
    noCaption: 'No caption.',
    showLabel: 'Show label',
    hideLabel: 'Hide label',
    showName: 'Show name',
    hideName: 'Hide name'
  },
  nodeInfoTab: {
    name: 'Name',
    namePlaceholder: 'Node name…',
    removeLink: 'Remove link',
    addLink: 'Add link to name',
    linkPlaceholder: 'https://…',
    caption: 'Caption',
    captionHint: 'Shown on the canvas below the node name',
    openLink: 'Open link',
    diagramLink: 'Link to diagram',
    diagramLinkPlaceholder: 'Select a diagram…',
    diagramLinkHint: 'Clicking this node in read-only mode opens the linked diagram',
    openDiagramLink: 'Open linked diagram'
  },
  nodeStyleTab: {
    icon: 'Icon',
    close: 'Close',
    change: 'Change…',
    iconSize: 'Icon size',
    labelFontSize: 'Label font size',
    labelColor: 'Label color',
    labelHeight: 'Label height'
  },
  connectorControls: {
    close: 'Close',
    labels: 'Labels',
    details: 'Details',
    style: 'Style',
    notes: 'Notes',
    notesModified: 'Notes ●',
    name: 'Name',
    namePlaceholder: 'Edge label…',
    additionalLabels: 'Additional labels',
    addLabel: 'Add label',
    noLabels: 'No labels yet.',
    addLink: 'Add link',
    removeLink: 'Remove link',
    linkPlaceholder: 'https://…',
    showLabel: 'Show label',
    hideLabel: 'Hide label',
    showName: 'Show name',
    hideName: 'Hide name',
    color: 'Color',
    width: 'Width',
    lineStyle: 'Line style',
    lineType: 'Line type',
    useCustomColor: 'Use custom color',
    showArrow: 'Show arrow',
    solid: 'Solid',
    dotted: 'Dotted',
    dashed: 'Dashed',
    singleLine: 'Single line',
    doubleLine: 'Double line',
    doubleLineWithCircle: 'Double line with circle'
  },
  textBoxControls: {
    close: 'Close',
    name: 'Name',
    namePlaceholder: 'Element name…',
    text: 'Text',
    textSize: 'Text size',
    textColor: 'Text color',
    alignment: 'Alignment'
  },
  rectangleControls: {
    close: 'Close',
    name: 'Name',
    namePlaceholder: 'Element name…',
    color: 'Color',
    useCustomColor: 'Use Custom Color'
  },
  labelColorPicker: {
    customColor: 'Custom color'
  },
  deleteButton: {
    delete: 'Delete'
  },
  nodeActionBar: {
    style: 'Style',
    editName: 'Edit name',
    editLink: 'Edit link',
    addLink: 'Add link',
    editNotes: 'Edit notes',
    addNotes: 'Add notes',
    startConnector: 'Start connector',
    delete: 'Delete'
  },
  quickAddNodePopover: {
    add: 'Add',
    rectangle: 'Rectangle'
  },
  zoomControls: {
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    fitToScreen: 'Fit to screen',
    keepLabelsReadable: 'Keep labels readable',
    help: 'Help (F1)',
    selected: '{count} selected'
  },
  modeHints: {
    connector: 'Drag between items to connect • Esc to cancel'
  },
  previewLayerSwitcher: {
    layers: 'Layers',
    showLayer: 'Show layer',
    hideLayer: 'Hide layer',
    solo: 'Solo',
    unsolo: 'Exit solo'
  },
  previewLabelsToggle: {
    hideLabels: 'Hide labels',
    showLabels: 'Show labels'
  },
  annotationPalette: {
    pen: 'Annotate',
    select: 'Select',
    draw: 'Draw',
    shapes: 'Shapes',
    pencil: 'Pencil',
    highlighter: 'Highlighter',
    line: 'Line',
    arrow: 'Arrow',
    rectangle: 'Rectangle',
    ellipse: 'Ellipse',
    eraser: 'Eraser',
    undo: 'Undo',
    redo: 'Redo',
    clear: 'Clear all'
  },
  viewModeInfoPopover: {
    close: 'Close'
  },
  labelSettings: {
    description: 'Configure label display settings',
    expandButtonPadding: 'Expand Button Padding',
    expandButtonPaddingDesc:
      'Bottom padding when expand button is visible (prevents text overlap)',
    // D13
    currentValue: 'Current: {value} theme units'
  },
  iconSelectionControls: {
    close: 'Close',
    importIcons: 'Import Icons',
    addMoreIcons: 'Add more icons',
    isometricLabel: 'Treat as isometric (3D view)',
    isometricHint: 'Uncheck for flat icons (logos, UI elements)',
    dragHint: 'You can drag and drop any item below onto the canvas.',
    aiPromptTooltip: 'Generate icons with AI',
    aiPromptTitle: 'Generate isometric icons with AI',
    aiPromptBody:
      'Paste this prompt into an image-generating AI. Replace "my object" with what you need, then import the generated PNG.',
    aiPromptCopy: 'Copy prompt',
    aiPromptCopied: 'Copied'
  },
  searchbox: {
    placeholder: 'Search icons'
  },
  exportImageDialog: {
    title: 'Export as image',
    compatibilityTitle: 'Browser Compatibility Notice',
    compatibilityMessage:
      'For best results, please use Chrome or Edge. Firefox currently has compatibility issues with the export feature.',
    cropInstruction: 'Click and drag to select the area you want to export',
    options: 'Options',
    showGrid: 'Show grid',
    showLabels: 'Show labels',
    expandDescriptions: 'Expand descriptions',
    screenshotPreset: 'Screenshot (recommended)',
    scaleClamped: 'Export size reduced to fit the browser image limit:',
    cropToContent: 'Crop to content',
    backgroundColor: 'Background color',
    transparentBackground: 'Transparent background',
    exportQuality: 'Export Quality (DPI)',
    custom: 'Custom',
    recrop: 'Recrop',
    cropApplied: 'Crop applied successfully',
    applyCrop: 'Apply Crop',
    clearSelection: 'Clear Selection',
    cropHint:
      'Select an area to crop, or uncheck "Crop to content" to use full image',
    cancel: 'Cancel',
    downloadSvg: 'Download as SVG',
    downloadPng: 'Download as PNG',
    error: 'Could not export image'
  },
  toolMenu: {
    undo: 'Undo',
    redo: 'Redo',
    select: 'Select',
    lassoSelect: 'Lasso select',
    freehandLasso: 'Freehand lasso',
    pan: 'Pan',
    addItem: 'Add item',
    rectangle: 'Rectangle',
    connector: 'Connector',
    text: 'Text',
    common: 'Common',
    // D5
    switchTo2D: 'Switch to 2D view',
    switchToIsometric: 'Switch to isometric view',
    clickMode: 'Click',
    dragMode: 'Drag'
  },
  quickIconSelector: {
    recentlyUsed: 'RECENTLY USED',
    searchResults: 'SEARCH RESULTS ({count} icons)',
    noIconsFound: 'No icons found matching "{term}"'
  },
  // D1 — CanvasContextMenu (ADR 0027). Sentence case per ux §7.2.
  canvasContextMenu: {
    details: 'Details…',
    rename: 'Rename',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    duplicate: 'Duplicate',
    bringForward: 'Bring forward',
    sendBackward: 'Send backward',
    assignToLayer: 'Assign to layer',
    snapToGrid: 'Snap to grid',
    unsnapFromGrid: 'Unsnap from grid',
    disableCollision: 'Disable collision',
    enableCollision: 'Enable collision',
    delete: 'Delete',
    addItem: 'Add item',
    selectAll: 'Select all',
    enableSnapToGrid: 'Enable snap to grid',
    disableSnapToGrid: 'Disable snap to grid',
    itemsSelectedOne: '{count} item selected',
    itemsSelectedOther: '{count} items selected',
    deleteItemsOne: 'Delete {count} item',
    deleteItemsOther: 'Delete {count} items',
    removeFromLayer: 'Remove from layer',
    noLayers: 'No layers — add one in the Layers panel'
  },
  // D4 — LeftDock icon-strip tooltips + disabled-state hint. Sentence case.
  leftDock: {
    fileExplorer: 'File explorer',
    elements: 'Elements',
    layers: 'Layers',
    settings: 'Settings',
    openDiagramFirst: 'open or create a diagram first'
  },
  // D8 — LayersPanel chrome. Sentence case; {count} is interpolated.
  layersPanel: {
    header: 'Layers',
    addLayer: 'Add layer',
    deleteSelectedLayer: 'Delete selected layer',
    noLayersYet: 'No layers yet. Click + to add one.',
    unassigned: 'Unassigned ({count})',
    dropToUnassign: 'Drop items here to unassign',
    layerN: 'Layer {count}'
  },
  // D7 — clipboard toast strings; {count}/{percent} interpolated, never concat.
  clipboard: {
    copiedOne: 'Copied {count} item',
    copiedOther: 'Copied {count} items',
    cutOne: 'Cut {count} item',
    cutOther: 'Cut {count} items',
    pastedOne: 'Pasted {count} item',
    pastedOther: 'Pasted {count} items',
    nothingToPaste: 'Nothing to paste',
    routingConnectors: 'Pasting… routing connectors ({percent}%)'
  },
  // D13 — default page name; {count} interpolated.
  page: {
    pageName: 'Page {count}'
  }
};

export default locale;
