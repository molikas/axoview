import { LocaleProps } from '../types/axoviewProps';

const locale: LocaleProps = {
  common: {
    exampleText: 'Ini adalah contoh teks'
  },
  helpDialog: {
    title: 'Pintasan Keyboard & Bantuan',
    close: 'Tutup',
    keyboardShortcuts: 'Pintasan Keyboard',
    mouseInteractions: 'Interaksi Mouse',
    action: 'Aksi',
    shortcut: 'Pintasan',
    method: 'Metode',
    description: 'Deskripsi',
    note: 'Catatan:',
    noteContent:
      'Pintasan keyboard dinonaktifkan saat mengetik di bidang input, area teks, atau elemen yang dapat diedit untuk mencegah konflik.',
    // Keyboard shortcuts
    undoAction: 'Batalkan',
    undoDescription: 'Batalkan aksi terakhir',
    redoAction: 'Ulangi',
    redoDescription: 'Ulangi aksi terakhir yang dibatalkan',
    redoAltAction: 'Ulangi (Alternatif)',
    redoAltDescription: 'Pintasan alternatif untuk mengulangi',
    helpAction: 'Bantuan',
    helpDescription: 'Buka dialog bantuan dengan pintasan keyboard',
    zoomInAction: 'Perbesar',
    zoomInShortcut: 'Roda Mouse Naik',
    zoomInDescription: 'Perbesar kanvas',
    zoomOutAction: 'Perkecil',
    zoomOutShortcut: 'Roda Mouse Turun',
    zoomOutDescription: 'Perkecil kanvas',
    panCanvasAction: 'Geser Kanvas',
    panCanvasShortcut: 'Klik Kiri + Seret',
    panCanvasDescription: 'Geser kanvas saat dalam mode Geser',
    togglePanToolAction: 'Aktifkan/Nonaktifkan Alat Geser',
    togglePanToolShortcut: 'Klik kanan',
    togglePanToolDescription:
      'Aktifkan/nonaktifkan mode geser; klik kiri untuk kembali ke mode pilih',
    lassoSelectAction: 'Seleksi Lasso',
    lassoSelectShortcut: 'Klik Kiri + Seret (area kosong)',
    lassoSelectDescription:
      'Gambar kotak seleksi persegi panjang untuk memilih beberapa item',
    deselectAction: 'Batal Pilih',
    deselectShortcut: 'Klik Kiri (area kosong)',
    deselectDescription:
      'Batalkan pilihan saat ini dan kembali ke mode pilih',
    addNodeGroupAction: 'Add Node / Group',
    addNodeGroupShortcut: 'Klik ganda (area kosong)',
    addNodeGroupDescription:
      'Opens the Add popover at the cursor: pick an icon to place a node, or click Group to add a background area for visually grouping nodes',
    // Mouse interactions
    selectToolAction: 'Alat Pilih',
    selectToolShortcut: 'Klik tombol Pilih',
    selectToolDescription: 'Beralih ke mode pemilihan',
    panToolAction: 'Alat Geser',
    panToolShortcut: 'Klik tombol Geser',
    panToolDescription: 'Beralih ke mode geser untuk memindahkan kanvas',
    addItemAction: 'Tambah Item',
    addItemShortcut: 'Klik tombol Tambah item',
    addItemDescription: 'Buka pemilih ikon untuk menambahkan item baru',
    drawRectangleAction: 'Gambar Persegi Panjang',
    drawRectangleShortcut: 'Klik tombol Persegi Panjang',
    drawRectangleDescription: 'Beralih ke mode menggambar persegi panjang',
    createConnectorAction: 'Buat Konektor',
    createConnectorShortcut: 'Klik tombol Konektor',
    createConnectorDescription: 'Beralih ke mode konektor',
    addTextAction: 'Tambah Teks',
    addTextShortcut: 'Klik tombol Teks',
    addTextDescription: 'Buat kotak teks baru',
    deleteSelectedAction: 'Hapus yang Dipilih',
    deleteSelectedShortcut: 'Delete (Backspace di Mac)',
    deleteSelectedDescription:
      'Hapus item yang dipilih atau semua item dalam seleksi lasso; mendukung undo/redo',
    cutAction: 'Potong',
    cutDescription:
      'Potong item yang dipilih ke clipboard — item dihapus dan dapat ditempel di tempat lain; mendukung undo/redo',
    copyAction: 'Salin',
    copyDescription: 'Salin item yang dipilih ke clipboard',
    pasteAction: 'Tempel',
    pasteDescription:
      'Tempel item clipboard di posisi mouse; digeser untuk menghindari tumpang tindih'
  },
  connectorHintTooltip: {
    tipCreatingConnectors: 'Tip: Membuat Konektor',
    tipConnectorTools: 'Tip: Alat Konektor',
    clickInstructionStart: 'Klik',
    clickInstructionMiddle: 'pada node atau titik pertama, lalu',
    clickInstructionEnd: 'pada node atau titik kedua untuk membuat koneksi.',
    nowClickTarget: 'Sekarang klik pada target untuk menyelesaikan koneksi.',
    dragStart: 'Seret',
    dragEnd: 'dari node pertama ke node kedua untuk membuat koneksi.',
    rerouteStart: 'Untuk mengubah rute konektor,',
    rerouteMiddle: 'klik kiri',
    rerouteEnd:
      'pada titik mana pun di sepanjang garis konektor dan seret untuk membuat atau memindahkan titik jangkar.'
  },
  lassoHintTooltip: {
    tipLasso: 'Tip: Seleksi Lasso',
    tipFreehandLasso: 'Tip: Seleksi Lasso Bebas',
    lassoDragStart: 'Klik dan seret',
    lassoDragEnd:
      'untuk menggambar kotak seleksi persegi panjang di sekitar item yang ingin Anda pilih.',
    freehandDragStart: 'Klik dan seret',
    freehandDragMiddle: 'untuk menggambar',
    freehandDragEnd: 'bentuk bebas',
    freehandComplete:
      'di sekitar item. Lepas untuk memilih semua item di dalam bentuk.',
    moveStart: 'Setelah dipilih,',
    moveMiddle: 'klik di dalam seleksi',
    moveEnd: 'dan seret untuk memindahkan semua item yang dipilih bersama.'
  },
  importHintTooltip: {
    title: 'Impor Diagram',
    instructionStart: 'Untuk mengimpor diagram, klik',
    menuButton: 'tombol menu',
    instructionMiddle: '(☰) di pojok kiri atas, lalu pilih',
    openButton: '"Buka"',
    instructionEnd: 'untuk memuat file diagram Anda.'
  },
  connectorRerouteTooltip: {
    title: 'Tip: Ubah Rute Konektor',
    instructionStart:
      'Setelah konektor Anda ditempatkan, Anda dapat mengubah rutenya sesuai keinginan.',
    instructionSelect: 'Pilih konektor',
    instructionMiddle: 'terlebih dahulu, lalu',
    instructionClick: 'klik pada jalur konektor',
    instructionAnd: 'dan',
    instructionDrag: 'seret',
    instructionEnd: 'untuk mengubahnya!'
  },
  connectorEmptySpaceTooltip: {
    message: 'Untuk menghubungkan konektor ini ke node,',
    instruction:
      'klik kiri pada ujung konektor dan seret ke node yang diinginkan.'
  },
  settings: {
    zoom: {
      description: 'Konfigurasi perilaku zoom saat menggunakan roda mouse.',
      zoomToCursor: 'Zoom ke Kursor',
      zoomToCursorDesc:
        'Saat diaktifkan, zoom masuk/keluar terpusat pada posisi kursor mouse. Saat dinonaktifkan, zoom terpusat pada kanvas.'
    },
    hotkeys: {
      title: 'Pengaturan Pintasan',
      profile: 'Profil Pintasan',
      profileQwerty: 'QWERTY (Q, W, E, R, T, Y)',
      profileSmnrct: 'SMNRCT (S, M, N, R, C, T)',
      profileNone: 'Tidak Ada Pintasan',
      tool: 'Alat',
      hotkey: 'Pintasan',
      toolSelect: 'Pilih',
      toolPan: 'Geser',
      toolAddItem: 'Tambah Item',
      toolRectangle: 'Persegi Panjang',
      toolConnector: 'Konektor',
      toolText: 'Teks',
      note: 'Catatan: Pintasan berfungsi saat tidak mengetik di bidang teks',
      fixedShortcutsTitle: 'Pintasan Tetap (Selalu Aktif)',
      fixedCut: 'Potong',
      fixedCopy: 'Salin',
      fixedPaste: 'Tempel',
      fixedUndo: 'Batalkan',
      fixedRedo: 'Ulangi'
    },
    pan: {
      title: 'Pengaturan Geser',
      mousePanOptions: 'Opsi Geser Mouse',
      emptyAreaClickPan: 'Klik dan seret pada area kosong',
      middleClickPan: 'Klik tengah dan seret',
      rightClickPan: 'Klik kanan dan seret',
      ctrlClickPan: 'Ctrl + klik dan seret',
      altClickPan: 'Alt + klik dan seret',
      keyboardPanOptions: 'Opsi Geser Keyboard',
      arrowKeys: 'Tombol panah',
      wasdKeys: 'Tombol WASD',
      ijklKeys: 'Tombol IJKL',
      keyboardPanSpeed: 'Kecepatan Geser Keyboard',
      note: 'Catatan: Opsi geser berfungsi selain alat Geser khusus'
    },
    connector: {
      title: 'Pengaturan Konektor',
      connectionMode: 'Mode Pembuatan Koneksi',
      clickMode: 'Mode Klik (Direkomendasikan)',
      clickModeDesc:
        'Klik node pertama, lalu klik node kedua untuk membuat koneksi',
      dragMode: 'Mode Seret',
      dragModeDesc: 'Klik dan seret dari node pertama ke node kedua',
      note: 'Catatan: Anda dapat mengubah pengaturan ini kapan saja. Mode yang dipilih akan digunakan saat alat Konektor aktif.'
    },
    iconPacks: {
      title: 'Manajemen Paket Ikon',
      lazyLoading: 'Aktifkan Lazy Loading',
      lazyLoadingDesc:
        'Muat paket ikon sesuai permintaan untuk startup yang lebih cepat',
      availablePacks: 'Paket Ikon Tersedia',
      coreIsoflow: 'Core Isoflow (Selalu Dimuat)',
      alwaysEnabled: 'Selalu diaktifkan',
      awsPack: 'Ikon AWS',
      gcpPack: 'Ikon Google Cloud',
      azurePack: 'Ikon Azure',
      kubernetesPack: 'Ikon Kubernetes',
      loading: 'Memuat...',
      loaded: 'Dimuat',
      notLoaded: 'Tidak dimuat',
      iconCount: '{count} ikon',
      lazyLoadingDisabledNote:
        'Lazy loading dinonaktifkan. Semua paket ikon dimuat saat startup.',
      note: 'Paket ikon dapat diaktifkan atau dinonaktifkan sesuai kebutuhan Anda. Paket yang dinonaktifkan akan mengurangi penggunaan memori dan meningkatkan performa.'
    }
  },
  lazyLoadingWelcome: {
    title: 'Selamat Datang di Axoview',
    message:
      "Hai! Setelah banyak permintaan, kami telah mengimplementasikan Lazy Loading ikon, jadi sekarang jika Anda ingin mengaktifkan paket ikon non-standar, Anda dapat mengaktifkannya di bagian 'Konfigurasi'.",
    configPath: 'Klik pada ikon Hamburger',
    configPath2: 'di kiri atas untuk mengakses Konfigurasi.',
    canDisable: 'Anda dapat menonaktifkan perilaku ini jika diinginkan.',
    signature: '— Axoview'
  },
  viewTabs: {
    addPage: 'Tambah halaman',
    deletePage: 'Hapus halaman',
    renameDiagram: 'Ganti nama diagram',
    addPageDisabled: 'Batas halaman tercapai (5)'
  },
  nodePanel: {
    details: 'Detail',
    style: 'Gaya',
    notes: 'Catatan',
    notesModified: 'Catatan ●',
    close: 'Tutup',
    openLink: 'Buka tautan',
    caption: 'Keterangan',
    noCaption: 'Tidak ada keterangan.',
    showLabel: 'Tampilkan label',
    hideLabel: 'Sembunyikan label',
    showName: 'Tampilkan nama',
    hideName: 'Sembunyikan nama'
  },
  nodeInfoTab: {
    name: 'Nama',
    namePlaceholder: 'Nama node…',
    removeLink: 'Hapus tautan',
    addLink: 'Tambahkan tautan ke nama',
    linkPlaceholder: 'https://…',
    caption: 'Keterangan',
    captionHint: 'Ditampilkan di kanvas di bawah nama node',
    openLink: 'Buka tautan',
    diagramLink: 'Tautan ke diagram',
    diagramLinkPlaceholder: 'Pilih diagram…',
    diagramLinkHint: 'Mengklik node ini dalam mode baca-saja membuka diagram yang ditautkan',
    openDiagramLink: 'Buka diagram yang ditautkan'
  },
  nodeStyleTab: {
    icon: 'Ikon',
    close: 'Tutup',
    change: 'Ubah…',
    iconSize: 'Ukuran ikon',
    labelFontSize: 'Ukuran font label',
    labelColor: 'Warna label',
    labelHeight: 'Tinggi label'
  },
  connectorControls: {
    close: 'Tutup',
    labels: 'Label',
    details: 'Detail',
    style: 'Gaya',
    notes: 'Catatan',
    notesModified: 'Catatan ●',
    name: 'Nama',
    namePlaceholder: 'Label sisi…',
    additionalLabels: 'Label tambahan',
    addLabel: 'Tambah label',
    noLabels: 'Belum ada label.',
    addLink: 'Tambah tautan',
    removeLink: 'Hapus tautan',
    linkPlaceholder: 'https://…',
    showLabel: 'Tampilkan label',
    hideLabel: 'Sembunyikan label',
    showName: 'Tampilkan nama',
    hideName: 'Sembunyikan nama',
    color: 'Warna',
    width: 'Tebal',
    lineStyle: 'Gaya garis',
    lineType: 'Tipe garis',
    useCustomColor: 'Gunakan warna kustom',
    showArrow: 'Tampilkan panah',
    solid: 'Penuh',
    dotted: 'Titik',
    dashed: 'Putus-putus',
    singleLine: 'Garis tunggal',
    doubleLine: 'Garis ganda',
    doubleLineWithCircle: 'Garis ganda dengan lingkaran'
  },
  textBoxControls: {
    close: 'Tutup',
    name: 'Nama',
    namePlaceholder: 'Nama elemen…',
    text: 'Teks',
    textSize: 'Ukuran teks',
    textColor: 'Warna teks',
    alignment: 'Perataan'
  },
  rectangleControls: {
    close: 'Tutup',
    name: 'Nama',
    namePlaceholder: 'Nama elemen…',
    color: 'Warna',
    useCustomColor: 'Gunakan Warna Kustom'
  },
  labelColorPicker: {
    customColor: 'Warna kustom'
  },
  deleteButton: {
    delete: 'Hapus'
  },
  nodeActionBar: {
    style: 'Gaya',
    editName: 'Edit nama',
    editLink: 'Edit tautan',
    addLink: 'Tambah tautan',
    editNotes: 'Edit catatan',
    addNotes: 'Tambah catatan',
    startConnector: 'Mulai konektor',
    delete: 'Hapus'
  },
  quickAddNodePopover: {
    add: 'Tambah',
    rectangle: 'Grup'
  },
  zoomControls: {
    zoomOut: 'Perkecil',
    zoomIn: 'Perbesar',
    fitToScreen: 'Sesuaikan ke layar',
    keepLabelsReadable: 'Jaga label tetap terbaca',
    help: 'Bantuan (F1)'
  },
  labelSettings: {
    description: 'Konfigurasi pengaturan tampilan label',
    expandButtonPadding: 'Padding tombol perluas',
    expandButtonPaddingDesc:
      'Padding bawah saat tombol perluas terlihat (mencegah tumpang tindih teks)'
  },
  iconSelectionControls: {
    close: 'Tutup',
    importIcons: 'Impor Ikon',
    addMoreIcons: 'Tambah lebih banyak ikon',
    isometricLabel: 'Perlakukan sebagai isometrik (tampilan 3D)',
    isometricHint: 'Hapus centang untuk ikon datar (logo, elemen UI)',
    dragHint:
      'Anda dapat menyeret dan menjatuhkan item mana pun di bawah ke kanvas.',
    aiPromptTooltip: 'Buat ikon dengan AI',
    aiPromptTitle: 'Buat ikon isometrik dengan AI',
    aiPromptBody:
      "Tempel prompt ini ke AI penghasil gambar. Ganti 'my object' dengan kebutuhan Anda, lalu impor PNG yang dihasilkan.",
    aiPromptCopy: 'Salin prompt',
    aiPromptCopied: 'Disalin'
  },
  searchbox: {
    placeholder: 'Cari ikon'
  },
  exportImageDialog: {
    title: 'Ekspor sebagai gambar',
    compatibilityTitle: 'Pemberitahuan Kompatibilitas Browser',
    compatibilityMessage:
      'Untuk hasil terbaik, gunakan Chrome atau Edge. Firefox saat ini memiliki masalah kompatibilitas dengan fitur ekspor.',
    cropInstruction: 'Klik dan seret untuk memilih area yang ingin diekspor',
    options: 'Opsi',
    showGrid: 'Tampilkan kisi',
    expandDescriptions: 'Perluas deskripsi',
    cropToContent: 'Pangkas ke konten',
    backgroundColor: 'Warna latar belakang',
    transparentBackground: 'Latar belakang transparan',
    exportQuality: 'Kualitas Ekspor (DPI)',
    custom: 'Kustom',
    recrop: 'Pangkas ulang',
    cropApplied: 'Pemangkasan berhasil diterapkan',
    applyCrop: 'Terapkan Pemangkasan',
    clearSelection: 'Hapus Pilihan',
    cropHint:
      'Pilih area untuk dipangkas, atau hapus centang "Pangkas ke konten" untuk menggunakan gambar penuh',
    cancel: 'Batal',
    downloadSvg: 'Unduh sebagai SVG',
    downloadPng: 'Unduh sebagai PNG',
    error: 'Tidak dapat mengekspor gambar'
  },
  toolMenu: {
    undo: 'Batalkan',
    redo: 'Ulangi',
    select: 'Pilih',
    lassoSelect: 'Seleksi lasso',
    freehandLasso: 'Lasso bebas',
    pan: 'Geser',
    addItem: 'Tambah item',
    rectangle: 'Persegi panjang',
    connector: 'Konektor',
    text: 'Teks'
  },
  quickIconSelector: {
    recentlyUsed: 'BARU DIGUNAKAN',
    searchResults: 'HASIL PENCARIAN ({count} ikon)',
    noIconsFound: 'Tidak ada ikon yang cocok dengan "{term}"'
  }
};

export default locale;
