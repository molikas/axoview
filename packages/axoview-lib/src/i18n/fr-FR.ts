import { LocaleProps } from '../types/axoviewProps';

const locale: LocaleProps = {
  common: {
    exampleText: "Ceci est un texte d'exemple"
  },
  helpDialog: {
    title: 'Raccourcis clavier et aide',
    close: 'Fermer',
    keyboardShortcuts: 'Raccourcis clavier',
    mouseInteractions: 'Interactions de la souris',
    action: 'Action',
    shortcut: 'Raccourci',
    method: 'Méthode',
    description: 'Description',
    note: 'Remarque :',
    noteContent:
      'Les raccourcis clavier sont désactivés lors de la saisie dans les champs de saisie, les zones de texte ou les éléments modifiables pour éviter les conflits.',
    // Keyboard shortcuts
    undoAction: 'Annuler',
    undoDescription: 'Annuler la dernière action',
    redoAction: 'Refaire',
    redoDescription: 'Refaire la dernière action annulée',
    redoAltAction: 'Refaire (Alternatif)',
    redoAltDescription: 'Raccourci alternatif pour refaire',
    helpAction: 'Aide',
    helpDescription:
      "Ouvrir la boîte de dialogue d'aide avec les raccourcis clavier",
    zoomInAction: 'Zoom avant',
    zoomInShortcut: 'Molette de la souris vers le haut',
    zoomInDescription: 'Effectuer un zoom avant sur le canevas',
    zoomOutAction: 'Zoom arrière',
    zoomOutShortcut: 'Molette de la souris vers le bas',
    zoomOutDescription: 'Effectuer un zoom arrière sur le canevas',
    panCanvasAction: 'Déplacer le canevas',
    panCanvasShortcut: 'Clic gauche + Glisser',
    panCanvasDescription: 'Déplacer le canevas en mode déplacement',
    togglePanToolAction: 'Activer/Désactiver le déplacement',
    togglePanToolShortcut: 'Clic droit',
    togglePanToolDescription:
      'Activer/désactiver le mode déplacement ; clic gauche pour revenir au mode sélection',
    lassoSelectAction: 'Sélection au lasso',
    lassoSelectShortcut: 'Clic gauche + Glisser (zone vide)',
    lassoSelectDescription:
      'Dessiner un cadre de sélection rectangulaire pour sélectionner plusieurs éléments',
    deselectAction: 'Désélectionner',
    deselectShortcut: 'Clic gauche (zone vide)',
    deselectDescription:
      'Désélectionner la sélection actuelle et revenir au mode sélection',
    // Mouse interactions
    selectToolAction: 'Outil de sélection',
    selectToolShortcut: 'Cliquer sur le bouton Sélectionner',
    selectToolDescription: 'Passer en mode sélection',
    panToolAction: 'Outil de déplacement',
    panToolShortcut: 'Cliquer sur le bouton Déplacer',
    panToolDescription: 'Passer en mode déplacement pour déplacer le canevas',
    addItemAction: 'Ajouter un élément',
    addItemShortcut: 'Cliquer sur le bouton Ajouter un élément',
    addItemDescription:
      "Ouvrir le sélecteur d'icônes pour ajouter de nouveaux éléments",
    drawRectangleAction: 'Dessiner un rectangle',
    drawRectangleShortcut: 'Cliquer sur le bouton Rectangle',
    drawRectangleDescription: 'Passer en mode dessin de rectangles',
    createConnectorAction: 'Créer un connecteur',
    createConnectorShortcut: 'Cliquer sur le bouton Connecteur',
    createConnectorDescription: 'Passer en mode connecteur',
    addTextAction: 'Ajouter du texte',
    addTextShortcut: 'Cliquer sur le bouton Texte',
    addTextDescription: 'Créer une nouvelle zone de texte',
    deleteSelectedAction: 'Supprimer la sélection',
    deleteSelectedShortcut: 'Suppr (Retour arrière sur Mac)',
    deleteSelectedDescription:
      "Supprimer l'élément sélectionné ou tous les éléments d'une sélection lasso ; supporte annuler/rétablir",
    cutAction: 'Couper',
    cutDescription:
      'Couper les éléments sélectionnés dans le presse-papiers — les éléments sont supprimés et peuvent être collés ailleurs ; supporte annuler/rétablir',
    copyAction: 'Copier',
    copyDescription: 'Copier les éléments sélectionnés dans le presse-papiers',
    pasteAction: 'Coller',
    pasteDescription:
      'Coller les éléments du presse-papiers à la position de la souris ; décalage pour éviter les chevauchements',
    // D10 — Select all row
    selectAllAction: 'Tout sélectionner',
    selectAllShortcut: 'Ctrl+A',
    selectAllDescription:
      'Sélectionner tous les éléments visibles et déverrouillés de la vue active (éléments, rectangles, zones de texte, connecteurs + leurs points de passage)',
    // D10 — tool-activation keys (ADR 0022 §6)
    keyRenameAction: 'Renommer',
    keyRenameShortcut: 'F2',
    keyRenameDescription: 'Renommer l’élément ou le diagramme sélectionné sur place',
    keyAddItemAction: 'Ajouter un élément / Éléments',
    keyAddItemShortcut: 'N',
    keyAddItemDescription: 'Basculer le panneau Éléments pour placer un nouvel élément',
    keyConnectorAction: 'Connecteur',
    keyConnectorShortcut: 'C',
    keyConnectorDescription: 'Passer à l’outil connecteur',
    keyLassoAction: 'Sélection lasso',
    keyLassoShortcut: 'L',
    keyLassoDescription: 'Passer à l’outil de sélection lasso',
    keySelectAction: 'Sélectionner',
    keySelectShortcut: 'S',
    keySelectDescription: 'Passer à l’outil de sélection',
    // D10 — mouse interactions
    miSelectAction: 'Sélectionner',
    miSelectMethod: 'Clic gauche',
    miSelectDescription:
      'Cliquer sur un élément pour le sélectionner (le met en évidence et affiche la barre d’actions flottante). Cliquer sur le canevas vide pour effacer la sélection.',
    miOpenDetailsAction: 'Ouvrir les détails',
    miOpenDetailsMethod: 'Double-clic',
    miOpenDetailsDescription:
      'Double-cliquer sur un élément pour ouvrir son panneau de détails — comme l’entrée « Détails… » du menu contextuel.',
    miToggleSelectionAction: 'Basculer la sélection',
    miToggleSelectionMethod: 'Ctrl/Cmd + Clic gauche',
    miToggleSelectionDescription:
      'Ajouter ou retirer un élément de la sélection multiple ; un connecteur bascule avec ses points de passage.',
    miPanAction: 'Déplacer',
    miPanMethod: 'Clic droit + glisser',
    miPanDescription:
      'Maintenir le bouton droit et glisser pour déplacer le canevas. Le glisser-clic du milieu déplace aussi ; les flèches le décalent.',
    miContextMenuAction: 'Menu contextuel',
    miContextMenuMethod: 'Clic droit (appui)',
    miContextMenuDescription:
      'Un clic droit sans glisser ouvre le menu contextuel — le menu de l’élément sur un élément, ou le menu du canevas sur un espace vide. Sur écran tactile, appui long.',
    miRemoveWaypointAction: 'Supprimer le point de passage',
    miRemoveWaypointMethod: 'Alt + Clic gauche',
    miRemoveWaypointDescription:
      'Alt+clic sur un point de passage de connecteur pour le retirer (pas besoin de sélectionner le connecteur d’abord) ; les ancres d’extrémité sont préservées.',
    miZoomAction: 'Zoomer',
    miZoomMethod: 'Molette',
    miZoomDescription: 'Faire défiler pour zoomer vers le curseur.'
  },
  connectorHintTooltip: {
    tipCreatingConnectors: 'Astuce : Créer des connecteurs',
    tipConnectorTools: 'Astuce : Outils de connecteurs',
    clickInstructionStart: 'Cliquez',
    clickInstructionMiddle: 'sur le premier nœud ou point, puis',
    clickInstructionEnd:
      'sur le deuxième nœud ou point pour créer une connexion.',
    nowClickTarget:
      'Cliquez maintenant sur la cible pour terminer la connexion.',
    dragStart: 'Glissez',
    dragEnd: 'du premier nœud au deuxième nœud pour créer une connexion.',
    rerouteStart: 'Pour réacheminer un connecteur,',
    rerouteMiddle: 'cliquez avec le bouton gauche',
    rerouteEnd:
      "sur n'importe quel point le long de la ligne du connecteur et glissez pour créer ou déplacer des points d'ancrage."
  },
  lassoHintTooltip: {
    tipLasso: 'Astuce : Sélection au lasso',
    tipFreehandLasso: 'Astuce : Sélection au lasso libre',
    lassoDragStart: 'Cliquez et glissez',
    lassoDragEnd:
      'pour dessiner une zone de sélection rectangulaire autour des éléments que vous souhaitez sélectionner.',
    freehandDragStart: 'Cliquez et glissez',
    freehandDragMiddle: 'pour dessiner une',
    freehandDragEnd: 'forme libre',
    freehandComplete:
      "autour des éléments. Relâchez pour sélectionner tous les éléments à l'intérieur de la forme.",
    moveStart: 'Une fois sélectionnés,',
    moveMiddle: "cliquez à l'intérieur de la sélection",
    moveEnd: 'et glissez pour déplacer tous les éléments sélectionnés ensemble.'
  },
  importHintTooltip: {
    title: 'Importer des diagrammes',
    instructionStart: 'Pour importer des diagrammes, cliquez sur le',
    menuButton: 'bouton de menu',
    instructionMiddle: '(☰) dans le coin supérieur gauche, puis sélectionnez',
    openButton: '"Ouvrir"',
    instructionEnd: 'pour charger vos fichiers de diagramme.'
  },
  connectorRerouteTooltip: {
    title: 'Astuce : Réacheminer les connecteurs',
    instructionStart:
      'Une fois vos connecteurs placés, vous pouvez les réacheminer comme vous le souhaitez.',
    instructionSelect: 'Sélectionnez le connecteur',
    instructionMiddle: "d'abord, puis",
    instructionClick: 'cliquez sur le chemin du connecteur',
    instructionAnd: 'et',
    instructionDrag: 'glissez',
    instructionEnd: 'pour le modifier !'
  },
  connectorEmptySpaceTooltip: {
    message: 'Pour connecter ce connecteur à un nœud,',
    instruction:
      "cliquez avec le bouton gauche sur l'extrémité du connecteur et faites-le glisser vers le nœud souhaité."
  },
  settings: {
    // D3 — SettingsDialog chrome
    title: 'Paramètres',
    close: 'Fermer',
    canvas: 'Canevas',
    language: 'Langue',
    about: 'À propos',
    languageDescription:
      "Sélectionnez la langue d'affichage de l'interface de l'application.",
    zoomSection: 'Zoom',
    labelsSection: 'Étiquettes',
    zoom: {
      description:
        "Configurer le comportement du zoom lors de l'utilisation de la molette de la souris.",
      zoomToCursor: 'Zoom sur le curseur',
      zoomToCursorDesc:
        "Lorsqu'il est activé, le zoom est centré sur la position du curseur de la souris. Lorsqu'il est désactivé, le zoom est centré sur le canevas."
    },
    hotkeys: {
      title: 'Paramètres des raccourcis',
      profile: 'Profil de raccourcis',
      profileQwerty: 'QWERTY (Q, W, E, R, T, Y)',
      profileSmnrct: 'SMNRCT (S, M, N, R, C, T)',
      profileNone: 'Aucun raccourci',
      tool: 'Outil',
      hotkey: 'Raccourci',
      toolSelect: 'Sélectionner',
      toolPan: 'Déplacer',
      toolAddItem: 'Ajouter un élément',
      toolRectangle: 'Rectangle',
      toolConnector: 'Connecteur',
      toolText: 'Texte',
      note: 'Remarque : Les raccourcis fonctionnent lorsque vous ne tapez pas dans des champs de texte',
      fixedShortcutsTitle: 'Raccourcis fixes (toujours actifs)',
      fixedCut: 'Couper',
      fixedCopy: 'Copier',
      fixedPaste: 'Coller',
      fixedUndo: 'Annuler',
      fixedRedo: 'Refaire'
    },
    connector: {
      title: 'Paramètres des connecteurs',
      connectionMode: 'Mode de création de connexion',
      clickMode: 'Mode clic (Recommandé)',
      clickModeDesc:
        'Cliquez sur le premier nœud, puis cliquez sur le deuxième nœud pour créer une connexion',
      dragMode: 'Mode glisser',
      dragModeDesc: 'Cliquez et glissez du premier nœud au deuxième nœud',
      note: "Remarque : Vous pouvez modifier ce paramètre à tout moment. Le mode sélectionné sera utilisé lorsque l'outil de connecteur est actif."
    },
    iconPacks: {
      title: "Gestion des Packs d'Icônes",
      lazyLoading: 'Activer le Chargement Paresseux',
      lazyLoadingDesc:
        "Charger les packs d'icônes à la demande pour un démarrage plus rapide",
      availablePacks: "Packs d'Icônes Disponibles",
      coreIsoflow: 'Core Isoflow (Toujours Chargé)',
      alwaysEnabled: 'Toujours activé',
      awsPack: 'Icônes AWS',
      gcpPack: 'Icônes Google Cloud',
      azurePack: 'Icônes Azure',
      kubernetesPack: 'Icônes Kubernetes',
      loading: 'Chargement...',
      loaded: 'Chargé',
      notLoaded: 'Non chargé',
      iconCount: '{count} icônes',
      lazyLoadingDisabledNote:
        "Le chargement paresseux est désactivé. Tous les packs d'icônes sont chargés au démarrage.",
      note: "Les packs d'icônes peuvent être activés ou désactivés selon vos besoins. Les packs désactivés réduiront l'utilisation de la mémoire et amélioreront les performances."
    }
  },
  lazyLoadingWelcome: {
    title: 'Bienvenue dans Axoview',
    message:
      "Salut ! Suite à une forte demande, nous avons implémenté le Chargement Paresseux des icônes, donc maintenant si vous voulez activer des packs d'icônes non standard, vous pouvez les activer dans la section 'Configuration'.",
    configPath: "Cliquez sur l'icône Hamburger",
    configPath2: 'en haut à gauche pour accéder à la Configuration.',
    canDisable: 'Vous pouvez désactiver ce comportement si vous le souhaitez.',
    signature: '— Axoview'
  },
  viewTabs: {
    addPage: 'Ajouter une page',
    deletePage: 'Supprimer la page',
    renameDiagram: 'Renommer le diagramme',
    addPageDisabled: 'Limite de pages atteinte (5)'
  },
  nodePanel: {
    details: 'Détails',
    style: 'Style',
    notes: 'Notes',
    notesModified: 'Notes ●',
    close: 'Fermer',
    openLink: 'Ouvrir le lien',
    caption: 'Légende',
    noCaption: 'Aucune légende.',
    showLabel: 'Afficher le libellé',
    hideLabel: 'Masquer le libellé',
    showName: 'Afficher le nom',
    hideName: 'Masquer le nom'
  },
  nodeInfoTab: {
    name: 'Nom',
    namePlaceholder: 'Nom du nœud…',
    removeLink: 'Supprimer le lien',
    addLink: 'Ajouter un lien au nom',
    linkPlaceholder: 'https://…',
    caption: 'Légende',
    captionHint: 'Affiché sur le canevas sous le nom du nœud',
    openLink: 'Ouvrir le lien',
    diagramLink: 'Lien vers le diagramme',
    diagramLinkPlaceholder: 'Sélectionner un diagramme…',
    diagramLinkHint: 'Cliquer sur ce nœud en mode lecture seule ouvre le diagramme lié',
    openDiagramLink: 'Ouvrir le diagramme lié'
  },
  nodeStyleTab: {
    icon: 'Icône',
    close: 'Fermer',
    change: 'Modifier…',
    iconSize: "Taille de l'icône",
    labelFontSize: "Taille de police de l'étiquette",
    labelColor: "Couleur de l'étiquette",
    labelHeight: "Hauteur de l'étiquette"
  },
  connectorControls: {
    close: 'Fermer',
    labels: 'Étiquettes',
    details: 'Détails',
    style: 'Style',
    notes: 'Notes',
    notesModified: 'Notes ●',
    name: 'Nom',
    namePlaceholder: "Libellé de l'arête…",
    additionalLabels: 'Étiquettes supplémentaires',
    addLabel: 'Ajouter une étiquette',
    noLabels: 'Aucune étiquette pour le moment.',
    addLink: 'Ajouter un lien',
    removeLink: 'Supprimer le lien',
    linkPlaceholder: 'https://…',
    showLabel: 'Afficher le libellé',
    hideLabel: 'Masquer le libellé',
    showName: 'Afficher le nom',
    hideName: 'Masquer le nom',
    color: 'Couleur',
    width: 'Épaisseur',
    lineStyle: 'Style de ligne',
    lineType: 'Type de ligne',
    useCustomColor: 'Utiliser une couleur personnalisée',
    showArrow: 'Afficher la flèche',
    solid: 'Pleine',
    dotted: 'Pointillée',
    dashed: 'Tiretée',
    singleLine: 'Ligne simple',
    doubleLine: 'Ligne double',
    doubleLineWithCircle: 'Ligne double avec cercle'
  },
  textBoxControls: {
    close: 'Fermer',
    name: 'Nom',
    namePlaceholder: "Nom de l'élément…",
    text: 'Texte',
    textSize: 'Taille du texte',
    textColor: 'Couleur du texte',
    alignment: 'Alignement'
  },
  rectangleControls: {
    close: 'Fermer',
    name: 'Nom',
    namePlaceholder: "Nom de l'élément…",
    color: 'Couleur',
    useCustomColor: 'Utiliser une couleur personnalisée'
  },
  labelColorPicker: {
    customColor: 'Couleur personnalisée'
  },
  deleteButton: {
    delete: 'Supprimer'
  },
  nodeActionBar: {
    style: 'Style',
    editName: 'Modifier le nom',
    editLink: 'Modifier le lien',
    addLink: 'Ajouter un lien',
    editNotes: 'Modifier les notes',
    addNotes: 'Ajouter des notes',
    startConnector: 'Commencer le connecteur',
    delete: 'Supprimer'
  },
  quickAddNodePopover: {
    add: 'Ajouter',
    rectangle: 'Groupe'
  },
  zoomControls: {
    zoomOut: 'Zoom arrière',
    zoomIn: 'Zoom avant',
    fitToScreen: "Ajuster à l'écran",
    keepLabelsReadable: 'Garder les étiquettes lisibles',
    help: 'Aide (F1)',
    selected: '{count} sélectionnés'
  },
  modeHints: {
    connector: 'Glissez entre les éléments pour connecter • Échap pour annuler'
  },
  previewLayerSwitcher: {
    layers: 'Calques',
    showLayer: 'Afficher le calque',
    hideLayer: 'Masquer le calque',
    solo: 'Solo',
    unsolo: 'Quitter le solo'
  },
  previewLabelsToggle: {
    hideLabels: 'Masquer les libellés',
    showLabels: 'Afficher les libellés'
  },
  annotationPalette: {
    pen: 'Annoter',
    select: 'Sélectionner',
    draw: 'Dessiner',
    shapes: 'Formes',
    pencil: 'Crayon',
    highlighter: 'Surligneur',
    line: 'Ligne',
    arrow: 'Flèche',
    rectangle: 'Rectangle',
    ellipse: 'Ellipse',
    eraser: 'Gomme',
    undo: 'Annuler',
    redo: 'Rétablir',
    clear: 'Tout effacer'
  },
  viewModeInfoPopover: {
    close: 'Fermer'
  },
  labelSettings: {
    description: "Configurer les paramètres d'affichage des étiquettes",
    expandButtonPadding: 'Rembourrage du bouton développer',
    expandButtonPaddingDesc:
      'Rembourrage inférieur lorsque le bouton développer est visible (évite le chevauchement du texte)',
    // D13
    currentValue: 'Actuel : {value} unités de thème'
  },
  iconSelectionControls: {
    close: 'Fermer',
    importIcons: 'Importer des icônes',
    addMoreIcons: "Ajouter d'autres icônes",
    isometricLabel: 'Traiter comme isométrique (vue 3D)',
    isometricHint: 'Décocher pour les icônes plates (logos, éléments UI)',
    dragHint:
      "Vous pouvez faire glisser et déposer n'importe quel élément ci-dessous sur le canevas.",
    aiPromptTooltip: "Générer des icônes avec l'IA",
    aiPromptTitle: "Générer des icônes isométriques avec l'IA",
    aiPromptBody:
      "Collez cette invite dans une IA de génération d'images. Remplacez « my object » par ce dont vous avez besoin, puis importez le PNG généré.",
    aiPromptCopy: "Copier l'invite",
    aiPromptCopied: 'Copié'
  },
  searchbox: {
    placeholder: 'Rechercher des icônes'
  },
  exportImageDialog: {
    title: 'Exporter en image',
    compatibilityTitle: 'Avis de compatibilité du navigateur',
    compatibilityMessage:
      "Pour de meilleurs résultats, veuillez utiliser Chrome ou Edge. Firefox a actuellement des problèmes de compatibilité avec la fonction d'exportation.",
    cropInstruction:
      'Cliquez et faites glisser pour sélectionner la zone à exporter',
    options: 'Options',
    showGrid: 'Afficher la grille',
    showLabels: 'Afficher les étiquettes',
    expandDescriptions: 'Développer les descriptions',
    screenshotPreset: "Capture d'écran (recommandé)",
    scaleClamped: "Taille d'export réduite pour respecter la limite d'image du navigateur :",
    cropToContent: 'Recadrer au contenu',
    backgroundColor: 'Couleur de fond',
    transparentBackground: 'Fond transparent',
    exportQuality: "Qualité d'exportation (DPI)",
    custom: 'Personnalisé',
    recrop: 'Recadrer à nouveau',
    cropApplied: 'Recadrage appliqué avec succès',
    applyCrop: 'Appliquer le recadrage',
    clearSelection: 'Effacer la sélection',
    cropHint:
      'Sélectionnez une zone à recadrer, ou décochez "Recadrer au contenu" pour utiliser l\'image entière',
    cancel: 'Annuler',
    downloadSvg: 'Télécharger en SVG',
    downloadPng: 'Télécharger en PNG',
    error: "Impossible d'exporter l'image"
  },
  toolMenu: {
    undo: 'Annuler',
    redo: 'Refaire',
    select: 'Sélectionner',
    lassoSelect: 'Sélection au lasso',
    freehandLasso: 'Lasso libre',
    pan: 'Déplacer',
    addItem: 'Ajouter un élément',
    rectangle: 'Rectangle',
    connector: 'Connecteur',
    text: 'Texte',
    common: 'Communs',
    // D5
    switchTo2D: 'Passer en vue 2D',
    switchToIsometric: 'Passer en vue isométrique',
    clickMode: 'Clic',
    dragMode: 'Glisser'
  },
  quickIconSelector: {
    recentlyUsed: 'RÉCEMMENT UTILISÉS',
    searchResults: 'RÉSULTATS DE RECHERCHE ({count} icônes)',
    noIconsFound: 'Aucune icône correspondant à "{term}"'
  },
  canvasContextMenu: {
    details: 'Détails…',
    rename: 'Renommer',
    cut: 'Couper',
    copy: 'Copier',
    paste: 'Coller',
    duplicate: 'Dupliquer',
    bringForward: 'Avancer',
    sendBackward: 'Reculer',
    assignToLayer: 'Affecter au calque',
    snapToGrid: 'Aligner sur la grille',
    unsnapFromGrid: 'Détacher de la grille',
    disableCollision: 'Désactiver la collision',
    enableCollision: 'Activer la collision',
    delete: 'Supprimer',
    addItem: 'Ajouter un élément',
    selectAll: 'Tout sélectionner',
    enableSnapToGrid: "Activer l'alignement sur la grille",
    disableSnapToGrid: "Désactiver l'alignement sur la grille",
    itemsSelectedOne: '{count} élément sélectionné',
    itemsSelectedOther: '{count} éléments sélectionnés',
    deleteItemsOne: 'Supprimer {count} élément',
    deleteItemsOther: 'Supprimer {count} éléments',
    removeFromLayer: 'Retirer du calque',
    noLayers: 'Aucun calque — ajoutez-en un dans le panneau des calques'
  },
  // D4 — LeftDock
  leftDock: {
    fileExplorer: 'Explorateur de fichiers',
    elements: 'Éléments',
    layers: 'Calques',
    settings: 'Paramètres',
    openDiagramFirst: 'ouvrez ou créez d’abord un diagramme'
  },
  // D8 — LayersPanel
  layersPanel: {
    header: 'Calques',
    addLayer: 'Ajouter un calque',
    deleteSelectedLayer: 'Supprimer le calque sélectionné',
    noLayersYet: 'Aucun calque pour l’instant. Cliquez sur + pour en ajouter un.',
    unassigned: 'Non assigné ({count})',
    dropToUnassign: 'Déposez des éléments ici pour les désassigner',
    layerN: 'Calque {count}'
  },
  // D7 — clipboard toast strings; {count}/{percent} interpolated.
  clipboard: {
    copiedOne: '{count} élément copié',
    copiedOther: '{count} éléments copiés',
    cutOne: '{count} élément coupé',
    cutOther: '{count} éléments coupés',
    pastedOne: '{count} élément collé',
    pastedOther: '{count} éléments collés',
    nothingToPaste: 'Rien à coller',
    routingConnectors: 'Collage… routage des connecteurs ({percent}%)'
  },
  // D13 — default page name; {count} interpolated.
  page: {
    pageName: 'Page {count}'
  }
};

export default locale;
