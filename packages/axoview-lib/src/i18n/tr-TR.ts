import { LocaleProps } from '../types/axoviewProps';

const locale: LocaleProps = {
  common: {
    exampleText: 'Bu bir örnek metindir'
  },
  helpDialog: {
    title: 'Klavye Kısayolları ve Yardım',
    close: 'Kapat',
    keyboardShortcuts: 'Klavye Kısayolları',
    mouseInteractions: 'Fare Etkileşimleri',
    action: 'Eylem',
    shortcut: 'Kısayol',
    method: 'Yöntem',
    description: 'Açıklama',
    note: 'Not:',
    noteContent:
      'Klavye kısayolları, çakışmaları önlemek için giriş alanlarında, metin alanlarında veya içerik düzenlenebilir öğelerde yazarken devre dışı bırakılır.',
    // Keyboard shortcuts
    undoAction: 'Geri Al',
    undoDescription: 'Son eylemi geri al',
    redoAction: 'Yinele',
    redoDescription: 'Son geri alınan eylemi yinele',
    redoAltAction: 'Yinele (Alternatif)',
    redoAltDescription: 'Alternatif yineleme kısayolu',
    helpAction: 'Yardım',
    helpDescription: 'Klavye kısayollarıyla yardım diyaloğunu aç',
    zoomInAction: 'Yakınlaştır',
    zoomInShortcut: 'Fare Tekerleği Yukarı',
    zoomInDescription: 'Tuvalde yakınlaştır',
    zoomOutAction: 'Uzaklaştır',
    zoomOutShortcut: 'Fare Tekerleği Aşağı',
    zoomOutDescription: 'Tuvalden uzaklaştır',
    panCanvasAction: 'Tuvali Kaydır',
    panCanvasShortcut: 'Sol tık + Sürükle',
    panCanvasDescription: 'Kaydırma modundayken tuvali kaydır',
    togglePanToolAction: 'Kaydırma Aracını Aç/Kapat',
    togglePanToolShortcut: 'Sağ tık',
    togglePanToolDescription:
      'Kaydırma modunu aç/kapat; seçim moduna dönmek için sol tık',
    lassoSelectAction: 'Lasso Seçimi',
    lassoSelectShortcut: 'Sol tık + Sürükle (boş alan)',
    lassoSelectDescription:
      'Birden fazla öğe seçmek için dikdörtgen bir seçim kutusu çiz',
    deselectAction: 'Seçimi Kaldır',
    deselectShortcut: 'Sol tık (boş alan)',
    deselectDescription: 'Mevcut seçimi kaldır ve seçim moduna dön',
    // Mouse interactions
    selectToolAction: 'Seçim Aracı',
    selectToolShortcut: 'Seç butonuna tıkla',
    selectToolDescription: 'Seçim moduna geç',
    panToolAction: 'Kaydırma Aracı',
    panToolShortcut: 'Kaydır butonuna tıkla',
    panToolDescription: 'Tuvali hareket ettirmek için kaydırma moduna geç',
    addItemAction: 'Öğe Ekle',
    addItemShortcut: 'Öğe ekle butonuna tıkla',
    addItemDescription: 'Yeni öğeler eklemek için simge seçiciyi aç',
    drawRectangleAction: 'Dikdörtgen Çiz',
    drawRectangleShortcut: 'Dikdörtgen butonuna tıkla',
    drawRectangleDescription: 'Dikdörtgen çizim moduna geç',
    createConnectorAction: 'Bağlayıcı Oluştur',
    createConnectorShortcut: 'Bağlayıcı butonuna tıkla',
    createConnectorDescription: 'Bağlayıcı moduna geç',
    addTextAction: 'Metin Ekle',
    addTextShortcut: 'Metin butonuna tıkla',
    addTextDescription: 'Yeni bir metin kutusu oluştur',
    deleteSelectedAction: 'Seçilenleri Sil',
    deleteSelectedShortcut: "Delete (Mac'te Backspace)",
    deleteSelectedDescription:
      'Seçili öğeyi veya lasso seçimindeki tüm öğeleri sil; geri al/yinele desteklenir',
    cutAction: 'Kes',
    cutDescription:
      'Seçili öğeleri panoya kes — öğeler kaldırılır ve başka yere yapıştırılabilir; geri al/yinele desteklenir',
    copyAction: 'Kopyala',
    copyDescription: 'Seçili öğeleri panoya kopyala',
    pasteAction: 'Yapıştır',
    pasteDescription:
      'Pano öğelerini fare konumuna yapıştır; üst üste binmeyi önlemek için kaydırılır'
  },
  connectorHintTooltip: {
    tipCreatingConnectors: 'İpucu: Bağlayıcı Oluşturma',
    tipConnectorTools: 'İpucu: Bağlayıcı Araçları',
    clickInstructionStart: 'İlk düğüme veya noktaya',
    clickInstructionMiddle: 'tıklayın, ardından',
    clickInstructionEnd:
      'bir bağlantı oluşturmak için ikinci düğüme veya noktaya tıklayın.',
    nowClickTarget: 'Bağlantıyı tamamlamak için şimdi hedefe tıklayın.',
    dragStart: 'Bir bağlantı oluşturmak için',
    dragEnd: 'ilk düğümden ikinci düğüme sürükleyin.',
    rerouteStart: 'Bir bağlayıcıyı yeniden yönlendirmek için,',
    rerouteMiddle: 'bağlayıcı çizgisi boyunca herhangi bir noktaya',
    rerouteEnd:
      'sol tıklayın ve çapa noktaları oluşturmak veya taşımak için sürükleyin.'
  },
  lassoHintTooltip: {
    tipLasso: 'İpucu: Lasso Seçimi',
    tipFreehandLasso: 'İpucu: Serbest El Lasso Seçimi',
    lassoDragStart: 'Seçmek istediğiniz öğelerin etrafına',
    lassoDragEnd:
      'dikdörtgen bir seçim kutusu çizmek için tıklayın ve sürükleyin.',
    freehandDragStart: 'Tıklayın ve sürükleyin',
    freehandDragMiddle: 'bir',
    freehandDragEnd: 'serbest form şekli',
    freehandComplete:
      'öğelerin etrafına çizin. Şeklin içindeki tüm öğeleri seçmek için bırakın.',
    moveStart: 'Seçildikten sonra,',
    moveMiddle: 'seçimin içine tıklayın',
    moveEnd: 've tüm seçili öğeleri birlikte taşımak için sürükleyin.'
  },
  importHintTooltip: {
    title: 'Diyagramları İçe Aktar',
    instructionStart: 'Diyagramları içe aktarmak için, sol üst köşedeki',
    menuButton: 'menü butonuna',
    instructionMiddle: '(☰) tıklayın, ardından',
    openButton: '"Aç"',
    instructionEnd: 'seçerek diyagram dosyalarınızı yükleyin.'
  },
  connectorRerouteTooltip: {
    title: 'İpucu: Bağlayıcıları Yeniden Yönlendir',
    instructionStart:
      'Bağlayıcılarınız yerleştirildikten sonra istediğiniz gibi yeniden yönlendirebilirsiniz.',
    instructionSelect: 'Önce bağlayıcıyı seçin',
    instructionMiddle: ', ardından',
    instructionClick: 'bağlayıcı yoluna tıklayın',
    instructionAnd: 've',
    instructionDrag: 'değiştirmek için sürükleyin',
    instructionEnd: '!'
  },
  connectorEmptySpaceTooltip: {
    message: 'Bu bağlayıcıyı bir düğüme bağlamak için,',
    instruction:
      'bağlayıcının ucuna sol tıklayın ve istediğiniz düğüme sürükleyin.'
  },
  settings: {
    zoom: {
      description:
        'Fare tekerleği kullanılırken yakınlaştırma davranışını yapılandırın.',
      zoomToCursor: 'İmlece Yakınlaştır',
      zoomToCursorDesc:
        'Etkinleştirildiğinde, fare imleci konumunda merkezlenmiş olarak yakınlaştırır/uzaklaştırır. Devre dışı bırakıldığında, yakınlaştırma tuvalde merkezlenir.'
    },
    hotkeys: {
      title: 'Kısayol Tuşu Ayarları',
      profile: 'Kısayol Tuşu Profili',
      profileQwerty: 'QWERTY (Q, W, E, R, T, Y)',
      profileSmnrct: 'SMNRCT (S, M, N, R, C, T)',
      profileNone: 'Kısayol Tuşu Yok',
      tool: 'Araç',
      hotkey: 'Kısayol Tuşu',
      toolSelect: 'Seç',
      toolPan: 'Kaydır',
      toolAddItem: 'Öğe Ekle',
      toolRectangle: 'Dikdörtgen',
      toolConnector: 'Bağlayıcı',
      toolText: 'Metin',
      note: 'Not: Kısayol tuşları metin alanlarında yazarken çalışmaz',
      fixedShortcutsTitle: 'Sabit Kısayollar (Her Zaman Aktif)',
      fixedCut: 'Kes',
      fixedCopy: 'Kopyala',
      fixedPaste: 'Yapıştır',
      fixedUndo: 'Geri Al',
      fixedRedo: 'Yinele'
    },
    connector: {
      title: 'Bağlayıcı Ayarları',
      connectionMode: 'Bağlantı Oluşturma Modu',
      clickMode: 'Tıklama Modu (Önerilen)',
      clickModeDesc:
        'Bir bağlantı oluşturmak için ilk düğüme tıklayın, ardından ikinci düğüme tıklayın',
      dragMode: 'Sürükleme Modu',
      dragModeDesc: 'İlk düğümden ikinci düğüme tıklayın ve sürükleyin',
      note: 'Not: Bu ayarı istediğiniz zaman değiştirebilirsiniz. Seçilen mod, Bağlayıcı aracı etkin olduğunda kullanılacaktır.'
    },
    iconPacks: {
      title: 'Simge Paketi Yönetimi',
      lazyLoading: 'Tembel Yükleme Etkinleştir',
      lazyLoadingDesc:
        'Daha hızlı başlangıç için simge paketlerini isteğe bağlı yükle',
      availablePacks: 'Mevcut Simge Paketleri',
      coreIsoflow: 'Çekirdek Axoview (Her Zaman Yüklenir)',
      alwaysEnabled: 'Her zaman etkin',
      awsPack: 'AWS Simgeleri',
      gcpPack: 'Google Cloud Simgeleri',
      azurePack: 'Azure Simgeleri',
      kubernetesPack: 'Kubernetes Simgeleri',
      loading: 'Yükleniyor...',
      loaded: 'Yüklendi',
      notLoaded: 'Yüklenmedi',
      iconCount: '{count} simge',
      lazyLoadingDisabledNote:
        'Tembel yükleme devre dışı. Tüm simge paketleri başlangıçta yüklenir.',
      note: 'Simge paketleri ihtiyaçlarınıza göre etkinleştirilebilir veya devre dışı bırakılabilir. Devre dışı bırakılan paketler bellek kullanımını azaltır ve performansı artırır.'
    }
  },
  lazyLoadingWelcome: {
    title: "Axoview'a Hoş Geldiniz",
    message:
      "Merhaba! Popüler talep üzerine, simgelerin Tembel Yüklenmesini uyguladık, bu yüzden artık standart olmayan simge paketlerini etkinleştirmek isterseniz bunları 'Yapılandırma' bölümünde etkinleştirebilirsiniz.",
    configPath: 'Yapılandırmaya erişmek için',
    configPath2: 'sol üstteki Hamburger simgesine tıklayın.',
    canDisable: 'İsterseniz bu davranışı devre dışı bırakabilirsiniz.',
    signature: '— Axoview'
  },
  viewTabs: {
    addPage: 'Sayfa ekle',
    deletePage: 'Sayfayı sil',
    renameDiagram: 'Diyagramı yeniden adlandır',
    addPageDisabled: 'Sayfa sınırına ulaşıldı (5)'
  },
  nodePanel: {
    details: 'Ayrıntılar',
    style: 'Stil',
    notes: 'Notlar',
    notesModified: 'Notlar ●',
    close: 'Kapat',
    openLink: 'Bağlantıyı aç',
    caption: 'Altyazı',
    noCaption: 'Altyazı yok.',
    showLabel: 'Etiketi göster',
    hideLabel: 'Etiketi gizle',
    showName: 'Adı göster',
    hideName: 'Adı gizle'
  },
  nodeInfoTab: {
    name: 'Ad',
    namePlaceholder: 'Düğüm adı…',
    removeLink: 'Bağlantıyı kaldır',
    addLink: 'Ada bağlantı ekle',
    linkPlaceholder: 'https://…',
    caption: 'Altyazı',
    captionHint: 'Tuvalde düğüm adının altında gösterilir',
    openLink: 'Bağlantıyı aç',
    diagramLink: 'Diyagrama bağlantı',
    diagramLinkPlaceholder: 'Diyagram seçin…',
    diagramLinkHint: 'Salt okunur modda bu düğüme tıklamak bağlantılı diyagramı açar',
    openDiagramLink: 'Bağlantılı diyagramı aç'
  },
  nodeStyleTab: {
    icon: 'Simge',
    close: 'Kapat',
    change: 'Değiştir…',
    iconSize: 'Simge boyutu',
    labelFontSize: 'Etiket yazı tipi boyutu',
    labelColor: 'Etiket rengi',
    labelHeight: 'Etiket yüksekliği'
  },
  connectorControls: {
    close: 'Kapat',
    labels: 'Etiketler',
    details: 'Ayrıntılar',
    style: 'Stil',
    notes: 'Notlar',
    notesModified: 'Notlar ●',
    name: 'Ad',
    namePlaceholder: 'Kenar etiketi…',
    additionalLabels: 'Ek etiketler',
    addLabel: 'Etiket ekle',
    noLabels: 'Henüz etiket yok.',
    addLink: 'Bağlantı ekle',
    removeLink: 'Bağlantıyı kaldır',
    linkPlaceholder: 'https://…',
    showLabel: 'Etiketi göster',
    hideLabel: 'Etiketi gizle',
    showName: 'Adı göster',
    hideName: 'Adı gizle',
    color: 'Renk',
    width: 'Kalınlık',
    lineStyle: 'Çizgi stili',
    lineType: 'Çizgi türü',
    useCustomColor: 'Özel renk kullan',
    showArrow: 'Oku göster',
    solid: 'Düz',
    dotted: 'Noktalı',
    dashed: 'Kesik',
    singleLine: 'Tek çizgi',
    doubleLine: 'Çift çizgi',
    doubleLineWithCircle: 'Daireli çift çizgi'
  },
  textBoxControls: {
    close: 'Kapat',
    name: 'Ad',
    namePlaceholder: 'Eleman adı…',
    text: 'Metin',
    textSize: 'Metin boyutu',
    textColor: 'Metin rengi',
    alignment: 'Hizalama'
  },
  rectangleControls: {
    close: 'Kapat',
    name: 'Ad',
    namePlaceholder: 'Eleman adı…',
    color: 'Renk',
    useCustomColor: 'Özel Renk Kullan'
  },
  labelColorPicker: {
    customColor: 'Özel renk'
  },
  deleteButton: {
    delete: 'Sil'
  },
  nodeActionBar: {
    style: 'Stil',
    editName: 'Adı düzenle',
    editLink: 'Bağlantıyı düzenle',
    addLink: 'Bağlantı ekle',
    editNotes: 'Notları düzenle',
    addNotes: 'Not ekle',
    startConnector: 'Bağlayıcı başlat',
    delete: 'Sil'
  },
  quickAddNodePopover: {
    add: 'Ekle',
    rectangle: 'Grup'
  },
  zoomControls: {
    zoomOut: 'Uzaklaştır',
    zoomIn: 'Yaklaştır',
    fitToScreen: 'Ekrana sığdır',
    keepLabelsReadable: 'Etiketleri okunabilir tut',
    help: 'Yardım (F1)'
  },
  previewLayerSwitcher: {
    layers: 'Katmanlar',
    showLayer: 'Katmanı göster',
    hideLayer: 'Katmanı gizle',
    solo: 'Solo',
    unsolo: 'Solodan çık'
  },
  previewLabelsToggle: {
    hideLabels: 'Etiketleri gizle',
    showLabels: 'Etiketleri göster'
  },
  annotationPalette: {
    pen: 'Açıklama',
    select: 'Seç',
    draw: 'Çiz',
    shapes: 'Şekiller',
    pencil: 'Kalem',
    highlighter: 'Fosforlu kalem',
    line: 'Çizgi',
    arrow: 'Ok',
    rectangle: 'Dikdörtgen',
    ellipse: 'Elips',
    eraser: 'Silgi',
    undo: 'Geri al',
    redo: 'Yinele',
    clear: 'Tümünü temizle'
  },
  viewModeInfoPopover: {
    close: 'Kapat'
  },
  labelSettings: {
    description: 'Etiket görüntüleme ayarlarını yapılandır',
    expandButtonPadding: 'Genişlet düğmesi dolgusu',
    expandButtonPaddingDesc:
      'Genişlet düğmesi görünür olduğunda alt dolgu (metin üst üste binmesini önler)'
  },
  iconSelectionControls: {
    close: 'Kapat',
    importIcons: 'Simge İçe Aktar',
    addMoreIcons: 'Daha fazla simge ekle',
    isometricLabel: 'İzometrik olarak değerlendir (3D görünüm)',
    isometricHint: 'Düz simgeler için işareti kaldırın (logolar, UI öğeleri)',
    dragHint: 'Aşağıdaki herhangi bir öğeyi tuvale sürükleyip bırakabilirsiniz.',
    aiPromptTooltip: 'Yapay zekâ ile simge oluştur',
    aiPromptTitle: 'Yapay zekâ ile izometrik simgeler oluştur',
    aiPromptBody:
      "Bu istemi bir görsel üreten yapay zekâya yapıştırın. 'my object' kısmını ihtiyacınızla değiştirin ve oluşturulan PNG'yi içe aktarın.",
    aiPromptCopy: 'İstemi kopyala',
    aiPromptCopied: 'Kopyalandı'
  },
  searchbox: {
    placeholder: 'Simge ara'
  },
  exportImageDialog: {
    title: 'Resim olarak dışa aktar',
    compatibilityTitle: 'Tarayıcı Uyumluluk Bildirimi',
    compatibilityMessage:
      'En iyi sonuçlar için lütfen Chrome veya Edge kullanın. Firefox şu anda dışa aktarma özelliğiyle uyumluluk sorunları yaşamaktadır.',
    cropInstruction:
      'Dışa aktarmak istediğiniz alanı seçmek için tıklayıp sürükleyin',
    options: 'Seçenekler',
    showGrid: 'Kılavuzu göster',
    showLabels: 'Etiketleri göster',
    expandDescriptions: 'Açıklamaları genişlet',
    screenshotPreset: 'Ekran görüntüsü (önerilen)',
    scaleClamped: 'Dışa aktarma boyutu, tarayıcı görüntü sınırına uyacak şekilde küçültüldü:',
    cropToContent: 'İçeriğe göre kırp',
    backgroundColor: 'Arka plan rengi',
    transparentBackground: 'Şeffaf arka plan',
    exportQuality: 'Dışa Aktarma Kalitesi (DPI)',
    custom: 'Özel',
    recrop: 'Yeniden kırp',
    cropApplied: 'Kırpma başarıyla uygulandı',
    applyCrop: 'Kırpmayı Uygula',
    clearSelection: 'Seçimi Temizle',
    cropHint:
      'Kırpılacak bir alan seçin veya tam resmi kullanmak için "İçeriğe göre kırp" seçeneğinin işaretini kaldırın',
    cancel: 'İptal',
    downloadSvg: 'SVG olarak indir',
    downloadPng: 'PNG olarak indir',
    error: 'Resim dışa aktarılamadı'
  },
  toolMenu: {
    undo: 'Geri Al',
    redo: 'Yinele',
    select: 'Seç',
    lassoSelect: 'Lasso seçimi',
    freehandLasso: 'Serbest lasso',
    pan: 'Kaydır',
    addItem: 'Öğe ekle',
    rectangle: 'Dikdörtgen',
    connector: 'Bağlayıcı',
    text: 'Metin'
  },
  quickIconSelector: {
    recentlyUsed: 'SON KULLANILAN',
    searchResults: 'ARAMA SONUÇLARI ({count} simge)',
    noIconsFound: '"{term}" ile eşleşen simge bulunamadı'
  }
};

export default locale;
