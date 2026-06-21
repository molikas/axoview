import { LocaleProps } from '../types/axoviewProps';

const locale: LocaleProps = {
  common: {
    exampleText: '这是一段示例文本'
  },
  helpDialog: {
    title: '键盘快捷键和帮助',
    close: '关闭',
    keyboardShortcuts: '键盘快捷键',
    mouseInteractions: '鼠标交互',
    action: '操作',
    shortcut: '快捷键',
    method: '方法',
    description: '描述',
    note: '注意：',
    noteContent:
      '在输入框、文本区域或可编辑内容元素中键入时，键盘快捷键会被禁用，以防止冲突。',
    // Keyboard shortcuts
    undoAction: '撤销',
    undoDescription: '撤销上一个操作',
    redoAction: '重做',
    redoDescription: '重做上一个撤销的操作',
    redoAltAction: '重做（备选）',
    redoAltDescription: '备选重做快捷键',
    helpAction: '帮助',
    helpDescription: '打开包含键盘快捷键的帮助对话框',
    zoomInAction: '放大',
    zoomInShortcut: '鼠标滚轮向上',
    zoomInDescription: '放大画布',
    zoomOutAction: '缩小',
    zoomOutShortcut: '鼠标滚轮向下',
    zoomOutDescription: '缩小画布',
    panCanvasAction: '平移画布',
    panCanvasShortcut: '左键拖拽',
    panCanvasDescription: '在平移模式下移动画布',
    togglePanToolAction: '切换平移工具',
    togglePanToolShortcut: '右键单击',
    togglePanToolDescription: '切换平移模式开/关；左键单击以返回选择模式',
    lassoSelectAction: '套索选择',
    lassoSelectShortcut: '左键单击 + 拖拽（空白区域）',
    lassoSelectDescription: '绘制矩形选择框以选择多个项目',
    deselectAction: '取消选择',
    deselectShortcut: '左键单击（空白区域）',
    deselectDescription: '取消当前选择并返回选择模式',
    // Mouse interactions
    selectToolAction: '选择工具',
    selectToolShortcut: '点击选择按钮',
    selectToolDescription: '切换到选择模式',
    panToolAction: '平移工具',
    panToolShortcut: '点击平移按钮',
    panToolDescription: '切换到平移模式以移动画布',
    addItemAction: '添加项目',
    addItemShortcut: '点击添加项目按钮',
    addItemDescription: '打开图标选择器以添加新项目',
    drawRectangleAction: '绘制矩形',
    drawRectangleShortcut: '点击矩形按钮',
    drawRectangleDescription: '切换到矩形绘制模式',
    createConnectorAction: '创建连接器',
    createConnectorShortcut: '点击连接器按钮',
    createConnectorDescription: '切换到连接器模式',
    addTextAction: '添加文本',
    addTextShortcut: '点击文本按钮',
    addTextDescription: '创建新的文本框',
    deleteSelectedAction: '删除所选',
    deleteSelectedShortcut: 'Delete（Mac 上为 Backspace）',
    deleteSelectedDescription: '删除所选项目或套索选择中的所有项目；支持撤销/重做',
    cutAction: '剪切',
    cutDescription:
      '将所选项目剪切到剪贴板——项目被移除并可粘贴到其他位置；支持撤销/重做',
    copyAction: '复制',
    copyDescription: '将所选项目复制到剪贴板',
    pasteAction: '粘贴',
    pasteDescription: '将剪贴板项目粘贴到鼠标位置；偏移以避免重叠',
    // D10 — Select all row
    selectAllAction: '全选',
    selectAllShortcut: 'Ctrl+A',
    selectAllDescription: '选择当前视图中所有可见且未锁定的项目（项目、矩形、文本框、连接线及其路径点）',
    // D10 — tool-activation keys (ADR 0022 §6)
    keyRenameAction: '重命名',
    keyRenameShortcut: 'F2',
    keyRenameDescription: '就地重命名选定的项目或图表',
    keyAddItemAction: '添加项目 / 元素',
    keyAddItemShortcut: 'N',
    keyAddItemDescription: '切换元素面板以放置新项目',
    keyConnectorAction: '连接线',
    keyConnectorShortcut: 'C',
    keyConnectorDescription: '切换到连接线工具',
    keyLassoAction: '套索选择',
    keyLassoShortcut: 'L',
    keyLassoDescription: '切换到套索选择工具',
    keySelectAction: '选择',
    keySelectShortcut: 'S',
    keySelectDescription: '切换到选择工具',
    // D10 — mouse interactions
    miSelectAction: '选择',
    miSelectMethod: '左键单击',
    miSelectDescription: '单击项目以选择它（高亮显示并显示浮动操作栏）。单击空白画布以清除选择。',
    miOpenDetailsAction: '打开详情',
    miOpenDetailsMethod: '双击',
    miOpenDetailsDescription: '双击项目以打开其详情面板——与右键菜单中的“详情…”项相同。',
    miToggleSelectionAction: '切换选择',
    miToggleSelectionMethod: 'Ctrl/Cmd + 左键单击',
    miToggleSelectionDescription: '从多选中添加或移除项目；连接线会与其路径点一起切换。',
    miPanAction: '平移',
    miPanMethod: '右键单击 + 拖动',
    miPanDescription: '按住右键并拖动以平移画布。中键拖动也可平移；方向键可微移。',
    miContextMenuAction: '右键菜单',
    miContextMenuMethod: '右键单击（轻点）',
    miContextMenuDescription: '不拖动的右键单击会打开右键菜单——在项目上为项目菜单，在空白处为画布菜单。触屏上为长按。',
    miRemoveWaypointAction: '移除路径点',
    miRemoveWaypointMethod: 'Alt + 左键单击',
    miRemoveWaypointDescription: 'Alt+单击连接线路径点以将其删除（无需先选择连接线）；端点锚点会被保留。',
    miZoomAction: '缩放',
    miZoomMethod: '滚轮',
    miZoomDescription: '滚动以朝光标方向缩放。'
  },
  connectorHintTooltip: {
    tipCreatingConnectors: '提示：创建连接器',
    tipConnectorTools: '提示：连接器工具',
    clickInstructionStart: '点击',
    clickInstructionMiddle: '第一个节点或点，然后',
    clickInstructionEnd: '第二个节点或点来创建连接。',
    nowClickTarget: '现在点击目标以完成连接。',
    dragStart: '拖拽',
    dragEnd: '从第一个节点到第二个节点来创建连接。',
    rerouteStart: '要重新规划连接器线路，请',
    rerouteMiddle: '左键点击',
    rerouteEnd: '连接器线上的任何点并拖拽以创建或移动锚点。'
  },
  lassoHintTooltip: {
    tipLasso: '提示：套索选择',
    tipFreehandLasso: '提示：自由套索选择',
    lassoDragStart: '点击并拖拽',
    lassoDragEnd: '以绘制矩形选择框来选中您想选择的项目。',
    freehandDragStart: '点击并拖拽',
    freehandDragMiddle: '以绘制',
    freehandDragEnd: '自由形状',
    freehandComplete: '围绕项目。释放以选择形状内的所有项目。',
    moveStart: '选择后，',
    moveMiddle: '在选择区域内点击',
    moveEnd: '并拖拽以一起移动所有选中的项目。'
  },
  importHintTooltip: {
    title: '导入图表',
    instructionStart: '要导入图表，请点击左上角的',
    menuButton: '菜单按钮',
    instructionMiddle: '（☰），然后选择',
    openButton: '"打开"',
    instructionEnd: '来加载您的图表文件。'
  },
  connectorRerouteTooltip: {
    title: '提示：重新规划连接器路径',
    instructionStart: '连接器放置后，您可以随意重新规划路径。',
    instructionSelect: '先选择连接器',
    instructionMiddle: '，然后',
    instructionClick: '点击连接器路径',
    instructionAnd: '并',
    instructionDrag: '拖拽',
    instructionEnd: '即可更改！'
  },
  connectorEmptySpaceTooltip: {
    message: '要将此连接器连接到节点，',
    instruction: '左键单击连接器末端并将其拖动到所需节点。'
  },
  settings: {
    // D3 — SettingsDialog chrome
    title: '设置',
    close: '关闭',
    canvas: '画布',
    language: '语言',
    about: '关于',
    languageDescription: '选择应用程序界面的显示语言。',
    zoomSection: '缩放',
    labelsSection: '标签',
    zoom: {
      description: '配置使用鼠标滚轮时的缩放行为。',
      zoomToCursor: '光标缩放',
      zoomToCursorDesc:
        '启用时，以鼠标光标位置为中心进行缩放。禁用时，以画布中心进行缩放。'
    },
    hotkeys: {
      title: '快捷键设置',
      profile: '快捷键配置',
      profileQwerty: 'QWERTY（Q、W、E、R、T、Y）',
      profileSmnrct: 'SMNRCT（S、M、N、R、C、T）',
      profileNone: '无快捷键',
      tool: '工具',
      hotkey: '快捷键',
      toolSelect: '选择',
      toolPan: '平移',
      toolAddItem: '添加项目',
      toolRectangle: '矩形',
      toolConnector: '连接器',
      toolText: '文本',
      note: '注意：在文本输入框中输入时快捷键不生效',
      fixedShortcutsTitle: '固定快捷键（始终有效）',
      fixedCut: '剪切',
      fixedCopy: '复制',
      fixedPaste: '粘贴',
      fixedUndo: '撤销',
      fixedRedo: '重做'
    },
    connector: {
      title: '连接器设置',
      connectionMode: '连接创建模式',
      clickMode: '点击模式（推荐）',
      clickModeDesc: '先点击第一个节点，然后点击第二个节点来创建连接',
      dragMode: '拖拽模式',
      dragModeDesc: '从第一个节点点击并拖拽到第二个节点',
      note: '注意：您可以随时更改此设置。所选模式将在连接器工具激活时使用。'
    },
    iconPacks: {
      title: '图标包管理',
      lazyLoading: '启用延迟加载',
      lazyLoadingDesc: '按需加载图标包以加快启动速度',
      availablePacks: '可用图标包',
      coreIsoflow: '核心 Axoview（始终加载）',
      alwaysEnabled: '始终启用',
      awsPack: 'AWS 图标',
      gcpPack: 'Google Cloud 图标',
      azurePack: 'Azure 图标',
      kubernetesPack: 'Kubernetes 图标',
      loading: '加载中...',
      loaded: '已加载',
      notLoaded: '未加载',
      iconCount: '{count} 个图标',
      lazyLoadingDisabledNote: '延迟加载已禁用。所有图标包将在启动时加载。',
      note: '可以根据需要启用或禁用图标包。禁用的图标包将减少内存使用并提高性能。'
    }
  },
  lazyLoadingWelcome: {
    title: '欢迎使用 Axoview',
    message:
      '嘿！应大家的要求，我们实现了图标的延迟加载功能，现在如果您想启用非标准图标包，可以在「配置」部分中启用它们。',
    configPath: '点击左上角的汉堡菜单图标',
    configPath2: '以访问配置。',
    canDisable: '如果您愿意，可以禁用此行为。',
    signature: '— Axoview'
  },
  viewTabs: {
    addPage: '添加页面',
    deletePage: '删除页面',
    renameDiagram: '重命名图表',
    addPageDisabled: '已达到页面上限 (5)'
  },
  nodePanel: {
    details: '详情',
    style: '样式',
    notes: '备注',
    notesModified: '备注 ●',
    close: '关闭',
    openLink: '打开链接',
    caption: '说明文字',
    noCaption: '无说明文字。',
    showLabel: '显示标签',
    hideLabel: '隐藏标签',
    showName: '显示名称',
    hideName: '隐藏名称'
  },
  nodeInfoTab: {
    name: '名称',
    namePlaceholder: '节点名称…',
    removeLink: '移除链接',
    addLink: '为名称添加链接',
    linkPlaceholder: 'https://…',
    caption: '说明文字',
    captionHint: '显示在画布中节点名称下方',
    openLink: '打开链接',
    diagramLink: '链接到图表',
    diagramLinkPlaceholder: '选择图表…',
    diagramLinkHint: '在只读模式下单击此节点将打开链接的图表',
    openDiagramLink: '打开链接的图表'
  },
  nodeStyleTab: {
    icon: '图标',
    close: '关闭',
    change: '更改…',
    iconSize: '图标大小',
    labelFontSize: '标签字体大小',
    labelColor: '标签颜色',
    labelHeight: '标签高度'
  },
  connectorControls: {
    close: '关闭',
    labels: '标签',
    details: '详情',
    style: '样式',
    notes: '备注',
    notesModified: '备注 ●',
    name: '名称',
    namePlaceholder: '边标签…',
    additionalLabels: '附加标签',
    addLabel: '添加标签',
    noLabels: '暂无标签。',
    addLink: '添加链接',
    removeLink: '移除链接',
    linkPlaceholder: 'https://…',
    showLabel: '显示标签',
    hideLabel: '隐藏标签',
    showName: '显示名称',
    hideName: '隐藏名称',
    color: '颜色',
    width: '粗细',
    lineStyle: '线条样式',
    lineType: '线条类型',
    useCustomColor: '使用自定义颜色',
    showArrow: '显示箭头',
    solid: '实线',
    dotted: '点线',
    dashed: '虚线',
    singleLine: '单线',
    doubleLine: '双线',
    doubleLineWithCircle: '带圆圈的双线'
  },
  textBoxControls: {
    close: '关闭',
    name: '名称',
    namePlaceholder: '元素名称…',
    text: '文本',
    textSize: '文本大小',
    textColor: '文本颜色',
    alignment: '对齐方式'
  },
  rectangleControls: {
    close: '关闭',
    name: '名称',
    namePlaceholder: '元素名称…',
    color: '颜色',
    useCustomColor: '使用自定义颜色'
  },
  labelColorPicker: {
    customColor: '自定义颜色'
  },
  deleteButton: {
    delete: '删除'
  },
  nodeActionBar: {
    style: '样式',
    editName: '编辑名称',
    editLink: '编辑链接',
    addLink: '添加链接',
    editNotes: '编辑备注',
    addNotes: '添加备注',
    startConnector: '开始连接',
    delete: '删除'
  },
  quickAddNodePopover: {
    add: '添加',
    rectangle: '分组'
  },
  zoomControls: {
    zoomOut: '缩小',
    zoomIn: '放大',
    fitToScreen: '适应屏幕',
    keepLabelsReadable: '保持标签清晰可读',
    help: '帮助 (F1)',
    selected: '已选择 {count} 项'
  },
  previewLayerSwitcher: {
    layers: '图层',
    showLayer: '显示图层',
    hideLayer: '隐藏图层',
    solo: '单独显示',
    unsolo: '退出单独显示'
  },
  previewLabelsToggle: {
    hideLabels: '隐藏标签',
    showLabels: '显示标签'
  },
  annotationPalette: {
    pen: '批注',
    select: '选择',
    draw: '绘制',
    shapes: '形状',
    pencil: '铅笔',
    highlighter: '荧光笔',
    line: '直线',
    arrow: '箭头',
    rectangle: '矩形',
    ellipse: '椭圆',
    eraser: '橡皮擦',
    undo: '撤销',
    redo: '重做',
    clear: '全部清除'
  },
  viewModeInfoPopover: {
    close: '关闭'
  },
  labelSettings: {
    description: '配置标签显示设置',
    expandButtonPadding: '展开按钮内边距',
    expandButtonPaddingDesc: '展开按钮可见时的底部内边距（防止文字重叠）',
    // D13
    currentValue: '当前：{value} 主题单位'
  },
  iconSelectionControls: {
    close: '关闭',
    importIcons: '导入图标',
    addMoreIcons: '添加更多图标',
    isometricLabel: '作为等轴测处理（3D 视图）',
    isometricHint: '取消勾选以使用平面图标（Logo、UI 元素）',
    dragHint: '您可以将下方任意项目拖放到画布上。',
    aiPromptTooltip: '用 AI 生成图标',
    aiPromptTitle: '用 AI 生成等距图标',
    aiPromptBody:
      "将此提示粘贴到图像生成 AI 中。将 'my object' 替换为你需要的内容，然后导入生成的 PNG。",
    aiPromptCopy: '复制提示',
    aiPromptCopied: '已复制'
  },
  searchbox: {
    placeholder: '搜索图标'
  },
  exportImageDialog: {
    title: '导出为图片',
    compatibilityTitle: '浏览器兼容性提示',
    compatibilityMessage:
      '为获得最佳效果，请使用 Chrome 或 Edge。Firefox 目前与导出功能存在兼容性问题。',
    cropInstruction: '点击并拖动以选择要导出的区域',
    options: '选项',
    showGrid: '显示网格',
    showLabels: '显示标签',
    expandDescriptions: '展开描述',
    screenshotPreset: '屏幕截图（推荐）',
    scaleClamped: '导出尺寸已缩小以适应浏览器图片限制：',
    cropToContent: '裁剪到内容',
    backgroundColor: '背景颜色',
    transparentBackground: '透明背景',
    exportQuality: '导出质量（DPI）',
    custom: '自定义',
    recrop: '重新裁剪',
    cropApplied: '裁剪已成功应用',
    applyCrop: '应用裁剪',
    clearSelection: '清除选择',
    cropHint: '选择要裁剪的区域，或取消勾选「裁剪到内容」以使用完整图片',
    cancel: '取消',
    downloadSvg: '下载为 SVG',
    downloadPng: '下载为 PNG',
    error: '无法导出图片'
  },
  toolMenu: {
    undo: '撤销',
    redo: '重做',
    select: '选择',
    lassoSelect: '套索选择',
    freehandLasso: '自由套索',
    pan: '平移',
    addItem: '添加项目',
    rectangle: '矩形',
    connector: '连接器',
    text: '文本',
    common: '常用',
    // D5
    switchTo2D: '切换到 2D 视图',
    switchToIsometric: '切换到等距视图',
    clickMode: '点击',
    dragMode: '拖动'
  },
  quickIconSelector: {
    recentlyUsed: '最近使用',
    searchResults: '搜索结果（{count} 个图标）',
    noIconsFound: '未找到匹配 "{term}" 的图标'
  },
  canvasContextMenu: {
    details: '详情…',
    rename: '重命名',
    cut: '剪切',
    copy: '复制',
    paste: '粘贴',
    duplicate: '创建副本',
    bringForward: '上移一层',
    sendBackward: '下移一层',
    assignToLayer: '指定到图层',
    snapToGrid: '对齐到网格',
    unsnapFromGrid: '取消对齐网格',
    disableCollision: '禁用碰撞',
    enableCollision: '启用碰撞',
    delete: '删除',
    addItem: '添加项目',
    selectAll: '全选',
    enableSnapToGrid: '启用网格对齐',
    disableSnapToGrid: '禁用网格对齐',
    itemsSelectedOne: '已选择 {count} 个项目',
    itemsSelectedOther: '已选择 {count} 个项目',
    deleteItemsOne: '删除 {count} 个项目',
    deleteItemsOther: '删除 {count} 个项目',
    removeFromLayer: '从图层移除',
    noLayers: '没有图层 — 在图层面板中添加一个'
  },
  // D4 — LeftDock
  leftDock: {
    fileExplorer: '文件资源管理器',
    elements: '元素',
    layers: '图层',
    settings: '设置',
    openDiagramFirst: '请先打开或创建一个图表'
  },
  // D8 — LayersPanel
  layersPanel: {
    header: '图层',
    addLayer: '添加图层',
    deleteSelectedLayer: '删除选定图层',
    noLayersYet: '暂无图层。点击 + 添加一个。',
    unassigned: '未分配 ({count})',
    dropToUnassign: '将项目拖放到此处以取消分配',
    layerN: '图层 {count}'
  },
  // D7 — clipboard toast strings; {count}/{percent} interpolated.
  clipboard: {
    copiedOne: '已复制 {count} 个项目',
    copiedOther: '已复制 {count} 个项目',
    cutOne: '已剪切 {count} 个项目',
    cutOther: '已剪切 {count} 个项目',
    pastedOne: '已粘贴 {count} 个项目',
    pastedOther: '已粘贴 {count} 个项目',
    nothingToPaste: '没有可粘贴的内容',
    routingConnectors: '正在粘贴…正在布线连接线（{percent}%）'
  },
  // D13 — default page name; {count} interpolated.
  page: {
    pageName: '第 {count} 页'
  }
};

export default locale;
