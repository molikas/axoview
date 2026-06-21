import { LocaleProps } from '../types/axoviewProps';

const locale: LocaleProps = {
  common: {
    exampleText: 'Questo è un testo di esempio'
  },
  helpDialog: {
    title: 'Scorciatoie da tastiera e aiuto',
    close: 'Chiudi',
    keyboardShortcuts: 'Scorciatoie da tastiera',
    mouseInteractions: 'Interazioni del mouse',
    action: 'Azione',
    shortcut: 'Scorciatoia',
    method: 'Metodo',
    description: 'Descrizione',
    note: 'Nota:',
    noteContent:
      'Le scorciatoie da tastiera sono disattivate durante la digitazione in campi di testo o elementi modificabili per evitare conflitti.',
    // Keyboard shortcuts
    undoAction: 'Annulla',
    undoDescription: "Annulla l'ultima azione",
    redoAction: 'Ripeti',
    redoDescription: "Ripeti l'ultima azione annullata",
    redoAltAction: 'Ripeti (Alternativa)',
    redoAltDescription: 'Scorciatoia alternativa per ripetere',
    helpAction: 'Aiuto',
    helpDescription: 'Apri la finestra di aiuto con le scorciatoie da tastiera',
    zoomInAction: 'Ingrandisci',
    zoomInShortcut: 'Rotella del mouse su',
    zoomInDescription: 'Ingrandisci la tela',
    zoomOutAction: 'Rimpicciolisci',
    zoomOutShortcut: 'Rotella del mouse giù',
    zoomOutDescription: 'Rimpicciolisci la tela',
    panCanvasAction: 'Sposta la tela',
    panCanvasShortcut: 'Clic sinistro + trascina',
    panCanvasDescription: 'Muovi la tela in modalità panoramica',
    togglePanToolAction: 'Attiva/Disattiva panoramica',
    togglePanToolShortcut: 'Clic destro',
    togglePanToolDescription:
      'Attiva/disattiva modalità panoramica; clic sinistro per tornare alla modalità selezione',
    lassoSelectAction: 'Selezione Lasso',
    lassoSelectShortcut: 'Clic sinistro + Trascina (area vuota)',
    lassoSelectDescription:
      'Disegna un riquadro di selezione rettangolare per selezionare più elementi',
    deselectAction: 'Deseleziona',
    deselectShortcut: 'Clic sinistro (area vuota)',
    deselectDescription:
      'Deseleziona la selezione corrente e torna alla modalità selezione',
    // Mouse interactions
    selectToolAction: 'Strumento Selezione',
    selectToolShortcut: 'Clicca il pulsante Selezione',
    selectToolDescription: 'Passa alla modalità selezione',
    panToolAction: 'Strumento Panoramica',
    panToolShortcut: 'Clicca il pulsante Panoramica',
    panToolDescription: 'Passa alla modalità panoramica per spostare la tela',
    addItemAction: 'Aggiungi elemento',
    addItemShortcut: 'Clicca il pulsante Aggiungi elemento',
    addItemDescription:
      'Apri il selettore di icone per aggiungere nuovi elementi',
    drawRectangleAction: 'Disegna rettangolo',
    drawRectangleShortcut: 'Clicca il pulsante Rettangolo',
    drawRectangleDescription: 'Passa alla modalità disegno rettangolo',
    createConnectorAction: 'Crea connettore',
    createConnectorShortcut: 'Clicca il pulsante Connettore',
    createConnectorDescription: 'Passa alla modalità connettore',
    addTextAction: 'Aggiungi testo',
    addTextShortcut: 'Clicca il pulsante Testo',
    addTextDescription: 'Crea una nuova casella di testo',
    deleteSelectedAction: 'Elimina selezionati',
    deleteSelectedShortcut: 'Canc (Backspace su Mac)',
    deleteSelectedDescription:
      "Elimina l'elemento selezionato o tutti gli elementi in una selezione lasso; supporta annulla/ripeti",
    cutAction: 'Taglia',
    cutDescription:
      'Taglia gli elementi selezionati negli appunti — gli elementi vengono rimossi e possono essere incollati altrove; supporta annulla/ripeti',
    copyAction: 'Copia',
    copyDescription: 'Copia gli elementi selezionati negli appunti',
    pasteAction: 'Incolla',
    pasteDescription:
      'Incolla gli elementi degli appunti alla posizione del mouse; sposta per evitare sovrapposizioni',
    // D10 — Select all row
    selectAllAction: 'Seleziona tutto',
    selectAllShortcut: 'Ctrl+A',
    selectAllDescription:
      'Seleziona tutti gli elementi visibili e sbloccati nella vista attiva (elementi, rettangoli, caselle di testo, connettori + i loro punti di passaggio)',
    // D10 — tool-activation keys (ADR 0022 §6)
    keyRenameAction: 'Rinomina',
    keyRenameShortcut: 'F2',
    keyRenameDescription: 'Rinomina l’elemento o il diagramma selezionato in linea',
    keyAddItemAction: 'Aggiungi elemento / Elementi',
    keyAddItemShortcut: 'N',
    keyAddItemDescription: 'Attiva/disattiva il pannello Elementi per inserire un nuovo elemento',
    keyConnectorAction: 'Connettore',
    keyConnectorShortcut: 'C',
    keyConnectorDescription: 'Passa allo strumento connettore',
    keyLassoAction: 'Selezione lazo',
    keyLassoShortcut: 'L',
    keyLassoDescription: 'Passa allo strumento di selezione lazo',
    keySelectAction: 'Seleziona',
    keySelectShortcut: 'S',
    keySelectDescription: 'Passa allo strumento di selezione',
    // D10 — mouse interactions
    miSelectAction: 'Seleziona',
    miSelectMethod: 'Clic sinistro',
    miSelectDescription:
      'Fai clic su un elemento per selezionarlo (lo evidenzia e mostra la barra delle azioni flottante). Fai clic sulla tela vuota per annullare la selezione.',
    miOpenDetailsAction: 'Apri dettagli',
    miOpenDetailsMethod: 'Doppio clic',
    miOpenDetailsDescription:
      'Fai doppio clic su un elemento per aprire il suo pannello dei dettagli, come la voce «Dettagli…» del menu contestuale.',
    miToggleSelectionAction: 'Attiva/disattiva selezione',
    miToggleSelectionMethod: 'Ctrl/Cmd + Clic sinistro',
    miToggleSelectionDescription:
      'Aggiungi o rimuovi un elemento dalla selezione multipla; un connettore si attiva/disattiva insieme ai suoi punti di passaggio.',
    miPanAction: 'Sposta',
    miPanMethod: 'Clic destro + trascina',
    miPanDescription:
      'Tieni premuto il pulsante destro e trascina per spostare la tela. Anche il trascinamento con il tasto centrale sposta; i tasti freccia la muovono.',
    miContextMenuAction: 'Menu contestuale',
    miContextMenuMethod: 'Clic destro (tocco)',
    miContextMenuDescription:
      'Un clic destro senza trascinare apre il menu contestuale: il menu dell’elemento sopra un elemento, o il menu della tela sopra uno spazio vuoto. Su touch, tieni premuto a lungo.',
    miRemoveWaypointAction: 'Rimuovi punto di passaggio',
    miRemoveWaypointMethod: 'Alt + Clic sinistro',
    miRemoveWaypointDescription:
      'Alt+clic su un punto di passaggio di un connettore per rimuoverlo (senza dover prima selezionare il connettore); gli ancoraggi terminali vengono conservati.',
    miZoomAction: 'Zoom',
    miZoomMethod: 'Rotellina',
    miZoomDescription: 'Scorri per ingrandire verso il cursore.'
  },
  connectorHintTooltip: {
    tipCreatingConnectors: 'Suggerimento: Creazione connettori',
    tipConnectorTools: 'Suggerimento: Strumenti connettore',
    clickInstructionStart: 'Clicca',
    clickInstructionMiddle: 'sul primo nodo o punto, poi',
    clickInstructionEnd: 'sul secondo nodo o punto per creare una connessione.',
    nowClickTarget: "Ora clicca sull'obiettivo per completare la connessione.",
    dragStart: 'Trascina',
    dragEnd: 'dal primo nodo al secondo nodo per creare una connessione.',
    rerouteStart: 'Per riorientare un connettore,',
    rerouteMiddle: 'clicca con il tasto sinistro',
    rerouteEnd:
      'su un punto qualsiasi lungo la linea del connettore e trascina per creare o spostare i punti di ancoraggio.'
  },
  lassoHintTooltip: {
    tipLasso: 'Suggerimento: Selezione Lasso',
    tipFreehandLasso: 'Suggerimento: Selezione Lasso a mano libera',
    lassoDragStart: 'Clicca e trascina',
    lassoDragEnd:
      'per disegnare un riquadro di selezione rettangolare attorno agli elementi da selezionare.',
    freehandDragStart: 'Clicca e trascina',
    freehandDragMiddle: 'per disegnare una',
    freehandDragEnd: 'forma libera',
    freehandComplete:
      "attorno agli elementi. Rilascia per selezionare tutti gli elementi all'interno della forma.",
    moveStart: 'Una volta selezionati,',
    moveMiddle: "clicca all'interno della selezione",
    moveEnd: 'e trascina per muovere tutti gli elementi selezionati insieme.'
  },
  importHintTooltip: {
    title: 'Importa diagrammi',
    instructionStart: 'Per importare diagrammi, clicca sul',
    menuButton: 'pulsante del menu',
    instructionMiddle: '(☰) in alto a sinistra, poi seleziona',
    openButton: '"Apri"',
    instructionEnd: 'per caricare i tuoi file di diagramma.'
  },
  connectorRerouteTooltip: {
    title: 'Suggerimento: Riorienta connettori',
    instructionStart:
      'Una volta posizionati i connettori, puoi riorientarli come preferisci.',
    instructionSelect: 'Seleziona prima il connettore,',
    instructionMiddle: 'poi',
    instructionClick: 'clicca sul percorso del connettore',
    instructionAnd: 'e',
    instructionDrag: 'trascina',
    instructionEnd: 'per modificarlo!'
  },
  connectorEmptySpaceTooltip: {
    message: 'Per collegare questo connettore a un nodo,',
    instruction:
      'clicca con il tasto sinistro sulla fine del connettore e trascinalo sul nodo desiderato.'
  },
  settings: {
    // D3 — SettingsDialog chrome
    title: 'Impostazioni',
    close: 'Chiudi',
    canvas: 'Tela',
    language: 'Lingua',
    about: 'Informazioni',
    languageDescription:
      "Seleziona la lingua di visualizzazione dell'interfaccia dell'applicazione.",
    zoomSection: 'Zoom',
    labelsSection: 'Etichette',
    zoom: {
      description:
        'Configura il comportamento dello zoom quando si usa la rotella del mouse.',
      zoomToCursor: 'Zoom sul cursore',
      zoomToCursorDesc:
        'Se abilitato, ingrandisci o riduci centrando sul cursore del mouse. Se disabilitato, lo zoom è centrato sulla tela.'
    },
    hotkeys: {
      title: 'Impostazioni scorciatoie',
      profile: 'Profilo scorciatoie',
      profileQwerty: 'QWERTY (Q, W, E, R, T, Y)',
      profileSmnrct: 'SMNRCT (S, M, N, R, C, T)',
      profileNone: 'Nessuna scorciatoia',
      tool: 'Strumento',
      hotkey: 'Scorciatoia',
      toolSelect: 'Seleziona',
      toolPan: 'Panoramica',
      toolAddItem: 'Aggiungi elemento',
      toolRectangle: 'Rettangolo',
      toolConnector: 'Connettore',
      toolText: 'Testo',
      note: 'Nota: Le scorciatoie funzionano quando non stai digitando nei campi di testo',
      fixedShortcutsTitle: 'Scorciatoie fisse (sempre attive)',
      fixedCut: 'Taglia',
      fixedCopy: 'Copia',
      fixedPaste: 'Incolla',
      fixedUndo: 'Annulla',
      fixedRedo: 'Ripeti'
    },
    connector: {
      title: 'Impostazioni Connettore',
      connectionMode: 'Modalità creazione connessione',
      clickMode: 'Modalità clic (consigliata)',
      clickModeDesc:
        'Clicca sul primo nodo, poi sul secondo per creare una connessione',
      dragMode: 'Modalità trascinamento',
      dragModeDesc:
        'Clicca e trascina dal primo nodo al secondo per creare una connessione',
      note: 'Nota: Puoi modificare questa impostazione in qualsiasi momento. La modalità selezionata verrà usata quando lo strumento Connettore è attivo.'
    },
    iconPacks: {
      title: 'Gestione pacchetti di icone',
      lazyLoading: 'Abilita caricamento ritardato (Lazy Loading)',
      lazyLoadingDesc:
        'Carica i pacchetti di icone su richiesta per un avvio più rapido',
      availablePacks: 'Pacchetti di icone disponibili',
      coreIsoflow: 'Axoview di base (sempre caricato)',
      alwaysEnabled: 'Sempre abilitato',
      awsPack: 'Icone AWS',
      gcpPack: 'Icone Google Cloud',
      azurePack: 'Icone Azure',
      kubernetesPack: 'Icone Kubernetes',
      loading: 'Caricamento...',
      loaded: 'Caricato',
      notLoaded: 'Non caricato',
      iconCount: '{count} icone',
      lazyLoadingDisabledNote:
        "Il caricamento ritardato è disabilitato. Tutti i pacchetti di icone vengono caricati all'avvio.",
      note: "I pacchetti di icone possono essere abilitati o disabilitati in base alle tue esigenze. I pacchetti disabilitati riducono l'uso di memoria e migliorano le prestazioni."
    }
  },
  lazyLoadingWelcome: {
    title: 'Benvenuto in Axoview',
    message:
      "Ciao! Su grande richiesta, abbiamo implementato il caricamento ritardato (Lazy Loading) delle icone. Ora, se desideri abilitare pacchetti di icone non standard, puoi farlo nella sezione 'Configurazione'.",
    configPath: "Clicca sull'icona dell'hamburger",
    configPath2: 'in alto a sinistra per accedere alla Configurazione.',
    canDisable: 'Puoi disattivare questo comportamento se lo desideri.',
    signature: '— Axoview'
  },
  viewTabs: {
    addPage: 'Aggiungi pagina',
    deletePage: 'Elimina pagina',
    renameDiagram: 'Rinomina diagramma',
    addPageDisabled: 'Limite di pagine raggiunto (5)'
  },
  nodePanel: {
    details: 'Dettagli',
    style: 'Stile',
    notes: 'Note',
    notesModified: 'Note ●',
    close: 'Chiudi',
    openLink: 'Apri link',
    caption: 'Didascalia',
    noCaption: 'Nessuna didascalia.',
    showLabel: 'Mostra etichetta',
    hideLabel: 'Nascondi etichetta',
    showName: 'Mostra nome',
    hideName: 'Nascondi nome'
  },
  nodeInfoTab: {
    name: 'Nome',
    namePlaceholder: 'Nome del nodo…',
    removeLink: 'Rimuovi link',
    addLink: 'Aggiungi link al nome',
    linkPlaceholder: 'https://…',
    caption: 'Didascalia',
    captionHint: 'Mostrato sulla tela sotto il nome del nodo',
    openLink: 'Apri link',
    diagramLink: 'Collegamento al diagramma',
    diagramLinkPlaceholder: 'Seleziona un diagramma…',
    diagramLinkHint: 'Facendo clic su questo nodo in modalità sola lettura si apre il diagramma collegato',
    openDiagramLink: 'Apri diagramma collegato'
  },
  nodeStyleTab: {
    icon: 'Icona',
    close: 'Chiudi',
    change: 'Cambia…',
    iconSize: 'Dimensione icona',
    labelFontSize: 'Dimensione font etichetta',
    labelColor: 'Colore etichetta',
    labelHeight: 'Altezza etichetta'
  },
  connectorControls: {
    close: 'Chiudi',
    labels: 'Etichette',
    details: 'Dettagli',
    style: 'Stile',
    notes: 'Note',
    notesModified: 'Note ●',
    name: 'Nome',
    namePlaceholder: "Etichetta dell'arco…",
    additionalLabels: 'Etichette aggiuntive',
    addLabel: 'Aggiungi etichetta',
    noLabels: 'Nessuna etichetta ancora.',
    addLink: 'Aggiungi link',
    removeLink: 'Rimuovi link',
    linkPlaceholder: 'https://…',
    showLabel: 'Mostra etichetta',
    hideLabel: 'Nascondi etichetta',
    showName: 'Mostra nome',
    hideName: 'Nascondi nome',
    color: 'Colore',
    width: 'Spessore',
    lineStyle: 'Stile linea',
    lineType: 'Tipo di linea',
    useCustomColor: 'Usa colore personalizzato',
    showArrow: 'Mostra freccia',
    solid: 'Continua',
    dotted: 'Punteggiata',
    dashed: 'Tratteggiata',
    singleLine: 'Linea singola',
    doubleLine: 'Linea doppia',
    doubleLineWithCircle: 'Linea doppia con cerchio'
  },
  textBoxControls: {
    close: 'Chiudi',
    name: 'Nome',
    namePlaceholder: "Nome dell'elemento…",
    text: 'Testo',
    textSize: 'Dimensione testo',
    textColor: 'Colore testo',
    alignment: 'Allineamento'
  },
  rectangleControls: {
    close: 'Chiudi',
    name: 'Nome',
    namePlaceholder: "Nome dell'elemento…",
    color: 'Colore',
    useCustomColor: 'Usa colore personalizzato'
  },
  labelColorPicker: {
    customColor: 'Colore personalizzato'
  },
  deleteButton: {
    delete: 'Elimina'
  },
  nodeActionBar: {
    style: 'Stile',
    editName: 'Modifica nome',
    editLink: 'Modifica link',
    addLink: 'Aggiungi link',
    editNotes: 'Modifica note',
    addNotes: 'Aggiungi note',
    startConnector: 'Inizia connettore',
    delete: 'Elimina'
  },
  quickAddNodePopover: {
    add: 'Aggiungi',
    rectangle: 'Gruppo'
  },
  zoomControls: {
    zoomOut: 'Riduci zoom',
    zoomIn: 'Aumenta zoom',
    fitToScreen: 'Adatta allo schermo',
    keepLabelsReadable: 'Mantieni le etichette leggibili',
    help: 'Aiuto (F1)',
    selected: '{count} selezionati'
  },
  previewLayerSwitcher: {
    layers: 'Livelli',
    showLayer: 'Mostra livello',
    hideLayer: 'Nascondi livello',
    solo: 'Solo',
    unsolo: 'Esci da solo'
  },
  previewLabelsToggle: {
    hideLabels: 'Nascondi etichette',
    showLabels: 'Mostra etichette'
  },
  annotationPalette: {
    pen: 'Annota',
    select: 'Seleziona',
    draw: 'Disegna',
    shapes: 'Forme',
    pencil: 'Matita',
    highlighter: 'Evidenziatore',
    line: 'Linea',
    arrow: 'Freccia',
    rectangle: 'Rettangolo',
    ellipse: 'Ellisse',
    eraser: 'Gomma',
    undo: 'Annulla',
    redo: 'Ripeti',
    clear: 'Cancella tutto'
  },
  viewModeInfoPopover: {
    close: 'Chiudi'
  },
  labelSettings: {
    description: 'Configura le impostazioni di visualizzazione delle etichette',
    expandButtonPadding: 'Spaziatura pulsante espandi',
    expandButtonPaddingDesc:
      'Spaziatura inferiore quando il pulsante espandi è visibile (evita la sovrapposizione del testo)',
    // D13
    currentValue: 'Attuale: {value} unità del tema'
  },
  iconSelectionControls: {
    close: 'Chiudi',
    importIcons: 'Importa icone',
    addMoreIcons: 'Aggiungi altre icone',
    isometricLabel: 'Tratta come isometrico (vista 3D)',
    isometricHint: 'Deseleziona per icone piatte (loghi, elementi UI)',
    dragHint:
      'Puoi trascinare e rilasciare qualsiasi elemento qui sotto sulla tela.',
    aiPromptTooltip: "Genera icone con l'IA",
    aiPromptTitle: "Genera icone isometriche con l'IA",
    aiPromptBody:
      "Incolla questo prompt in un'IA generatrice di immagini. Sostituisci 'my object' con ciò che ti serve, poi importa il PNG generato.",
    aiPromptCopy: 'Copia prompt',
    aiPromptCopied: 'Copiato'
  },
  searchbox: {
    placeholder: 'Cerca icone'
  },
  exportImageDialog: {
    title: 'Esporta come immagine',
    compatibilityTitle: 'Avviso di compatibilità del browser',
    compatibilityMessage:
      'Per i migliori risultati, usa Chrome o Edge. Firefox attualmente ha problemi di compatibilità con la funzione di esportazione.',
    cropInstruction: "Clicca e trascina per selezionare l'area da esportare",
    options: 'Opzioni',
    showGrid: 'Mostra griglia',
    showLabels: 'Mostra etichette',
    expandDescriptions: 'Espandi descrizioni',
    screenshotPreset: 'Screenshot (consigliato)',
    scaleClamped: 'Dimensione di esportazione ridotta per rientrare nel limite immagine del browser:',
    cropToContent: 'Ritaglia al contenuto',
    backgroundColor: 'Colore di sfondo',
    transparentBackground: 'Sfondo trasparente',
    exportQuality: 'Qualità di esportazione (DPI)',
    custom: 'Personalizzato',
    recrop: 'Ritaglia di nuovo',
    cropApplied: 'Ritaglio applicato con successo',
    applyCrop: 'Applica ritaglio',
    clearSelection: 'Cancella selezione',
    cropHint:
      'Seleziona un\'area da ritagliare, o deseleziona "Ritaglia al contenuto" per usare l\'immagine completa',
    cancel: 'Annulla',
    downloadSvg: 'Scarica come SVG',
    downloadPng: 'Scarica come PNG',
    error: "Impossibile esportare l'immagine"
  },
  toolMenu: {
    undo: 'Annulla',
    redo: 'Ripeti',
    select: 'Seleziona',
    lassoSelect: 'Selezione lasso',
    freehandLasso: 'Lasso a mano libera',
    pan: 'Panoramica',
    addItem: 'Aggiungi elemento',
    rectangle: 'Rettangolo',
    connector: 'Connettore',
    text: 'Testo',
    common: 'Comuni',
    // D5
    switchTo2D: 'Passa alla vista 2D',
    switchToIsometric: 'Passa alla vista isometrica',
    clickMode: 'Clic',
    dragMode: 'Trascina'
  },
  quickIconSelector: {
    recentlyUsed: 'USATI DI RECENTE',
    searchResults: 'RISULTATI RICERCA ({count} icone)',
    noIconsFound: 'Nessuna icona trovata per "{term}"'
  },
  canvasContextMenu: {
    details: 'Dettagli…',
    rename: 'Rinomina',
    cut: 'Taglia',
    copy: 'Copia',
    paste: 'Incolla',
    duplicate: 'Duplica',
    bringForward: 'Porta avanti',
    sendBackward: 'Porta indietro',
    assignToLayer: 'Assegna al livello',
    snapToGrid: 'Aggancia alla griglia',
    unsnapFromGrid: 'Sgancia dalla griglia',
    disableCollision: 'Disattiva collisione',
    enableCollision: 'Attiva collisione',
    delete: 'Elimina',
    addItem: 'Aggiungi elemento',
    selectAll: 'Seleziona tutto',
    enableSnapToGrid: 'Attiva aggancio alla griglia',
    disableSnapToGrid: 'Disattiva aggancio alla griglia',
    itemsSelectedOne: '{count} elemento selezionato',
    itemsSelectedOther: '{count} elementi selezionati',
    deleteItemsOne: 'Elimina {count} elemento',
    deleteItemsOther: 'Elimina {count} elementi',
    removeFromLayer: 'Rimuovi dal livello',
    noLayers: 'Nessun livello — aggiungine uno nel pannello dei livelli'
  },
  // D4 — LeftDock
  leftDock: {
    fileExplorer: 'Esplora file',
    elements: 'Elementi',
    layers: 'Livelli',
    settings: 'Impostazioni',
    openDiagramFirst: 'apri o crea prima un diagramma'
  },
  // D8 — LayersPanel
  layersPanel: {
    header: 'Livelli',
    addLayer: 'Aggiungi livello',
    deleteSelectedLayer: 'Elimina livello selezionato',
    noLayersYet: 'Ancora nessun livello. Fai clic su + per aggiungerne uno.',
    unassigned: 'Non assegnato ({count})',
    dropToUnassign: 'Rilascia qui gli elementi per annullarne l’assegnazione',
    layerN: 'Livello {count}'
  },
  // D7 — clipboard toast strings; {count}/{percent} interpolated.
  clipboard: {
    copiedOne: '{count} elemento copiato',
    copiedOther: '{count} elementi copiati',
    cutOne: '{count} elemento tagliato',
    cutOther: '{count} elementi tagliati',
    pastedOne: '{count} elemento incollato',
    pastedOther: '{count} elementi incollati',
    nothingToPaste: 'Niente da incollare',
    routingConnectors: 'Incollaggio… instradamento connettori ({percent}%)'
  },
  // D13 — default page name; {count} interpolated.
  page: {
    pageName: 'Pagina {count}'
  }
};

export default locale;
