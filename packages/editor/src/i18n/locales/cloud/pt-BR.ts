import type en from "./en";

const ptBR: typeof en = {
  // Loading
  loading: {
    initializing: "Inicializando...",
  },

  // Error
  error: {
    title: "Algo deu errado",
    defaultMessage:
      "O editor não conseguiu conectar ao Templatical. Verifique sua conexão de rede e tente novamente.",
    authFailed: "Autenticação falhou. Verifique suas credenciais.",
    templateNotFound:
      "O template solicitado não foi encontrado. Verifique se o ID do template está correto.",
    retry: "Tentar novamente",
  },

  // Header
  header: {
    title: "Templatical",
    unsaved: "Não salvo",
    saving: "Salvando...",
    saved: "Salvo",
    saveFailed: "Falha ao salvar",
    save: "Salvar",
    templatesUsed: "{used}/{max} templates usados",
  },

  // Snapshot preview banner
  snapshotPreview: {
    message: "Você está visualizando uma versão anterior deste template.",
    cancel: "Cancelar",
    restore: "Restaurar este snapshot",
  },

  // Snapshot history (cloud)
  snapshotHistory: {
    tooltip: "Histórico de versões",
    dropdownTitle: "Histórico de versões",
    noSnapshots: "Nenhuma versão ainda",
    auto: "auto",
    justNow: "Agora mesmo",
    minutesAgo: "há {minutes}m",
    hoursAgo: "há {hours}h",
    daysAgo: "há {days}d",
    olderSnapshot: "Versão anterior",
    newerSnapshot: "Versão mais recente",
  },

  // Test Email (cloud)
  testEmail: {
    title: "Enviar email de teste",
    recipientLabel: "Destinatário",
    send: "Enviar",
    sending: "Enviando...",
    cancel: "Cancelar",
    success: "Email de teste enviado com sucesso",
    button: "Testar",
  },

  // AI Rewrite (cloud)
  aiRewrite: {
    title: "Reescrever com IA",
    tone: "Tom",
    length: "Comprimento",
    clarity: "Clareza",
    professional: "Profissional",
    casual: "Informal",
    friendly: "Amigável",
    urgent: "Urgente",
    persuasive: "Persuasivo",
    shorter: "Mais curto",
    longer: "Mais longo",
    summarize: "Resumir",
    simplify: "Simplificar",
    fixGrammar: "Corrigir gramática",
    improveReadability: "Melhorar legibilidade",
    customInstruction: "Instrução personalizada",
    customPlaceholder: "Descreva como reescrever...",
    rewrite: "Reescrever",
    rewriting: "Reescrevendo...",
    undo: "Desfazer",
    redo: "Refazer",
    refine: "Aprimorar",
    error: "Falha ao reescrever o texto",
  },

  // AI Chat (cloud)
  aiChat: {
    title: "Assistente de IA",
    button: "IA",
    inputPlaceholder: "Descreva seu template de email...",
    send: "Enviar",
    generating: "Gerando...",
    applied: "Alterações aplicadas ao template.",
    applyFailed: "Não foi possível aplicar as alterações. Tente novamente.",
    revert: "Reverter alterações",
    reapply: "Reaplicar",
    error: "Falha ao gerar template",
    clear: "Limpar conversa",
    placeholder:
      "Descreva o template de email que você quer criar, ou peça para modificar o atual.",
    loadingHistory: "Carregando conversa...",
  },

  // Template Scoring (cloud)
  scoring: {
    button: "Avaliar",
    title: "Pontuação do Template",
    rescore: "Reavaliar",
    scoring: "Analisando template...",
    overallScore: "Pontuação geral",
    categories: {
      spam: "Risco de spam",
      readability: "Legibilidade",
      accessibility: "Acessibilidade",
      bestPractices: "Boas práticas",
    },
    severity: {
      high: "Alto",
      medium: "Médio",
      low: "Baixo",
    },
    fix: "Corrigir com IA",
    fixing: "Corrigindo...",
    fixed: "Corrigido",
    findings: "achados",
    noFindings: "Nenhum problema encontrado",
    error: "Falha ao analisar o template",
    fixError: "Falha ao aplicar correção",
    emptyState:
      "Avalie seu template para obter feedback acionável sobre risco de spam, legibilidade, acessibilidade e melhores práticas.",
  },

  // AI Feature Menu (cloud)
  aiMenu: {
    aiAssistant: "Assistente de IA",
    aiAssistantDesc: "Converse com a IA para criar ou modificar seu template",
    designToTemplate: "Design para Template",
    designToTemplateDesc: "Gerar um template a partir de uma imagem ou PDF",
    templateScore: "Pontuação do Template",
    templateScoreDesc: "Analisar qualidade, risco de spam e acessibilidade",
    disclaimer: "A IA pode errar. Verifique antes de aprovar.",
  },

  // Comments (cloud)
  comments: {
    title: "Comentários",
    placeholder: "Escreva um comentário...",
    replyPlaceholder: "Escreva uma resposta...",
    reply: "Responder",
    resolve: "Resolver",
    unresolve: "Reabrir",
    resolved: "Resolvido",
    delete: "Excluir",
    edit: "Editar",
    cancel: "Cancelar",
    save: "Salvar",
    noComments: "Nenhum comentário ainda",
    noCommentsHint:
      "Inicie uma conversa adicionando um comentário ao template ou a um bloco específico.",
    addComment: "Adicionar comentário",
    deleteConfirm: "Excluir este comentário?",
    filterAll: "Todos",
    filterUnresolved: "Não resolvidos",
    filterBlock: "Este bloco",
    ownedByYou: "Você",
    edited: "editado",
    resolvedBy: "Resolvido por {name}",
    replyOne: "{count} resposta",
    replyMany: "{count} respostas",
    missingBlock: "Bloco ausente",
    saveTemplateFirst: "Salve o template antes de comentar neste bloco.",
    button: "Comentários",
  },

  // Collaboration (cloud)
  collaboration: {
    connected: "Modo colaboração ativo",
    disconnected: "Colaboração desconectada",
    reconnecting: "Reconectando...",
    blockLockedBy: "Editando por {name}",
    usersOnline: "{count} usuários online",
  },

  // Saved Modules (cloud)
  modules: {
    title: "Módulos salvos",
    saveAsModule: "Salvar como módulo",
    moduleName: "Nome do módulo",
    moduleNamePlaceholder: "ex.: Cabeçalho, Rodapé, CTA...",
    selectBlocks: "Selecionar blocos",
    save: "Salvar módulo",
    saving: "Salvando...",
    cancel: "Cancelar",
    noModules: "Nenhum módulo salvo ainda",
    noModulesHint: "Salve blocos dos seus templates para reutilizá‑los depois.",
    search: "Buscar módulos...",
    insert: "Inserir",
    delete: "Excluir",
    deleteConfirm: "Excluir este módulo?",
    blockCount: "{count} bloco(s)",
    browse: "Procurar módulos",
    selectToPreview: "Selecione um módulo para visualizar",
    insertAtBeginning: "No início",
    insertAfterBlock: "Após {block}",
    insertAtEnd: "No fim",
    insertPosition: "Posição de inserção",
    close: "Fechar",
  },

  // Design Reference (cloud)
  designReference: {
    title: "Referência de design",
    button: "Design",
    uploadImage: "Enviar imagem",
    uploadPdf: "Enviar PDF",
    dropHint: "Solte um arquivo aqui ou clique para procurar",
    acceptedImages: "PNG, JPG, WebP (máx 10MB)",
    acceptedPdf: "PDF (máx 10MB)",
    promptLabel: "Instruções (opcional)",
    promptPlaceholder:
      "Descreva ajustes ou preferências para o template gerado...",
    generate: "Gerar a partir do design",
    generating: "Analisando o design e gerando template...",
    replaceWarning:
      "Gerar a partir de um design substituirá o conteúdo existente do template.",
    replaceConfirm: "Substituir e gerar",
    replaceCancel: "Cancelar",
    error: "Falha ao gerar template a partir do design",
    fileTooLarge: "Arquivo muito grande. O tamanho máximo é 10MB.",
    invalidFileType:
      "Este tipo de arquivo não é suportado. Envie PNG, JPG, WebP ou PDF.",
  },
};

export default ptBR;
