import { LocaleProps } from '../types/axoviewProps';

const locale: LocaleProps = {
  common: {
    exampleText: 'Это пример текста'
  },
  helpDialog: {
    title: 'Горячие клавиши и справка',
    close: 'Закрыть',
    keyboardShortcuts: 'Горячие клавиши',
    mouseInteractions: 'Взаимодействие с мышью',
    action: 'Действие',
    shortcut: 'Горячая клавиша',
    method: 'Метод',
    description: 'Описание',
    note: 'Примечание:',
    noteContent:
      'Горячие клавиши отключены при вводе в полях ввода, текстовых областях или редактируемых элементах во избежание конфликтов.',
    // Keyboard shortcuts
    undoAction: 'Отменить',
    undoDescription: 'Отменить последнее действие',
    redoAction: 'Повторить',
    redoDescription: 'Повторить последнее отмененное действие',
    redoAltAction: 'Повторить (альтернатива)',
    redoAltDescription: 'Альтернативная горячая клавиша для повтора',
    helpAction: 'Справка',
    helpDescription: 'Открыть диалог справки с горячими клавишами',
    zoomInAction: 'Увеличить',
    zoomInShortcut: 'Колесико мыши вверх',
    zoomInDescription: 'Увеличить масштаб холста',
    zoomOutAction: 'Уменьшить',
    zoomOutShortcut: 'Колесико мыши вниз',
    zoomOutDescription: 'Уменьшить масштаб холста',
    panCanvasAction: 'Переместить холст',
    panCanvasShortcut: 'Левая кнопка + перетаскивание',
    panCanvasDescription: 'Переместить холст в режиме перемещения',
    togglePanToolAction: 'Переключить инструмент перемещения',
    togglePanToolShortcut: 'Правая кнопка мыши',
    togglePanToolDescription:
      'Включить/выключить режим перемещения; левая кнопка для возврата в режим выделения',
    lassoSelectAction: 'Выделение лассо',
    lassoSelectShortcut: 'Левая кнопка + перетаскивание (пустая область)',
    lassoSelectDescription:
      'Нарисуйте прямоугольную область для выделения нескольких элементов',
    deselectAction: 'Снять выделение',
    deselectShortcut: 'Левая кнопка (пустая область)',
    deselectDescription:
      'Снять текущее выделение и вернуться в режим выделения',
    // Mouse interactions
    selectToolAction: 'Инструмент выделения',
    selectToolShortcut: 'Нажать кнопку Выделить',
    selectToolDescription: 'Переключиться в режим выделения',
    panToolAction: 'Инструмент перемещения',
    panToolShortcut: 'Нажать кнопку Переместить',
    panToolDescription: 'Переключиться в режим перемещения холста',
    addItemAction: 'Добавить элемент',
    addItemShortcut: 'Нажать кнопку Добавить элемент',
    addItemDescription: 'Открыть выбор иконок для добавления новых элементов',
    drawRectangleAction: 'Нарисовать прямоугольник',
    drawRectangleShortcut: 'Нажать кнопку Прямоугольник',
    drawRectangleDescription: 'Переключиться в режим рисования прямоугольников',
    createConnectorAction: 'Создать соединитель',
    createConnectorShortcut: 'Нажать кнопку Соединитель',
    createConnectorDescription: 'Переключиться в режим соединителя',
    addTextAction: 'Добавить текст',
    addTextShortcut: 'Нажать кнопку Текст',
    addTextDescription: 'Создать новое текстовое поле',
    deleteSelectedAction: 'Удалить выделенное',
    deleteSelectedShortcut: 'Delete (Backspace на Mac)',
    deleteSelectedDescription:
      'Удалить выделенный элемент или все элементы в лассо-выделении; поддерживает отмену/повтор',
    cutAction: 'Вырезать',
    cutDescription:
      'Вырезать выделенные элементы в буфер обмена — элементы удаляются и могут быть вставлены в другое место; поддерживает отмену/повтор',
    copyAction: 'Копировать',
    copyDescription: 'Копировать выделенные элементы в буфер обмена',
    pasteAction: 'Вставить',
    pasteDescription:
      'Вставить элементы буфера обмена в позицию мыши; смещение для избежания перекрытия',
    // D10 — Select all row
    selectAllAction: 'Выделить всё',
    selectAllShortcut: 'Ctrl+A',
    selectAllDescription:
      'Выделить все видимые незаблокированные объекты в активном виде (элементы, прямоугольники, текстовые поля, соединители + их путевые точки)',
    // D10 — tool-activation keys (ADR 0022 §6)
    keyRenameAction: 'Переименовать',
    keyRenameShortcut: 'F2',
    keyRenameDescription: 'Переименовать выбранный объект или диаграмму на месте',
    keyAddItemAction: 'Добавить элемент / Элементы',
    keyAddItemShortcut: 'N',
    keyAddItemDescription: 'Переключить панель «Элементы», чтобы разместить новый элемент',
    keyConnectorAction: 'Соединитель',
    keyConnectorShortcut: 'C',
    keyConnectorDescription: 'Переключиться на инструмент соединителя',
    keyLassoAction: 'Выделение лассо',
    keyLassoShortcut: 'L',
    keyLassoDescription: 'Переключиться на инструмент выделения лассо',
    keySelectAction: 'Выделить',
    keySelectShortcut: 'S',
    keySelectDescription: 'Переключиться на инструмент выделения',
    // D10 — mouse interactions
    miSelectAction: 'Выделить',
    miSelectMethod: 'Левый клик',
    miSelectDescription:
      'Щёлкните объект, чтобы выделить его (подсвечивает его и показывает плавающую панель действий). Щёлкните пустой холст, чтобы снять выделение.',
    miOpenDetailsAction: 'Открыть сведения',
    miOpenDetailsMethod: 'Двойной клик',
    miOpenDetailsDescription:
      'Дважды щёлкните объект, чтобы открыть его панель сведений — то же, что пункт «Сведения…» контекстного меню.',
    miToggleSelectionAction: 'Переключить выделение',
    miToggleSelectionMethod: 'Ctrl/Cmd + Левый клик',
    miToggleSelectionDescription:
      'Добавить или убрать объект из множественного выделения; соединитель переключается вместе со своими путевыми точками.',
    miPanAction: 'Панорамирование',
    miPanMethod: 'Правый клик + перетаскивание',
    miPanDescription:
      'Удерживайте правую кнопку и перетаскивайте, чтобы панорамировать холст. Перетаскивание средней кнопкой тоже панорамирует; стрелки сдвигают его.',
    miContextMenuAction: 'Контекстное меню',
    miContextMenuMethod: 'Правый клик (касание)',
    miContextMenuDescription:
      'Правый клик без перетаскивания открывает контекстное меню — меню объекта над объектом или меню холста над пустым местом. На сенсорном экране — долгое нажатие.',
    miRemoveWaypointAction: 'Удалить путевую точку',
    miRemoveWaypointMethod: 'Alt + Левый клик',
    miRemoveWaypointDescription:
      'Alt+клик по путевой точке соединителя, чтобы удалить её (не нужно сначала выделять соединитель); конечные привязки сохраняются.',
    miZoomAction: 'Масштаб',
    miZoomMethod: 'Колесо мыши',
    miZoomDescription: 'Прокручивайте для масштабирования к курсору.'
  },
  connectorHintTooltip: {
    tipCreatingConnectors: 'Совет: Создание соединителей',
    tipConnectorTools: 'Совет: Инструменты соединителей',
    clickInstructionStart: 'Нажмите',
    clickInstructionMiddle: 'на первый узел или точку, затем',
    clickInstructionEnd: 'на второй узел или точку, чтобы создать соединение.',
    nowClickTarget: 'Теперь нажмите на цель, чтобы завершить соединение.',
    dragStart: 'Перетащите',
    dragEnd: 'от первого узла ко второму узлу, чтобы создать соединение.',
    rerouteStart: 'Чтобы изменить маршрут соединителя,',
    rerouteMiddle: 'нажмите левой кнопкой',
    rerouteEnd:
      'на любую точку вдоль линии соединителя и перетащите, чтобы создать или переместить опорные точки.'
  },
  lassoHintTooltip: {
    tipLasso: 'Совет: Выделение лассо',
    tipFreehandLasso: 'Совет: Свободное выделение лассо',
    lassoDragStart: 'Нажмите и перетащите',
    lassoDragEnd:
      'чтобы нарисовать прямоугольную область выделения вокруг элементов, которые вы хотите выбрать.',
    freehandDragStart: 'Нажмите и перетащите',
    freehandDragMiddle: 'чтобы нарисовать',
    freehandDragEnd: 'произвольную форму',
    freehandComplete:
      'вокруг элементов. Отпустите, чтобы выбрать все элементы внутри формы.',
    moveStart: 'После выделения',
    moveMiddle: 'нажмите внутри выделения',
    moveEnd: 'и перетащите, чтобы переместить все выделенные элементы вместе.'
  },
  importHintTooltip: {
    title: 'Импорт диаграмм',
    instructionStart: 'Чтобы импортировать диаграммы, нажмите',
    menuButton: 'кнопку меню',
    instructionMiddle: '(☰) в верхнем левом углу, затем выберите',
    openButton: '"Открыть"',
    instructionEnd: 'чтобы загрузить файлы диаграмм.'
  },
  connectorRerouteTooltip: {
    title: 'Совет: Изменение маршрута соединителей',
    instructionStart:
      'После размещения соединителей вы можете изменить их маршрут по своему усмотрению.',
    instructionSelect: 'Выберите соединитель',
    instructionMiddle: 'сначала, затем',
    instructionClick: 'нажмите на путь соединителя',
    instructionAnd: 'и',
    instructionDrag: 'перетащите',
    instructionEnd: 'чтобы изменить его!'
  },
  connectorEmptySpaceTooltip: {
    message: 'Чтобы подключить этот соединитель к узлу,',
    instruction:
      'щелкните левой кнопкой мыши на конце соединителя и перетащите его к нужному узлу.'
  },
  settings: {
    // D3 — SettingsDialog chrome
    title: 'Настройки',
    close: 'Закрыть',
    canvas: 'Холст',
    language: 'Язык',
    about: 'О программе',
    languageDescription:
      'Выберите язык отображения интерфейса приложения.',
    zoomSection: 'Масштаб',
    labelsSection: 'Подписи',
    zoom: {
      description:
        'Настройте поведение масштабирования при использовании колесика мыши.',
      zoomToCursor: 'Масштабировать к курсору',
      zoomToCursorDesc:
        'При включении масштабирование центрируется на позиции курсора мыши. При выключении масштабирование центрируется на холсте.'
    },
    hotkeys: {
      title: 'Настройки горячих клавиш',
      profile: 'Профиль горячих клавиш',
      profileQwerty: 'QWERTY (Q, W, E, R, T, Y)',
      profileSmnrct: 'SMNRCT (S, M, N, R, C, T)',
      profileNone: 'Без горячих клавиш',
      tool: 'Инструмент',
      hotkey: 'Горячая клавиша',
      toolSelect: 'Выделить',
      toolPan: 'Переместить',
      toolAddItem: 'Добавить элемент',
      toolRectangle: 'Прямоугольник',
      toolConnector: 'Соединитель',
      toolText: 'Текст',
      note: 'Примечание: Горячие клавиши работают, когда вы не вводите текст в текстовых полях',
      fixedShortcutsTitle: 'Фиксированные сочетания (всегда активны)',
      fixedCut: 'Вырезать',
      fixedCopy: 'Копировать',
      fixedPaste: 'Вставить',
      fixedUndo: 'Отменить',
      fixedRedo: 'Повторить'
    },
    connector: {
      title: 'Настройки соединителя',
      connectionMode: 'Режим создания соединения',
      clickMode: 'Режим нажатия (рекомендуется)',
      clickModeDesc:
        'Нажмите на первый узел, затем нажмите на второй узел, чтобы создать соединение',
      dragMode: 'Режим перетаскивания',
      dragModeDesc: 'Нажмите и перетащите от первого узла ко второму узлу',
      note: 'Примечание: Вы можете изменить эту настройку в любое время. Выбранный режим будет использоваться, когда инструмент соединителя активен.'
    },
    iconPacks: {
      title: 'Управление Пакетами Иконок',
      lazyLoading: 'Включить Ленивую Загрузку',
      lazyLoadingDesc:
        'Загружать пакеты иконок по требованию для более быстрого запуска',
      availablePacks: 'Доступные Пакеты Иконок',
      coreIsoflow: 'Core Isoflow (Всегда Загружен)',
      alwaysEnabled: 'Всегда включено',
      awsPack: 'Иконки AWS',
      gcpPack: 'Иконки Google Cloud',
      azurePack: 'Иконки Azure',
      kubernetesPack: 'Иконки Kubernetes',
      loading: 'Загрузка...',
      loaded: 'Загружено',
      notLoaded: 'Не загружено',
      iconCount: '{count} иконок',
      lazyLoadingDisabledNote:
        'Ленивая загрузка отключена. Все пакеты иконок загружаются при запуске.',
      note: 'Пакеты иконок могут быть включены или отключены в зависимости от ваших потребностей. Отключенные пакеты уменьшат использование памяти и улучшат производительность.'
    }
  },
  lazyLoadingWelcome: {
    title: 'Добро пожаловать в Axoview',
    message:
      "Привет! По многочисленным просьбам мы реализовали Ленивую Загрузку иконок, поэтому теперь, если вы хотите включить нестандартные пакеты иконок, вы можете включить их в разделе 'Конфигурация'.",
    configPath: 'Нажмите на иконку Гамбургер',
    configPath2: 'в верхнем левом углу, чтобы получить доступ к Конфигурации.',
    canDisable: 'Вы можете отключить это поведение, если хотите.',
    signature: '— Axoview'
  },
  viewTabs: {
    addPage: 'Добавить страницу',
    deletePage: 'Удалить страницу',
    renameDiagram: 'Переименовать диаграмму',
    addPageDisabled: 'Достигнут лимит страниц (5)'
  },
  nodePanel: {
    details: 'Подробности',
    style: 'Стиль',
    notes: 'Заметки',
    notesModified: 'Заметки ●',
    close: 'Закрыть',
    openLink: 'Открыть ссылку',
    caption: 'Подпись',
    noCaption: 'Нет подписи.',
    showLabel: 'Показать метку',
    hideLabel: 'Скрыть метку',
    showName: 'Показать имя',
    hideName: 'Скрыть имя'
  },
  nodeInfoTab: {
    name: 'Название',
    namePlaceholder: 'Имя узла…',
    removeLink: 'Удалить ссылку',
    addLink: 'Добавить ссылку к названию',
    linkPlaceholder: 'https://…',
    caption: 'Подпись',
    captionHint: 'Отображается на холсте под именем узла',
    openLink: 'Открыть ссылку',
    diagramLink: 'Ссылка на диаграмму',
    diagramLinkPlaceholder: 'Выберите диаграмму…',
    diagramLinkHint: 'Нажатие на этот узел в режиме только для чтения открывает связанную диаграмму',
    openDiagramLink: 'Открыть связанную диаграмму'
  },
  nodeStyleTab: {
    icon: 'Иконка',
    close: 'Закрыть',
    change: 'Изменить…',
    iconSize: 'Размер иконки',
    labelFontSize: 'Размер шрифта метки',
    labelColor: 'Цвет метки',
    labelHeight: 'Высота метки'
  },
  connectorControls: {
    close: 'Закрыть',
    labels: 'Метки',
    details: 'Подробности',
    style: 'Стиль',
    notes: 'Заметки',
    notesModified: 'Заметки ●',
    name: 'Имя',
    namePlaceholder: 'Метка ребра…',
    additionalLabels: 'Дополнительные метки',
    addLabel: 'Добавить метку',
    noLabels: 'Меток пока нет.',
    addLink: 'Добавить ссылку',
    removeLink: 'Удалить ссылку',
    linkPlaceholder: 'https://…',
    showLabel: 'Показать метку',
    hideLabel: 'Скрыть метку',
    showName: 'Показать имя',
    hideName: 'Скрыть имя',
    color: 'Цвет',
    width: 'Толщина',
    lineStyle: 'Стиль линии',
    lineType: 'Тип линии',
    useCustomColor: 'Использовать свой цвет',
    showArrow: 'Показать стрелку',
    solid: 'Сплошная',
    dotted: 'Пунктирная',
    dashed: 'Штриховая',
    singleLine: 'Одинарная линия',
    doubleLine: 'Двойная линия',
    doubleLineWithCircle: 'Двойная линия с кругом'
  },
  textBoxControls: {
    close: 'Закрыть',
    name: 'Название',
    namePlaceholder: 'Имя элемента…',
    text: 'Текст',
    textSize: 'Размер текста',
    textColor: 'Цвет текста',
    alignment: 'Выравнивание'
  },
  rectangleControls: {
    close: 'Закрыть',
    name: 'Название',
    namePlaceholder: 'Имя элемента…',
    color: 'Цвет',
    useCustomColor: 'Использовать пользовательский цвет'
  },
  labelColorPicker: {
    customColor: 'Пользовательский цвет'
  },
  deleteButton: {
    delete: 'Удалить'
  },
  quickAddNodePopover: {
    add: 'Добавить',
    rectangle: 'Группа'
  },
  zoomControls: {
    zoomOut: 'Уменьшить',
    zoomIn: 'Увеличить',
    fitToScreen: 'По размеру экрана',
    keepLabelsReadable: 'Сохранять читаемость подписей',
    help: 'Помощь (F1)',
    selected: 'Выбрано: {count}'
  },
  modeHints: {
    connector: 'Перетащите между элементами для соединения • Esc для отмены'
  },
  previewLayerSwitcher: {
    layers: 'Слои',
    showLayer: 'Показать слой',
    hideLayer: 'Скрыть слой',
    solo: 'Соло',
    unsolo: 'Выйти из соло'
  },
  previewLabelsToggle: {
    hideLabels: 'Скрыть подписи',
    showLabels: 'Показать подписи'
  },
  annotationPalette: {
    pen: 'Аннотация',
    select: 'Выбрать',
    draw: 'Рисование',
    shapes: 'Фигуры',
    pencil: 'Карандаш',
    highlighter: 'Маркер',
    line: 'Линия',
    arrow: 'Стрелка',
    rectangle: 'Прямоугольник',
    ellipse: 'Эллипс',
    eraser: 'Ластик',
    undo: 'Отменить',
    redo: 'Повторить',
    clear: 'Очистить всё'
  },
  viewModeInfoPopover: {
    close: 'Закрыть'
  },
  labelSettings: {
    description: 'Настройка параметров отображения меток',
    expandButtonPadding: 'Отступ кнопки развернуть',
    expandButtonPaddingDesc:
      'Нижний отступ при видимой кнопке развернуть (предотвращает перекрытие текста)',
    // D13
    currentValue: 'Текущее: {value} единиц темы'
  },
  iconSelectionControls: {
    close: 'Закрыть',
    importIcons: 'Импортировать иконки',
    addMoreIcons: 'Добавить больше иконок',
    isometricLabel: 'Использовать как изометрический (3D вид)',
    isometricHint: 'Снимите галочку для плоских иконок (логотипы, элементы UI)',
    dragHint: 'Вы можете перетащить любой элемент ниже на холст.',
    aiPromptTooltip: 'Сгенерировать иконки с помощью ИИ',
    aiPromptTitle: 'Сгенерировать изометрические иконки с помощью ИИ',
    aiPromptBody:
      "Вставьте этот промпт в ИИ для генерации изображений. Замените 'my object' на нужный объект и импортируйте получившийся PNG.",
    aiPromptCopy: 'Копировать промпт',
    aiPromptCopied: 'Скопировано'
  },
  searchbox: {
    placeholder: 'Поиск иконок'
  },
  exportImageDialog: {
    groupAppearance: 'Appearance',
    groupBackground: 'Background',
    groupCrop: 'Crop',
    title: 'Экспортировать как изображение',
    compatibilityTitle: 'Уведомление о совместимости браузера',
    compatibilityMessage:
      'Для наилучших результатов используйте Chrome или Edge. Firefox в настоящее время имеет проблемы совместимости с функцией экспорта.',
    cropInstruction:
      'Щёлкните и перетащите, чтобы выбрать область для экспорта',
    options: 'Параметры',
    showGrid: 'Показать сетку',
    showLabels: 'Показать подписи',
    expandDescriptions: 'Развернуть описания',
    screenshotPreset: 'Снимок экрана (рекомендуется)',
    scaleClamped: 'Размер экспорта уменьшен для соответствия ограничению изображения браузера:',
    cropToContent: 'Обрезать по содержимому',
    backgroundColor: 'Цвет фона',
    transparentBackground: 'Прозрачный фон',
    exportQuality: 'Качество экспорта (DPI)',
    custom: 'Пользовательский',
    recrop: 'Обрезать снова',
    cropApplied: 'Обрезка успешно применена',
    applyCrop: 'Применить обрезку',
    clearSelection: 'Снять выделение',
    cropHint:
      'Выберите область для обрезки или снимите галочку «Обрезать по содержимому», чтобы использовать полное изображение',
    cancel: 'Отмена',
    downloadSvg: 'Скачать как SVG',
    downloadPng: 'Скачать как PNG',
    error: 'Не удалось экспортировать изображение'
  },
  toolMenu: {
    undo: 'Отменить',
    redo: 'Повторить',
    select: 'Выделить',
    lassoSelect: 'Выделение лассо',
    freehandLasso: 'Произвольное лассо',
    pan: 'Переместить',
    addItem: 'Добавить элемент',
    rectangle: 'Прямоугольник',
    connector: 'Соединитель',
    text: 'Текст',
    common: 'Общие',
    // D5
    switchTo2D: 'Переключить на 2D-вид',
    switchToIsometric: 'Переключить на изометрический вид',
    clickMode: 'Клик',
    dragMode: 'Перетаскивание'
  },
  quickIconSelector: {
    recentlyUsed: 'НЕДАВНО ИСПОЛЬЗОВАННЫЕ',
    searchResults: 'РЕЗУЛЬТАТЫ ПОИСКА ({count} иконок)',
    noIconsFound: 'Иконки, соответствующие "{term}", не найдены'
  },
  canvasContextMenu: {
    addNote: 'Добавить заметку',
    addLabel: 'Добавить метку',
    details: 'Подробности…',
    rename: 'Переименовать',
    cut: 'Вырезать',
    copy: 'Копировать',
    paste: 'Вставить',
    duplicate: 'Дублировать',
    bringForward: 'На передний план',
    sendBackward: 'На задний план',
    assignToLayer: 'Назначить слою',
    snapToGrid: 'Привязать к сетке',
    unsnapFromGrid: 'Открепить от сетки',
    disableCollision: 'Отключить столкновения',
    enableCollision: 'Включить столкновения',
    delete: 'Удалить',
    addItem: 'Добавить элемент',
    selectAll: 'Выделить всё',
    enableSnapToGrid: 'Включить привязку к сетке',
    disableSnapToGrid: 'Отключить привязку к сетке',
    itemsSelectedOne: 'Выбран {count} элемент',
    itemsSelectedOther: 'Выбрано элементов: {count}',
    deleteItemsOne: 'Удалить {count} элемент',
    deleteItemsOther: 'Удалить элементов: {count}',
    removeFromLayer: 'Убрать со слоя',
    noLayers: 'Нет слоёв — добавьте слой на панели слоёв'
  },
  // D4 — LeftDock
  leftDock: {
    fileExplorer: 'Проводник файлов',
    elements: 'Элементы',
    layers: 'Слои',
    settings: 'Настройки',
    openDiagramFirst: 'сначала откройте или создайте диаграмму',
    collapsePanel: 'Свернуть панель'
  },
  // D8 — LayersPanel
  layersPanel: {
    header: 'Слои',
    addLayer: 'Добавить слой',
    deleteSelectedLayer: 'Удалить выбранный слой',
    noLayersYet: 'Слоёв пока нет. Нажмите +, чтобы добавить.',
    unassigned: 'Без слоя ({count})',
    dropToUnassign: 'Перетащите элементы сюда, чтобы убрать из слоя',
    layerN: 'Слой {count}'
  },
  // D7 — clipboard toast strings; {count}/{percent} interpolated.
  clipboard: {
    copiedOne: 'Скопирован {count} объект',
    copiedOther: 'Скопировано объектов: {count}',
    cutOne: 'Вырезан {count} объект',
    cutOther: 'Вырезано объектов: {count}',
    pastedOne: 'Вставлен {count} объект',
    pastedOther: 'Вставлено объектов: {count}',
    nothingToPaste: 'Нечего вставить',
    routingConnectors: 'Вставка… трассировка соединителей ({percent}%)'
  },
  // D13 — default page name; {count} interpolated.
  page: {
    pageName: 'Страница {count}'
  }
};

export default locale;
