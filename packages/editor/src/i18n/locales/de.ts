import type en from "./en";

const de: typeof en = {
  // Footer (OSS only)
  footer: {
    poweredBy: "Erstellt mit",
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
    hero: "Hero",
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

  // Placeholder text a newly inserted block starts with. Author-facing
  // prompts, meant to be overwritten — so they follow the editor UI locale.
  // Recipient-facing defaults live in `i18n/contentDefaults.ts` and follow
  // the template's own `settings.locale` instead.
  blockDefaults: {
    title: "Geben Sie Ihren Titel ein",
    paragraph: "Geben Sie hier Ihren Text ein",
    button: "Hier klicken",
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
    lineHeightShort: "ZH",
    letterSpacingShort: "ZA",
    letterSpacingNormal: "Normal",
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
    wrapperLayoutConflict:
      "Dieser Editor rahmt die E-Mail bereits ein. Ein zusätzlicher Rahmen für diesen Abschnitt wird nicht unterstützt — Vorschau und Export schlagen fehl.",
    stackOnMobile: "Auf Mobilgeräten stapeln",
    heroNeedsOneColumn:
      "Der Hero-Modus braucht eine Spalte. Mit mehr Spalten wird dieser Abschnitt als normaler Abschnitt angezeigt.",
    heroAddImage: "Hintergrundbild hinzufügen",
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
    lockAspectRatio: "Seitenverhältnis des Bildes beibehalten",
    unlockAspectRatio: "Breite und Höhe getrennt festlegen",
    heightCapped: "Auf die Spaltenbreite begrenzt, {height}px hoch",
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
    widthCustom: "Benutzerdefiniert",
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
    stylePlain: "Schlicht",
    color: "Farbe",
    colorBrand: "Markenfarben",
    colorDark: "Dunkel",
    colorLight: "Hell",
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

  // Toolbar - Paragraph
  paragraph: {
    paragraphSpacing: "Absatzabstand",
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
    borderWidth: "Rahmenbreite",
    borderStyle: "Rahmenstil",
    borderColor: "Rahmenfarbe",
    border: "Rahmen",
    borderSide: "Seite",
    linkSides: "Gleicher Rahmen auf allen Seiten",
    unlinkSides: "Jede Seite einzeln festlegen",
    linkCorners: "Gleicher Radius an allen Ecken",
    unlinkCorners: "Jede Ecke einzeln festlegen",
    cornerTopLeft: "Oben links",
    cornerTopRight: "Oben rechts",
    cornerBottomRight: "Unten rechts",
    cornerBottomLeft: "Unten links",
    color: "Farbe",
    backgroundImage: "Bild",
    backgroundImagePlaceholder: "https://example.com/background.jpg",
    backgroundSize: "Größe",
    backgroundSizeCover: "Füllen",
    backgroundSizeContain: "Einpassen",
    backgroundSizeAuto: "Original",
    backgroundPosition: "Position",
    backgroundPositionTopLeft: "Oben links",
    backgroundPositionTopCenter: "Oben mittig",
    backgroundPositionTopRight: "Oben rechts",
    backgroundPositionCenterLeft: "Mitte links",
    backgroundPositionCenter: "Mitte",
    backgroundPositionCenterRight: "Mitte rechts",
    backgroundPositionBottomLeft: "Unten links",
    backgroundPositionBottomCenter: "Unten mittig",
    backgroundPositionBottomRight: "Unten rechts",
    backgroundRepeat: "Bild wiederholen",
    heroHeight: "Höhe",
    heroHeightFit: "Wie Inhalt",
    heroHeightImage: "Wie Bild",
    heroHeightFixed: "Fest",
    heroAlign: "Position des Inhalts",
    heroAlignTop: "Oben",
    heroAlignMiddle: "Mitte",
    heroAlignBottom: "Unten",
    heroMatchImageMergeTag:
      "„Wie Bild“ braucht eine direkte Bild-URL: Bei einem Merge-Tag lässt sich keine Größe auslesen.",
    heroSizeUnknown:
      "Die Größe dieses Bilds ist noch nicht bekannt, daher wird der Abschnitt in der Höhe seines Inhalts angezeigt.",
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
    contentDirection: "Rechts-nach-links",
    contentDirectionHint:
      "Schreibrichtung der E-Mail, unabhängig von der Sprache des Editors. Ungesetzt folgt sie der Inhaltssprache (Arabisch, Hebräisch, …).",
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
    transparent: "Transparent",
    presetColors: "Vordefinierte Farben",
  },

  // Merge-Tag
  mergeTag: {
    editAsText: "Als Text bearbeiten",
    fieldGroup: "Wert mit Merge-Tags",
    remove: "Merge-Tag entfernen",
    insert: "Merge-Tag einfügen",
    insertShort: "Merge-Tag",
    editValue: "Merge-Tag-Wert bearbeiten",
    changeTag: "Merge-Tag ändern: {label}",
    unknownLabel: "Merge-Tag",
    deleteMergeTag: "Merge-Tag löschen",
    suggestionEmpty: "Keine passenden Merge-Tags",
    picker: {
      title: "Merge-Tag einfügen",
      changeTitle: "Merge-Tag ändern",
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
    deleteConfirmShort: "Löschen?",
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
    close: "Schließen",
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
  collaboration: {
    people: "Personen, die diese Vorlage bearbeiten",
    guest: "Gast",
    connected: "Live",
    reconnecting: "Verbindung wird wiederhergestellt…",
    offline: "Offline",
    editing: "{name} bearbeitet",
    selectionRefused: "{name} bearbeitet diesen Block.",
    editRefused:
      "Ihre Änderung wurde nicht gespeichert: Jemand anderes hat diesen Teil zuerst geändert.",
    editRefusedLocked:
      "Ihre Änderung wurde nicht gespeichert: {name} bearbeitet diesen Block.",
    editTooLarge: "Ihre Änderung wurde nicht gespeichert: Sie ist zu groß.",
    undoSkipped:
      "Dieser Schritt lässt sich nicht rückgängig machen: Jemand anderes hat ihn inzwischen geändert.",
    replaceRefused:
      "Die Vorlage kann nicht ersetzt werden, während andere sie bearbeiten: {names}.",
    reconnectingNotice:
      "Verbindung wird wiederhergestellt… Sie können weiter bearbeiten.",
    dismiss: "Ausblenden",
    anAgent: "Ein Agent",
    agentFor: "{client} für {name}",
    aiFor: "KI (für {name})",
    agentChangedBlock: "{who} hat einen Block geändert.",
    agentChangedBlocks: "{who} hat {count} Blöcke geändert.",
    agentChangedSettings: "{who} hat die Vorlageneinstellungen geändert.",
    agentChangedBlockAndSettings:
      "{who} hat einen Block und die Vorlageneinstellungen geändert.",
    agentChangedBlocksAndSettings:
      "{who} hat {count} Blöcke und die Vorlageneinstellungen geändert.",
    agentUpdatedTemplate: "{who} hat die Vorlage aktualisiert.",
  },
  ai: {
    altText: {
      stale: "Das Bild hat sich geändert. Schreiben Sie den Alt-Text erneut.",
      bulk: "Fehlende Alt-Texte schreiben ({count})",
      review: "Alt-Texte prüfen",
      applyAccepted: "Ausgewählte übernehmen ({count})",
      progress: "Alt-Texte werden geschrieben… {done} von {total}",
      button: "Alt-Text schreiben",
      drafting: "Alt-Text wird geschrieben…",
      title: "Alt-Text",
      accept: "Übernehmen",
      decorative: "Als dekorativ markieren",
      cancel: "Abbrechen",
      note: "Von KI entworfen. Prüfen Sie, ob er den Zweck des Bildes beschreibt.",
      failed:
        "Für dieses Bild konnte kein Alt-Text geschrieben werden. Bitte schreiben Sie ihn selbst.",
    },
    fix: {
      button: "Mit KI beheben",
      fixing: "Wird behoben…",
      stillFlagged: "Nach der Korrektur weiterhin markiert",
    },
    starters: {
      emptyWelcome: "Willkommens-E-Mail für neue Kunden entwerfen",
      emptyLaunch: "Ankündigung für einen Produktstart erstellen",
      emptyNewsletter: "Layout für einen monatlichen Newsletter aufbauen",
      filledShorten: "Den Text kürzen",
      filledFriendlier: "Den Ton freundlicher machen",
      filledDates: "Daten und Angebot aktualisieren",
      filledCta: "Einen klaren Call-to-Action ergänzen",
    },
    rewrite: {
      tooLarge:
        "Dieser Absatz ist zu lang für KI. Wählen Sie einen Absatz mit höchstens 20.000 Zeichen.",
      title: "Mit KI umformulieren",
      close: "Schließen",
      suggestionLabel: "KI-Vorschlag",
      presets: {
        shorten: "Kürzen",
        expand: "Erweitern",
        friendlier: "Freundlicher",
        formal: "Förmlicher",
        fixGrammar: "Grammatik korrigieren",
        translate: "Übersetzen",
      },
      language: "Sprache",
      instructionLabel: "Ihre Anweisung",
      instructionPlaceholder: "Oder sagen Sie, wie umformuliert werden soll…",
      run: "Umformulieren",
      rewriting: "Wird umformuliert…",
      stop: "Stoppen",
      replaceAction: "Ersetzen",
      discard: "Verwerfen",
    },
    errors: {
      historyError:
        "Die Unterhaltung konnte nicht geladen werden. Versuchen Sie es erneut.",
      missingProvider:
        "Dieses KI-Backend benötigt einen Vorlagen- oder Kollaborationsanbieter, um seine Änderungen anzuzeigen.",
      featureUnavailable: "Diese KI-Funktion ist nicht verfügbar.",
      limitReached: "Ihr KI-Kontingent ist vorerst aufgebraucht.",
      limitReachedUntil: "Ihr KI-Kontingent ist bis {date} aufgebraucht.",
      rateLimited: "Zu viele KI-Anfragen. Versuchen Sie es gleich noch einmal.",
      turnRunning: "Für diese Vorlage läuft bereits eine KI-Anfrage.",
      contentTooLarge: "Diese Vorlage ist zu groß für die KI.",
      outputInvalid:
        "Die KI konnte kein gültiges Ergebnis liefern. Versuchen Sie es noch einmal.",
      providerError:
        "Die KI ist gerade nicht erreichbar. Versuchen Sie es später noch einmal.",
      templateChanged:
        "Die Vorlage hat sich geändert, während die KI gearbeitet hat.",
      blockLocked: "Jemand bearbeitet einen Block, den die KI brauchte.",
      undoRefused:
        "Jemand hat diese Blöcke inzwischen geändert, deshalb lässt sich das nicht rückgängig machen.",
      redoRefused:
        "Jemand hat diese Blöcke inzwischen geändert, deshalb lässt sich das nicht wiederholen.",
      messageGone: "Diese Nachricht ist nicht mehr im Verlauf.",
      generic: "Etwas ist schiefgelaufen. Versuchen Sie es noch einmal.",
    },
    menu: {
      button: "KI",
      chat: "KI-Assistent",
    },
    chat: {
      keptYourVersion:
        "Sie haben bearbeitet, während die KI gearbeitet hat. Daher behält dieser Editor Ihre Version. Die Änderungen der KI sind auf dem Server gespeichert; laden Sie neu, um sie zu sehen. Wenn Sie Ihre Version speichern, werden sie ersetzt.",
      reload: "Neu laden",
      attach: "Dateien anhängen",
      dropHint: "Bilder oder PDFs zum Anhängen hier ablegen",
      removeAttachment: "{name} entfernen",
      attachTooMany: "Hängen Sie höchstens 4 Dateien an.",
      attachTooLarge: "{name} ist größer als 5 MB.",
      attachTotalTooLarge: "Anhänge dürfen zusammen höchstens 10 MB groß sein.",
      attachWrongType: "{name} ist weder ein Bild noch ein PDF.",
      title: "KI-Assistent",
      notice: "Antworten und Änderungen stammen von einer KI.",
      close: "Schließen",
      newChat: "Neuer Chat",
      inputPlaceholder: "Beschreiben Sie die gewünschte Änderung...",
      send: "Senden",
      stop: "Stoppen",
      placeholder:
        "Beschreiben Sie die gewünschte E-Mail oder bitten Sie um eine Änderung an dieser.",
      loadingHistory: "Verlauf wird geladen...",
      appliedChange: "1 Änderung angewendet",
      appliedChanges: "{count} Änderungen angewendet",
      undone: "Rückgängig gemacht",
      undo: "Rückgängig",
      redo: "Wiederholen",
      disclaimer: "Die KI kann Fehler machen. Prüfen Sie die Änderungen.",
    },
    import: {
      menu: "Aus Screenshot oder PDF importieren",
      prompt: "Diese E-Mail aus dem angehängten Design aufbauen",
      placeholderNote:
        "Bilder werden als Platzhalter übernommen. Ersetzen Sie sie nach dem Import.",
    },
    canvas: {
      importHint: "Haben Sie bereits ein Design?",
      chatHint: "oder lassen Sie die Funktion",
      chatHintSuffix: "einen Entwurf aus Ihrer Beschreibung erstellen",
    },
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
    emailSize: "E-Mail-Größe",
    sizeExplainer: "Gmail schneidet E-Mails über etwa 102 KB ab.",
    checkSize: "Größe prüfen",
    checkingSize: "Prüfung läuft…",
    checkSizeAgain: "Erneut prüfen",
    sizeResult: "{size} KB",
    sizePass: "{size} KB · Gmail zeigt die ganze E-Mail an.",
    sizeOutdated: "Der Inhalt wurde seit der Prüfung geändert.",
    sizeError: "Größe konnte nicht geprüft werden: {error}",
    learnMore: "Mehr erfahren",
    issueCountTooltip: "{count} Problem(e)",
  },

  smallScreen: {
    title: "Größerer Bildschirm erforderlich",
    message:
      "Der Editor benötigt mehr Platz, als dieser Bildschirm bietet. Öffnen Sie ihn auf einem Tablet oder Desktop, um mit der Bearbeitung zu beginnen.",
  },
};

export default de;
