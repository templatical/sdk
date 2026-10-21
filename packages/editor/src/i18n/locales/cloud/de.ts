import type en from "./en";

const de: typeof en = {
  loading: {
    initializing: "Initialisieren...",
  },
  error: {
    title: "Etwas ist schiefgelaufen",
    defaultMessage:
      "Der Editor konnte keine Verbindung zu Templatical herstellen. Überprüfen Sie Ihre Netzwerkverbindung und versuchen Sie es erneut.",
    authFailed:
      "Authentifizierung fehlgeschlagen. Bitte überprüfen Sie Ihre Anmeldedaten.",
    templateNotFound:
      "Die angeforderte Vorlage konnte nicht gefunden werden. Bitte überprüfen Sie die Vorlagen-ID.",
    retry: "Erneut versuchen",
  },
  header: {
    templatesUsed: "{used}/{max} Vorlagen verwendet",
  },
  saveGate: {
    title: "Barrierefreiheitsfehler blockieren das Speichern",
    body: "Ihr Plan blockiert das Speichern, solange Fehler bestehen. Beheben Sie die folgenden Punkte oder speichern Sie trotzdem.",
    cancel: "Prüfen und beheben",
    confirm: "Trotzdem speichern",
  },
};

export default de;
