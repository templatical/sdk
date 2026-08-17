import type en from "./en";

const ptBR: typeof en = {
  loading: {
    initializing: "Inicializando...",
  },
  error: {
    title: "Algo deu errado",
    defaultMessage:
      "O editor não conseguiu se conectar ao Templatical. Verifique sua conexão de rede e tente novamente.",
    authFailed: "Falha na autenticação. Verifique suas credenciais.",
    templateNotFound:
      "O template solicitado não foi encontrado. Verifique se o ID do template está correto.",
    retry: "Tentar novamente",
  },
  header: {
    templatesUsed: "{used}/{max} templates utilizados",
  },
  aiRewrite: {
    title: "Reescrita com IA",
    tone: "Tom",
    length: "Tamanho",
    clarity: "Clareza",
    professional: "Profissional",
    casual: "Casual",
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
    refine: "Refinar mais",
    error: "Falha ao reescrever o texto",
  },
  aiChat: {
    title: "Assistente de IA",
    button: "IA",
    inputPlaceholder: "Descreva seu template de e-mail...",
    send: "Enviar",
    generating: "Gerando...",
    applied: "Alterações aplicadas ao template.",
    applyFailed:
      "Não foi possível aplicar as alterações ao template. Tente novamente.",
    revert: "Reverter alterações",
    reapply: "Reaplicar alterações",
    error: "Falha ao gerar o template",
    clear: "Limpar conversa",
    placeholder:
      "Descreva o template de e-mail que você deseja criar, ou peça para modificar o atual.",
    loadingHistory: "Carregando conversa...",
  },
  scoring: {
    button: "Pontuar",
    title: "Pontuação do Template",
    rescore: "Pontuar novamente",
    scoring: "Analisando template...",
    overallScore: "Pontuação Geral",
    categories: {
      spam: "Risco de Spam",
      readability: "Legibilidade",
      accessibility: "Acessibilidade",
      bestPractices: "Boas Práticas",
    },
    severity: {
      high: "Alta",
      medium: "Média",
      low: "Baixa",
    },
    fix: "Corrigir com IA",
    fixing: "Corrigindo...",
    fixed: "Corrigido",
    findings: "ocorrências",
    noFindings: "Nenhum problema encontrado",
    error: "Falha ao analisar o template",
    fixError: "Falha ao aplicar correção",
    emptyState:
      "Pontue seu template para obter sugestões práticas sobre risco de spam, legibilidade, acessibilidade e boas práticas.",
  },
  aiMenu: {
    aiAssistant: "Assistente de IA",
    aiAssistantDesc: "Converse com a IA para criar ou modificar seu template",
    designToTemplate: "Design para Template",
    designToTemplateDesc: "Gere um template a partir de uma imagem ou PDF",
    templateScore: "Pontuação do Template",
    templateScoreDesc: "Analise qualidade, risco de spam e acessibilidade",
    disclaimer: "A IA pode cometer erros. Verifique antes de aprovar.",
  },
  collaboration: {
    connected: "Modo de colaboração ativo",
    disconnected: "Colaboração desconectada",
    reconnecting: "Reconectando...",
    blockLockedBy: "Em edição por {name}",
    usersOnline: "{count} usuários online",
  },
  designReference: {
    title: "Referência de Design",
    button: "Design",
    uploadImage: "Imagem",
    uploadPdf: "PDF",
    dropHint: "Solte um arquivo aqui ou clique para procurar",
    acceptedImages: "PNG, JPG, WebP (máx. 10MB)",
    acceptedPdf: "PDF (máx. 10MB)",
    promptLabel: "Instruções (opcional)",
    promptPlaceholder:
      "Descreva ajustes ou preferências para o template gerado...",
    generate: "Gerar a partir do design",
    generating: "Analisando design e gerando template...",
    replaceWarning:
      "Gerar a partir de uma referência de design substituirá o conteúdo existente do template.",
    replaceConfirm: "Substituir e gerar",
    replaceCancel: "Cancelar",
    error: "Falha ao gerar template a partir do design",
    fileTooLarge: "O arquivo é muito grande. O tamanho máximo é 10MB.",
    invalidFileType:
      "Este tipo de arquivo não é suportado. Envie um PNG, JPG, WebP ou PDF.",
  },

  saveGate: {
    title: "Erros de acessibilidade bloqueiam este salvamento",
    body: "Seu plano bloqueia salvamentos enquanto houver erros. Corrija os itens abaixo ou salve mesmo assim.",
    cancel: "Revisar e corrigir",
    confirm: "Salvar mesmo assim",
  },
};

export default ptBR;
