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
    enable: "Modo de Visualização",
    disable: "Sair da Visualização",
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
    social: "Redes Sociais",
    spacer: "Espaçador",
    html: "HTML",
    menu: "Menu",
    table: "Tabela",
    countdown: "Contagem Regressiva",
  },

  // Right sidebar
  sidebar: {
    content: "Conteúdo",
    settings: "Configurações",
    noSelection: "Nenhum elemento selecionado",
    noSelectionHint: "Selecione um bloco na tela para editá-lo",
  },

  // Toolbar - Common
  toolbar: {
    duplicate: "Duplicar",
    delete: "Excluir",
  },

  // Title editor toolbar
  titleEditor: {
    toolbar: "Formatação de título",
    bold: "Negrito (Ctrl+B)",
    italic: "Itálico (Ctrl+I)",
    addLink: "Adicionar Link",
  },

  // Paragraph editor toolbar
  paragraphEditor: {
    toolbar: "Formatação de texto",
    bold: "Negrito (Ctrl+B)",
    italic: "Itálico (Ctrl+I)",
    underline: "Sublinhado (Ctrl+U)",
    strikethrough: "Tachado",
    subscript: "Subscrito",
    superscript: "Sobrescrito",
    addLink: "Adicionar Link",
    bulletList: "Lista com Marcadores",
    numberedList: "Lista Numerada",
    alignLeft: "Alinhar à Esquerda",
    alignCenter: "Centralizar",
    alignRight: "Alinhar à Direita",
    clearFormatting: "Limpar Formatação",
    insertEmoji: "Inserir Emoji",
    fontFamily: "Família da Fonte",
    defaultFont: "Padrão",
    fontSize: "Tamanho da Fonte",
    defaultSize: "Padrão",
    textColor: "Cor do Texto",
    highlightColor: "Cor de Destaque",
    lineHeight: "Altura da Linha",
    letterSpacing: "Espaçamento entre Letras",
    emojiItemLabel: "Inserir emoji {emoji}",
    closeEmojiPicker: "Fechar seletor de emojis",
  },

  // Block actions (BlockWrapper)
  blockActions: {
    drag: "Arraste para reordenar, ou pressione Espaço para mover com o teclado",
    dragLifted:
      "Movendo {block}. Use as setas para cima e para baixo para reposicionar, Espaço ou Enter para soltar, Escape para cancelar.",
    duplicate: "Duplicar bloco",
    delete: "Excluir bloco",
    hiddenOnViewport: "Oculto em {viewport}",
    saveAsModule: "Salvar como Módulo",
    conditionToggle: "Alternar condição de exibição",
    comments: "Comentários ({count})",
    lifted: "{block} levantado. Posição {position} de {total}.",
    moved: "{block} movido para a posição {position} de {total}.",
    dropped: "{block} solto na posição {position} de {total}.",
    cancelled: "Movimento cancelado. {block} retornou à posição {position}.",
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
    editLink: "Editar Link",
    insertLink: "Inserir Link",
    updateLink: "Atualizar Link",
    removeLink: "Remover Link",
    cancel: "Cancelar",
    urlPlaceholder: "https://exemplo.com",
    urlLabel: "URL",
  },

  // Toolbar - Title
  title: {
    level: "Nível do Cabeçalho",
    heading1: "Cabeçalho 1 (36px)",
    heading2: "Cabeçalho 2 (28px)",
    heading3: "Cabeçalho 3 (22px)",
    heading4: "Cabeçalho 4 (18px)",
    fontFamily: "Família da Fonte",
    inheritFont: "Usar fonte do template",
    color: "Cor",
    align: "Alinhamento",
    alignLeft: "Esquerda",
    alignCenter: "Centro",
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
    imageUrl: "URL da Imagem",
    imageUrlPlaceholder: "https://...",
    altText: "Texto Alternativo",
    altTextPlaceholder: "Descrição da imagem",
    width: "Largura",
    fullWidth: "Largura Total",
    linkUrl: "URL do Link",
    openInNewTab: "Abrir em nova aba",
    placeholderUrl: "Imagem de Espaço Reservado",
    placeholderUrlPlaceholder: "https://... (somente em design)",
    placeholderUrlTooltip:
      "Como a URL da imagem usa uma merge tag, você pode fornecer uma imagem real aqui para visualizar o layout durante o design. Isso não é incluído na saída final.",
    clickToAdd: "Clique para adicionar a URL da imagem",
    browseMedia: "Explorar Mídia",
    decorative: "Imagem decorativa",
    decorativeHint:
      "Oculta para leitores de tela. Use apenas para espaçadores e elementos visuais.",
  },

  // Toolbar - Video
  video: {
    videoUrl: "URL do Vídeo",
    videoUrlPlaceholder: "https://youtube.com/...",
    youtube: "YouTube",
    vimeo: "Vimeo",
    detected: "Vídeo detectado — a miniatura será gerada automaticamente",
    openInNewTab: "Abrir em nova aba",
    customThumbnail: "Miniatura Personalizada",
    optional: "(opcional)",
    thumbnailPlaceholder: "Gerada automaticamente a partir da URL do vídeo",
    altText: "Texto Alternativo",
    altTextPlaceholder: "Descrição do vídeo",
    width: "Largura",
    fullWidth: "Largura Total",
    placeholderUrl: "Miniatura de Espaço Reservado",
    placeholderUrlPlaceholder: "https://... (somente em design)",
    placeholderUrlTooltip:
      "Como a URL do vídeo usa uma merge tag, você pode fornecer uma miniatura real aqui para visualizar o layout durante o design. Isso não é incluído na saída final.",
    addVideo: "Adicionar URL de vídeo",
  },

  // Toolbar - Button
  button: {
    fontFamily: "Família da Fonte",
    inheritFont: "Usar fonte do template",
    text: "Texto",
    url: "URL",
    urlPlaceholder: "https://...",
    openInNewTab: "Abrir em nova aba",
    background: "Plano de Fundo",
    textColor: "Cor do Texto",
    borderRadius: "Arredondamento das Bordas",
    fontSize: "Tamanho da Fonte",
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
    addIcon: "Adicionar Ícone",
    addIcons: "Adicionar ícones de redes sociais",
    removeIcon: "Remover",
    platform: "Plataforma",
    url: "URL",
    urlPlaceholder: "https://...",
    style: "Estilo",
    styleSolid: "Sólido",
    styleOutlined: "Contornado",
    styleRounded: "Arredondado",
    styleSquare: "Quadrado",
    styleCircle: "Circular",
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
      email: "E-mail",
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
    items: "Itens do Menu",
    addItem: "Adicionar Item",
    removeItem: "Remover",
    text: "Texto",
    url: "URL",
    urlPlaceholder: "https://exemplo.com",
    openInNewTab: "Abrir em nova aba",
    bold: "Negrito",
    underline: "Sublinhado",
    color: "Cor",
    linkColor: "Cor do Link",
    fontSize: "Tamanho da Fonte",
    fontFamily: "Família da Fonte",
    separator: "Separador",
    separatorColor: "Cor do Separador",
    spacing: "Espaçamento",
    textAlign: "Alinhamento",
    addLinks: "Adicionar links ao menu",
  },

  // Toolbar - Table
  table: {
    dimensions: "Dimensões",
    rows: "Linhas",
    columns: "Colunas",
    addRow: "Adicionar Linha",
    removeRow: "Remover Linha",
    addColumn: "Adicionar Coluna",
    removeColumn: "Remover Coluna",
    hasHeaderRow: "Linha de cabeçalho",
    headerBackgroundColor: "Plano de Fundo do Cabeçalho",
    noHeaderBg: "Sem plano de fundo",
    borderColor: "Cor da Borda",
    borderWidth: "Espessura da Borda",
    cellPadding: "Preenchimento da Célula",
    fontFamily: "Família da Fonte",
    fontSize: "Tamanho da Fonte",
    color: "Cor do Texto",
    textAlign: "Alinhamento",
    cellPlaceholder: "Digite o texto...",
    empty: "Adicionar uma tabela",
  },

  // Toolbar - Spacer
  spacer: {
    height: "Altura",
  },

  // Toolbar - Countdown
  countdown: {
    targetDate: "Data Alvo",
    timezone: "Fuso Horário",
    display: "Exibição",
    days: "Dias",
    hours: "Horas",
    minutes: "Minutos",
    seconds: "Segundos",
    separator: "Separador",
    fontFamily: "Família da Fonte",
    inheritFont: "Padrão",
    digitFontSize: "Tamanho dos Dígitos",
    digitColor: "Cor dos Dígitos",
    labelColor: "Cor dos Rótulos",
    labelFontSize: "Tamanho dos Rótulos",
    background: "Plano de Fundo",
    labels: "Rótulos",
    expiry: "Mensagem de Expiração",
    expiredMessagePlaceholder: "Esta oferta expirou",
    expiredImageUrl: "URL da Imagem de Expiração",
    hideOnExpiry: "Ocultar ao expirar",
    setDate: "Defina uma data alvo no painel de configurações",
    hidden: "Oculto (expirado)",
  },

  // Custom Blocks
  customBlocks: {
    definitionNotFound:
      "Tipo de bloco desconhecido — este bloco não está registrado",
    renderError:
      "Este bloco não pôde ser renderizado. Verifique se há erros no template do bloco.",
    fields: {
      required: "Obrigatório",
      addItem: "Adicionar item",
      removeItem: "Remover",
      maxItemsReached: "Número máximo de itens atingido",
      minItemsRequired: "Mínimo de {count} itens obrigatório",
    },
    toolbar: {
      noDefinition:
        "Registre este tipo de bloco na sua configuração do SDK para editar suas propriedades",
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
      "Scripts e elementos não seguros são removidos na exportação.",
  },

  // Toolbar - Common block settings
  blockSettings: {
    spacing: "Espaçamento",
    padding: "Preenchimento",
    margin: "Margem",
    background: "Plano de Fundo",
    color: "Cor",
    display: "Exibição",
    showOnDesktop: "Mostrar no desktop",
    showOnTablet: "Mostrar no tablet",
    showOnMobile: "Mostrar no mobile",
    hiddenOnDevice: "Oculto em {device}",
    customCss: "CSS Personalizado",
    css: "CSS",
    cssPlaceholder: "/* Estilos personalizados */",
    displayCondition: "Condição de Exibição",
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
    widthPreset: "Largura Predefinida",
    customWidth: "Largura Personalizada",
    appearance: "Aparência",
    backgroundColor: "Cor de Fundo",
    fontFamily: "Família da Fonte",
    preheaderText: "Texto de Pré-cabeçalho",
    preheaderTextPlaceholder:
      "Texto de prévia exibido após o assunto na caixa de entrada...",
    preheaderTextHint:
      "Este texto aparece após o assunto nas pré-visualizações dos clientes de e-mail. Suporta merge tags.",
    language: "Idioma",
    contentLocale: "Idioma do conteúdo",
    contentLocaleHint:
      "Código BCP 47 (ex.: en, de, pt-BR). Define o atributo lang do e-mail renderizado para que leitores de tela pronunciem o conteúdo corretamente.",
    tips: "Dicas",
    tip1: "600px é a largura padrão para templates de e-mail",
    tip2: "Use fontes seguras para web para melhor compatibilidade",
    tip3: "Fundos claros funcionam melhor para legibilidade",
  },

  // Spacing control
  spacingControl: {
    lockAll: "Travar todos os lados",
    unlock: "Destravar lados",
    top: "Superior",
    right: "Direito",
    bottom: "Inferior",
    left: "Esquerdo",
    decreaseTop: "Diminuir superior",
    increaseTop: "Aumentar superior",
    decreaseLeft: "Diminuir esquerdo",
    increaseLeft: "Aumentar esquerdo",
    decreaseRight: "Diminuir direito",
    increaseRight: "Aumentar direito",
    decreaseBottom: "Diminuir inferior",
    increaseBottom: "Aumentar inferior",
  },

  // Color Picker
  colorPicker: {
    pickColor: "Escolher uma cor",
    hexValue: "Valor hexadecimal da cor",
  },

  // Merge Tag
  mergeTag: {
    clickToEdit: "Clique para editar",
    remove: "Remover merge tag",
    insert: "Inserir merge tag",
    add: "Adicionar merge tag",
    editValue: "Editar valor da merge tag",
    deleteMergeTag: "Excluir merge tag",
    suggestionEmpty: "Nenhuma merge tag correspondente",
  },

  // Canvas
  canvas: {
    noBlocks: "Nenhum bloco ainda",
    dragHint: "Comece do zero arrastando blocos da barra lateral",
    dropHere: "Solte aqui",
    aiHintChat: "ou deixe a",
    aiHintChatSuffix: "gerar um template completo para você em segundos",
    aiHintDesign:
      "Tem um design existente? Envie uma captura de tela, imagem ou PDF e a",
    aiHintDesignSuffix: "recriará instantaneamente",
  },

  // Media Library (cloud)
  mediaLibrary: {
    title: "Biblioteca de Mídia",
    searchPlaceholder: "Buscar arquivos...",
    allFiles: "Todos os Arquivos",
    filterAll: "Todos os Tipos",
    filterImages: "Imagens",
    filterDocuments: "Documentos",
    filterVideos: "Vídeos",
    filterAudio: "Áudio",
    newFolder: "Nova Pasta",
    folderName: "Nome da pasta",
    noFiles: "Nenhum arquivo encontrado",
    dropOrClick: "Solte arquivos aqui ou clique para enviar",
    acceptedFormats: "Imagens, PDF, Vídeo, Áudio, Documentos (máx. 10MB)",
    uploading: "Enviando...",
    uploadingProgress: "Enviando {current} de {total}...",
    selectImage: "Selecionar Imagem",
    selectFile: "Selecionar Arquivo",
    deleteSelected: "Excluir",
    copyUrl: "Copiar URL",
    copied: "Copiado!",
    browseMedia: "Explorar Biblioteca de Mídia",
    renameFolder: "Renomear pasta",
    addSubfolder: "Adicionar subpasta",
    subfolderName: "Nome da subpasta",
    sortNewest: "Mais Recentes",
    sortOldest: "Mais Antigos",
    sortNameAsc: "Nome A-Z",
    sortNameDesc: "Nome Z-A",
    sortSizeAsc: "Menores Primeiro",
    sortSizeDesc: "Maiores Primeiro",
    moveSelected: "Mover",
    moveToRoot: "Todos os Arquivos",
    currentFolder: "(atual)",
    confirmDelete: "Excluir este arquivo?",
    renameFile: "Renomear",
    editFile: "Editar Arquivo",
    fileName: "Nome do arquivo",
    altText: "Texto Alternativo",
    altTextPlaceholder: "Descreva esta imagem para acessibilidade",
    saveChanges: "Salvar",
    cancel: "Cancelar",
    frequentlyUsed: "Usados Frequentemente",
    deleteWarningTitle: "Excluir Arquivo",
    deleteWarningMessage:
      "Este arquivo será excluído permanentemente e não poderá ser recuperado.",
    deleteWarningUsageNote:
      "Os arquivos a seguir estão sendo usados em templates. Excluí-los pode quebrar esses templates.",
    deleteAnyway: "Excluir arquivo",
    usedInTemplates: "Usado em {count} template(s)",
    viewGrid: "Visualização em grade",
    viewList: "Visualização em lista",
    showFolders: "Mostrar pastas",
    hideFolders: "Ocultar pastas",
    importFromUrl: "Importar de URL",
    importUrlPlaceholder: "https://exemplo.com/imagem.jpg",
    import: "Importar",
    importing: "Importando...",
    importError: "Falha ao importar da URL",
    conversionLabel: "Tamanho",
    conversionOriginal: "Original",
    conversionSmall: "Pequeno (150px)",
    conversionMedium: "Médio (600px)",
    conversionLarge: "Grande (1200px)",
    replaceFile: "Substituir Arquivo",
    replaceWarningTitle: "Substituir Arquivo",
    replaceWarningMessage:
      "Você está prestes a substituir este arquivo. O substituto deve ter a mesma extensão ({extension}).",
    replaceWarningUsageNote:
      "Este arquivo é usado em {count} template(s). Substituí-lo atualizará todas as referências.",
    replaceSelectFile: "Selecionar arquivo substituto",
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
    cropMaxWidth: "Largura Máxima",
    cropMaxHeight: "Altura Máxima",
    cropOutputSize: "Tamanho de Saída",
    cropPixels: "px",
    cropOptional: "(opcional)",
    storageTooltip: "{used} de {total} usados ({remaining} restantes)",
  },

  // Sidebar
  sidebarNav: {
    browseModules: "Explorar módulos salvos",
    expandSidebar: "Expandir barra lateral de blocos",
    palette: "Paleta de blocos",
    insertBlock: "Inserir bloco {block}",
  },

  // Landmark region labels for assistive technology
  landmarks: {
    canvas: "Tela do e-mail",
    blockToolbar: "Propriedades do bloco",
    rightSidebar: "Propriedades do bloco e configurações do template",
    reorderAnnouncements: "Anúncios de reordenação de blocos",
  },

  // Design Reference (cloud)
  errors: {
    editorLoading: "Carregando editor...",
    editorLoadFailed: "Falha ao carregar o editor.",
    retry: "Tentar novamente",
  },

  issues: {
    panelTitle: "Problemas",
    panelTabLabel: "Problemas",
    groupErrors: "Erros",
    groupWarnings: "Avisos",
    groupInfo: "Informações",
    jump: "Ir para o bloco",
    fix: "Corrigir",
    emptyState: "Nenhum problema — tudo certo.",
    badgeError: "Possui erros",
    badgeWarning: "Possui avisos",
    issueCountTooltip: "{count} problema(s)",
  },
};

export default ptBR;
