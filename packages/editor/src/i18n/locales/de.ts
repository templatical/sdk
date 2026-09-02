import type en from "./en";

const de: typeof en = {
  // Footer (OSS only)
  footer: {
    poweredBy: "Erstellt mit",
    openSource: "Open Source",
  },

  // Header — Vorlagenname + Speicherstatus. Nur sichtbar, wenn ein
  // Vorlagen-Provider konfiguriert ist.
  header: {
    save: "Speichern",
    saving: "Speichern...",
    saved: "Gespeichert",
    unsaved: "Nicht gespeichert",
    saveFailed: "Speichern fehlgeschlagen",
    saveNoTemplate: "Laden oder erstellen Sie zuerst eine Vorlage",
    templateName: "Vorlagenname",
    rename: "Vorlage umbenennen",
    untitled: "Unbenannt",
    updatedAt: "Aktualisiert {time}",
    createdAt: "Erstellt {time}",
    updatedJustNow: "Gerade eben aktualisiert",
    createdJustNow: "Gerade eben erstellt",
  },

  // Relative timestamps, shared by every surface that shows one: the header's
  // updated line, saved blocks, comments and version history.
  time: {
    justNow: "Gerade eben",
    minutesAgo: "vor {minutes} Min.",
    hoursAgo: "vor {hours} Std.",
    daysAgo: "vor {days} Tagen",
  },

  // History (undo/redo)
  history: {
    collabWarning:
      "Rückgängig machen kann die Änderungen anderer Mitarbeiter beeinflussen",
    undo: "Rückgängig",
    redo: "Wiederholen",
  },

  // Viewport toggle
  viewport: {
    label: "Ansichtsgröße",
    desktop: "Desktop",
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
    alignJustify: "Blocksatz",
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
  },

  // Block actions (BlockWrapper)
  blockActions: {
    drag: "Zum Sortieren ziehen oder Leertaste drücken, um mit der Tastatur zu verschieben",
    dragLifted:
      "{block} wird verschoben. Pfeiltasten zum Positionieren, Leer- oder Eingabetaste zum Ablegen, Esc zum Abbrechen.",
    duplicate: "Block duplizieren",
    delete: "Block löschen",
    hiddenOnViewport: "Ausgeblendet auf {viewport}",
    saveAsBlock: "Als Block speichern",
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
    borderRadius: "Eckenradius",
    wrapperEnable: "Wrapper hinzufügen",
    stackOnMobile: "Auf Mobilgeräten stapeln",
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
    colorLabel: "Linkfarbe",
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
    widthCustom: "Benutzerdefiniert",
    height: "Höhe",
    heightAuto: "Automatisch",
    heightCustom: "Benutzerdefiniert",
    borderRadius: "Eckenradius",
    linkUrl: "Link-URL",
    openInNewTab: "In neuem Tab öffnen",
    placeholderUrl: "Platzhalterbild",
    optional: "(optional)",
    placeholderUrlPlaceholder: "https://... (nur zur Gestaltung)",
    placeholderUrlTooltip:
      "Da die Bild-URL ein Merge-Tag verwendet, können Sie hier ein echtes Bild angeben, um das Layout während der Gestaltung in der Vorschau anzuzeigen. Dies wird nicht in die endgültige Ausgabe aufgenommen.",
    clickToAdd: "Klicken Sie, um eine Bild-URL hinzuzufügen",
    browseMedia: "Medien durchsuchen",
    dropToUpload: "Bild zum Hochladen ablegen",
    uploading: "Wird hochgeladen…",
    decorative: "Dekoratives Bild",
    decorativeHint:
      "Wird von Bildschirmlesern ignoriert. Nur für Abstandshalter und visuelle Verzierungen verwenden.",
  },

  // Toolbar - Video
  video: {
    videoUrl: "Video-URL",
    videoUrlPlaceholder: "https://youtube.com/...",
    openInNewTab: "In neuem Tab öffnen",
    customThumbnail: "Eigenes Vorschaubild",
    optional: "(optional)",
    thumbnailPlaceholder: "Automatisch aus Video-URL generiert",
    altText: "Alternativtext",
    altTextPlaceholder: "Videobeschreibung",
    width: "Breite",
    fullWidth: "Volle Breite",
    height: "Höhe",
    heightAuto: "Automatisch",
    heightCustom: "Benutzerdefiniert",
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
    width: "Breite",
    widthAuto: "An Inhalt anpassen",
    fullWidth: "Volle Breite",
    widthCustom: "Benutzerdefiniert",
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
      website: "Website",
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
      "HTML wird unverändert exportiert und nicht bereinigt – stellen Sie sicher, dass der Inhalt sicher ist.",
  },

  // Toolbar - Common block settings
  blockSettings: {
    spacing: "Abstände",
    padding: "Innenabstand",
    background: "Hintergrund",
    color: "Farbe",
    display: "Anzeige",
    showOnDesktop: "Auf Desktop anzeigen",
    showOnMobile: "Auf Mobilgerät anzeigen",
    hiddenOnDevice: "Ausgeblendet auf {device}",
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
    textColor: "Textfarbe",
    linkColor: "Linkfarbe",
    linkUnderline: "Links unterstreichen",
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
    notSet: "Nicht festgelegt",
    clear: "Farbe entfernen",
    presetColors: "Vordefinierte Farben",
  },

  // Merge-Tag
  mergeTag: {
    clickToEdit: "Zum Bearbeiten klicken",
    remove: "Merge-Tag entfernen",
    insert: "Merge-Tag einfügen",
    insertShort: "Merge-Tag",
    editValue: "Merge-Tag-Wert bearbeiten",
    deleteMergeTag: "Merge-Tag löschen",
    suggestionEmpty: "Keine passenden Merge-Tags",
    picker: {
      title: "Merge-Tag einfügen",
      searchPlaceholder: "Merge-Tags suchen",
      searchAriaLabel: "Merge-Tags suchen",
      noResults: "Keine passenden Merge-Tags",
      empty: "Keine Merge-Tags konfiguriert",
      otherGroup: "Sonstige",
      close: "Schließen",
      groupCount: "{count}",
      sample: "Vorschau: {sample}",
    },
  },

  // Logic tags (standalone, separate from merge tags)
  logicTag: {
    insert: "Logik einfügen",
    insertShort: "Logik",
    picker: {
      title: "Logik einfügen",
      searchPlaceholder: "Logik-Tags suchen",
      searchAriaLabel: "Logik-Tags suchen",
      noResults: "Keine passenden Logik-Tags",
      empty: "Keine Logik-Tags konfiguriert",
      otherGroup: "Sonstige",
      close: "Schließen",
    },
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

  // Seitenleiste
  savedBlocks: {
    title: "Gespeicherte Blöcke",
    saveAsBlock: "Als Block speichern",
    name: "Name",
    namePlaceholder: "z.B. Header, Footer, CTA...",
    save: "Block speichern",
    saving: "Wird gespeichert...",
    cancel: "Abbrechen",
    empty: "Noch keine gespeicherten Blöcke",
    emptyHint:
      "Speichern Sie Blöcke aus Ihren Vorlagen, um sie später wiederzuverwenden.",
    noResults: "Keine gespeicherten Blöcke gefunden",
    search: "Gespeicherte Blöcke suchen...",
    loading: "Gespeicherte Blöcke werden geladen…",
    category: "Kategorie",
    categoryPlaceholder: "z. B. Kopfzeilen, Aktionen... (optional)",
    allCategories: "Alle Kategorien",
    filterByCategory: "Nach Kategorie filtern",
    insert: "Einfügen",
    rename: "Umbenennen",
    delete: "Löschen",
    deleteConfirm: "Diesen gespeicherten Block löschen?",
    blockCount: "{count} Block/Blöcke",
    browse: "Gespeicherte Blöcke durchsuchen",
    selectToPreview: "Gespeicherten Block für Vorschau auswählen",
    insertAtBeginning: "Am Anfang",
    insertAfterBlock: "Nach {block}",
    insertAtEnd: "Am Ende",
    insertPosition: "Einfügeposition",
    close: "Schließen",
    pickToolbar: "Auswahl für gespeicherten Block",
    pickCount: "{count} Block/Blöcke ausgewählt",
    pickHint: "Blöcke anklicken, um sie hinzuzufügen oder zu entfernen",
    savingCount: "{count} Block/Blöcke werden gespeichert:",
    reorderHint:
      "Zum Umsortieren ziehen — in dieser Reihenfolge werden die Blöcke gespeichert",
    reorderHandle: "{block} umsortieren, Position {position} von {total}",
    reorderAnnouncement:
      "{block} an Position {position} von {total} verschoben",
    expand: "Aufklappen",
    collapse: "Zuklappen",
    expandPreview: "Vorschau von {block} aufklappen",
    collapsePreview: "Vorschau von {block} zuklappen",
  },
  comments: {
    button: "Kommentare",
    title: "Kommentare",
    placeholder: "Kommentar schreiben...",
    replyPlaceholder: "Antwort schreiben...",
    reply: "Antworten",
    resolve: "Lösen",
    unresolve: "Wiedereröffnen",
    delete: "Löschen",
    edit: "Bearbeiten",
    cancel: "Abbrechen",
    save: "Speichern",
    noComments: "Noch keine Kommentare",
    noCommentsHint:
      "Starten Sie eine Konversation, indem Sie einen Kommentar zur Vorlage oder einem bestimmten Block hinzufügen.",
    deleteConfirm: "Diesen Kommentar löschen?",
    filterAll: "Alle",
    filterUnresolved: "Ungelöst",
    filterBlock: "Dieser Block",
    jumpToBlock: "Block",
    ownedByYou: "Sie",
    edited: "bearbeitet",
    resolvedBy: "Gelöst von {name}",
    replyOne: "{count} Antwort",
    replyMany: "{count} Antworten",
    missingBlock: "Fehlender Block",
    saveTemplateFirst:
      "Speichern Sie die Vorlage, bevor Sie diesen Block kommentieren.",
  },
  versionHistory: {
    tooltip: "Versionsverlauf",
    dropdownTitle: "Versionsverlauf",
    empty: "Noch keine Versionen",
    auto: "auto",
    olderVersion: "Ältere Version",
    newerVersion: "Neuere Version",
  },
  versionPreview: {
    message: "Sie sehen eine frühere Version dieser Vorlage.",
    cancel: "Abbrechen",
    restore: "Diese Version wiederherstellen",
    restoreConfirm: {
      title: "Diese Version wiederherstellen?",
      unsavedWithSave:
        "Sie haben ungespeicherte Änderungen. Speichern Sie sie zuerst, dann bleiben sie in Ihrem Verlauf — stellen Sie ohne Speichern wieder her, gehen sie verloren.",
      unsavedNoSave:
        "Sie haben ungespeicherte Änderungen und keinen Ort, um sie zu speichern. Beim Wiederherstellen dieser Version gehen sie verloren.",
      saveAndRestore: "Speichern und wiederherstellen",
      restoreAnyway: "Trotzdem wiederherstellen",
      cancel: "Abbrechen",
    },
  },
  previewResolution: {
    resolving: "Vorschau wird aufgelöst…",
    failed:
      "Die Vorschau konnte nicht aufgelöst werden — die unaufgelöste Vorlage wird angezeigt.",
    hint: "Die Vorschau verwendet aufgelöste Daten aus Ihrem Backend.",
  },
  mergeTagPreview: {
    label: "Merge-Tag-Ansicht",
    sample: "Beispiel",
    labelView: "Bezeichnung",
  },
  testEmail: {
    title: "Test-E-Mail senden",
    recipientLabel: "Empfänger",
    recipientPlaceholder: "sie@beispiel.de",
    invalidAddress: "Geben Sie eine gültige E-Mail-Adresse ein.",
    preview: "Vorschau",
    previewHint:
      "Merge-Tags werden unaufgelöst angezeigt — Ihr Backend setzt sie ein.",
    previewHintSample:
      "Merge-Tags zeigen Beispielwerte — Ihr Backend setzt die echten Daten ein.",
    recipientNotAllowed:
      "Diese Adresse steht nicht auf der Liste der erlaubten Empfänger.",
    send: "Senden",
    sending: "Wird gesendet...",
    cancel: "Abbrechen",
    success: "Test-E-Mail erfolgreich gesendet",
    button: "Test",
  },
  sidebarNav: {
    browseSavedBlocks: "Gespeicherte Blöcke durchsuchen",
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

  issues: {
    panelTitle: "Probleme",
    panelTabLabel: "Probleme",
    groupErrors: "Fehler",
    groupWarnings: "Warnungen",
    groupInfo: "Hinweise",
    jump: "Zum Block springen",
    fix: "Beheben",
    emptyState: "Keine Probleme — sieht gut aus.",
    badgeError: "Hat Fehler",
    badgeWarning: "Hat Warnungen",
    issueCountTooltip: "{count} Problem(e)",
  },

  smallScreen: {
    title: "Größerer Bildschirm erforderlich",
    message:
      "Der Editor benötigt mehr Platz, als dieser Bildschirm bietet. Öffnen Sie ihn auf einem Tablet oder Desktop, um mit der Bearbeitung zu beginnen.",
  },
};

export default de;
