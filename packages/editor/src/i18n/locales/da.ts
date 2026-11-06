import type en from "./en";

const da: typeof en = {
  localization: {
    tagsDiffer: "Flettefelterne er forskellige",
    tagsDifferExplanation:
      "Flettefelterne passer ikke til teksten på {default}.",
    changed: "Ændret på {language}",
    notTranslatedCount: {
      one: "{count} ikke oversat",
      other: "{count} ikke oversat",
    },
    missingExplanation:
      "Ikke oversat endnu. Mailen viser teksten på {default}.",
    staleExplanation: "{default} er ændret, siden dette blev oversat.",
    currentExcerpt: "Nu: “{excerpt}”",
    useDefaultLanguage: "Brug {default}",
    changedProperties: {
      one: "{count} egenskab afviger fra {default}.",
      other: "{count} egenskaber afviger fra {default}.",
    },
    resetChanges: "Nulstil ændringer",
    staleLanguages: {
      one: "Forældet på {count} sprog",
      other: "Forældet på {count} sprog",
    },
    open: "Åbn",
    resetToDefault: "Nulstil til {default}",
    hiddenExplanation: "Denne blok er ikke med i mailen på {language}.",
    editingLanguage: "Redigerer {language}",
    languageReadOnly: "Skrivebeskyttet: {language} er ikke slået til",
    backToDefault: "Tilbage til {default}",
    translateFields: {
      one: "Oversæt {count} felt",
      other: "Oversæt {count} felter",
    },
    translationConfirmation: {
      one: "Oversæt alle {count} felt igen?",
      other: "Oversæt alle {count} felter igen?",
    },
    translateAllFields: {
      one: "Oversæt alle {count} felt",
      other: "Oversæt alle {count} felter",
    },
    translationDescription:
      "Det erstatter de nuværende oversættelser til {language}, også manuelle rettelser. Du kan fortryde det.",
    translatedFields: {
      one: "Oversatte {count} felt.",
      other: "Oversatte {count} felter.",
    },
    translationTagsChanged: {
      one: "{count} beholdt, fordi dets felter er ændret.",
      other: "{count} beholdt, fordi deres felter er ændret.",
    },
    translationSkippedLocked: {
      one: "{count} sprunget over, fordi nogen redigerer det.",
      other: "{count} sprunget over, fordi nogen redigerer dem.",
    },
    translationMissing: {
      one: "{count} kom ikke tilbage.",
      other: "{count} kom ikke tilbage.",
    },
    translationTooLarge: {
      one: "{count} felt er for langt til at blive oversat.",
      other: "{count} felter er for lange til at blive oversat.",
    },
    translationError: "Oversættelsestjenesten svarede: {message}",
    defaultRefused: "{language} kunne ikke gøres til standardsprog: {reason}",
    defaultLockedReason: "en anden redigerer denne skabelon",
    complete: "Færdig",
    gapTooltip: "{missing} mangler, {stale} forældet",
    moreActions: "Flere handlinger for {language}",
    makeDefaultLanguage: "Gør til standardsprog",
    makeDefault: "Gør til standard",
    makeDefaultConfirmation: "Gør {language} til standardsprog?",
    removeConfirmation: "Fjern {language}?",
    removeDescription:
      "Det sletter teksten og ændringerne på {language}. Du kan fortryde det.",
    defaultChanged: "{language} er nu standardsprog.",
    missingCount: { one: "{count} mangler", other: "{count} mangler" },
    staleCount: { one: "{count} forældet", other: "{count} forældede" },
    hiddenBeforeDefault: {
      one: "Vis først den {count} blok, der er skjult på {language}",
      other: "Vis først de {count} blokke, der er skjult på {language}",
    },
    defaultNotEnabled: "Føj først {default} til de aktive sprog",
    defaultGaps: {
      one: "{count} felt har ingen tekst på {language} og beholder sin tekst på {default}. Oversæt det først. {default} beholder en kopi; senere rettelser på {language} markerer den som forældet.",
      other:
        "{count} felter har ingen tekst på {language} og beholder deres tekst på {default}. Oversæt dem først. {default} beholder en kopi; senere rettelser på {language} markerer den som forældet.",
    },
    defaultRemaining: {
      one: "{count} felt er stadig på {old}.",
      other: "{count} felter er stadig på {old}.",
    },
    translateAllAgain: "Oversæt alt igen…",
    translate: "Oversæt",
    retranslate: "Oversæt igen",
    translating: "Oversætter {done} af {total}…",
    languages: "Sprog",
    default: "Standard",
    notEnabled: "Ikke slået til",
    addLanguage: "Tilføj sprog",
    removeLanguage: "Fjern {language}",
    cancel: "Annuller",
    notTranslated: "Ikke oversat",
    outOfDate: "Forældet",
    keep: "Behold",
    hidden: "Skjult på {language}",
    show: "Vis",
    hide: "Skjul på {language}",
    dismiss: "Luk",
    structureNotice: "Ændringer i opbygningen gælder alle sprog.",
    aiActiveLanguage:
      "AI-chatten redigerer {language}. Ændringer i opbygningen gælder alle sprog.",
  },
  // Footer (OSS only)
  footer: {
    poweredBy: "Leveret af",
  },

  // Header — template name + save state. Shown only when a templates provider
  // is configured.
  header: {
    save: "Gem",
    saving: "Gemmer...",
    saved: "Gemt",
    unsaved: "Ikke gemt",
    saveFailed: "Kunne ikke gemme",
    saveNoTemplate: "Indlæs eller opret en skabelon først",
    templateName: "Skabelonens navn",
    rename: "Omdøb skabelon",
    untitled: "Uden navn",
    updatedAt: "Opdateret {time}",
    createdAt: "Oprettet {time}",
    updatedJustNow: "Opdateret lige nu",
    createdJustNow: "Oprettet lige nu",
  },

  // Relative timestamps, shared by every surface that shows one: the header's
  // updated line, saved blocks, comments and version history.
  time: {
    justNow: "Lige nu",
    minutesAgo: "for {minutes} min. siden",
    hoursAgo: "for {hours} t. siden",
    daysAgo: "for {days} d. siden",
  },

  // History (undo/redo)
  history: {
    undo: "Fortryd",
    redo: "Gentag",
  },

  // Viewport toggle
  viewport: {
    label: "Visning",
    desktop: "Computer",
    mobile: "Mobil",
  },

  // Dark mode preview
  darkMode: {
    enable: "Vis i mørk tilstand",
    disable: "Vis i lys tilstand",
  },

  // Preview mode
  previewMode: {
    enable: "Eksempelvisning",
    disable: "Luk eksempelvisning",
  },

  // Sidebar - Block types
  blocks: {
    section: "Sektion",
    hero: "Hero",
    image: "Billede",
    title: "Overskrift",
    paragraph: "Afsnit",
    button: "Knap",
    divider: "Skillelinje",
    video: "Video",
    social: "Sociale medier",
    spacer: "Mellemrum",
    html: "HTML",
    menu: "Menu",
    table: "Tabel",
    countdown: "Nedtælling",
  },

  // Placeholder text a newly inserted block starts with. Author-facing
  // prompts, meant to be overwritten — so they follow the editor UI locale.
  // Recipient-facing defaults live in `i18n/contentDefaults.ts` and follow
  // the template's own `settings.locale` instead.
  blockDefaults: {
    title: "Skriv din overskrift",
    paragraph: "Skriv din tekst her",
    button: "Klik her",
  },

  // Right sidebar
  sidebar: {
    content: "Indhold",
    settings: "Indstillinger",
    noSelection: "Intet element valgt",
    noSelectionHint: "Vælg en blok på lærredet for at redigere den",
  },

  // Toolbar - Common
  toolbar: {
    duplicate: "Duplikér",
    delete: "Slet",
  },

  // Title editor toolbar
  titleEditor: {
    toolbar: "Formatering af overskrift",
    bold: "Fed (Ctrl+B)",
    italic: "Kursiv (Ctrl+I)",
    addLink: "Tilføj link",
  },

  // Paragraph editor toolbar
  paragraphEditor: {
    toolbar: "Tekstformatering",
    bold: "Fed (Ctrl+B)",
    italic: "Kursiv (Ctrl+I)",
    underline: "Understreget (Ctrl+U)",
    strikethrough: "Gennemstreget",
    subscript: "Sænket skrift",
    superscript: "Hævet skrift",
    addLink: "Tilføj link",
    bulletList: "Punktopstilling",
    numberedList: "Nummereret liste",
    alignLeft: "Venstrejustér",
    alignCenter: "Centrér",
    alignRight: "Højrejustér",
    alignJustify: "Lige margener",
    clearFormatting: "Ryd formatering",
    insertEmoji: "Indsæt emoji",
    fontFamily: "Skrifttype",
    defaultFont: "Standard",
    fontSize: "Skriftstørrelse",
    defaultSize: "Standard",
    textColor: "Tekstfarve",
    highlightColor: "Markeringsfarve",
    lineHeight: "Linjehøjde",
    letterSpacing: "Tegnafstand",
    // Placeholders of the narrow line-height and letter-spacing selects, which
    // carry the full name as their tooltip. Keep each to about two characters.
    lineHeightShort: "LH",
    letterSpacingShort: "TA",
    letterSpacingNormal: "Normal",
    emojiItemLabel: "Indsæt emoji {emoji}",
  },

  // Block actions (BlockWrapper)
  blockActions: {
    drag: "Træk for at flytte, eller tryk på mellemrum for at flytte med tastaturet",
    dragLifted:
      "Flytter {block}. Brug pil op og pil ned til at flytte, mellemrum eller Enter for at slippe og Escape for at annullere.",
    duplicate: "Duplikér blok",
    delete: "Slet blok",
    hiddenOnViewport: "Skjult på {viewport}",
    saveAsBlock: "Gem som blok",
    conditionToggle: "Slå visningsbetingelse til/fra",
    comments: "Kommentarer ({count})",
    lifted: "{block} er løftet. Position {position} af {total}.",
    moved: "{block} er flyttet til position {position} af {total}.",
    dropped: "{block} er sluppet på position {position} af {total}.",
    cancelled:
      "Flytning annulleret. {block} er tilbage på position {position}.",
  },

  // Toolbar - Section
  section: {
    dropHere: "Slip blokke her",
    columns: "Kolonner",
    column1: "1 kolonne",
    column2: "2 kolonner",
    column3: "3 kolonner",
    column4: "4 kolonner",
    ratio12: "Forhold 1:2",
    ratio21: "Forhold 2:1",
    ratio13: "Forhold 1:3",
    ratio31: "Forhold 3:1",
    ratio121: "Forhold 1:2:1",
    borderRadius: "Hjørneradius",
    wrapperEnable: "Tilføj ramme",
    wrapperLayoutConflict:
      "Denne editor sætter allerede en ramme om mailen. En ekstra ramme om denne sektion understøttes ikke — eksempelvisning og eksport vil fejle.",
    stackOnMobile: "Stak på mobil",
    heroNeedsOneColumn:
      "Hero-tilstand kræver én kolonne. Med flere vises sektionen som en almindelig sektion.",
    heroAddImage: "Tilføj et baggrundsbillede",
  },

  // Text editor link dialog
  linkDialog: {
    editLink: "Rediger link",
    insertLink: "Indsæt link",
    updateLink: "Opdater link",
    removeLink: "Fjern link",
    cancel: "Annuller",
    urlPlaceholder: "https://example.com",
    urlLabel: "URL",
    colorLabel: "Linkfarve",
  },

  // Toolbar - Title
  title: {
    level: "Overskriftsniveau",
    heading1: "Overskrift 1 (36px)",
    heading2: "Overskrift 2 (28px)",
    heading3: "Overskrift 3 (22px)",
    heading4: "Overskrift 4 (18px)",
    fontFamily: "Skrifttype",
    inheritFont: "Brug skabelonens skrifttype",
    color: "Farve",
    align: "Justering",
    alignLeft: "Venstre",
    alignCenter: "Centreret",
    alignRight: "Højre",
  },

  // Emoji picker
  emoji: {
    smileys: "Smileys",
    gestures: "Fagter",
    objects: "Objekter",
  },

  // Toolbar - Image
  image: {
    imageUrl: "Billed-URL",
    imageUrlPlaceholder: "https://...",
    altText: "Alt-tekst",
    altTextPlaceholder: "Beskrivelse af billedet",
    width: "Bredde",
    fullWidth: "Fuld bredde",
    widthCustom: "Tilpasset",
    height: "Højde",
    heightAuto: "Auto",
    heightCustom: "Tilpasset",
    lockAspectRatio: "Bevar billedets proportioner",
    unlockAspectRatio: "Angiv bredde og højde hver for sig",
    heightCapped: "Begrænset til kolonnens bredde, {height}px høj",
    borderRadius: "Hjørneradius",
    linkUrl: "Link-URL",
    openInNewTab: "Åbn i ny fane",
    placeholderUrl: "Pladsholderbillede",
    optional: "(valgfrit)",
    placeholderUrlPlaceholder: "https://... (kun under design)",
    placeholderUrlTooltip:
      "Da billed-URL'en bruger et flettefelt, kan du angive et rigtigt billede her for at se layoutet, mens du designer. Det kommer ikke med i den færdige mail.",
    clickToAdd: "Klik for at tilføje billed-URL",
    browseMedia: "Gennemse medier",
    dropToUpload: "Slip billedet for at uploade",
    uploading: "Uploader…",
    decorative: "Dekorativt billede",
    decorativeHint:
      "Skjult for skærmlæsere. Brug det kun til afstande og visuel pynt.",
    fluidOnMobile: "Fuld bredde på mobil",
    fluidOnMobileAuto: "Automatisk",
    fluidOnMobileAlways: "Altid",
    fluidOnMobileNever: "Aldrig",
  },

  // Toolbar - Video
  video: {
    videoUrl: "Video-URL",
    videoUrlPlaceholder: "https://youtube.com/...",
    openInNewTab: "Åbn i ny fane",
    customThumbnail: "Eget miniaturebillede",
    optional: "(valgfrit)",
    thumbnailPlaceholder: "Laves automatisk ud fra video-URL'en",
    altText: "Alt-tekst",
    altTextPlaceholder: "Beskrivelse af videoen",
    width: "Bredde",
    fullWidth: "Fuld bredde",
    widthCustom: "Tilpasset",
    height: "Højde",
    heightAuto: "Auto",
    heightCustom: "Tilpasset",
    placeholderUrl: "Pladsholder-miniature",
    placeholderUrlPlaceholder: "https://... (kun under design)",
    placeholderUrlTooltip:
      "Da video-URL'en bruger et flettefelt, kan du angive et rigtigt miniaturebillede her for at se layoutet, mens du designer. Det kommer ikke med i den færdige mail.",
    addVideo: "Tilføj en video-URL",
  },

  // Toolbar - Button
  button: {
    fontFamily: "Skrifttype",
    inheritFont: "Brug skabelonens skrifttype",
    text: "Tekst",
    url: "URL",
    urlPlaceholder: "https://...",
    openInNewTab: "Åbn i ny fane",
    background: "Baggrund",
    textColor: "Tekstfarve",
    borderRadius: "Hjørneradius",
    fontSize: "Skriftstørrelse",
    fontWeight: "Skrifttykkelse",
    fontWeightRegular: "Normal",
    fontWeightMedium: "Mellem",
    fontWeightBold: "Fed",
    width: "Bredde",
    widthAuto: "Tilpas til indhold",
    fullWidth: "Fuld bredde",
    widthCustom: "Tilpasset",
  },

  // Toolbar - Divider
  divider: {
    style: "Stil",
    solid: "Hel",
    dashed: "Stiplet",
    dotted: "Prikket",
    color: "Farve",
    thickness: "Tykkelse",
  },

  // Toolbar - Social Icons
  social: {
    icons: "Ikoner",
    addIcon: "Tilføj ikon",
    addIcons: "Tilføj ikoner til sociale medier",
    removeIcon: "Fjern",
    urlPlaceholder: "https://...",
    style: "Stil",
    styleSolid: "Udfyldt",
    styleOutlined: "Omrids",
    styleRounded: "Afrundet",
    styleSquare: "Firkantet",
    styleCircle: "Cirkel",
    stylePlain: "Enkel",
    color: "Farve",
    colorBrand: "Brandfarver",
    colorDark: "Mørk",
    colorLight: "Lys",
    size: "Størrelse",
    sizeSmall: "S",
    sizeMedium: "M",
    sizeLarge: "L",
    spacing: "Afstand",
    align: "Justering",
    platforms: {
      facebook: "Facebook",
      twitter: "X (Twitter)",
      instagram: "Instagram",
      linkedin: "LinkedIn",
      xing: "XING",
      youtube: "YouTube",
      tiktok: "TikTok",
      pinterest: "Pinterest",
      email: "E-mail",
      website: "Hjemmeside",
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
    items: "Menupunkter",
    addItem: "Tilføj punkt",
    removeItem: "Fjern",
    text: "Tekst",
    urlPlaceholder: "https://example.com",
    openInNewTab: "Åbn i ny fane",
    bold: "Fed",
    underline: "Understreget",
    color: "Farve",
    linkColor: "Linkfarve",
    fontSize: "Skriftstørrelse",
    fontFamily: "Skrifttype",
    separator: "Skilletegn",
    separatorColor: "Farve på skilletegn",
    spacing: "Afstand",
    textAlign: "Justering",
    addLinks: "Tilføj menulinks",
  },

  // Toolbar - Table
  table: {
    dimensions: "Størrelse",
    rows: "Rækker",
    columns: "Kolonner",
    hasHeaderRow: "Overskriftsrække",
    headerBackgroundColor: "Baggrund i overskrift",
    noHeaderBg: "Ingen baggrund",
    borderColor: "Kantfarve",
    borderWidth: "Kantbredde",
    cellPadding: "Celleafstand",
    fontFamily: "Skrifttype",
    fontSize: "Skriftstørrelse",
    color: "Tekstfarve",
    textAlign: "Justering",
    cellPlaceholder: "Skriv tekst...",
    empty: "Tilføj en tabel",
  },

  // Toolbar - Paragraph
  paragraph: {
    paragraphSpacing: "Afstand mellem afsnit",
  },

  // Toolbar - Spacer
  spacer: {
    height: "Højde",
  },

  // Toolbar - Countdown
  countdown: {
    targetDate: "Slutdato",
    timezone: "Tidszone",
    display: "Visning",
    days: "Dage",
    hours: "Timer",
    minutes: "Minutter",
    seconds: "Sekunder",
    separator: "Skilletegn",
    fontFamily: "Skrifttype",
    inheritFont: "Standard",
    digitFontSize: "Talstørrelse",
    digitColor: "Talfarve",
    labelColor: "Etiketfarve",
    labelFontSize: "Etiketstørrelse",
    background: "Baggrund",
    labels: "Etiketter",
    expiry: "Besked ved udløb",
    expiredMessagePlaceholder: "Dette tilbud er udløbet",
    expiredImageUrl: "Billed-URL ved udløb",
    hideOnExpiry: "Skjul ved udløb",
    setDate: "Angiv en slutdato i indstillingerne",
    hidden: "Skjult (udløbet)",
  },

  // Custom Blocks
  customBlocks: {
    definitionNotFound: "Ukendt bloktype — denne blok er ikke registreret",
    renderError:
      "Denne blok kunne ikke vises. Tjek blokkens skabelon for fejl.",
    fields: {
      required: "Påkrævet",
      addItem: "Tilføj punkt",
      removeItem: "Fjern",
      maxItemsReached: "Det maksimale antal punkter er nået",
      minItemsRequired: "Mindst {count} punkter påkrævet",
    },
    toolbar: {
      noDefinition:
        "Registrér denne bloktype i din SDK-konfiguration for at redigere dens egenskaber",
    },
    dataSource: {
      fetchButton: "Hent indhold",
      changeButton: "Skift",
      fetching: "Henter...",
      readOnlyTooltip: "Denne værdi hentes fra din datakilde",
      fetchError: "Indholdet kunne ikke hentes",
    },
  },

  // Toolbar - HTML
  html: {
    content: "HTML-indhold",
    preview: "Egen HTML-blok",
    empty: "Tilføj HTML-indhold i panelet",
    sanitizationHint:
      "HTML'en eksporteres, som den er, og bliver ikke renset — sørg for, at indholdet er sikkert.",
  },

  // Toolbar - Common block settings
  blockSettings: {
    spacing: "Afstand",
    padding: "Indre afstand",
    background: "Baggrund",
    fullWidthBackground: "Baggrund i fuld bredde",
    contentBackground: "Indholdets baggrund",
    borderWidth: "Kantbredde",
    borderStyle: "Kantstil",
    borderColor: "Kantfarve",
    border: "Kant",
    borderSide: "Side",
    linkSides: "Samme kant på alle sider",
    unlinkSides: "Angiv hver side for sig",
    linkCorners: "Samme radius på alle hjørner",
    unlinkCorners: "Angiv hvert hjørne for sig",
    cornerTopLeft: "Øverst til venstre",
    cornerTopRight: "Øverst til højre",
    cornerBottomRight: "Nederst til højre",
    cornerBottomLeft: "Nederst til venstre",
    color: "Farve",
    backgroundImage: "Billede",
    backgroundImagePlaceholder: "https://example.com/background.jpg",
    backgroundSize: "Størrelse",
    backgroundSizeCover: "Udfyld",
    backgroundSizeContain: "Tilpas",
    backgroundSizeAuto: "Original",
    backgroundPosition: "Placering",
    backgroundPositionTopLeft: "Øverst til venstre",
    backgroundPositionTopCenter: "Øverst i midten",
    backgroundPositionTopRight: "Øverst til højre",
    backgroundPositionCenterLeft: "Midt til venstre",
    backgroundPositionCenter: "Midten",
    backgroundPositionCenterRight: "Midt til højre",
    backgroundPositionBottomLeft: "Nederst til venstre",
    backgroundPositionBottomCenter: "Nederst i midten",
    backgroundPositionBottomRight: "Nederst til højre",
    backgroundRepeat: "Gentag billede",
    heroHeight: "Højde",
    heroHeightFit: "Tilpas til indhold",
    heroHeightImage: "Som billedet",
    heroHeightFixed: "Fast",
    heroAlign: "Placering af indhold",
    heroAlignTop: "Øverst",
    heroAlignMiddle: "Midt",
    heroAlignBottom: "Nederst",
    heroMatchImageMergeTag:
      '"Som billedet" kræver en direkte billed-URL: et flettefelt har ingen størrelse at aflæse.',
    heroSizeUnknown:
      "Billedets størrelse kendes ikke endnu, så sektionen vises i indholdets højde.",
    display: "Visning",
    showOnDesktop: "Vis på computer",
    showOnMobile: "Vis på mobil",
    hiddenOnDevice: "Skjult på {device}",
    displayCondition: "Visningsbetingelse",
    selectCondition: "Vælg betingelse",
    removeCondition: "Fjern betingelse",
    addCondition: "Tilføj betingelse",
    editCondition: "Rediger",
    noCondition: "Altid synlig",
    conditionApplied: "Betingelse anvendt",
    customCondition: "Egen betingelse",
    customConditionLabel: "Betingelsens navn",
    customConditionBefore: "Før (åbnende logik)",
    customConditionAfter: "Efter (lukkende logik)",
    applyCondition: "Anvend",
    cancelCondition: "Annuller",
    customBadge: "Egen",
    restoreHiddenBlocks: "Vis alle skjulte blokke",
  },

  // Template settings
  templateSettings: {
    layout: "Layout",
    widthPreset: "Standardbredde",
    customWidth: "Egen bredde",
    appearance: "Udseende",
    backgroundColor: "Baggrundsfarve",
    textColor: "Tekstfarve",
    linkColor: "Linkfarve",
    linkUnderline: "Understreg links",
    fontFamily: "Skrifttype",
    preheaderText: "Forhåndsvisningstekst",
    preheaderTextPlaceholder: "Tekst der vises efter emnelinjen i indbakken...",
    preheaderTextHint:
      "Denne tekst vises efter emnelinjen i mailprogrammernes forhåndsvisning. Understøtter flettefelter.",
    language: "Sprog",
    contentLocale: "Indholdets sprog",
    contentLocaleHint:
      "BCP 47-kode (fx da, en, pt-BR). Sætter mailens lang-attribut, så skærmlæsere udtaler indholdet korrekt.",
    contentDirection: "Højre mod venstre",
    contentDirectionHint:
      "Mailens skriveretning, uafhængigt af editorens eget sprog. Når den ikke er sat, følger den indholdets sprog (arabisk, hebraisk, …).",
    tips: "Tips",
    tip1: "600px er standardbredden for mailskabeloner",
    tip2: "Brug websikre skrifttyper for den bedste kompatibilitet",
    tip3: "Lyse baggrunde giver den bedste læsbarhed",
  },

  // Spacing control
  spacingControl: {
    lockAll: "Lås alle sider",
    unlock: "Lås sider op",
    top: "Top",
    right: "Højre",
    bottom: "Bund",
    left: "Venstre",
    decreaseTop: "Mindsk top",
    increaseTop: "Øg top",
    decreaseLeft: "Mindsk venstre",
    increaseLeft: "Øg venstre",
    decreaseRight: "Mindsk højre",
    increaseRight: "Øg højre",
    decreaseBottom: "Mindsk bund",
    increaseBottom: "Øg bund",
  },

  // Color Picker
  colorPicker: {
    pickColor: "Vælg en farve",
    hexValue: "Hex-farveværdi",
    notSet: "Ikke angivet",
    clear: "Ryd farve",
    transparent: "Gennemsigtig",
    presetColors: "Foruddefinerede farver",
  },

  // Merge Tag
  mergeTag: {
    editAsText: "Rediger som tekst",
    fieldGroup: "Værdi med flettefelter",
    remove: "Fjern flettefelt",
    insert: "Indsæt flettefelt",
    insertShort: "Flettefelt",
    editValue: "Rediger flettefeltets værdi",
    changeTag: "Skift flettefelt: {label}",
    unknownLabel: "Flettefelt",
    deleteMergeTag: "Slet flettefelt",
    suggestionEmpty: "Ingen matchende flettefelter",
    picker: {
      title: "Indsæt flettefelt",
      changeTitle: "Skift flettefelt",
      searchPlaceholder: "Søg i flettefelter",
      searchAriaLabel: "Søg i flettefelter",
      noResults: "Ingen matchende flettefelter",
      empty: "Ingen flettefelter sat op",
      otherGroup: "Andet",
      close: "Luk",
      groupCount: "{count}",
      sample: "Eksempel: {sample}",
    },
  },

  // Logic tags (standalone, separate from merge tags)
  logicTag: {
    insert: "Indsæt logik",
    insertShort: "Logik",
    picker: {
      title: "Indsæt logik",
      searchPlaceholder: "Søg i logikfelter",
      searchAriaLabel: "Søg i logikfelter",
      noResults: "Ingen matchende logikfelter",
      empty: "Ingen logikfelter sat op",
      otherGroup: "Andet",
      close: "Luk",
    },
  },

  // Canvas
  canvas: {
    noBlocks: "Ingen blokke endnu",
    dragHint: "Start fra bunden ved at trække blokke ind fra sidepanelet",
    dropHere: "Slip her",
  },

  // Sidebar
  savedBlocks: {
    title: "Gemte blokke",
    saveAsBlock: "Gem som blok",
    name: "Navn",
    namePlaceholder: "fx Sidehoved, Sidefod, Opfordring...",
    save: "Gem blok",
    saving: "Gemmer...",
    cancel: "Annuller",
    empty: "Ingen gemte blokke endnu",
    emptyHint: "Gem blokke fra dine skabeloner for at genbruge dem senere.",
    noResults: "Ingen gemte blokke matcher din søgning",
    search: "Søg i gemte blokke...",
    loading: "Henter gemte blokke…",
    category: "Kategori",
    categoryPlaceholder: "fx Sidehoveder, Kampagner... (valgfrit)",
    allCategories: "Alle kategorier",
    filterByCategory: "Filtrér efter kategori",
    insert: "Indsæt",
    rename: "Omdøb",
    delete: "Slet",
    // The delete confirm shows the short label and is named by the question,
    // so the label must stay part of the question (WCAG 2.5.3).
    deleteConfirm: "Slet denne gemte blok?",
    deleteConfirmShort: "Slet?",
    blockCount: "{count} blok(ke)",
    browse: "Gennemse gemte blokke",
    selectToPreview: "Vælg en gemt blok for at se en eksempelvisning",
    insertAtBeginning: "I starten",
    insertAfterBlock: "Efter {block}",
    insertAtEnd: "I slutningen",
    insertPosition: "Placering",
    close: "Luk",
    pickToolbar: "Valg af gemte blokke",
    pickCount: "{count} blok(ke) valgt",
    pickHint: "Klik på blokke for at tilføje eller fjerne dem",
    savingCount: "Gemmer {count} blok(ke):",
    reorderHint:
      "Træk for at ændre rækkefølgen — blokkene gemmes i denne rækkefølge",
    reorderHandle: "Flyt {block}, position {position} af {total}",
    reorderAnnouncement:
      "{block} er flyttet til position {position} af {total}",
    expand: "Udvid",
    collapse: "Skjul",
    expandPreview: "Udvid eksempelvisning af {block}",
    collapsePreview: "Skjul eksempelvisning af {block}",
  },
  comments: {
    filterLanguage: "Dette sprog",
    button: "Kommentarer",
    title: "Kommentarer",
    close: "Luk",
    placeholder: "Skriv en kommentar...",
    replyPlaceholder: "Skriv et svar...",
    reply: "Svar",
    resolve: "Løs",
    unresolve: "Genåbn",
    delete: "Slet",
    edit: "Rediger",
    cancel: "Annuller",
    save: "Gem",
    noComments: "Ingen kommentarer endnu",
    noCommentsHint:
      "Start en samtale ved at kommentere skabelonen eller en bestemt blok.",
    deleteConfirm: "Slet denne kommentar?",
    filterAll: "Alle",
    filterUnresolved: "Uløste",
    filterBlock: "Denne blok",
    jumpToBlock: "Blok",
    ownedByYou: "Dig",
    edited: "redigeret",
    resolvedBy: "Løst af {name}",
    replyOne: "{count} svar",
    replyMany: "{count} svar",
    missingBlock: "Manglende blok",
    saveTemplateFirst: "Gem skabelonen, før du kommenterer denne blok.",
  },
  collaboration: {
    people: "Personer der redigerer denne skabelon",
    guest: "Gæst",
    connected: "Live",
    reconnecting: "Genopretter forbindelse…",
    offline: "Offline",
    editing: "{name} redigerer",
    selectionRefused: "{name} redigerer denne blok.",
    editRefused:
      "Din ændring blev ikke gemt: en anden ændrede denne del først.",
    editRefusedLocked: "Din ændring blev ikke gemt: {name} redigerer den blok.",
    editTooLarge: "Din ændring blev ikke gemt: den er for stor.",
    undoSkipped: "Trinnet kunne ikke fortrydes: en anden har ændret det siden.",
    replaceRefused:
      "Skabelonen kan ikke erstattes, mens andre redigerer: {names}.",
    reconnectingNotice:
      "Genopretter forbindelse… Du kan blive ved med at redigere.",
    dismiss: "Luk",
    anAgent: "En agent",
    agentFor: "{client} for {name}",
    aiFor: "AI (for {name})",
    agentChangedBlock: "{who} ændrede en blok.",
    agentChangedBlocks: "{who} ændrede {count} blokke.",
    agentChangedSettings: "{who} ændrede skabelonens indstillinger.",
    agentChangedBlockAndSettings:
      "{who} ændrede en blok og skabelonens indstillinger.",
    agentChangedBlocksAndSettings:
      "{who} ændrede {count} blokke og skabelonens indstillinger.",
    agentUpdatedTemplate: "{who} opdaterede skabelonen.",
  },
  ai: {
    altText: {
      stale: "Billedet er ændret. Skriv alt-teksten igen.",
      bulk: "Skriv manglende alt-tekst ({count})",
      review: "Gennemgå alt-tekst",
      applyAccepted: "Anvend godkendte ({count})",
      progress: "Skriver alt-tekst… {done} af {total}",
      button: "Skriv alt-tekst",
      drafting: "Skriver alt-tekst…",
      title: "Alt-tekst",
      accept: "Godkend",
      decorative: "Markér som dekorativt",
      cancel: "Annuller",
      note: "Skrevet af AI. Tjek, at den siger, hvad billedet skal vise.",
      failed:
        "Der kunne ikke skrives alt-tekst til dette billede. Skriv den selv.",
    },
    fix: {
      button: "Ret med AI",
      fixing: "Retter…",
      stillFlagged: "Stadig markeret efter rettelsen",
    },
    starters: {
      emptyWelcome: "Skriv en velkomstmail til nye kunder",
      emptyLaunch: "Lav en lanceringsmail for et nyt produkt",
      emptyNewsletter: "Byg et layout til et månedligt nyhedsbrev",
      filledShorten: "Gør teksten kortere",
      filledFriendlier: "Gør tonen venligere",
      filledDates: "Opdater datoerne og tilbuddet",
      filledCta: "Tilføj en tydelig opfordring til handling",
    },
    rewrite: {
      tooLarge:
        "Dette afsnit er for langt til AI. Vælg et afsnit med højst 20.000 tegn.",
      title: "Omskriv med AI",
      close: "Luk",
      suggestionLabel: "AI-forslag",
      presets: {
        shorten: "Kortere",
        expand: "Længere",
        friendlier: "Venligere",
        formal: "Mere formel",
        fixGrammar: "Ret grammatik",
        translate: "Oversæt",
      },
      language: "Sprog",
      instructionLabel: "Din instruktion",
      instructionPlaceholder: "Eller skriv, hvordan den skal omskrives…",
      run: "Omskriv",
      rewriting: "Omskriver…",
      stop: "Stop",
      replaceAction: "Erstat",
      discard: "Kassér",
    },
    errors: {
      historyError: "Samtalen kunne ikke hentes. Prøv igen.",
      missingProvider:
        "Denne AI-backend skal bruge en skabelon- eller samarbejdsudbyder for at vise sine ændringer.",
      featureUnavailable: "Denne AI-funktion er ikke tilgængelig.",
      limitReached: "Du har brugt din AI-kvote for nu.",
      limitReachedUntil: "Du har brugt din AI-kvote indtil {date}.",
      rateLimited: "For mange AI-forespørgsler. Prøv igen om lidt.",
      turnRunning: "Der kører allerede en AI-forespørgsel på denne skabelon.",
      contentTooLarge: "Denne skabelon er for stor til AI.",
      outputInvalid: "AI'en kunne ikke lave et gyldigt resultat. Prøv igen.",
      providerError: "AI er ikke tilgængelig lige nu. Prøv igen senere.",
      templateChanged: "Skabelonen blev ændret, mens AI'en arbejdede.",
      blockLocked: "Nogen redigerer en blok, som AI'en skulle bruge.",
      undoRefused:
        "Nogen har ændret disse blokke siden, så det kan ikke fortrydes.",
      redoRefused:
        "Nogen har ændret disse blokke siden, så det kan ikke gentages.",
      messageGone: "Denne besked er ikke længere med i samtalen.",
      generic: "Noget gik galt. Prøv igen.",
    },
    menu: {
      button: "AI",
      chat: "AI-assistent",
    },
    chat: {
      keptYourVersion:
        "Du redigerede, mens AI'en arbejdede, så editoren har beholdt din version. AI'ens ændringer er gemt på serveren; genindlæs for at se dem. Gemmer du din version, erstatter den dem.",
      reload: "Genindlæs",
      attach: "Vedhæft filer",
      dropHint: "Slip billeder eller PDF'er for at vedhæfte dem",
      removeAttachment: "Fjern {name}",
      attachTooMany: "Vedhæft højst 4 filer.",
      attachTooLarge: "{name} er større end 5 MB.",
      attachTotalTooLarge: "Vedhæftninger må højst fylde 10 MB tilsammen.",
      attachWrongType: "{name} er hverken et billede eller en PDF.",
      title: "AI-assistent",
      notice: "Svar og ændringer kommer fra AI.",
      close: "Luk",
      newChat: "Ny chat",
      inputPlaceholder: "Beskriv den ændring, du ønsker...",
      send: "Send",
      stop: "Stop",
      placeholder:
        "Beskriv den mail, du ønsker, eller bed om en ændring til denne.",
      loadingHistory: "Henter samtalen...",
      appliedChange: "Anvendte 1 ændring",
      appliedChanges: "Anvendte {count} ændringer",
      undone: "Fortrudt",
      undo: "Fortryd",
      redo: "Gentag",
      disclaimer: "AI kan tage fejl. Tjek ændringerne.",
    },
    import: {
      menu: "Importér fra screenshot eller PDF",
      prompt: "Byg denne mail ud fra det vedhæftede design.",
      placeholderNote:
        "Billeder kommer ind som pladsholdere. Erstat dem efter importen.",
    },
    canvas: {
      importHint: "Har du allerede et design?",
      chatHint: "eller lad",
      chatHintSuffix: "lave en skabelon ud fra din beskrivelse",
    },
  },
  versionHistory: {
    tooltip: "Versionshistorik",
    dropdownTitle: "Versionshistorik",
    empty: "Ingen versioner endnu",
    auto: "auto",
    olderVersion: "Ældre version",
    newerVersion: "Nyere version",
  },
  versionPreview: {
    message: "Du ser en tidligere version af denne skabelon.",
    cancel: "Annuller",
    restore: "Gendan denne version",
    restoreConfirm: {
      title: "Gendan denne version?",
      unsavedWithSave:
        "Du har ændringer, der ikke er gemt. Gem dem først, så bliver de i din historik — gendanner du uden at gemme, går de tabt.",
      unsavedNoSave:
        "Du har ændringer, der ikke er gemt, og intet sted at gemme dem. Gendanner du denne version, går de tabt.",
      saveAndRestore: "Gem og gendan",
      restoreAnyway: "Gendan alligevel",
      cancel: "Annuller",
    },
  },
  previewResolution: {
    resolving: "Henter data til eksempelvisning…",
    failed: "Eksempelvisningen kunne ikke hentes — viser skabelonen uden data.",
    hint: "Eksempelvisningen bruger data fra din backend.",
  },
  mergeTagPreview: {
    label: "Visning af flettefelter",
    sample: "Eksempel",
    labelView: "Navn",
  },
  testEmail: {
    title: "Send testmail",
    recipientLabel: "Modtager",
    recipientPlaceholder: "dig@example.com",
    invalidAddress: "Indtast en gyldig e-mailadresse.",
    preview: "Eksempelvisning",
    previewHint: "Flettefelter vises uudfyldt — din backend udfylder dem.",
    previewHintSample:
      "Flettefelter viser eksempelværdier — din backend udfylder de rigtige data.",
    recipientNotAllowed: "Den adresse er ikke på listen over tilladte.",
    send: "Send",
    sending: "Sender...",
    cancel: "Annuller",
    success: "Testmailen er sendt",
    button: "Test",
  },
  sidebarNav: {
    browseSavedBlocks: "Gennemse gemte blokke",
    palette: "Blokke",
    insertBlock: "Indsæt blokken {block}",
  },

  // Landmark region labels for assistive technology
  landmarks: {
    canvas: "Mailens lærred",
    blockToolbar: "Blokkens egenskaber",
    rightSidebar: "Blokkens egenskaber og skabelonens indstillinger",
    reorderAnnouncements: "Meddelelser om flytning af blokke",
  },

  // Design Reference (cloud)
  errors: {
    editorLoading: "Indlæser editor...",
    editorLoadFailed: "Editoren kunne ikke indlæses.",
    retry: "Prøv igen",
  },

  issues: {
    panelTitle: "Problemer",
    panelTabLabel: "Problemer",
    groupErrors: "Fejl",
    groupWarnings: "Advarsler",
    groupInfo: "Info",
    jump: "Gå til blok",
    fix: "Ret",
    emptyState: "Ingen problemer — det ser godt ud.",
    badgeError: "Har fejl",
    badgeWarning: "Har advarsler",
    emailSize: "Mailens størrelse",
    sizeExplainer: "Gmail afkorter mails over ca. 102 KB.",
    checkSize: "Tjek størrelse",
    checkingSize: "Tjekker…",
    checkSizeAgain: "Tjek igen",
    sizeResult: "{size} KB",
    sizePass: "{size} KB · Gmail viser hele mailen.",
    sizeOutdated: "Indholdet er ændret siden tjekket.",
    sizeError: "Størrelsen kunne ikke tjekkes: {error}",
    learnMore: "Læs mere",
    issueCountTooltip: "{count} problem(er)",
  },

  smallScreen: {
    title: "Kræver en større skærm",
    message:
      "Editoren skal bruge mere plads, end denne skærm har. Åbn den på en tablet eller computer for at begynde at redigere.",
  },
};

export default da;
