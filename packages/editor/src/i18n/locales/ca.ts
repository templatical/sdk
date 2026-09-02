import type en from "./en";

const ca: typeof en = {
  // Footer (OSS only)
  footer: {
    poweredBy: "Amb la tecnologia de",
    openSource: "Codi obert",
  },

  // Header — nom de la plantilla + estat de desat. Només es mostra quan hi ha un
  // proveïdor de plantilles configurat.
  header: {
    save: "Desa",
    saving: "S'està desant...",
    saved: "Desat",
    unsaved: "Sense desar",
    saveFailed: "No s'ha pogut desar",
    saveNoTemplate: "Primer carrega o crea una plantilla",
    templateName: "Nom de la plantilla",
    rename: "Canvia el nom de la plantilla",
    untitled: "Sense títol",
    updatedAt: "Actualitzat {time}",
    createdAt: "Creat {time}",
    updatedJustNow: "Actualitzat ara mateix",
    createdJustNow: "Creat ara mateix",
  },

  // Relative timestamps, shared by every surface that shows one: the header's
  // updated line, saved blocks, comments and version history.
  time: {
    justNow: "Ara mateix",
    minutesAgo: "fa {minutes} min",
    hoursAgo: "fa {hours} h",
    daysAgo: "fa {days} d",
  },

  // History (undo/redo)
  history: {
    collabWarning: "Desfer pot afectar els canvis recents dels col·laboradors",
    undo: "Desfer",
    redo: "Refer",
  },

  // Viewport toggle
  viewport: {
    label: "Àrea de visualització",
    desktop: "Escriptori",
    mobile: "Mòbil",
  },

  // Dark mode preview
  darkMode: {
    enable: "Vista prèvia del mode fosc",
    disable: "Vista prèvia del mode clar",
  },

  // Preview mode
  previewMode: {
    enable: "Mode de vista prèvia",
    disable: "Surt de la vista prèvia",
  },

  // Sidebar - Block types
  blocks: {
    section: "Secció",
    image: "Imatge",
    title: "Títol",
    paragraph: "Paràgraf",
    button: "Botó",
    divider: "Divisor",
    video: "Vídeo",
    social: "Xarxes socials",
    spacer: "Espaiador",
    html: "HTML",
    menu: "Menú",
    table: "Taula",
    countdown: "Compta enrere",
  },

  // Right sidebar
  sidebar: {
    content: "Contingut",
    settings: "Configuració",
    noSelection: "Cap element seleccionat",
    noSelectionHint: "Selecciona un bloc al llenç per editar-lo",
  },

  // Toolbar - Common
  toolbar: {
    duplicate: "Duplica",
    delete: "Elimina",
  },

  // Title editor toolbar
  titleEditor: {
    toolbar: "Format del títol",
    bold: "Negreta (Ctrl+B)",
    italic: "Cursiva (Ctrl+I)",
    addLink: "Afegeix un enllaç",
  },

  // Paragraph editor toolbar
  paragraphEditor: {
    toolbar: "Format del text",
    bold: "Negreta (Ctrl+B)",
    italic: "Cursiva (Ctrl+I)",
    underline: "Subratllat (Ctrl+U)",
    strikethrough: "Text ratllat",
    subscript: "Subíndex",
    superscript: "Superíndex",
    addLink: "Afegeix un enllaç",
    bulletList: "Llista de vinyetes",
    numberedList: "Llista numerada",
    alignLeft: "Alinea a l'esquerra",
    alignCenter: "Alinea al centre",
    alignRight: "Alinea a la dreta",
    alignJustify: "Justifica",
    clearFormatting: "Neteja el format",
    insertEmoji: "Insereix un emoji",
    fontFamily: "Tipus de lletra",
    defaultFont: "Per defecte",
    fontSize: "Mida de la font",
    defaultSize: "Per defecte",
    textColor: "Color del text",
    highlightColor: "Color de ressaltat",
    lineHeight: "Interlínia",
    letterSpacing: "Espaiat de lletres",
    emojiItemLabel: "Insereix l'emoji {emoji}",
  },

  // Block actions (BlockWrapper)
  blockActions: {
    drag: "Arrossega per reordenar, o prem Espai per moure amb el teclat",
    dragLifted:
      "Movent {block}. Utilitza les fletxes amunt i avall per reposicionar, Espai o Retorn per deixar anar, Esc per cancel·lar.",
    duplicate: "Duplica el bloc",
    delete: "Elimina el bloc",
    hiddenOnViewport: "Ocult a {viewport}",
    saveAsBlock: "Desa com a bloc",
    conditionToggle: "Alterna la condició de visualització",
    comments: "Comentaris ({count})",
    lifted: "{block} aixecat. Posició {position} de {total}.",
    moved: "{block} mogut a la posició {position} de {total}.",
    dropped: "{block} deixat anar a la posició {position} de {total}.",
    cancelled:
      "Moviment cancel·lat. {block} ha tornat a la posició {position}.",
  },

  // Toolbar - Section
  section: {
    dropHere: "Deixa anar els blocs aquí",
    columns: "Columnes",
    column1: "1 columna",
    column2: "2 columnes",
    column3: "3 columnes",
    ratio12: "Proporció 1:2",
    ratio21: "Proporció 2:1",
    borderRadius: "Radi de la vora",
    wrapperEnable: "Afegeix un contenidor",
    stackOnMobile: "Apila en mòbil",
  },

  // Text editor link dialog
  linkDialog: {
    editLink: "Edita l'enllaç",
    insertLink: "Insereix l'enllaç",
    updateLink: "Actualitza l'enllaç",
    removeLink: "Elimina l'enllaç",
    cancel: "Cancel·la",
    urlPlaceholder: "https://example.com",
    urlLabel: "URL",
    colorLabel: "Color de l'enllaç",
  },

  // Toolbar - Title
  title: {
    level: "Nivell d'encapçalament",
    heading1: "Encapçalament 1 (36px)",
    heading2: "Encapçalament 2 (28px)",
    heading3: "Encapçalament 3 (22px)",
    heading4: "Encapçalament 4 (18px)",
    fontFamily: "Tipus de lletra",
    inheritFont: "Utilitza la font de la plantilla",
    color: "Color",
    align: "Alineació",
    alignLeft: "Esquerra",
    alignCenter: "Centre",
    alignRight: "Dreta",
  },

  // Emoji picker
  emoji: {
    smileys: "Emoticones",
    gestures: "Gestos",
    objects: "Objectes",
  },

  // Toolbar - Image
  image: {
    imageUrl: "URL de la imatge",
    imageUrlPlaceholder: "https://...",
    altText: "Text alternatiu",
    altTextPlaceholder: "Descripció de la imatge",
    width: "Amplada",
    fullWidth: "Amplada completa",
    widthCustom: "Personalitzada",
    height: "Alçada",
    heightAuto: "Automàtica",
    heightCustom: "Personalitzada",
    linkUrl: "URL de l'enllaç",
    openInNewTab: "Obre en una pestanya nova",
    placeholderUrl: "Imatge de mostra",
    optional: "(opcional)",
    placeholderUrlPlaceholder: "https://... (només per al disseny)",
    placeholderUrlTooltip:
      "Com que la URL de la imatge utilitza una etiqueta de fusió, podeu proporcionar una imatge real aquí per previsualitzar el disseny mentre dissenyeu. Això no s'inclou a la sortida final.",
    clickToAdd: "Feu clic per afegir la URL de la imatge",
    browseMedia: "Explora multimèdia",
    dropToUpload: "Deixeu anar la imatge per pujar-la",
    uploading: "Pujant…",
    decorative: "Imatge decorativa",
    decorativeHint:
      "Ocult per als lectors de pantalla. Utilitzeu-lo només per a espaiadors i detalls visuals.",
  },

  // Toolbar - Video
  video: {
    videoUrl: "URL del vídeo",
    videoUrlPlaceholder: "https://youtube.com/...",
    openInNewTab: "Obre en una pestanya nova",
    customThumbnail: "Miniatura personalitzada",
    optional: "(opcional)",
    thumbnailPlaceholder: "Generat automàticament des de la URL del vídeo",
    altText: "Text alternatiu",
    altTextPlaceholder: "Descripció del vídeo",
    width: "Amplada",
    fullWidth: "Amplada completa",
    height: "Alçada",
    heightAuto: "Automàtica",
    heightCustom: "Personalitzada",
    placeholderUrl: "Miniatura de mostra",
    placeholderUrlPlaceholder: "https://... (només per al disseny)",
    placeholderUrlTooltip:
      "Com que la URL del vídeo utilitza una etiqueta de fusió, podeu proporcionar una miniatura real aquí per previsualitzar el disseny mentre dissenyeu. Això no s'inclou a la sortida final.",
    addVideo: "Afegeix una URL de vídeo",
  },

  // Toolbar - Button
  button: {
    fontFamily: "Tipus de lletra",
    inheritFont: "Utilitza la font de la plantilla",
    text: "Text",
    url: "URL",
    urlPlaceholder: "https://...",
    openInNewTab: "Obre en una pestanya nova",
    background: "Fons",
    textColor: "Color del text",
    borderRadius: "Radi de la vora",
    fontSize: "Mida de la font",
    width: "Amplada",
    widthAuto: "Ajusta al contingut",
    fullWidth: "Amplada completa",
    widthCustom: "Personalitzada",
  },

  // Toolbar - Divider
  divider: {
    style: "Estil",
    solid: "Sòlid",
    dashed: "Amb guions",
    dotted: "Amb punts",
    color: "Color",
    thickness: "Gruix",
  },

  // Toolbar - Social Icons
  social: {
    icons: "Icones",
    addIcon: "Afegeix una icona",
    addIcons: "Afegeix icones de xarxes socials",
    removeIcon: "Elimina",
    urlPlaceholder: "https://...",
    style: "Estil",
    styleSolid: "Sòlid",
    styleOutlined: "Contornejat",
    styleRounded: "Arrodonit",
    styleSquare: "Quadrat",
    styleCircle: "Cercle",
    size: "Mida",
    sizeSmall: "S",
    sizeMedium: "M",
    sizeLarge: "L",
    spacing: "Espaiat",
    align: "Alineació",
    platforms: {
      facebook: "Facebook",
      twitter: "X (Twitter)",
      instagram: "Instagram",
      linkedin: "LinkedIn",
      youtube: "YouTube",
      tiktok: "TikTok",
      pinterest: "Pinterest",
      email: "Correu electrònic",
      website: "Lloc web",
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
    items: "Elements del menú",
    addItem: "Afegeix un element",
    removeItem: "Elimina",
    text: "Text",
    urlPlaceholder: "https://example.com",
    openInNewTab: "Obre en una pestanya nova",
    bold: "Negreta",
    underline: "Subratllat",
    color: "Color",
    linkColor: "Color de l'enllaç",
    fontSize: "Mida de la font",
    fontFamily: "Tipus de lletra",
    separator: "Separador",
    separatorColor: "Color del separador",
    spacing: "Espaiat",
    textAlign: "Alineació",
    addLinks: "Afegeix enllaços al menú",
  },

  // Toolbar - Table
  table: {
    dimensions: "Dimensions",
    rows: "Files",
    columns: "Columnes",
    hasHeaderRow: "Fila de capçalera",
    headerBackgroundColor: "Fons de la capçalera",
    noHeaderBg: "Sense fons",
    borderColor: "Color de la vora",
    borderWidth: "Gruix de la vora",
    cellPadding: "Farciment de la cel·la",
    fontFamily: "Tipus de lletra",
    fontSize: "Mida de la font",
    color: "Color del text",
    textAlign: "Alineació",
    cellPlaceholder: "Introdueix el text...",
    empty: "Afegeix una taula",
  },

  // Toolbar - Paragraph
  paragraph: {
    paragraphSpacing: "Espaiat entre paràgrafs",
  },

  // Toolbar - Spacer
  spacer: {
    height: "Alçada",
  },

  // Toolbar - Countdown
  countdown: {
    targetDate: "Data límit",
    timezone: "Zona horària",
    display: "Visualització",
    days: "Dies",
    hours: "Hores",
    minutes: "Minuts",
    seconds: "Segons",
    separator: "Separador",
    fontFamily: "Tipus de lletra",
    inheritFont: "Per defecte",
    digitFontSize: "Mida dels dígits",
    digitColor: "Color dels dígits",
    labelColor: "Color de l'etiqueta",
    labelFontSize: "Mida de l'etiqueta",
    background: "Fons",
    labels: "Etiquetes",
    expiry: "Missatge de caducitat",
    expiredMessagePlaceholder: "Aquesta oferta ha caducat",
    expiredImageUrl: "URL de la imatge caducada",
    hideOnExpiry: "Oculta quan hagi caducat",
    setDate: "Defineix una data límit al panell de configuració",
    hidden: "Ocult (caducat)",
  },

  // Custom Blocks
  customBlocks: {
    definitionNotFound:
      "Tipus de bloc desconegut: aquest bloc no està registrat",
    renderError:
      "No s'ha pogut renderitzar aquest bloc. Comproveu si hi ha errors a la plantilla del bloc.",
    fields: {
      required: "Obligatori",
      addItem: "Afegeix un element",
      removeItem: "Elimina",
      maxItemsReached: "S'ha arribat al límit màxim d'elements",
      minItemsRequired: "Es requereix un mínim de {count} elements",
    },
    toolbar: {
      noDefinition:
        "Enregistreu aquest tipus de bloc a la configuració de l'SDK per editar-ne les propietats",
    },
    dataSource: {
      fetchButton: "Carrega el contingut",
      changeButton: "Canvia",
      fetching: "Carregant...",
      readOnlyTooltip: "Aquest valor es carrega des de la vostra font de dades",
      fetchError: "No s'ha pogut carregar el contingut",
    },
  },

  // Toolbar - HTML
  html: {
    content: "Contingut HTML",
    preview: "Bloc HTML personalitzat",
    empty: "Afegeix contingut HTML al panell",
    sanitizationHint:
      "L'HTML s'exporta tal qual i no es depura — assegura't que el contingut sigui segur.",
  },

  // Toolbar - Common block settings
  blockSettings: {
    spacing: "Espaiat",
    padding: "Farciment",
    background: "Fons",
    color: "Color",
    display: "Visualització",
    showOnDesktop: "Mostra a l'escriptori",
    showOnMobile: "Mostra al mòbil",
    hiddenOnDevice: "Ocult a {device}",
    displayCondition: "Condició de visualització",
    selectCondition: "Selecciona una condició",
    removeCondition: "Elimina la condició",
    noCondition: "Sempre visible",
    conditionApplied: "Condició aplicada",
    customCondition: "Condició personalitzada",
    customConditionLabel: "Nom de la condició",
    customConditionBefore: "Abans (lògica d'obertura)",
    customConditionAfter: "Després (lògica de tancament)",
    applyCondition: "Aplica",
    cancelCondition: "Cancel·la",
    customBadge: "Personalitzat",
    restoreHiddenBlocks: "Mostra tots els blocs ocults",
  },

  // Template settings
  templateSettings: {
    layout: "Disposició",
    widthPreset: "Amplada predefinida",
    customWidth: "Amplada personalitzada",
    appearance: "Aparença",
    backgroundColor: "Color de fons",
    textColor: "Color del text",
    linkColor: "Color de l'enllaç",
    linkUnderline: "Subratllar enllaços",
    fontFamily: "Tipus de lletra",
    preheaderText: "Text de la precapçalera",
    preheaderTextPlaceholder:
      "Text de vista prèvia que es mostra després de la línia de l'assumpte a la bústia...",
    preheaderTextHint:
      "Aquest text apareix després de la línia de l'assumpte a les vistes prèvies dels clients de correu. Admet etiquetes de fusió.",
    language: "Idioma",
    contentLocale: "Idioma del contingut",
    contentLocaleHint:
      "Codi BCP 47 (p. ex. ca, en, de). Estableix l'atribut lang del correu renderitzat perquè els lectors de pantalla pronunciïn el contingut correctament.",
    tips: "Consells",
    tip1: "600px és l'amplada estàndard per a les plantilles de correu electrònic",
    tip2: "Utilitzeu fonts segures per a la web per obtenir la millor compatibilitat",
    tip3: "Els fons clars funcionen millor per a la llegibilitat",
  },

  // Spacing control
  spacingControl: {
    lockAll: "Bloqueja tots els costats",
    unlock: "Desbloqueja els costats",
    top: "Superior",
    right: "Dret",
    bottom: "Inferior",
    left: "Esquerre",
    decreaseTop: "Disminueix superior",
    increaseTop: "Augmenta superior",
    decreaseLeft: "Disminueix esquerre",
    increaseLeft: "Augmenta esquerre",
    decreaseRight: "Disminueix dret",
    increaseRight: "Augmenta dret",
    decreaseBottom: "Disminueix inferior",
    increaseBottom: "Augmenta inferior",
  },

  // Color Picker
  colorPicker: {
    pickColor: "Tria un color",
    hexValue: "Valor del color en Hex",
    notSet: "No definit",
    clear: "Neteja el color",
    presetColors: "Colors predefinits",
  },

  // Merge Tag
  mergeTag: {
    clickToEdit: "Feu clic per editar",
    remove: "Elimina l'etiqueta de fusió",
    insert: "Insereix l'etiqueta de fusió",
    insertShort: "Etiqueta de fusió",
    editValue: "Edita el valor de l'etiqueta de fusió",
    deleteMergeTag: "Elimina l'etiqueta de fusió",
    suggestionEmpty: "No hi ha etiquetes de fusió coincidents",
    picker: {
      title: "Insereix l'etiqueta de fusió",
      searchPlaceholder: "Cerca etiquetes de fusió",
      searchAriaLabel: "Cerca etiquetes de fusió",
      noResults: "No hi ha etiquetes de fusió coincidents",
      empty: "No hi ha etiquetes de fusió configurades",
      otherGroup: "Altres",
      close: "Tanca",
      groupCount: "{count}",
      sample: "Vista prèvia: {sample}",
    },
  },

  // Logic tags (standalone, separate from merge tags)
  logicTag: {
    insert: "Insereix lògica",
    insertShort: "Lògica",
    picker: {
      title: "Insereix lògica",
      searchPlaceholder: "Cerca etiquetes de lògica",
      searchAriaLabel: "Cerca etiquetes de lògica",
      noResults: "No hi ha etiquetes de lògica coincidents",
      empty: "No hi ha etiquetes de lògica configurades",
      otherGroup: "Altres",
      close: "Tanca",
    },
  },

  // Canvas
  canvas: {
    noBlocks: "Encara no hi ha blocs",
    dragHint: "Comenceu des de zero arrossegant blocs des de la barra lateral",
    dropHere: "Deixeu anar aquí",
    aiHintChat: "o deixeu que",
    aiHintChatSuffix:
      "generi una plantilla completa per a vosaltres en pocs segons",
    aiHintDesign:
      "Teniu un disseny existent? Pugeu una captura de pantalla, una imatge o un PDF i",
    aiHintDesignSuffix: "el recrearà a l'instant",
  },

  // Sidebar
  savedBlocks: {
    title: "Blocs desats",
    saveAsBlock: "Desa com a bloc",
    name: "Nom",
    namePlaceholder: "p. ex. Encapçalament, Peu de pàgina, CTA...",
    save: "Desa el bloc",
    saving: "S'està desant...",
    cancel: "Cancel·la",
    empty: "Encara no hi ha blocs desats",
    emptyHint:
      "Desa blocs de les teves plantilles per reutilitzar-los més tard.",
    noResults: "Cap bloc desat coincideix amb la teva cerca",
    search: "Cerca blocs desats...",
    loading: "S'estan carregant els blocs desats…",
    category: "Categoria",
    categoryPlaceholder: "p. ex. Capçaleres, Promocions... (opcional)",
    allCategories: "Totes les categories",
    filterByCategory: "Filtra per categoria",
    insert: "Insereix",
    rename: "Canvia el nom",
    delete: "Elimina",
    deleteConfirm: "Vols eliminar aquest bloc desat?",
    blockCount: "{count} bloc(s)",
    browse: "Explora els blocs desats",
    selectToPreview: "Selecciona un bloc desat per previsualitzar-lo",
    insertAtBeginning: "Al principi",
    insertAfterBlock: "Després de {block}",
    insertAtEnd: "Al final",
    insertPosition: "Posició d'inserció",
    close: "Tanca",
    pickToolbar: "Selecció de bloc desat",
    pickCount: "{count} bloc(s) seleccionat(s)",
    pickHint: "Fes clic als blocs per afegir-los o treure'ls",
    savingCount: "S'estan desant {count} bloc(s):",
    reorderHint: "Arrossega per reordenar: els blocs es desen en aquest ordre",
    reorderHandle: "Reordena {block}, posició {position} de {total}",
    reorderAnnouncement: "{block} mogut a la posició {position} de {total}",
    expand: "Amplia",
    collapse: "Redueix",
    expandPreview: "Amplia la vista prèvia de {block}",
    collapsePreview: "Redueix la vista prèvia de {block}",
  },
  comments: {
    button: "Comentaris",
    title: "Comentaris",
    placeholder: "Escriu un comentari...",
    replyPlaceholder: "Escriu una resposta...",
    reply: "Respondre",
    resolve: "Resoldre",
    unresolve: "Reobrir",
    delete: "Eliminar",
    edit: "Editar",
    cancel: "Cancel·lar",
    save: "Desar",
    noComments: "Encara no hi ha comentaris",
    noCommentsHint:
      "Comença una conversa afegint un comentari a la plantilla o a un bloc concret.",
    deleteConfirm: "Vols eliminar aquest comentari?",
    filterAll: "Tots",
    filterUnresolved: "Sense resoldre",
    filterBlock: "Aquest bloc",
    jumpToBlock: "Bloc",
    ownedByYou: "Tu",
    edited: "editat",
    resolvedBy: "Resolt per {name}",
    replyOne: "{count} resposta",
    replyMany: "{count} respostes",
    missingBlock: "Bloc no trobat",
    saveTemplateFirst: "Desa la plantilla abans de comentar en aquest bloc.",
  },
  versionHistory: {
    tooltip: "Historial de versions",
    dropdownTitle: "Historial de versions",
    empty: "Encara no hi ha versions",
    auto: "auto",
    olderVersion: "Versió anterior",
    newerVersion: "Versió més recent",
  },
  versionPreview: {
    message: "Estàs veient una versió anterior d’aquesta plantilla.",
    cancel: "Cancel·la",
    restore: "Restaura aquesta versió",
    restoreConfirm: {
      title: "Vols restaurar aquesta versió?",
      unsavedWithSave:
        "Tens canvis sense desar. Desa’ls primer i es mantindran a l’historial; si restaures sense desar, es perdran.",
      unsavedNoSave:
        "Tens canvis sense desar i cap lloc on desar-los. Si restaures aquesta versió, es perdran.",
      saveAndRestore: "Desa i restaura",
      restoreAnyway: "Restaura igualment",
      cancel: "Cancel·la",
    },
  },
  previewResolution: {
    resolving: "S’està resolent la vista prèvia…",
    failed:
      "No s’ha pogut resoldre la vista prèvia; es mostra la plantilla sense resoldre.",
    hint: "La vista prèvia utilitza dades resoltes pel teu backend.",
  },
  mergeTagPreview: {
    label: "Vista d’etiquetes de combinació",
    sample: "Exemple",
    labelView: "Etiqueta",
  },
  testEmail: {
    title: "Envia un correu de prova",
    recipientLabel: "Destinatari",
    recipientPlaceholder: "tu@exemple.cat",
    invalidAddress: "Introduïu una adreça de correu vàlida.",
    preview: "Previsualització",
    previewHint:
      "Les etiquetes de combinació es mostren sense resoldre — el vostre backend les omple.",
    previewHintSample:
      "Les etiquetes de combinació mostren valors d’exemple; el teu backend insereix les dades reals.",
    recipientNotAllowed:
      "Aquesta adreça no és a la llista de destinataris permesos.",
    send: "Envia",
    sending: "S'està enviant...",
    cancel: "Cancel·la",
    success: "Correu de prova enviat correctament",
    button: "Prova",
  },
  sidebarNav: {
    browseSavedBlocks: "Explora els blocs desats",
    palette: "Paleta de blocs",
    insertBlock: "Insereix un bloc de tipus {block}",
  },

  // Landmark region labels for assistive technology
  landmarks: {
    canvas: "Llenç del correu",
    blockToolbar: "Propietats del bloc",
    rightSidebar: "Propietats del bloc i configuració de la plantilla",
    reorderAnnouncements: "Avisos de reordenació de blocs",
  },

  // Design Reference (cloud)
  errors: {
    editorLoading: "Carregant l'editor...",
    editorLoadFailed: "No s'ha pogut carregar l'editor.",
    retry: "Torna-ho a provar",
  },

  issues: {
    panelTitle: "Problemes",
    panelTabLabel: "Problemes",
    groupErrors: "Errors",
    groupWarnings: "Avisos",
    groupInfo: "Informació",
    jump: "Vés al bloc",
    fix: "Corregeix",
    emptyState: "Sense problemes, tot correcte.",
    badgeError: "Té errors",
    badgeWarning: "Té avisos",
    issueCountTooltip: "{count} problema/es",
  },

  smallScreen: {
    title: "Cal una pantalla més gran",
    message:
      "L'editor necessita més espai del que ofereix aquesta pantalla. Obriu-lo en una tauleta o ordinador d'escriptori per començar a editar.",
  },
};

export default ca;
