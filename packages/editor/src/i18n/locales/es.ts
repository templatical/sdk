import type en from "./en";

const es: typeof en = {
  // Footer (OSS only)
  footer: {
    poweredBy: "Con la tecnología de",
    openSource: "Código abierto",
  },

  // Header — nombre de la plantilla + estado de guardado. Solo se muestra cuando
  // hay un proveedor de plantillas configurado.
  header: {
    save: "Guardar",
    saving: "Guardando...",
    saved: "Guardado",
    unsaved: "Sin guardar",
    saveFailed: "Error al guardar",
    saveNoTemplate: "Carga o crea una plantilla primero",
    templateName: "Nombre de la plantilla",
    rename: "Cambiar el nombre de la plantilla",
    untitled: "Sin título",
    updatedAt: "Actualizado {time}",
    createdAt: "Creado {time}",
    updatedJustNow: "Actualizado ahora mismo",
    createdJustNow: "Creado ahora mismo",
  },

  // Relative timestamps, shared by every surface that shows one: the header's
  // updated line, saved blocks, comments and version history.
  time: {
    justNow: "Ahora mismo",
    minutesAgo: "hace {minutes} min",
    hoursAgo: "hace {hours} h",
    daysAgo: "hace {days} d",
  },

  // History (undo/redo)
  history: {
    collabWarning:
      "Deshacer puede afectar a los cambios recientes de los colaboradores",
    undo: "Deshacer",
    redo: "Rehacer",
  },

  // Viewport toggle
  viewport: {
    label: "Área de visualización",
    desktop: "Escritorio",
    mobile: "Móvil",
  },

  // Dark mode preview
  darkMode: {
    enable: "Vista previa en modo oscuro",
    disable: "Vista previa en modo claro",
  },

  // Preview mode
  previewMode: {
    enable: "Modo vista previa",
    disable: "Salir de la vista previa",
  },

  // Sidebar - Block types
  blocks: {
    section: "Sección",
    image: "Imagen",
    title: "Título",
    paragraph: "Párrafo",
    button: "Botón",
    divider: "Divisor",
    video: "Vídeo",
    social: "Redes sociales",
    spacer: "Espaciador",
    html: "HTML",
    menu: "Menú",
    table: "Tabla",
    countdown: "Cuenta atrás",
  },

  // Right sidebar
  sidebar: {
    content: "Contenido",
    settings: "Configuración",
    noSelection: "Ningún elemento seleccionado",
    noSelectionHint: "Selecciona un bloque en el lienzo para editarlo",
  },

  // Toolbar - Common
  toolbar: {
    duplicate: "Duplicar",
    delete: "Eliminar",
  },

  // Title editor toolbar
  titleEditor: {
    toolbar: "Formato del título",
    bold: "Negrita (Ctrl+B)",
    italic: "Cursiva (Ctrl+I)",
    addLink: "Añadir enlace",
  },

  // Paragraph editor toolbar
  paragraphEditor: {
    toolbar: "Formato del texto",
    bold: "Negrita (Ctrl+B)",
    italic: "Cursiva (Ctrl+I)",
    underline: "Subrayado (Ctrl+U)",
    strikethrough: "Tachado",
    subscript: "Subíndice",
    superscript: "Superíndice",
    addLink: "Añadir enlace",
    bulletList: "Lista con viñetas",
    numberedList: "Lista numerada",
    alignLeft: "Alinear a la izquierda",
    alignCenter: "Alinear al centro",
    alignRight: "Alinear a la derecha",
    alignJustify: "Justificar",
    clearFormatting: "Borrar formato",
    insertEmoji: "Insertar emoji",
    fontFamily: "Familia tipográfica",
    defaultFont: "Por defecto",
    fontSize: "Tamaño de fuente",
    defaultSize: "Por defecto",
    textColor: "Color del texto",
    highlightColor: "Color de resaltado",
    lineHeight: "Interlineado",
    letterSpacing: "Espaciado entre letras",
    emojiItemLabel: "Insertar emoji {emoji}",
  },

  // Block actions (BlockWrapper)
  blockActions: {
    drag: "Arrastra para reordenar o pulsa Espacio para mover con el teclado",
    dragLifted:
      "Moviendo {block}. Usa las flechas arriba y abajo para reposicionar, Espacio o Intro para soltar, Esc para cancelar.",
    duplicate: "Duplicar bloque",
    delete: "Eliminar bloque",
    hiddenOnViewport: "Oculto en {viewport}",
    saveAsBlock: "Guardar como bloque",
    conditionToggle: "Alternar condición de visualización",
    comments: "Comentarios ({count})",
    lifted: "{block} levantado. Posición {position} de {total}.",
    moved: "{block} movido a la posición {position} de {total}.",
    dropped: "{block} soltado en la posición {position} de {total}.",
    cancelled: "Movimiento cancelado. {block} volvió a la posición {position}.",
  },

  // Toolbar - Section
  section: {
    dropHere: "Suelta los bloques aquí",
    columns: "Columnas",
    column1: "1 columna",
    column2: "2 columnas",
    column3: "3 columnas",
    ratio12: "Proporción 1:2",
    ratio21: "Proporción 2:1",
    borderRadius: "Radio del borde",
    wrapperEnable: "Añadir contenedor",
    stackOnMobile: "Apilar en móvil",
  },

  // Text editor link dialog
  linkDialog: {
    editLink: "Editar enlace",
    insertLink: "Insertar enlace",
    updateLink: "Actualizar enlace",
    removeLink: "Eliminar enlace",
    cancel: "Cancelar",
    urlPlaceholder: "https://example.com",
    urlLabel: "URL",
    colorLabel: "Color del enlace",
  },

  // Toolbar - Title
  title: {
    level: "Nivel de encabezado",
    heading1: "Encabezado 1 (36px)",
    heading2: "Encabezado 2 (28px)",
    heading3: "Encabezado 3 (22px)",
    heading4: "Encabezado 4 (18px)",
    fontFamily: "Familia tipográfica",
    inheritFont: "Usar fuente de la plantilla",
    color: "Color",
    align: "Alineación",
    alignLeft: "Izquierda",
    alignCenter: "Centro",
    alignRight: "Derecha",
  },

  // Emoji picker
  emoji: {
    smileys: "Emoticonos",
    gestures: "Gestos",
    objects: "Objetos",
  },

  // Toolbar - Image
  image: {
    imageUrl: "URL de la imagen",
    imageUrlPlaceholder: "https://...",
    altText: "Texto alternativo",
    altTextPlaceholder: "Descripción de la imagen",
    width: "Ancho",
    fullWidth: "Ancho completo",
    widthCustom: "Personalizado",
    height: "Altura",
    heightAuto: "Automática",
    heightCustom: "Personalizada",
    linkUrl: "URL del enlace",
    openInNewTab: "Abrir en una nueva pestaña",
    placeholderUrl: "Imagen de muestra",
    optional: "(opcional)",
    placeholderUrlPlaceholder: "https://... (solo para diseño)",
    placeholderUrlTooltip:
      "Dado que la URL de la imagen utiliza una etiqueta de combinación, puedes proporcionar una imagen real aquí para previsualizar el diseño mientras diseñas. Esto no se incluirá en el resultado final.",
    clickToAdd: "Haz clic para añadir la URL de la imagen",
    browseMedia: "Explorar archivos multimedia",
    dropToUpload: "Suelta la imagen para subirla",
    uploading: "Subiendo...",
    decorative: "Imagen decorativa",
    decorativeHint:
      "Oculto para los lectores de pantalla. Utilízalo solo para espaciadores y adornos visuales.",
  },

  // Toolbar - Video
  video: {
    videoUrl: "URL del vídeo",
    videoUrlPlaceholder: "https://youtube.com/...",
    openInNewTab: "Abrir en una nueva pestaña",
    customThumbnail: "Miniatura personalizada",
    optional: "(opcional)",
    thumbnailPlaceholder: "Generada automáticamente desde la URL del vídeo",
    altText: "Texto alternativo",
    altTextPlaceholder: "Descripción del vídeo",
    width: "Ancho",
    fullWidth: "Ancho completo",
    height: "Altura",
    heightAuto: "Automática",
    heightCustom: "Personalizada",
    placeholderUrl: "Miniatura de muestra",
    placeholderUrlPlaceholder: "https://... (solo para diseño)",
    placeholderUrlTooltip:
      "Dado que la URL del vídeo utiliza una etiqueta de combinación, puedes proporcionar una miniatura real aquí para previsualizar el diseño mientras diseñas. Esto no se incluirá en el resultado final.",
    addVideo: "Añadir una URL de vídeo",
  },

  // Toolbar - Button
  button: {
    fontFamily: "Familia tipográfica",
    inheritFont: "Usar fuente de la plantilla",
    text: "Texto",
    url: "URL",
    urlPlaceholder: "https://...",
    openInNewTab: "Abrir en una nueva pestaña",
    background: "Fondo",
    textColor: "Color del texto",
    borderRadius: "Radio del borde",
    fontSize: "Tamaño de fuente",
    width: "Ancho",
    widthAuto: "Ajustar al contenido",
    fullWidth: "Ancho completo",
    widthCustom: "Personalizado",
  },

  // Toolbar - Divider
  divider: {
    style: "Estilo",
    solid: "Sólido",
    dashed: "Discontinuo",
    dotted: "Punteado",
    color: "Color",
    thickness: "Grosor",
  },

  // Toolbar - Social Icons
  social: {
    icons: "Iconos",
    addIcon: "Añadir icono",
    addIcons: "Añadir iconos de redes sociales",
    removeIcon: "Eliminar",
    urlPlaceholder: "https://...",
    style: "Estilo",
    styleSolid: "Sólido",
    styleOutlined: "Contorneado",
    styleRounded: "Redondeado",
    styleSquare: "Cuadrado",
    styleCircle: "Círculo",
    size: "Tamaño",
    sizeSmall: "S",
    sizeMedium: "M",
    sizeLarge: "L",
    spacing: "Espaciado",
    align: "Alineación",
    platforms: {
      facebook: "Facebook",
      twitter: "X (Twitter)",
      instagram: "Instagram",
      linkedin: "LinkedIn",
      youtube: "YouTube",
      tiktok: "TikTok",
      pinterest: "Pinterest",
      email: "Correo electrónico",
      website: "Sitio web",
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
    items: "Elementos del menú",
    addItem: "Añadir elemento",
    removeItem: "Eliminar",
    text: "Texto",
    urlPlaceholder: "https://example.com",
    openInNewTab: "Abrir en una nueva pestaña",
    bold: "Negrita",
    underline: "Subrayado",
    color: "Color",
    linkColor: "Color del enlace",
    fontSize: "Tamaño de fuente",
    fontFamily: "Familia tipográfica",
    separator: "Separador",
    separatorColor: "Color del separador",
    spacing: "Espaciado",
    textAlign: "Alineación",
    addLinks: "Añadir enlaces al menú",
  },

  // Toolbar - Table
  table: {
    dimensions: "Dimensiones",
    rows: "Filas",
    columns: "Columnas",
    hasHeaderRow: "Fila de encabezado",
    headerBackgroundColor: "Fondo del encabezado",
    noHeaderBg: "Sin fondo",
    borderColor: "Color del borde",
    borderWidth: "Grosor del borde",
    cellPadding: "Relleno de la celda",
    fontFamily: "Familia tipográfica",
    fontSize: "Tamaño de fuente",
    color: "Color del texto",
    textAlign: "Alineación",
    cellPlaceholder: "Introduce el texto...",
    empty: "Añadir una tabla",
  },

  // Toolbar - Paragraph
  paragraph: {
    paragraphSpacing: "Espaciado entre párrafos",
  },

  // Toolbar - Spacer
  spacer: {
    height: "Altura",
  },

  // Toolbar - Countdown
  countdown: {
    targetDate: "Fecha límite",
    timezone: "Zona horaria",
    display: "Visualización",
    days: "Días",
    hours: "Horas",
    minutes: "Minutos",
    seconds: "Segundos",
    separator: "Separador",
    fontFamily: "Familia tipográfica",
    inheritFont: "Por defecto",
    digitFontSize: "Tamaño de los dígitos",
    digitColor: "Color de los dígitos",
    labelColor: "Color de la etiqueta",
    labelFontSize: "Tamaño de la etiqueta",
    background: "Fondo",
    labels: "Etiquetas",
    expiry: "Mensaje de expiración",
    expiredMessagePlaceholder: "Esta oferta ha expirado",
    expiredImageUrl: "URL de la imagen caducada",
    hideOnExpiry: "Ocultar al expirar",
    setDate: "Establece una fecha límite en el panel de configuración",
    hidden: "Oculto (expirado)",
  },

  // Custom Blocks
  customBlocks: {
    definitionNotFound:
      "Tipo de bloque desconocido: este bloque no está registrado",
    renderError:
      "No se pudo renderizar este bloque. Comprueba si hay errores en la plantilla del bloque.",
    fields: {
      required: "Obligatorio",
      addItem: "Añadir elemento",
      removeItem: "Eliminar",
      maxItemsReached: "Se ha alcanzado el máximo de elementos",
      minItemsRequired: "Se requiere un mínimo de {count} elementos",
    },
    toolbar: {
      noDefinition:
        "Registra este tipo de bloque en la configuración de tu SDK para editar sus propiedades",
    },
    dataSource: {
      fetchButton: "Cargar contenido",
      changeButton: "Cambiar",
      fetching: "Cargando...",
      readOnlyTooltip: "Este valor se carga desde tu fuente de datos",
      fetchError: "Error al cargar el contenido",
    },
  },

  // Toolbar - HTML
  html: {
    content: "Contenido HTML",
    preview: "Bloque HTML personalizado",
    empty: "Añadir contenido HTML en el panel",
    sanitizationHint:
      "El HTML se exporta tal cual y no se sanea — asegúrate de que el contenido sea seguro.",
  },

  // Toolbar - Common block settings
  blockSettings: {
    spacing: "Espaciado",
    padding: "Relleno",
    background: "Fondo",
    color: "Color",
    display: "Visualización",
    showOnDesktop: "Mostrar en escritorio",
    showOnMobile: "Mostrar en móvil",
    hiddenOnDevice: "Oculto en {device}",
    displayCondition: "Condición de visualización",
    selectCondition: "Seleccionar condición",
    removeCondition: "Eliminar condición",
    noCondition: "Siempre visible",
    conditionApplied: "Condición aplicada",
    customCondition: "Condición personalizada",
    customConditionLabel: "Nombre de la condición",
    customConditionBefore: "Antes (lógica de apertura)",
    customConditionAfter: "Después (lógica de cierre)",
    applyCondition: "Aplicar",
    cancelCondition: "Cancelar",
    customBadge: "Personalizado",
    restoreHiddenBlocks: "Mostrar todos los bloques ocultos",
  },

  // Template settings
  templateSettings: {
    layout: "Diseño",
    widthPreset: "Ancho predefinido",
    customWidth: "Ancho personalizado",
    appearance: "Apariencia",
    backgroundColor: "Color de fondo",
    textColor: "Color del texto",
    linkColor: "Color del enlace",
    linkUnderline: "Subrayar enlaces",
    fontFamily: "Familia tipográfica",
    preheaderText: "Texto del preencabezado",
    preheaderTextPlaceholder:
      "Texto de vista previa que se muestra después del asunto en la bandeja de entrada...",
    preheaderTextHint:
      "Este texto aparece después del asunto en las vistas previas de los clientes de correo electrónico. Admite etiquetas de combinación.",
    language: "Idioma",
    contentLocale: "Idioma del contenido",
    contentLocaleHint:
      "Código BCP 47 (por ejemplo, es, en, de). Establece el atributo lang del correo electrónico renderizado para que los lectores de pantalla pronuncien el contenido correctamente.",
    tips: "Consejos",
    tip1: "600px es el ancho estándar para las plantillas de correo electrónico",
    tip2: "Usa fuentes seguras para la web para una mejor compatibilidad",
    tip3: "Los fondos claros funcionan mejor para la legibilidad",
  },

  // Spacing control
  spacingControl: {
    lockAll: "Bloquear todos los lados",
    unlock: "Desbloquear lados",
    top: "Superior",
    right: "Derecho",
    bottom: "Inferior",
    left: "Izquierdo",
    decreaseTop: "Disminuir superior",
    increaseTop: "Aumentar superior",
    decreaseLeft: "Disminuir izquierdo",
    increaseLeft: "Aumentar izquierdo",
    decreaseRight: "Disminuir derecho",
    increaseRight: "Aumentar derecho",
    decreaseBottom: "Disminuir inferior",
    increaseBottom: "Aumentar inferior",
  },

  // Color Picker
  colorPicker: {
    pickColor: "Elegir un color",
    hexValue: "Valor de color Hex",
    notSet: "No establecido",
    clear: "Limpiar color",
    presetColors: "Colores predefinidos",
  },

  // Merge Tag
  mergeTag: {
    clickToEdit: "Haz clic para editar",
    remove: "Eliminar etiqueta de combinación",
    insert: "Insertar etiqueta de combinación",
    insertShort: "Etiqueta de combinación",
    editValue: "Editar valor de la etiqueta de combinación",
    deleteMergeTag: "Eliminar etiqueta de combinación",
    suggestionEmpty: "No hay etiquetas de combinación coincidentes",
    picker: {
      title: "Insertar etiqueta de combinación",
      searchPlaceholder: "Buscar etiquetas de combinación",
      searchAriaLabel: "Buscar etiquetas de combinación",
      noResults: "No hay etiquetas de combinación coincidentes",
      empty: "No hay etiquetas de combinación configuradas",
      otherGroup: "Otro",
      close: "Cerrar",
      groupCount: "{count}",
      sample: "Vista previa: {sample}",
    },
  },

  // Logic tags (standalone, separate from merge tags)
  logicTag: {
    insert: "Insertar lógica",
    insertShort: "Lógica",
    picker: {
      title: "Insertar lógica",
      searchPlaceholder: "Buscar etiquetas de lógica",
      searchAriaLabel: "Buscar etiquetas de lógica",
      noResults: "No hay etiquetas de lógica coincidentes",
      empty: "No hay etiquetas de lógica configuradas",
      otherGroup: "Otro",
      close: "Cerrar",
    },
  },

  // Canvas
  canvas: {
    noBlocks: "Aún no hay bloques",
    dragHint: "Comienza desde cero arrastrando bloques desde la barra lateral",
    dropHere: "Suelta aquí",
    aiHintChat: "o deja que",
    aiHintChatSuffix: "genere una plantilla completa para ti en segundos",
    aiHintDesign:
      "¿Tienes un diseño existente? Sube una captura de pantalla, imagen o PDF y",
    aiHintDesignSuffix: "lo recreará instantáneamente",
  },

  // Sidebar
  savedBlocks: {
    title: "Bloques guardados",
    saveAsBlock: "Guardar como bloque",
    name: "Nombre",
    namePlaceholder: "p. ej. Encabezado, Pie de página, CTA...",
    save: "Guardar bloque",
    saving: "Guardando...",
    cancel: "Cancelar",
    empty: "Aún no hay bloques guardados",
    emptyHint: "Guarda bloques de tus plantillas para reutilizarlos más tarde.",
    noResults: "Ningún bloque guardado coincide con tu búsqueda",
    search: "Buscar bloques guardados...",
    loading: "Cargando bloques guardados…",
    category: "Categoría",
    categoryPlaceholder: "p. ej. Cabeceras, Promociones... (opcional)",
    allCategories: "Todas las categorías",
    filterByCategory: "Filtrar por categoría",
    insert: "Insertar",
    rename: "Cambiar nombre",
    delete: "Eliminar",
    deleteConfirm: "¿Eliminar este bloque guardado?",
    blockCount: "{count} bloque(s)",
    browse: "Explorar bloques guardados",
    selectToPreview: "Selecciona un bloque guardado para previsualizarlo",
    insertAtBeginning: "Al principio",
    insertAfterBlock: "Después de {block}",
    insertAtEnd: "Al final",
    insertPosition: "Posición de inserción",
    close: "Cerrar",
    pickToolbar: "Selección de bloque guardado",
    pickCount: "{count} bloque(s) seleccionado(s)",
    pickHint: "Haz clic en los bloques para añadirlos o quitarlos",
    savingCount: "Guardando {count} bloque(s):",
    reorderHint:
      "Arrastra para reordenar: los bloques se guardan en este orden",
    reorderHandle: "Reordenar {block}, posición {position} de {total}",
    reorderAnnouncement: "{block} movido a la posición {position} de {total}",
    expand: "Expandir",
    collapse: "Contraer",
    expandPreview: "Expandir la vista previa de {block}",
    collapsePreview: "Contraer la vista previa de {block}",
  },
  comments: {
    button: "Comentarios",
    title: "Comentarios",
    placeholder: "Escribe un comentario...",
    replyPlaceholder: "Escribe una respuesta...",
    reply: "Responder",
    resolve: "Resolver",
    unresolve: "Reabrir",
    delete: "Eliminar",
    edit: "Editar",
    cancel: "Cancelar",
    save: "Guardar",
    noComments: "Aún no hay comentarios",
    noCommentsHint:
      "Inicia una conversación añadiendo un comentario a la plantilla o a un bloque concreto.",
    deleteConfirm: "¿Eliminar este comentario?",
    filterAll: "Todos",
    filterUnresolved: "Sin resolver",
    filterBlock: "Este bloque",
    jumpToBlock: "Bloque",
    ownedByYou: "Tú",
    edited: "editado",
    resolvedBy: "Resuelto por {name}",
    replyOne: "{count} respuesta",
    replyMany: "{count} respuestas",
    missingBlock: "Bloque no encontrado",
    saveTemplateFirst: "Guarda la plantilla antes de comentar en este bloque.",
  },
  versionHistory: {
    tooltip: "Historial de versiones",
    dropdownTitle: "Historial de versiones",
    empty: "Todavía no hay versiones",
    auto: "auto",
    olderVersion: "Versión anterior",
    newerVersion: "Versión más reciente",
  },
  versionPreview: {
    message: "Estás viendo una versión anterior de esta plantilla.",
    cancel: "Cancelar",
    restore: "Restaurar esta versión",
    restoreConfirm: {
      title: "¿Restaurar esta versión?",
      unsavedWithSave:
        "Tienes cambios sin guardar. Guárdalos primero y se conservarán en el historial; si restauras sin guardar, se perderán.",
      unsavedNoSave:
        "Tienes cambios sin guardar y no hay dónde guardarlos. Al restaurar esta versión se perderán.",
      saveAndRestore: "Guardar y restaurar",
      restoreAnyway: "Restaurar de todos modos",
      cancel: "Cancelar",
    },
  },
  previewResolution: {
    resolving: "Resolviendo la vista previa…",
    failed:
      "No se pudo resolver la vista previa; se muestra la plantilla sin resolver.",
    hint: "La vista previa usa datos resueltos por tu backend.",
  },
  mergeTagPreview: {
    label: "Vista de etiquetas de combinación",
    sample: "Ejemplo",
    labelView: "Etiqueta",
  },
  testEmail: {
    title: "Enviar correo de prueba",
    recipientLabel: "Destinatario",
    recipientPlaceholder: "tu@ejemplo.com",
    invalidAddress: "Introduce una dirección de correo válida.",
    preview: "Vista previa",
    previewHint:
      "Las etiquetas de combinación se muestran sin resolver — tu backend las rellena.",
    previewHintSample:
      "Las etiquetas de combinación muestran valores de ejemplo; tu backend inserta los datos reales.",
    recipientNotAllowed:
      "Esa dirección no está en la lista de destinatarios permitidos.",
    send: "Enviar",
    sending: "Enviando...",
    cancel: "Cancelar",
    success: "Correo de prueba enviado correctamente",
    button: "Prueba",
  },
  sidebarNav: {
    browseSavedBlocks: "Explorar bloques guardados",
    palette: "Paleta de bloques",
    insertBlock: "Insertar bloque {block}",
  },

  // Landmark region labels for assistive technology
  landmarks: {
    canvas: "Lienzo del correo electrónico",
    blockToolbar: "Propiedades del bloque",
    rightSidebar: "Propiedades del bloque y configuración de la plantilla",
    reorderAnnouncements: "Anuncios de reordenación de bloques",
  },

  // Design Reference (cloud)
  errors: {
    editorLoading: "Cargando el editor...",
    editorLoadFailed: "Error al cargar el editor.",
    retry: "Reintentar",
  },

  issues: {
    panelTitle: "Problemes",
    panelTabLabel: "Problemes",
    groupErrors: "Errores",
    groupWarnings: "Advertencias",
    groupInfo: "Información",
    jump: "Saltar al bloque",
    fix: "Corregir",
    emptyState: "Sin problemas, todo se ve bien.",
    badgeError: "Tiene errores",
    badgeWarning: "Tiene advertencias",
    issueCountTooltip: "{count} problema(s)",
  },

  smallScreen: {
    title: "Se requiere una pantalla más grande",
    message:
      "El editor necesita más espacio del que ofrece esta pantalla. Ábrelo en una tableta o computadora de escritorio para comenzar a editar.",
  },
};

export default es;
