import type en from "./en";

const ptBR: typeof en = {
  // Footer (OSS only)
  footer: {
    poweredBy: "Desenvolvido por",
    openSource: "Código Aberto",
  },

  // History (undo/redo)
  history: {
    undo: "Desfazer",
    redo: "Refazer",
    collabWarning: "Desfazer pode afetar alterações recentes de colaboradores",
  },

  // Viewport toggle
  viewport: {
    label: "Viewport",
    desktop: "Desktop",
    tablet: "Tablet",
    mobile: "Mobile",
  },

  // Dark mode preview
  darkMode: {
    enable: "Visualizar Modo Escuro",
    disable: "Visualizar Modo Claro",
  },

  // Preview mode
  previewMode: {
    enable: "Modo de Pré-visualização",
    disable: "Sair da Pré-visualização",
  },

  // Sidebar - Block types
  blocks: {
    section: "Seção",
    image: "Imagem",
    title: "Título",
    paragraph: "Parágrafo",
    button: "Botão",
    divider: "Divisor",
    video: "Vídeo",
    social: "Social",
    spacer: "Espaçador",
    html: "HTML",
    menu: "Menu",
    table: "Tabela",
    countdown: "Contador",
  },

  // Right sidebar
  sidebar: {
    content: "Conteúdo",
    settings: "Configurações",
    noSelection: "Nenhum elemento selecionado",
    noSelectionHint: "Selecione um bloco na área para editá‑lo",
  },

  // Toolbar - Common
  toolbar: {
    duplicate: "Duplicar",
    delete: "Excluir",
  },

  // Title editor toolbar
  titleEditor: {
    toolbar: "Formatação do título",
    bold: "Negrito (Ctrl+B)",
    italic: "Itálico (Ctrl+I)",
    addLink: "Adicionar link",
  },

  // Paragraph editor toolbar
  paragraphEditor: {
    toolbar: "Formatação de texto",
    bold: "Negrito (Ctrl+B)",
    italic: "Itálico (Ctrl+I)",
    underline: "Sublinhado (Ctrl+U)",
    strikethrough: "Riscado",
    subscript: "Subscrito",
    superscript: "Sobrescrito",
    addLink: "Adicionar link",
    bulletList: "Lista com marcadores",
    numberedList: "Lista numerada",
    alignLeft: "Alinhar à esquerda",
    alignCenter: "Centralizar",
    alignRight: "Alinhar à direita",
    clearFormatting: "Limpar formatação",
    insertEmoji: "Inserir emoji",
    fontFamily: "Fonte",
    defaultFont: "Padrão",
    fontSize: "Tamanho da fonte",
    defaultSize: "Padrão",
    textColor: "Cor do texto",
    highlightColor: "Cor de destaque",
    lineHeight: "Altura da linha",
    letterSpacing: "Espaçamento entre letras",
    emojiItemLabel: "Inserir emoji {emoji}",
    closeEmojiPicker: "Fechar seletor de emoji",
  },

  // Block actions (BlockWrapper)
  blockActions: {
    drag: "Arraste para reordenar, ou pressione Espaço para mover com o teclado",
    dragLifted:
      "Movendo {block}. Use as teclas ↑ e ↓ para reposicionar, Espaço ou Enter para soltar, Esc para cancelar.",
    duplicate: "Duplicar bloco",
    delete: "Excluir bloco",
    hiddenOnViewport: "Oculto em {viewport}",
    saveAsModule: "Salvar como Módulo",
    conditionToggle: "Alternar condição de exibição",
    comments: "Comentários ({count})",
    lifted: "{block} levantado. Posição {position} de {total}.",
    moved: "{block} movido para a posição {position} de {total}.",
    dropped: "{block} solto na posição {position} de {total}.",
    cancelled:
      "Movimento cancelado. {block} retornou para a posição {position}.",
  },

  // Toolbar - Section
  section: {
    dropHere: "Solte blocos aqui",
    columns: "Colunas",
    column1: "1 Coluna",
    column2: "2 Colunas",
    column3: "3 Colunas",
    ratio12: "Proporção 1:2",
    ratio21: "Proporção 2:1",
  },

  // Text editor link dialog
  linkDialog: {
    editLink: "Editar link",
    insertLink: "Inserir link",
    updateLink: "Atualizar link",
    removeLink: "Remover link",
    cancel: "Cancelar",
    urlPlaceholder: "https://example.com",
    urlLabel: "URL",
  },

  // Toolbar - Title
  title: {
    level: "Nível do título",
    heading1: "Título 1 (36px)",
    heading2: "Título 2 (28px)",
    heading3: "Título 3 (22px)",
    heading4: "Título 4 (18px)",
    fontFamily: "Fonte",
    inheritFont: "Usar fonte do template",
    color: "Cor",
    align: "Alinhamento",
    alignLeft: "Esquerda",
    alignCenter: "Centralizado",
    alignRight: "Direita",
  },

  // Emoji picker
  emoji: {
    smileys: "Sorrisos",
    gestures: "Gestos",
    objects: "Objetos",
  },

  // Toolbar - Image
  image: {
    imageUrl: "URL da imagem",
    imageUrlPlaceholder: "https://...",
    altText: "Texto alternativo",
    altTextPlaceholder: "Descrição da imagem",
    width: "Largura",
    fullWidth: "Largura total",
    linkUrl: "URL do link",
    openInNewTab: "Abrir em nova aba",
    placeholderUrl: "Imagem substituta",
    placeholderUrlPlaceholder: "https://... (apenas para design)",
    placeholderUrlTooltip:
      "Como a URL da imagem usa um marcador, você pode fornecer uma imagem real aqui para visualizar o layout durante o design. Isso não é incluído no resultado final.",
    clickToAdd: "Clique para adicionar URL da imagem",
    browseMedia: "Procurar mídia",
  },

  // Toolbar - Video
  video: {
    videoUrl: "URL do vídeo",
    videoUrlPlaceholder: "https://youtube.com/...",
    youtube: "YouTube",
    vimeo: "Vimeo",
    detected: "Vídeo detectado — a miniatura será gerada automaticamente",
    openInNewTab: "Abrir em nova aba",
    customThumbnail: "Miniatura personalizada",
    optional: "(opcional)",
    thumbnailPlaceholder: "Auto-gerada a partir do URL do vídeo",
    altText: "Texto alternativo",
    altTextPlaceholder: "Descrição do vídeo",
    width: "Largura",
    fullWidth: "Largura total",
    placeholderUrl: "Miniatura substituta",
    placeholderUrlPlaceholder: "https://... (apenas para design)",
    placeholderUrlTooltip:
      "Como a URL da miniatura usa um marcador, você pode fornecer uma miniatura real aqui para visualizar o layout durante o design. Isso não é incluído no resultado final.",
    addVideo: "Adicionar URL do vídeo",
  },

  // Toolbar - Button
  button: {
    fontFamily: "Fonte",
    inheritFont: "Usar fonte do template",
    text: "Texto",
    url: "URL",
    urlPlaceholder: "https://...",
    openInNewTab: "Abrir em nova aba",
    background: "Fundo",
    textColor: "Cor do texto",
    borderRadius: "Raio da borda",
    fontSize: "Tamanho da fonte",
  },

  // Toolbar - Divider
  divider: {
    style: "Estilo",
    solid: "Sólido",
    dashed: "Tracejado",
    dotted: "Pontilhado",
    color: "Cor",
    thickness: "Espessura",
  },

  // Toolbar - Social Icons
  social: {
    icons: "Ícones",
    addIcon: "Adicionar ícone",
    addIcons: "Adicionar ícones sociais",
    removeIcon: "Remover",
    platform: "Plataforma",
    url: "URL",
    urlPlaceholder: "https://...",
    style: "Estilo",
    styleSolid: "Sólido",
    styleOutlined: "Contornado",
    styleRounded: "Arredondado",
    styleSquare: "Quadrado",
    styleCircle: "Círculo",
    size: "Tamanho",
    sizeSmall: "P",
    sizeMedium: "M",
    sizeLarge: "G",
    spacing: "Espaçamento",
    align: "Alinhamento",
    platforms: {
      facebook: "Facebook",
      twitter: "X (Twitter)",
      instagram: "Instagram",
      linkedin: "LinkedIn",
      youtube: "YouTube",
      tiktok: "TikTok",
      pinterest: "Pinterest",
      email: "Email",
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
    items: "Itens do menu",
    addItem: "Adicionar item",
    removeItem: "Remover item",
    text: "Texto",
    url: "URL",
    urlPlaceholder: "https://example.com",
    openInNewTab: "Abrir em nova aba",
    bold: "Negrito",
    underline: "Sublinhado",
    color: "Cor",
    linkColor: "Cor do link",
    fontSize: "Tamanho da fonte",
    fontFamily: "Fonte",
    separator: "Separador",
    separatorColor: "Cor do separador",
    spacing: "Espaçamento",
    textAlign: "Alinhamento",
    addLinks: "Adicionar links ao menu",
  },

  // Toolbar - Table
  table: {
    dimensions: "Dimensões",
    rows: "Linhas",
    columns: "Colunas",
    addRow: "Adicionar linha",
    removeRow: "Remover linha",
    addColumn: "Adicionar coluna",
    removeColumn: "Remover coluna",
    hasHeaderRow: "Linha de cabeçalho",
    headerBackgroundColor: "Fundo do cabeçalho",
    noHeaderBg: "Sem fundo",
    borderColor: "Cor da borda",
    borderWidth: "Largura da borda",
    cellPadding: "Padding da célula",
    fontFamily: "Fonte",
    fontSize: "Tamanho da fonte",
    color: "Cor do texto",
    textAlign: "Alinhamento",
    cellPlaceholder: "Insira o texto...",
    empty: "Adicionar uma tabela",
  },

  // Toolbar - Spacer
  spacer: {
    height: "Altura",
  },

  // Toolbar - Countdown
  countdown: {
    targetDate: "Data alvo",
    timezone: "Fuso horário",
    display: "Exibição",
    days: "Dias",
    hours: "Horas",
    minutes: "Minutos",
    seconds: "Segundos",
    separator: "Separador",
    fontFamily: "Fonte",
    inheritFont: "Padrão",
    digitFontSize: "Tamanho dos dígitos",
    digitColor: "Cor dos dígitos",
    labelColor: "Cor dos rótulos",
    labelFontSize: "Tamanho do rótulo",
    background: "Fundo",
    labels: "Rótulos",
    expiry: "Expirado",
    expiredMessagePlaceholder: "Esta oferta expirou",
    expiredImageUrl: "URL da imagem de expirado",
    hideOnExpiry: "Ocultar quando expirar",
    setDate: "Defina uma data alvo nas configurações",
    hidden: "Oculto (expirado)",
  },

  // Custom Blocks
  customBlocks: {
    definitionNotFound:
      "Tipo de bloco desconhecido — este bloco não está registrado",
    renderError:
      "Este bloco não pôde ser renderizado. Verifique o template do bloco por erros.",
    fields: {
      required: "Obrigatório",
      addItem: "Adicionar item",
      removeItem: "Remover",
      maxItemsReached: "Número máximo de itens atingido",
      minItemsRequired: "Mínimo de {count} itens exigido",
    },
    toolbar: {
      noDefinition:
        "Registre este tipo de bloco na configuração do SDK para editar suas propriedades",
    },
    dataSource: {
      fetchButton: "Carregar conteúdo",
      changeButton: "Alterar",
      fetching: "Carregando...",
      readOnlyTooltip: "Este valor é carregado da sua fonte de dados",
      fetchError: "Falha ao carregar conteúdo",
    },
  },

  // Toolbar - HTML
  html: {
    content: "Conteúdo HTML",
    preview: "Bloco HTML personalizado",
    empty: "Adicione conteúdo HTML no painel",
    sanitizationHint:
      "Scripts e elementos inseguros são removidos na exportação.",
  },

  // Toolbar - Common block settings
  blockSettings: {
    spacing: "Espaçamento",
    padding: "Padding",
    margin: "Margin",
    background: "Fundo",
    color: "Cor",
    display: "Exibição",
    showOnDesktop: "Mostrar no desktop",
    showOnTablet: "Mostrar no tablet",
    showOnMobile: "Mostrar no mobile",
    hiddenOnDevice: "Oculto em {device}",
    customCss: "CSS personalizado",
    css: "CSS",
    cssPlaceholder: "/* Estilos personalizados */",
    displayCondition: "Condição de exibição",
    selectCondition: "Selecionar condição",
    removeCondition: "Remover condição",
    noCondition: "Sempre visível",
    conditionApplied: "Condição aplicada",
    customCondition: "Condição personalizada",
    customConditionLabel: "Nome da condição",
    customConditionBefore: "Antes (lógica de abertura)",
    customConditionAfter: "Depois (lógica de fechamento)",
    applyCondition: "Aplicar",
    cancelCondition: "Cancelar",
    customBadge: "Personalizado",
    restoreHiddenBlocks: "Mostrar todos os blocos ocultos",
  },

  // Template settings
  templateSettings: {
    layout: "Layout",
    widthPreset: "Largura predefinida",
    customWidth: "Largura personalizada",
    appearance: "Aparência",
    backgroundColor: "Cor de fundo",
    fontFamily: "Fonte",
    preheaderText: "Preheader",
    preheaderTextPlaceholder:
      "Texto de pré-visualização exibido após a linha de assunto na caixa de entrada...",
    preheaderTextHint:
      "Este texto aparece após a linha de assunto nas pré-visualizações do cliente de email. Suporta placeholders.",
    tips: "Dicas",
    tip1: "600px é a largura padrão para templates de email",
    tip2: "Use fontes web‑safe para melhor compatibilidade",
    tip3: "Fundos claros funcionam melhor para legibilidade",
  },

  // Spacing control
  spacingControl: {
    lockAll: "Bloquear todos os lados",
    unlock: "Desbloquear lados",
    top: "Topo",
    right: "Direita",
    bottom: "Inferior",
    left: "Esquerda",
    decreaseTop: "Diminuir topo",
    increaseTop: "Aumentar topo",
    decreaseLeft: "Diminuir esquerda",
    increaseLeft: "Aumentar esquerda",
    decreaseRight: "Diminuir direita",
    increaseRight: "Aumentar direita",
    decreaseBottom: "Diminuir inferior",
    increaseBottom: "Aumentar inferior",
  },

  // Color Picker
  colorPicker: {
    pickColor: "Escolher cor",
    hexValue: "Valor hexadecimal",
  },

  // Merge Tag
  mergeTag: {
    clickToEdit: "Clique para editar",
    remove: "Remover placeholder",
    insert: "Inserir placeholder",
    add: "Adicionar placeholder",
    editValue: "Editar valor do placeholder",
    deleteMergeTag: "Excluir merge tag",
    suggestionEmpty: "Nenhum merge tag correspondente",
  },

  // Canvas
  canvas: {
    noBlocks: "Ainda não há blocos",
    dragHint: "Comece do zero arrastando blocos da barra lateral",
    dropHere: "Solte aqui",
    aiHintChat: "ou deixe que",
    aiHintChatSuffix: "gere um template completo para você em segundos",
    aiHintDesign:
      "Tem um design existente? Faça upload de uma captura de tela, imagem ou PDF e",
    aiHintDesignSuffix: "vai recriar instantaneamente",
  },

  // Media Library (cloud)
  mediaLibrary: {
    title: "Biblioteca de Mídia",
    searchPlaceholder: "Buscar arquivos...",
    allFiles: "Todos os arquivos",
    filterAll: "Todos os tipos",
    filterImages: "Imagens",
    filterDocuments: "Documentos",
    filterVideos: "Vídeos",
    filterAudio: "Áudio",
    newFolder: "Nova pasta",
    folderName: "Nome da pasta",
    noFiles: "Nenhum arquivo encontrado",
    dropOrClick: "Arraste arquivos aqui ou clique para enviar",
    acceptedFormats: "Imagens, PDF, Vídeo, Áudio, Documentos (máx 10MB)",
    uploading: "Enviando...",
    uploadingProgress: "Enviando {current} de {total}...",
    selectImage: "Selecionar imagem",
    selectFile: "Selecionar arquivo",
    deleteSelected: "Excluir",
    copyUrl: "Copiar URL",
    copied: "Copiado!",
    browseMedia: "Procurar Biblioteca de Mídia",
    renameFolder: "Renomear pasta",
    addSubfolder: "Adicionar subpasta",
    subfolderName: "Nome da subpasta",
    sortNewest: "Mais recentes",
    sortOldest: "Mais antigos",
    sortNameAsc: "Nome A‑Z",
    sortNameDesc: "Nome Z‑A",
    sortSizeAsc: "Menor primeiro",
    sortSizeDesc: "Maior primeiro",
    moveSelected: "Mover",
    moveToRoot: "Todos os arquivos",
    currentFolder: "(atual)",
    confirmDelete: "Excluir este arquivo?",
    renameFile: "Renomear",
    editFile: "Editar arquivo",
    fileName: "Nome do arquivo",
    altText: "Texto alternativo",
    altTextPlaceholder: "Descreva esta imagem para acessibilidade",
    saveChanges: "Salvar",
    cancel: "Cancelar",
    frequentlyUsed: "Mais usados",
    deleteWarningTitle: "Excluir arquivo",
    deleteWarningMessage:
      "Este arquivo será excluído permanentemente e não poderá ser recuperado.",
    deleteWarningUsageNote:
      "Os seguintes arquivos são usados em templates. Excluí‑los pode quebrar esses templates.",
    deleteAnyway: "Excluir arquivo",
    usedInTemplates: "Usado em {count} template(s)",
    viewGrid: "Exibir em grade",
    viewList: "Exibir em lista",
    showFolders: "Mostrar pastas",
    hideFolders: "Ocultar pastas",
    importFromUrl: "Importar por URL",
    importUrlPlaceholder: "https://example.com/image.jpg",
    import: "Importar",
    importing: "Importando...",
    importError: "Falha ao importar por URL",
    conversionLabel: "Tamanho",
    conversionOriginal: "Original",
    conversionSmall: "Pequeno (150px)",
    conversionMedium: "Médio (600px)",
    conversionLarge: "Grande (1200px)",
    replaceFile: "Substituir arquivo",
    replaceWarningTitle: "Substituir arquivo",
    replaceWarningMessage:
      "Você está prestes a substituir este arquivo. A substituição deve ter a mesma extensão ({extension}).",
    replaceWarningUsageNote:
      "Este arquivo é usado em {count} template(s). Substituí‑lo atualizará todas as referências.",
    replaceSelectFile: "Selecione o arquivo de substituição",
    replace: "Substituir",
    replacing: "Substituindo...",
    replaceError: "Falha ao substituir arquivo",
    saving: "Salvando...",
    cropAspectRatio: "Proporção",
    cropFree: "Livre",
    cropSquare: "1:1",
    cropLandscape43: "4:3",
    cropLandscape169: "16:9",
    cropOriginal: "Original",
    cropMaxWidth: "Largura máxima",
    cropMaxHeight: "Altura máxima",
    cropOutputSize: "Tamanho de saída",
    cropPixels: "px",
    cropOptional: "(opcional)",
    storageTooltip: "{used} de {total} usados ({remaining} restantes)",
  },

  // Sidebar
  sidebarNav: {
    browseModules: "Procurar módulos salvos",
    expandSidebar: "Expandir barra lateral",
    palette: "Paleta de blocos",
    insertBlock: "Inserir bloco {block}",
  },

  // Landmark region labels for assistive technology
  landmarks: {
    canvas: "Área do email",
    blockToolbar: "Barra de propriedades do bloco",
    rightSidebar: "Propriedades do bloco e configurações do template",
    reorderAnnouncements: "Anúncios de reordenação de blocos",
  },

  errors: {
    editorLoading: "Carregando editor...",
    editorLoadFailed: "Falha ao carregar o editor.",
    retry: "Tentar novamente",
  },
};

export default ptBR;
