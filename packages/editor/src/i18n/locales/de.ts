import type en from "./en";

const de: typeof en = {
  // Footer (OSS only)
  footer: {
    poweredBy: "Erstellt mit",
    openSource: "Open Source",
  },

  // History (undo/redo)
  history: {
    undo: "Rückgängig",
    redo: "Wiederholen",
    collabWarning:
      "Rückgängig machen kann die Änderungen anderer Mitarbeiter beeinflussen",
  },

  // Viewport toggle
  viewport: {
    label: "Ansichtsgröße",
    desktop: "Desktop",
    tablet: "Tablet",
    mobile: "Mobil",
  },

  // Dark mode preview
  darkMode: {
    enable: "Dunkelmodus-Vorschau",
    disable: "Hellmodus-Vorschau",
  },

  // Preview mode
  previewMode: {
    enable: "Vorschaumodus",
    disable: "Vorschau beenden",
  },

  // Sidebar - Block types
  blocks: {
    section: "Abschnitt",
    image: "Bild",
    title: "Titel",
    paragraph: "Absatz",
    button: "Schaltfläche",
    divider: "Trennlinie",
    video: "Video",
    social: "Sozial",
    spacer: "Abstand",
    html: "HTML",
    menu: "Menü",
    table: "Tabelle",
    countdown: "Countdown",
  },

  // Right sidebar
  sidebar: {
    content: "Inhalt",
    settings: "Einstellungen",
    noSelection: "Kein Element ausgewählt",
    noSelectionHint:
      "Wählen Sie einen Block auf der Leinwand aus, um ihn zu bearbeiten",
  },

  // Toolbar - Common
  toolbar: {
    duplicate: "Duplizieren",
    delete: "Löschen",
  },

  // Title editor toolbar
  titleEditor: {
    toolbar: "Titelformatierung",
    bold: "Fett (Strg+B)",
    italic: "Kursiv (Strg+I)",
    addLink: "Link hinzufügen",
  },

  // Paragraph editor toolbar
  paragraphEditor: {
    toolbar: "Textformatierung",
    bold: "Fett (Strg+B)",
    italic: "Kursiv (Strg+I)",
    underline: "Unterstrichen (Strg+U)",
    strikethrough: "Durchgestrichen",
    subscript: "Tiefgestellt",
    superscript: "Hochgestellt",
    addLink: "Link hinzufügen",
    bulletList: "Aufzählungsliste",
    numberedList: "Nummerierte Liste",
    alignLeft: "Linksbündig",
    alignCenter: "Zentriert",
    alignRight: "Rechtsbündig",
    clearFormatting: "Formatierung entfernen",
    insertEmoji: "Emoji einfügen",
    fontFamily: "Schriftart",
    defaultFont: "Standard",
    fontSize: "Schriftgröße",
    defaultSize: "Standard",
    textColor: "Textfarbe",
    highlightColor: "Hervorhebungsfarbe",
    lineHeight: "Zeilenhöhe",
    letterSpacing: "Zeichenabstand",
    emojiItemLabel: "Emoji {emoji} einfügen",
    closeEmojiPicker: "Emoji-Auswahl schließen",
  },

  // Block actions (BlockWrapper)
  blockActions: {
    drag: "Zum Sortieren ziehen oder Leertaste drücken, um mit der Tastatur zu verschieben",
    dragLifted:
      "{block} wird verschoben. Pfeiltasten zum Positionieren, Leer- oder Eingabetaste zum Ablegen, Esc zum Abbrechen.",
    duplicate: "Block duplizieren",
    delete: "Block löschen",
    hiddenOnViewport: "Ausgeblendet auf {viewport}",
    saveAsModule: "Als Modul speichern",
    conditionToggle: "Anzeigebedingung umschalten",
    comments: "Kommentare ({count})",
    lifted: "{block} angehoben. Position {position} von {total}.",
    moved: "{block} auf Position {position} von {total} verschoben.",
    dropped: "{block} auf Position {position} von {total} abgelegt.",
    cancelled:
      "Verschieben abgebrochen. {block} auf Position {position} zurückgesetzt.",
  },

  // Toolbar - Section
  section: {
    dropHere: "Blöcke hierher ziehen",
    columns: "Spalten",
    column1: "1 Spalte",
    column2: "2 Spalten",
    column3: "3 Spalten",
    ratio12: "1:2 Verhältnis",
    ratio21: "2:1 Verhältnis",
  },

  // Text editor link dialog
  linkDialog: {
    editLink: "Link bearbeiten",
    insertLink: "Link einfügen",
    updateLink: "Link aktualisieren",
    removeLink: "Link entfernen",
    cancel: "Abbrechen",
    urlPlaceholder: "https://beispiel.de",
    urlLabel: "URL",
  },

  // Toolbar - Title
  title: {
    level: "Überschriftenebene",
    heading1: "Überschrift 1 (36px)",
    heading2: "Überschrift 2 (28px)",
    heading3: "Überschrift 3 (22px)",
    heading4: "Überschrift 4 (18px)",
    fontFamily: "Schriftart",
    inheritFont: "Vorlagenschrift verwenden",
    color: "Farbe",
    align: "Ausrichtung",
    alignLeft: "Links",
    alignCenter: "Zentriert",
    alignRight: "Rechts",
  },

  // Emoji picker
  emoji: {
    smileys: "Smileys",
    gestures: "Gesten",
    objects: "Objekte",
  },

  // Toolbar - Image
  image: {
    imageUrl: "Bild-URL",
    imageUrlPlaceholder: "https://...",
    altText: "Alternativtext",
    altTextPlaceholder: "Bildbeschreibung",
    width: "Breite",
    fullWidth: "Volle Breite",
    linkUrl: "Link-URL",
    openInNewTab: "In neuem Tab öffnen",
    placeholderUrl: "Platzhalterbild",
    placeholderUrlPlaceholder: "https://... (nur zur Gestaltung)",
    placeholderUrlTooltip:
      "Da die Bild-URL ein Merge-Tag verwendet, können Sie hier ein echtes Bild angeben, um das Layout während der Gestaltung in der Vorschau anzuzeigen. Dies wird nicht in die endgültige Ausgabe aufgenommen.",
    clickToAdd: "Klicken Sie, um eine Bild-URL hinzuzufügen",
    browseMedia: "Medien durchsuchen",
    decorative: "Dekoratives Bild",
    decorativeHint:
      "Wird von Bildschirmlesern ignoriert. Nur für Abstandshalter und visuelle Verzierungen verwenden.",
  },

  // Toolbar - Video
  video: {
    videoUrl: "Video-URL",
    videoUrlPlaceholder: "https://youtube.com/...",
    youtube: "YouTube",
    vimeo: "Vimeo",
    detected: "Video erkannt — Vorschaubild wird automatisch generiert",
    openInNewTab: "In neuem Tab öffnen",
    customThumbnail: "Eigenes Vorschaubild",
    optional: "(optional)",
    thumbnailPlaceholder: "Automatisch aus Video-URL generiert",
    altText: "Alternativtext",
    altTextPlaceholder: "Videobeschreibung",
    width: "Breite",
    fullWidth: "Volle Breite",
    placeholderUrl: "Platzhalter-Thumbnail",
    placeholderUrlPlaceholder: "https://... (nur zur Gestaltung)",
    placeholderUrlTooltip:
      "Da die Video-URL ein Merge-Tag verwendet, können Sie hier ein echtes Thumbnail angeben, um das Layout während der Gestaltung in der Vorschau anzuzeigen. Dies wird nicht in die endgültige Ausgabe aufgenommen.",
    addVideo: "Video-URL hinzufügen",
  },

  // Toolbar - Button
  button: {
    fontFamily: "Schriftart",
    inheritFont: "Vorlagenschrift verwenden",
    text: "Text",
    url: "URL",
    urlPlaceholder: "https://...",
    openInNewTab: "In neuem Tab öffnen",
    background: "Hintergrund",
    textColor: "Textfarbe",
    borderRadius: "Eckenradius",
    fontSize: "Schriftgröße",
  },

  // Toolbar - Divider
  divider: {
    style: "Stil",
    solid: "Durchgehend",
    dashed: "Gestrichelt",
    dotted: "Gepunktet",
    color: "Farbe",
    thickness: "Stärke",
  },

  // Toolbar - Social Icons
  social: {
    icons: "Symbole",
    addIcon: "Symbol hinzufügen",
    addIcons: "Soziale Symbole hinzufügen",
    removeIcon: "Entfernen",
    platform: "Plattform",
    url: "URL",
    urlPlaceholder: "https://...",
    style: "Stil",
    styleSolid: "Gefüllt",
    styleOutlined: "Umrandet",
    styleRounded: "Abgerundet",
    styleSquare: "Eckig",
    styleCircle: "Rund",
    size: "Größe",
    sizeSmall: "K",
    sizeMedium: "M",
    sizeLarge: "G",
    spacing: "Abstand",
    align: "Ausrichtung",
    platforms: {
      facebook: "Facebook",
      twitter: "X (Twitter)",
      instagram: "Instagram",
      linkedin: "LinkedIn",
      youtube: "YouTube",
      tiktok: "TikTok",
      pinterest: "Pinterest",
      email: "E-Mail",
      whatsapp: "WhatsApp",
      telegram: "Telegram",
      discord: "Discord",
      snapchat: "Snapchat",
      reddit: "Reddit",
      github: "GitHub",
      dribbble: "Dribbble",
      behance: "Behance",
    },
  },

  // Toolbar - Menu
  menu: {
    items: "Menüpunkte",
    addItem: "Punkt hinzufügen",
    removeItem: "Entfernen",
    text: "Text",
    url: "URL",
    urlPlaceholder: "https://beispiel.de",
    openInNewTab: "In neuem Tab öffnen",
    bold: "Fett",
    underline: "Unterstrichen",
    color: "Farbe",
    linkColor: "Linkfarbe",
    fontSize: "Schriftgröße",
    fontFamily: "Schriftfamilie",
    separator: "Trennzeichen",
    separatorColor: "Trennzeichenfarbe",
    spacing: "Abstand",
    textAlign: "Ausrichtung",
    addLinks: "Menülinks hinzufügen",
  },

  // Toolbar - Table
  table: {
    dimensions: "Abmessungen",
    rows: "Zeilen",
    columns: "Spalten",
    addRow: "Zeile hinzufügen",
    removeRow: "Zeile entfernen",
    addColumn: "Spalte hinzufügen",
    removeColumn: "Spalte entfernen",
    hasHeaderRow: "Kopfzeile",
    headerBackgroundColor: "Kopfzeilen-Hintergrund",
    noHeaderBg: "Kein Hintergrund",
    borderColor: "Rahmenfarbe",
    borderWidth: "Rahmenbreite",
    cellPadding: "Zellenabstand",
    fontFamily: "Schriftart",
    fontSize: "Schriftgröße",
    color: "Textfarbe",
    textAlign: "Ausrichtung",
    cellPlaceholder: "Text eingeben...",
    empty: "Tabelle hinzufügen",
  },

  // Toolbar - Spacer
  spacer: {
    height: "Höhe",
  },

  // Toolbar - Countdown
  countdown: {
    targetDate: "Zieldatum",
    timezone: "Zeitzone",
    display: "Anzeige",
    days: "Tage",
    hours: "Stunden",
    minutes: "Minuten",
    seconds: "Sekunden",
    separator: "Trennzeichen",
    fontFamily: "Schriftart",
    inheritFont: "Standard",
    digitFontSize: "Zifferngröße",
    digitColor: "Ziffernfarbe",
    labelColor: "Beschriftungsfarbe",
    labelFontSize: "Beschriftungsgröße",
    background: "Hintergrund",
    labels: "Beschriftungen",
    expiry: "Ablaufnachricht",
    expiredMessagePlaceholder: "Dieses Angebot ist abgelaufen",
    expiredImageUrl: "Ablaufbild-URL",
    hideOnExpiry: "Bei Ablauf ausblenden",
    setDate: "Legen Sie ein Zieldatum im Einstellungsbereich fest",
    hidden: "Ausgeblendet (abgelaufen)",
  },

  // Custom Blocks
  customBlocks: {
    definitionNotFound:
      "Unbekannter Blocktyp — dieser Block ist nicht registriert",
    renderError:
      "Dieser Block konnte nicht gerendert werden. Überprüfen Sie die Block-Vorlage auf Fehler.",
    fields: {
      required: "Pflichtfeld",
      addItem: "Element hinzufügen",
      removeItem: "Entfernen",
      maxItemsReached: "Maximale Anzahl erreicht",
      minItemsRequired: "Mindestens {count} Elemente erforderlich",
    },
    toolbar: {
      noDefinition:
        "Registrieren Sie diesen Blocktyp in Ihrer SDK-Konfiguration, um seine Eigenschaften zu bearbeiten",
    },
    dataSource: {
      fetchButton: "Inhalt laden",
      changeButton: "Ändern",
      fetching: "Wird geladen...",
      readOnlyTooltip: "Dieser Wert wird aus Ihrer Datenquelle geladen",
      fetchError: "Inhalt konnte nicht geladen werden",
    },
  },

  // Toolbar - HTML
  html: {
    content: "HTML-Inhalt",
    preview: "Benutzerdefinierter HTML-Block",
    empty: "HTML-Inhalt im Bereich hinzufügen",
    sanitizationHint:
      "Skripte und unsichere Elemente werden beim Export entfernt.",
  },

  // Toolbar - Common block settings
  blockSettings: {
    spacing: "Abstände",
    padding: "Innenabstand",
    margin: "Außenabstand",
    background: "Hintergrund",
    color: "Farbe",
    display: "Anzeige",
    showOnDesktop: "Auf Desktop anzeigen",
    showOnTablet: "Auf Tablet anzeigen",
    showOnMobile: "Auf Mobilgerät anzeigen",
    hiddenOnDevice: "Ausgeblendet auf {device}",
    customCss: "Benutzerdefiniertes CSS",
    css: "CSS",
    cssPlaceholder: "/* Benutzerdefinierte Stile */",
    displayCondition: "Anzeigebedingung",
    selectCondition: "Bedingung auswählen",
    removeCondition: "Bedingung entfernen",
    noCondition: "Immer sichtbar",
    conditionApplied: "Bedingung angewendet",
    customCondition: "Eigene Bedingung",
    customConditionLabel: "Bedingungsname",
    customConditionBefore: "Vorher (öffnende Logik)",
    customConditionAfter: "Nachher (schließende Logik)",
    applyCondition: "Anwenden",
    cancelCondition: "Abbrechen",
    customBadge: "Eigene",
    restoreHiddenBlocks: "Alle ausgeblendeten Blöcke anzeigen",
  },

  // Template settings
  templateSettings: {
    layout: "Layout",
    widthPreset: "Breitenvoreinstellung",
    customWidth: "Benutzerdefinierte Breite",
    appearance: "Erscheinungsbild",
    backgroundColor: "Hintergrundfarbe",
    fontFamily: "Schriftfamilie",
    preheaderText: "Preheader-Text",
    preheaderTextPlaceholder:
      "Vorschautext, der nach der Betreffzeile im Posteingang angezeigt wird...",
    preheaderTextHint:
      "Dieser Text erscheint nach der Betreffzeile in der E-Mail-Vorschau. Unterstützt Merge-Tags.",
    language: "Sprache",
    contentLocale: "Inhaltssprache",
    contentLocaleHint:
      "BCP-47-Code (z. B. en, de, pt-BR). Setzt das lang-Attribut der gerenderten E-Mail, damit Screenreader den Inhalt korrekt aussprechen.",
    tips: "Tipps",
    tip1: "600px ist die Standardbreite für E-Mail-Vorlagen",
    tip2: "Verwenden Sie websichere Schriften für beste Kompatibilität",
    tip3: "Helle Hintergründe eignen sich am besten für die Lesbarkeit",
  },

  // Spacing control
  spacingControl: {
    lockAll: "Alle Seiten sperren",
    unlock: "Seiten entsperren",
    top: "Oben",
    right: "Rechts",
    bottom: "Unten",
    left: "Links",
    decreaseTop: "Oben verringern",
    increaseTop: "Oben erhöhen",
    decreaseLeft: "Links verringern",
    increaseLeft: "Links erhöhen",
    decreaseRight: "Rechts verringern",
    increaseRight: "Rechts erhöhen",
    decreaseBottom: "Unten verringern",
    increaseBottom: "Unten erhöhen",
  },

  // Color Picker
  colorPicker: {
    pickColor: "Farbe auswählen",
    hexValue: "Hex-Farbwert",
  },

  // Merge-Tag
  mergeTag: {
    clickToEdit: "Zum Bearbeiten klicken",
    remove: "Merge-Tag entfernen",
    insert: "Merge-Tag einfügen",
    add: "Merge-Tag hinzufügen",
    editValue: "Merge-Tag-Wert bearbeiten",
    deleteMergeTag: "Merge-Tag löschen",
    suggestionEmpty: "Keine passenden Merge-Tags",
  },

  // Canvas
  canvas: {
    noBlocks: "Noch keine Blöcke",
    dragHint:
      "Beginnen Sie von Grund auf, indem Sie Blöcke aus der Seitenleiste ziehen",
    dropHere: "Hier ablegen",
    aiHintChat: "oder lassen Sie",
    aiHintChatSuffix: "in Sekunden eine komplette Vorlage für Sie erstellen",
    aiHintDesign:
      "Haben Sie ein bestehendes Design? Laden Sie einen Screenshot, ein Bild oder PDF hoch und",
    aiHintDesignSuffix: "erstellt es sofort nach",
  },

  // Media Library (cloud)
  mediaLibrary: {
    title: "Medienbibliothek",
    searchPlaceholder: "Dateien suchen...",
    allFiles: "Alle Dateien",
    filterAll: "Alle Typen",
    filterImages: "Bilder",
    filterDocuments: "Dokumente",
    filterVideos: "Videos",
    filterAudio: "Audio",
    newFolder: "Neuer Ordner",
    folderName: "Ordnername",
    noFiles: "Keine Dateien gefunden",
    dropOrClick: "Dateien hierher ziehen oder klicken zum Hochladen",
    acceptedFormats: "Bilder, PDF, Video, Audio, Dokumente (max. 10 MB)",
    uploading: "Wird hochgeladen...",
    uploadingProgress: "{current} von {total} wird hochgeladen...",
    selectImage: "Bild auswählen",
    selectFile: "Datei auswählen",
    deleteSelected: "Löschen",
    copyUrl: "URL kopieren",
    copied: "Kopiert!",
    browseMedia: "Medienbibliothek durchsuchen",
    renameFolder: "Ordner umbenennen",
    addSubfolder: "Unterordner hinzufügen",
    subfolderName: "Unterordnername",
    sortNewest: "Neueste zuerst",
    sortOldest: "Älteste zuerst",
    sortNameAsc: "Name A-Z",
    sortNameDesc: "Name Z-A",
    sortSizeAsc: "Kleinste zuerst",
    sortSizeDesc: "Größte zuerst",
    moveSelected: "Verschieben",
    moveToRoot: "Alle Dateien",
    currentFolder: "(aktuell)",
    confirmDelete: "Diese Datei löschen?",
    renameFile: "Umbenennen",
    editFile: "Datei bearbeiten",
    fileName: "Dateiname",
    altText: "Alternativtext",
    altTextPlaceholder: "Bildbeschreibung für Barrierefreiheit",
    saveChanges: "Speichern",
    cancel: "Abbrechen",
    frequentlyUsed: "Häufig verwendet",
    deleteWarningTitle: "Datei löschen",
    deleteWarningMessage:
      "Diese Datei wird dauerhaft gelöscht und kann nicht wiederhergestellt werden.",
    deleteWarningUsageNote:
      "Die folgenden Dateien werden in Vorlagen verwendet. Das Löschen kann diese Vorlagen beschädigen.",
    deleteAnyway: "Datei löschen",
    usedInTemplates: "In {count} Vorlage(n) verwendet",
    viewGrid: "Rasteransicht",
    viewList: "Listenansicht",
    showFolders: "Ordner anzeigen",
    hideFolders: "Ordner ausblenden",
    importFromUrl: "Von URL importieren",
    importUrlPlaceholder: "https://example.com/image.jpg",
    import: "Importieren",
    importing: "Wird importiert...",
    importError: "Import von URL fehlgeschlagen",
    conversionLabel: "Groesse",
    conversionOriginal: "Original",
    conversionSmall: "Klein (150px)",
    conversionMedium: "Mittel (600px)",
    conversionLarge: "Gross (1200px)",
    replaceFile: "Datei ersetzen",
    replaceWarningTitle: "Datei ersetzen",
    replaceWarningMessage:
      "Sie sind dabei, diese Datei zu ersetzen. Die Ersatzdatei muss dieselbe Dateierweiterung haben ({extension}).",
    replaceWarningUsageNote:
      "Diese Datei wird in {count} Vorlage(n) verwendet. Das Ersetzen aktualisiert alle Verweise.",
    replaceSelectFile: "Ersatzdatei auswählen",
    replace: "Ersetzen",
    replacing: "Wird ersetzt...",
    replaceError: "Ersetzen der Datei fehlgeschlagen",
    saving: "Wird gespeichert...",
    cropAspectRatio: "Seitenverhältnis",
    cropFree: "Frei",
    cropSquare: "1:1",
    cropLandscape43: "4:3",
    cropLandscape169: "16:9",
    cropOriginal: "Original",
    cropMaxWidth: "Max. Breite",
    cropMaxHeight: "Max. Höhe",
    cropOutputSize: "Ausgabegröße",
    cropPixels: "px",
    cropOptional: "(optional)",
    storageTooltip: "{used} von {total} verwendet ({remaining} verfügbar)",
  },

  // Seitenleiste
  sidebarNav: {
    browseModules: "Gespeicherte Module durchsuchen",
    expandSidebar: "Block-Seitenleiste erweitern",
    palette: "Blockpalette",
    insertBlock: "{block}-Block einfügen",
  },

  // Landmark-Bezeichnungen für Hilfstechnologien
  landmarks: {
    canvas: "E-Mail-Leinwand",
    blockToolbar: "Blockeigenschaften",
    rightSidebar: "Blockeigenschaften und Vorlageneinstellungen",
    reorderAnnouncements: "Block-Neuanordnungsmeldungen",
  },

  // Design Reference (cloud)
  errors: {
    editorLoading: "Editor wird geladen...",
    editorLoadFailed: "Editor konnte nicht geladen werden.",
    retry: "Erneut versuchen",
  },

  accessibility: {
    panelTitle: "Barrierefreiheit",
    panelTabLabel: "Barrierefreiheit",
    groupErrors: "Fehler",
    groupWarnings: "Warnungen",
    groupInfo: "Hinweise",
    jump: "Zum Block springen",
    fix: "Beheben",
    emptyState: "Keine Probleme mit der Barrierefreiheit.",
    badgeError: "Hat Barrierefreiheitsfehler",
    badgeWarning: "Hat Barrierefreiheitswarnungen",
    issueCountTooltip: "{count} Barrierefreiheitsprobleme",
  },
};

export default de;
