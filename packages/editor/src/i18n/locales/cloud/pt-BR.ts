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
  saveGate: {
    title: "Erros de acessibilidade bloqueiam este salvamento",
    body: "Seu plano bloqueia salvamentos enquanto houver erros. Corrija os itens abaixo ou salve mesmo assim.",
    cancel: "Revisar e corrigir",
    confirm: "Salvar mesmo assim",
  },
};

export default ptBR;
