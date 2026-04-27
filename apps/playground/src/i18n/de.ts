import type { Translations } from "./index";

export default {
  chooser: {
    title: "Templatical Playground",
    subtitle: "W\u00e4hlen Sie einen Startpunkt f\u00fcr Ihre E-Mail-Vorlage",
    startFromScratch: "Neu beginnen",
    emptyCanvas: "Leere Leinwand mit Standardeinstellungen",
    beefreePrompt: "Haben Sie eine bestehende BeeFree-Vorlage?",
    importBeefree: "Aus BeeFree importieren",
  },
  cloudBanner: {
    title: "Das volle Erlebnis mit Cloud freischalten",
    description:
      "Echtzeit-Zusammenarbeit, KI-Schreibassistent, Versionsverlauf, Vorlagenbewertung, Medienbibliothek und mehr.",
    cta: "Cloud Playground testen",
  },
  toolbar: {
    templates: "Vorlagen",
    config: "Konfiguration",
    features: "Funktionen",
    json: "JSON",
    export: "Exportieren",
    downloadJson: "JSON herunterladen",
    downloadMjml: "MJML herunterladen",
    docs: "Dokumentation",
    tryCloud: "Cloud testen",
    retry: "Erneut versuchen",
    share: "Teilen",
    tour: "Tour",
  },
  jsonModal: {
    title: "Vorlagen-JSON",
    copy: "Kopieren",
    copied: "Kopiert!",
  },
  configModal: {
    tabs: {
      options: "Optionen",
      content: "Inhalt",
      theme: "Design",
      defaults: "Standards",
      callbacks: "Callbacks",
    },
    descriptions: {
      options: "mergeTags, displayConditions, customBlocks",
      content: "Vorlagen-Blockstruktur",
      theme: "Farben und visuelle \u00dcberschreibungen (OKLch)",
      defaults: "blockDefaults, templateDefaults",
      callbacks: "onRequestMedia, mergeTags.onRequest",
    },
    defaultsPresetLabel: "Vorlage",
    defaultsPresets: {
      templatical: "Templatical Standard",
      corporate: "Gesch\u00e4ftlich",
      playful: "Verspielt",
      minimal: "Minimalistisch",
    },
    defaultsHint:
      'Standardwerte f\u00fcr neu erstellte Bl\u00f6cke und Vorlagen. W\u00e4hlen Sie eine Vorlage oder bearbeiten Sie das JSON. \u00c4nderungen werden bei "\u00dcbernehmen & Neu laden" wirksam.',
    callbacksHint:
      'Callback-Handler f\u00fcr den Editor umschalten. \u00c4nderungen werden bei "\u00dcbernehmen & Neu laden" wirksam.',
    onRequestMediaDesc:
      '\u00d6ffnet eine Demo-Bildauswahl, wenn der Benutzer auf "Medien durchsuchen" klickt',
    onRequestMergeTag:
      "\u00d6ffnet eine Merge-Tag-Auswahl, wenn der Benutzer einen Platzhalter einf\u00fcgt",
    cancel: "Abbrechen",
    apply: "\u00dcbernehmen & Neu laden",
  },
  beefreeModal: {
    title: "BeeFree-Vorlage importieren",
    description:
      "F\u00fcgen Sie den JSON-Export aus Ihrem BeeFree-Editor unten ein.",
    chooseFile: ".json-Datei w\u00e4hlen",
    orPaste: "oder JSON einf\u00fcgen",
    import: "Importieren & \u00d6ffnen",
    cancel: "Abbrechen",
    emptyError:
      "F\u00fcgen Sie Ihr BeeFree-JSON ein oder laden Sie eine Datei hoch.",
  },
  mergeTagModal: {
    title: "Merge-Tag einf\u00fcgen",
  },
  mediaModal: {
    title: "Bild ausw\u00e4hlen",
  },
  dataSourceModal: {
    fetching: "Daten vom Endpunkt abrufen\u2026",
    fetchDescription:
      "Dies simuliert das Abrufen von Daten von Ihrem Endpunkt. In der Produktion ruft das SDK diese URL auf und zeigt die Antwort an, aus der der Benutzer w\u00e4hlen kann.",
    responseReceived: "Antwort erhalten \u2014 Element ausw\u00e4hlen",
  },
  featureModal: {
    title: "Funktionen in dieser Vorlage",
    subtitle: "{name} zeigt diese SDK-F\u00e4higkeiten",
    dismiss: "Verstanden, mit Bearbeitung beginnen",
  },
  shareModal: {
    title: "Vorlage teilen",
    description:
      "Jeder mit diesem Link kann eine Kopie Ihrer Vorlage ansehen und bearbeiten.",
    copyLink: "Link kopieren",
    copied: "Kopiert!",
    expiry: "Links laufen nach 30 Tagen ab.",
    loading: "Freigabelink wird erstellt\u2026",
    error: "Freigabelink konnte nicht erstellt werden.",
    retry: "Erneut versuchen",
  },
  sharedTemplate: {
    loading: "Geteilte Vorlage wird geladen\u2026",
    notFound:
      "Diese geteilte Vorlage wurde nicht gefunden oder ist abgelaufen.",
    error: "Geteilte Vorlage konnte nicht geladen werden.",
    goToPlayground: "Zum Playground",
  },
  common: {
    close: "Schlie\u00dfen",
    dismiss: "Ausblenden",
    or: "oder",
  },
  error: {
    initFailed: "Editor konnte nicht initialisiert werden: {message}",
  },
  templates: {
    product: {
      name: "Produkteinf\u00fchrung",
      description: "Ank\u00fcndigung mit Hero-Bereich, Funktionen und CTA",
    },
    newsletter: {
      name: "Newsletter",
      description:
        "W\u00f6chentlicher \u00dcberblick mit Hauptartikel und Links",
    },
    welcome: {
      name: "Willkommens-E-Mail",
      description: "Onboarding-Schritte f\u00fcr neue Benutzer",
    },
    order: {
      name: "Bestellbest\u00e4tigung",
      description: "Bestell\u00fcbersicht mit Artikeln und Versand",
    },
    event: {
      name: "Veranstaltungseinladung",
      description: "Veranstaltungsdetails mit Datum, Uhrzeit und RSVP",
    },
    reset: {
      name: "Passwort zur\u00fccksetzen",
      description: "Einfache transaktionale E-Mail mit Reset-Link",
    },
    sale: {
      name: "Black Friday Sale",
      description: "Aktion mit Produktauswahl und Rabattcode",
    },
  },
  onboarding: {
    next: "Weiter",
    skip: "Tour überspringen",
    done: "Verstanden!",
    stepCounter: "{current} von {total}",
    canvas: {
      title: "Ihre E-Mail-Leinwand",
      text: "Hier nimmt Ihre E-Mail Gestalt an. Klicken Sie auf einen Block, um ihn auszuwählen und zu bearbeiten.",
    },
    sidebar: {
      title: "Block-Bibliothek",
      text: "Ziehen Sie Blöcke von hier auf die Leinwand, um Text, Bilder, Buttons und mehr hinzuzufügen.",
    },
    rightSidebar: {
      title: "Inhalt & Einstellungen",
      text: "Wählen Sie einen Block aus, um seinen Inhalt hier zu bearbeiten, oder wechseln Sie zu Einstellungen, um das gesamte Vorlagenlayout anzupassen.",
    },
    config: {
      title: "Editor-Konfiguration",
      text: "Passen Sie Merge-Tags, Anzeigebedingungen, Designfarben und Block-Standards an.",
    },
    json: {
      title: "Vorlagen-JSON",
      text: "Sehen Sie jederzeit die rohe JSON-Ausgabe Ihrer Vorlage ein.",
    },
    exportBtn: {
      title: "Export-Optionen",
      text: "Laden Sie Ihre Vorlage als JSON oder MJML herunter, um sie in Ihrer Anwendung zu verwenden.",
    },
    share: {
      title: "Arbeit teilen",
      text: "Erstellen Sie einen Link, damit andere Ihre Vorlage ansehen und bearbeiten können.",
    },
    cloud: {
      title: "Cloud testen",
      text: "Schalten Sie KI-Schreiben, Echtzeit-Zusammenarbeit, Medienbibliothek und mehr frei.",
    },
  },
  mergeTags: {
    firstName: "Vorname",
    lastName: "Nachname",
    email: "E-Mail",
    company: "Unternehmen",
    accountId: "Konto-ID",
    planName: "Tarifname",
    orderId: "Bestell-ID",
    orderTotal: "Bestellsumme",
    shippingMethod: "Versandart",
    estimatedDelivery: "Voraussichtliche Lieferung",
    trackingUrl: "Tracking-URL",
    unsubscribeUrl: "Abmelde-URL",
    preferencesUrl: "Einstellungen-URL",
    currentDate: "Aktuelles Datum",
  },
  demoImages: {
    productShot: "Produktfoto",
    teamPhoto: "Teamfoto",
    abstract: "Abstrakt",
  },
  a11y: {
    backToTemplates: "Zur\u00fcck zu Vorlagen",
    startFromScratch: "Neu beginnen mit leerer Leinwand",
    chooseTemplate: "Vorlage {name} w\u00e4hlen",
    githubRepo: "GitHub-Repository",
    authMethod: "Authentifizierungsmethode",
    realtimeMode: "Echtzeitmodus",
    templateUuid: "Vorlagen-UUID",
    editorConfig: "Editor-Konfiguration",
    beefreeJsonContent: "BeeFree-JSON-Inhalt",
    selectLanguage: "Sprache auswählen",
    selectTheme: "Farbschema auswählen",
  },
  theme: {
    auto: "Auto",
    light: "Hell",
    dark: "Dunkel",
  },
  cloud: {
    title: "Templatical Cloud",
    subtitle: "Alles aus dem OSS-Editor, plus Cloud-basierte Funktionen.",
    auth: {
      apiCredentials: "API-Zugangsdaten",
      authProxy: "Auth-Proxy",
      apiDescription:
        "Verwenden Sie die API-Zugangsdaten Ihres Projekts, um direkt zu verbinden. Nur f\u00fcr Entwicklung und Tests gedacht \u2014 kein Backend erforderlich.",
      proxyDescription:
        "Verweisen Sie das SDK auf Ihren Backend-Token-Endpunkt. Der Editor sendet eine Anfrage an diese URL, um ein Zugriffstoken abzurufen, bevor er sich verbindet.",
      clientId: "Client-ID",
      clientSecret: "Client-Secret",
      tenant: "Mandant",
      identitySigning: "Identit\u00e4t & Signierung",
      optional: "optional",
      signingKey: "Signierschl\u00fcssel",
      signingKeyHelp:
        "Zu finden in Ihren Templatical Cloud-Projekteinstellungen unter API-Schl\u00fcssel.",
      collaboration: "Zusammenarbeit",
      mcp: "MCP",
      realtimeDescription:
        "Diese Modi schlie\u00dfen sich gegenseitig aus. Zusammenarbeit erm\u00f6glicht mehreren Personen die gleichzeitige Bearbeitung mit Pr\u00e4senz und Blocksperre. MCP erm\u00f6glicht die Verbindung Ihres KI-Agenten mit dem Editor, sodass er die Vorlage lesen und \u00e4ndern kann \u2014 \u00c4nderungen erscheinen live.",
      userName: "Benutzername",
      testEmail: "Test-E-Mail",
      credentialsWarning:
        "Zugangsdaten werden im Browser-Speicher gespeichert und direkt vom Browser gesendet. F\u00fcr die Produktion verwenden Sie den Auth-Proxy-Tab, um Token-Anfragen \u00fcber Ihr Backend zu leiten.",
      authEndpoint: "Auth-Endpunkt",
      method: "Methode",
      credentials: "Zugangsdaten",
      headers: "Headers",
      body: "Body",
      jsonOptional: "JSON, optional",
    },
    template: {
      loadExisting: "Bestehende Vorlage laden",
      enterUuid: "Vorlagen-UUID eingeben...",
      load: "Laden",
      startFromScratch: "Neu beginnen",
    },
    features: {
      versionHistory: "Versionsverlauf",
      autoSave: "Automatisches Speichern",
      aiWriting: "KI-Schreiben",
      realtimeCollaboration: "Echtzeit-Zusammenarbeit",
      mediaLibrary: "Medienbibliothek",
      savedModules: "Gespeicherte Module",
      testEmail: "Test-E-Mail",
      mcpIntegration: "MCP-Integration",
      commenting: "Kommentare",
      templateScoring: "Vorlagenbewertung",
      whiteLabel: "White Label",
      andMore: "und mehr \u2192",
    },
    backToOss: "\u2190 Zur\u00fcck zum OSS Playground",
    editor: {
      back: "Zur\u00fcck",
      cloud: "Cloud",
      newTemplate: "Neue Vorlage",
      save: "Speichern",
      retry: "Erneut versuchen",
    },
    errors: {
      requiredFields: "Client-ID, Client-Secret und Mandant sind erforderlich",
      authUrlRequired: "Auth-URL ist erforderlich",
      enterUuid: "Bitte geben Sie eine Vorlagen-UUID ein",
      initFailed: "Initialisierung fehlgeschlagen: {message}",
      invalidHeadersJson: "Auth-Header enthalten ungültiges JSON — ignoriert",
      invalidBodyJson: "Auth-Body enthält ungültiges JSON — ignoriert",
    },
  },
} satisfies Translations;
