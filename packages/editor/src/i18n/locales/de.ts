export default {
  // Loading
  loading: {
    initializing: "Initialisieren...",
  },

  // Error
  error: {
    title: "Etwas ist schiefgelaufen",
    defaultMessage:
      "Der Editor konnte keine Verbindung zu Templatical herstellen. Überprüfen Sie Ihre Netzwerkverbindung und versuchen Sie es erneut.",
    authFailed:
      "Authentifizierung fehlgeschlagen. Bitte überprüfen Sie Ihre Anmeldedaten.",
    templateNotFound:
      "Die angeforderte Vorlage konnte nicht gefunden werden. Bitte überprüfen Sie die Vorlagen-ID.",
    retry: "Erneut versuchen",
  },

  // Header
  header: {
    title: "Templatical",
    unsaved: "Nicht gespeichert",
    saving: "Speichern...",
    saved: "Gespeichert",
    saveFailed: "Speichern fehlgeschlagen",
    save: "Speichern",
    templatesUsed: "{used}/{max} Vorlagen verwendet",
  },

  // Footer (OSS only)
  footer: {
    poweredBy: "Erstellt mit",
    openSource: "Open Source",
  },

  // Snapshot preview banner
  snapshotPreview: {
    message: "Sie sehen einen früheren Snapshot dieser Vorlage.",
    cancel: "Abbrechen",
    restore: "Diesen Snapshot wiederherstellen",
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
  },

  // Block actions (BlockWrapper)
  blockActions: {
    drag: "Zum Sortieren ziehen",
    duplicate: "Block duplizieren",
    delete: "Block löschen",
    hiddenOnViewport: "Ausgeblendet auf {viewport}",
    saveAsModule: "Als Modul speichern",
    conditionToggle: "Anzeigebedingung umschalten",
    comments: "Kommentare ({count})",
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
      "Da die Bild-URL einen Platzhalter verwendet, können Sie hier ein echtes Bild angeben, um das Layout während der Gestaltung in der Vorschau anzuzeigen. Dies wird nicht in die endgültige Ausgabe aufgenommen.",
    clickToAdd: "Klicken Sie, um eine Bild-URL hinzuzufügen",
    browseMedia: "Medien durchsuchen",
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
      "Da die Video-URL einen Platzhalter verwendet, können Sie hier ein echtes Thumbnail angeben, um das Layout während der Gestaltung in der Vorschau anzuzeigen. Dies wird nicht in die endgültige Ausgabe aufgenommen.",
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
      "Dieser Text erscheint nach der Betreffzeile in der E-Mail-Vorschau. Unterstützt Platzhalter.",
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
  },

  // Snapshot history (cloud)
  snapshotHistory: {
    tooltip: "Versionsverlauf",
    dropdownTitle: "Versionsverlauf",
    noSnapshots: "Noch keine Versionen",
    auto: "auto",
    justNow: "Gerade eben",
    minutesAgo: "vor {minutes} Min.",
    hoursAgo: "vor {hours} Std.",
    daysAgo: "vor {days} Tagen",
    olderSnapshot: "Ältere Version",
    newerSnapshot: "Neuere Version",
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

  // Test Email (cloud)
  testEmail: {
    title: "Test-E-Mail senden",
    recipientLabel: "Empfänger",
    send: "Senden",
    sending: "Wird gesendet...",
    cancel: "Abbrechen",
    success: "Test-E-Mail erfolgreich gesendet",
    button: "Test",
  },

  // AI Rewrite (cloud)
  aiRewrite: {
    title: "KI-Umschreibung",
    tone: "Tonalität",
    length: "Länge",
    clarity: "Klarheit",
    professional: "Professionell",
    casual: "Locker",
    friendly: "Freundlich",
    urgent: "Dringend",
    persuasive: "Überzeugend",
    shorter: "Kürzer",
    longer: "Länger",
    summarize: "Zusammenfassen",
    simplify: "Vereinfachen",
    fixGrammar: "Grammatik korrigieren",
    improveReadability: "Lesbarkeit verbessern",
    customInstruction: "Eigene Anweisung",
    customPlaceholder: "Beschreiben Sie die gewünschte Umschreibung...",
    rewrite: "Umschreiben",
    rewriting: "Wird umgeschrieben...",
    undo: "Rückgängig",
    redo: "Wiederholen",
    refine: "Weiter verfeinern",
    error: "Text konnte nicht umgeschrieben werden",
  },

  // AI Chat (cloud)
  aiChat: {
    title: "KI-Assistent",
    button: "KI",
    inputPlaceholder: "Beschreiben Sie Ihre E-Mail-Vorlage...",
    send: "Senden",
    generating: "Wird generiert...",
    applied: "Änderungen auf Vorlage angewendet.",
    applyFailed:
      "Änderungen konnten nicht auf die Vorlage angewendet werden. Bitte versuchen Sie es erneut.",
    revert: "Änderungen rückgängig",
    reapply: "Änderungen erneut anwenden",
    error: "Vorlage konnte nicht generiert werden",
    clear: "Chat leeren",
    placeholder:
      "Beschreiben Sie die E-Mail-Vorlage, die Sie erstellen möchten, oder bitten Sie um Änderungen an der aktuellen.",
    loadingHistory: "Konversation wird geladen...",
  },

  // Template Scoring (cloud)
  scoring: {
    button: "Bewertung",
    title: "Vorlagenbewertung",
    rescore: "Neu bewerten",
    scoring: "Vorlage wird analysiert...",
    overallScore: "Gesamtbewertung",
    categories: {
      spam: "Spam-Risiko",
      readability: "Lesbarkeit",
      accessibility: "Barrierefreiheit",
      bestPractices: "Best Practices",
    },
    severity: {
      high: "Hoch",
      medium: "Mittel",
      low: "Niedrig",
    },
    fix: "Mit KI beheben",
    fixing: "Wird behoben...",
    fixed: "Behoben",
    findings: "Ergebnisse",
    noFindings: "Keine Probleme gefunden",
    error: "Vorlage konnte nicht analysiert werden",
    fixError: "Korrektur konnte nicht angewendet werden",
    emptyState:
      "Bewerten Sie Ihre Vorlage, um umsetzbare Rückmeldungen zu Spam-Risiko, Lesbarkeit, Barrierefreiheit und Best Practices zu erhalten.",
  },

  // AI Feature Menu (cloud)
  aiMenu: {
    aiAssistant: "KI-Assistent",
    aiAssistantDesc:
      "Mit KI chatten, um Ihre Vorlage zu erstellen oder zu ändern",
    designToTemplate: "Design zu Vorlage",
    designToTemplateDesc: "Vorlage aus einem Bild oder PDF generieren",
    templateScore: "Vorlagenbewertung",
    templateScoreDesc: "Qualität, Spam-Risiko und Barrierefreiheit analysieren",
    disclaimer:
      "KI kann Fehler machen. Bitte überprüfen Sie die Ergebnisse vor der Genehmigung.",
  },

  // Kommentare (cloud)
  comments: {
    title: "Kommentare",
    placeholder: "Kommentar schreiben...",
    replyPlaceholder: "Antwort schreiben...",
    reply: "Antworten",
    resolve: "Lösen",
    unresolve: "Wiedereröffnen",
    resolved: "Gelöst",
    delete: "Löschen",
    edit: "Bearbeiten",
    cancel: "Abbrechen",
    save: "Speichern",
    noComments: "Noch keine Kommentare",
    noCommentsHint:
      "Starten Sie eine Konversation, indem Sie einen Kommentar zur Vorlage oder einem bestimmten Block hinzufügen.",
    addComment: "Kommentar hinzufügen",
    deleteConfirm: "Diesen Kommentar löschen?",
    filterAll: "Alle",
    filterUnresolved: "Ungelöst",
    filterBlock: "Dieser Block",
    ownedByYou: "Sie",
    edited: "bearbeitet",
    resolvedBy: "Gelöst von {name}",
    replyOne: "{count} Antwort",
    replyMany: "{count} Antworten",
    missingBlock: "Fehlender Block",
    saveTemplateFirst:
      "Speichern Sie die Vorlage, bevor Sie diesen Block kommentieren.",
    button: "Kommentare",
  },

  // Zusammenarbeit (cloud)
  collaboration: {
    connected: "Zusammenarbeit aktiv",
    disconnected: "Zusammenarbeit getrennt",
    reconnecting: "Verbindung wird wiederhergestellt...",
    blockLockedBy: "Wird bearbeitet von {name}",
    usersOnline: "{count} Benutzer online",
  },

  // Seitenleiste
  sidebarNav: {
    browseModules: "Gespeicherte Module durchsuchen",
    expandSidebar: "Block-Seitenleiste erweitern",
  },

  // Gespeicherte Module (cloud)
  modules: {
    title: "Gespeicherte Module",
    saveAsModule: "Als Modul speichern",
    moduleName: "Modulname",
    moduleNamePlaceholder: "z.B. Header, Footer, CTA...",
    selectBlocks: "Blöcke auswählen",
    save: "Modul speichern",
    saving: "Wird gespeichert...",
    cancel: "Abbrechen",
    noModules: "Noch keine gespeicherten Module",
    noModulesHint:
      "Speichern Sie Blöcke aus Ihren Vorlagen, um sie später wiederzuverwenden.",
    search: "Module suchen...",
    insert: "Einfügen",
    delete: "Löschen",
    deleteConfirm: "Dieses Modul löschen?",
    blockCount: "{count} Block/Blöcke",
    browse: "Module durchsuchen",
    selectToPreview: "Modul auswählen für Vorschau",
    insertAtBeginning: "Am Anfang",
    insertAfterBlock: "Nach {block}",
    insertAtEnd: "Am Ende",
    insertPosition: "Einfügeposition",
    close: "Schließen",
  },

  // Design Reference (cloud)
  designReference: {
    title: "Designvorlage",
    button: "Design",
    uploadImage: "Bild",
    uploadPdf: "PDF",
    dropHint: "Datei hierher ziehen oder klicken zum Durchsuchen",
    acceptedImages: "PNG, JPG, WebP (max. 10 MB)",
    acceptedPdf: "PDF (max. 10 MB)",
    promptLabel: "Anweisungen (optional)",
    promptPlaceholder:
      "Beschreiben Sie Anpassungen oder Wünsche für die generierte Vorlage...",
    generate: "Aus Design generieren",
    generating: "Design wird analysiert und Vorlage generiert...",
    replaceWarning:
      "Die Generierung aus einer Designvorlage ersetzt den vorhandenen Vorlageninhalt.",
    replaceConfirm: "Ersetzen und generieren",
    replaceCancel: "Abbrechen",
    error: "Vorlage konnte nicht aus Design generiert werden",
    fileTooLarge: "Datei ist zu groß. Maximale Größe ist 10 MB.",
    invalidFileType:
      "Dieser Dateityp wird nicht unterstützt. Laden Sie eine PNG-, JPG-, WebP- oder PDF-Datei hoch.",
  },
  errors: {
    editorLoading: "Editor wird geladen...",
    editorLoadFailed: "Editor konnte nicht geladen werden.",
    retry: "Erneut versuchen",
  },
} as const;
