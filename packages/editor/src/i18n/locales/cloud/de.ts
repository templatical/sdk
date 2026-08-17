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
  aiRewrite: {
    title: "KI-Umschreibung",
    tone: "Tonalität",
    length: "Länge",
    clarity: "Klarheit",
    professional: "Professionell",
    casual: "Locker",
    friendly: "Freundlich",
    urgent: "Dringend",
    persuasive: "Überzeugend",
    shorter: "Kürzer",
    longer: "Länger",
    summarize: "Zusammenfassen",
    simplify: "Vereinfachen",
    fixGrammar: "Grammatik korrigieren",
    improveReadability: "Lesbarkeit verbessern",
    customInstruction: "Eigene Anweisung",
    customPlaceholder: "Beschreiben Sie die gewünschte Umschreibung...",
    rewrite: "Umschreiben",
    rewriting: "Wird umgeschrieben...",
    undo: "Rückgängig",
    redo: "Wiederholen",
    refine: "Weiter verfeinern",
    error: "Text konnte nicht umgeschrieben werden",
  },
  aiChat: {
    title: "KI-Assistent",
    button: "KI",
    inputPlaceholder: "Beschreiben Sie Ihre E-Mail-Vorlage...",
    send: "Senden",
    generating: "Wird generiert...",
    applied: "Änderungen auf Vorlage angewendet.",
    applyFailed:
      "Änderungen konnten nicht auf die Vorlage angewendet werden. Bitte versuchen Sie es erneut.",
    revert: "Änderungen rückgängig",
    reapply: "Änderungen erneut anwenden",
    error: "Vorlage konnte nicht generiert werden",
    clear: "Chat leeren",
    placeholder:
      "Beschreiben Sie die E-Mail-Vorlage, die Sie erstellen möchten, oder bitten Sie um Änderungen an der aktuellen.",
    loadingHistory: "Konversation wird geladen...",
  },
  scoring: {
    button: "Bewertung",
    title: "Vorlagenbewertung",
    rescore: "Neu bewerten",
    scoring: "Vorlage wird analysiert...",
    overallScore: "Gesamtbewertung",
    categories: {
      spam: "Spam-Risiko",
      readability: "Lesbarkeit",
      accessibility: "Barrierefreiheit",
      bestPractices: "Best Practices",
    },
    severity: {
      high: "Hoch",
      medium: "Mittel",
      low: "Niedrig",
    },
    fix: "Mit KI beheben",
    fixing: "Wird behoben...",
    fixed: "Behoben",
    findings: "Ergebnisse",
    noFindings: "Keine Probleme gefunden",
    error: "Vorlage konnte nicht analysiert werden",
    fixError: "Korrektur konnte nicht angewendet werden",
    emptyState:
      "Bewerten Sie Ihre Vorlage, um umsetzbare Rückmeldungen zu Spam-Risiko, Lesbarkeit, Barrierefreiheit und Best Practices zu erhalten.",
  },
  aiMenu: {
    aiAssistant: "KI-Assistent",
    aiAssistantDesc:
      "Mit KI chatten, um Ihre Vorlage zu erstellen oder zu ändern",
    designToTemplate: "Design zu Vorlage",
    designToTemplateDesc: "Vorlage aus einem Bild oder PDF generieren",
    templateScore: "Vorlagenbewertung",
    templateScoreDesc: "Qualität, Spam-Risiko und Barrierefreiheit analysieren",
    disclaimer:
      "KI kann Fehler machen. Bitte überprüfen Sie die Ergebnisse vor der Genehmigung.",
  },
  collaboration: {
    connected: "Zusammenarbeit aktiv",
    disconnected: "Zusammenarbeit getrennt",
    reconnecting: "Verbindung wird wiederhergestellt...",
    blockLockedBy: "Wird bearbeitet von {name}",
    usersOnline: "{count} Benutzer online",
  },
  designReference: {
    title: "Designvorlage",
    button: "Design",
    uploadImage: "Bild",
    uploadPdf: "PDF",
    dropHint: "Datei hierher ziehen oder klicken zum Durchsuchen",
    acceptedImages: "PNG, JPG, WebP (max. 10 MB)",
    acceptedPdf: "PDF (max. 10 MB)",
    promptLabel: "Anweisungen (optional)",
    promptPlaceholder:
      "Beschreiben Sie Anpassungen oder Wünsche für die generierte Vorlage...",
    generate: "Aus Design generieren",
    generating: "Design wird analysiert und Vorlage generiert...",
    replaceWarning:
      "Die Generierung aus einer Designvorlage ersetzt den vorhandenen Vorlageninhalt.",
    replaceConfirm: "Ersetzen und generieren",
    replaceCancel: "Abbrechen",
    error: "Vorlage konnte nicht aus Design generiert werden",
    fileTooLarge: "Datei ist zu groß. Maximale Größe ist 10 MB.",
    invalidFileType:
      "Dieser Dateityp wird nicht unterstützt. Laden Sie eine PNG-, JPG-, WebP- oder PDF-Datei hoch.",
  },

  saveGate: {
    title: "Barrierefreiheitsfehler blockieren das Speichern",
    body: "Ihr Plan blockiert das Speichern, solange Fehler bestehen. Beheben Sie die folgenden Punkte oder speichern Sie trotzdem.",
    cancel: "Prüfen und beheben",
    confirm: "Trotzdem speichern",
  },
};

export default de;
