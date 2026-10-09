import type { Translations } from "./index";

export default {
  toolbar: {
    export: "Exportieren",
    docs: "Dokumentation",
    retry: "Erneut versuchen",
    share: "Teilen",
  },
  host: {
    back: "Zur\u00fcck",
    code: "Code",
    docs: "Dokumentation",
    notFoundNamed: "Keine Szene namens {id}.",
    notFoundHint: "Diese ID steht nicht im Setup-Katalog.",
    catalogTitle: "Playground",
    setups: "Setups",
    catalogFooter: "Playground-Links",
    catalogNav: "Hauptnavigation",
    snippet: "init()-Snippet",
    minimumPaste: "init({ container })",
    catalogPageTitle: "Templatical Playground",
    pageTitle: "{name} · Templatical Playground",
    pickValue: "{key} wählen",
    brand: "Templatical",
    headline: "Der E-Mail-Editor, den Sie in Ihre App einbauen.",
    lede: "Öffnen Sie ein Setup, um es live zu nutzen, und kopieren Sie dann das init(), das es aufbaut.",
    installCommand: "npm i @templatical/editor",
    copyInstall: "Installationsbefehl kopieren",
    copied: "Kopiert",
    runTheseLines: "Diese Zeilen ausführen",
    copySnippet: "Setup-Code kopieren",
    snippetLabel: "Minimales Setup",
    proofsLabel: "Fertige Beispiele",
    openProof: "{name} öffnen",
    settings: {
      label: "Einstellungen",
      theme: "Darstellung",
      language: "Sprache",
      showNotes: "Notizen anzeigen",
    },
    phone: {
      widerScreen:
        "Der Editor braucht ein Tablet oder einen Desktop. Öffnen Sie diese Seite auf einem breiteren Bildschirm, um ihn auszuprobieren.",
      proofAlt: "Vorschau der E-Mail „{name}“",
    },
    hideRail: "Setups ausblenden",
    showRail: "Setups einblenden",
    pager: {
      previous: "Vorherige: {name}",
      next: "N\u00e4chste: {name}",
      noPrevious: "Keine vorherige Szene",
      noNext: "Keine n\u00e4chste Szene",
    },
    notes: {
      label: "Notizen",
      hide: "Notizen ausblenden",
      items: {
        rail: "weitere Setups",
        palette: "Bl\u00f6cke hineinziehen",
        properties: "Auswahl bearbeiten",
        issues: "Probleme beheben",
        preview: "Vorschau",
        share: "Kopie teilen",
        code: "Setup kopieren",
      },
      targets: {
        scene: "Dieses Setup",
        rail: "Setup-Liste",
        palette: "Blockpalette",
        properties: "Eigenschaften",
        issues: "Probleme-Tab",
        preview: "Vorschau-Schalter",
        share: "Teilen-Schaltfl\u00e4che",
        code: "Code-Schaltfl\u00e4che",
      },
    },
    groups: {
      minimum: "Minimum",
      configure: "Konfiguration",
      personalization: "Personalisierung",
      backend: "Ihr Backend",
      import: "Import",
      examples: "Beispiele",
    },
    groupJobs: {
      configure: "Chrome, Schriften, Locale",
      personalization: "Tags, Logik, Sichtbarkeit",
      backend: "Laden, speichern, senden",
      import: "Bestehende Vorlage konvertieren",
      examples: "Fertige E-Mails",
    },
  },
  scenes: {
    minimum: {
      title: "Minimales Setup",
      seeIt:
        "Ziehen Sie einen beliebigen Block auf die Arbeitsfläche: Dieser eine Aufruf ist die ganze Integration.",
    },
    fonts: {
      title: "Schriftarten",
      seeIt:
        "Öffnen Sie „Settings“ und wählen Sie eine Schrift: Angeboten werden nur Georgia, Times New Roman und Arial.",
      note: "nur 3 Schriften",
    },
    defaults: {
      title: "Standardwerte",
      seeIt:
        "Die leere Seite startet getönt, und ein hineingezogener „Button“ kommt in Petrol an.",
      note: "Button hineinziehen",
    },
    theming: {
      title: "Theming",
      seeIt:
        "Die Oberfläche des Editors trägt das Karminrot der Marke, von den Schaltern bis zur Fläche hinter der E-Mail.",
      note: "Markenfarben",
    },
    layout: {
      title: "Layout",
      seeIt:
        "Wechseln Sie in die Vorschau: Die E-Mail sitzt in Ihrer Kartenhülle, die im gespeicherten JSON nie vorkommt.",
      note: "zur Vorschau",
    },
    i18n: {
      title: "Internationalisierung",
      seeIt:
        "Wählen Sie über `locale` eine Sprache: Die Oberfläche des Editors und hineingezogene Blöcke folgen ihr.",
      note: "Sprache wählen",
    },
    "shadow-dom-off": {
      title: "Shadow DOM aus",
      seeIt:
        "Sieht gleich aus: Der Editor wird direkt in die Seite eingehängt, ohne Shadow Root.",
    },
    issues: {
      title: "Probleme",
      seeIt:
        "Der Tab „Issues“ meldet einen fehlenden Alt-Text und eine vage Button-Beschriftung: Springen Sie jeweils zum Block und beheben Sie das Problem.",
      note: "2 Probleme",
    },
    "custom-blocks": {
      title: "Benutzerdefinierte Blöcke",
      seeIt:
        "Ihr Block „Testimonial“ steht in der Palette und auf der Arbeitsfläche: Wählen Sie ihn aus, um seine Felder zu bearbeiten.",
      note: "Ihr Block",
    },
    "merge-tags": {
      title: "Merge-Tags",
      seeIt:
        "Bearbeiten Sie den Absatz und fügen Sie ein Merge-Tag ein: Der Picker listet Ihre Tags mit ihrer Beschriftung.",
      note: "Tag einfügen",
    },
    "merge-tags-on-request": {
      title: "Merge-Tags auf Anfrage",
      seeIt:
        "Bearbeiten Sie den Absatz und fügen Sie ein Merge-Tag ein: Statt der Liste öffnet sich Ihre eigene Auswahl.",
      note: "Tag einfügen",
    },
    "merge-tags-samples": {
      title: "Merge-Tag-Beispielwerte",
      seeIt: "Wechseln Sie in die Vorschau: Tags zeigen ihre Beispielwerte.",
      note: "zur Vorschau",
    },
    "merge-tags-resolve-preview": {
      title: "Vorschau auflösen",
      seeIt:
        "Wechseln Sie in die Vorschau: Ihr Resolver füllt die Tags und entscheidet die IF-Zweige.",
      note: "zur Vorschau",
    },
    "logic-tags": {
      title: "Logik-Tags",
      seeIt:
        "Die Badges IF und ENDIF sind Logik-Tags: Bearbeiten Sie den Absatz, um über „Logic“ weitere einzufügen.",
      note: "Logik-Tags",
    },
    "display-conditions": {
      title: "Anzeigebedingungen",
      seeIt:
        "Wählen Sie einen Block und dann unter „Display Condition“ eine Bedingung wie „VIP Partners“.",
      note: "Block auswählen",
    },
    templates: {
      title: "Vorlagen",
      seeIt:
        "Benennen Sie die Vorlage um oder bearbeiten Sie sie und speichern Sie dann: Der Header zeigt „Saved“ und „Updated just now“.",
      note: "speichern",
    },
    "version-history": {
      title: "Versionsverlauf",
      seeIt:
        "Speichern Sie, dann öffnen Sie „Version history“, um eine Version anzusehen und wiederherzustellen.",
      note: "Versionen",
    },
    comments: {
      title: "Kommentare",
      seeIt:
        "Öffnen Sie „Comments“, kommentieren Sie einen Block und antworten Sie darauf.",
      note: "Kommentare",
    },
    "saved-blocks": {
      title: "Gespeicherte Blöcke",
      seeIt:
        "Öffnen Sie „Saved Blocks“, um einen einzufügen, oder speichern Sie einen eigenen über das Lesezeichen eines Blocks.",
      note: "gespeicherte Blöcke",
    },
    media: {
      title: "Medien",
      seeIt:
        "Ziehen Sie ein „Image“ hinein und klicken Sie auf „Browse Media“: Wählen Sie aus der Galerie oder legen Sie eine Datei ab.",
      note: "Bild hineinziehen",
    },
    "test-email": {
      title: "Test-E-Mail",
      seeIt:
        "Klicken Sie auf „Test“, wählen Sie einen Empfänger und senden Sie. Nichts verlässt den Browser.",
      note: "Test senden",
    },
    render: {
      title: "Rendering",
      seeIt:
        "Öffnen Sie „Exportieren“: MJML kommt aus `toMjml()`, HTML aus Ihrem `compileMjml`.",
      note: "exportieren",
    },
  },
  importModal: {
    title: "Bestehende Vorlage importieren",
    report: {
      title: "Importergebnis",
      detected: "{count} Elemente im Bericht",
      viewDetails: "Details anzeigen",
      hideDetails: "Details ausblenden",
      importAgain: "Weitere Vorlage importieren",
      warningLabel: "Warnungen",
      warnings: "Warnungen ({count})",
      scope:
        "Dieser Bericht erfasst die vom Importer erkannten Elemente. Vergleichen Sie die E-Mail mit der Quelle, um Aussehen und Inhalt zu prüfen.",
      status: {
        converted: "konvertiert",
        approximated: "angenähert",
        "html-fallback": "als HTML erhalten",
        skipped: "übersprungen",
      },
    },
    sources: {
      unlayer: "Aus Unlayer",
      beefree: "Aus BeeFree",
      stripo: "Aus Stripo",
      topol: "Aus Topol",
      chamaileon: "Aus Chamaileon",
      easyEmailPro: "Aus Easy Email Pro",
      mjml: "Aus MJML",
      html: "Aus HTML",
    },
    chooseFile: "Datei w\u00e4hlen",
    orPaste: "oder unten einf\u00fcgen",
    trySample: "Beispiel-E-Mail laden",
    import: "Importieren & \u00d6ffnen",
    cancel: "Abbrechen",
    beefree: {
      description:
        "F\u00fcgen Sie den JSON-Export aus Ihrem BeeFree-Editor unten ein.",
      emptyError:
        "F\u00fcgen Sie Ihr BeeFree-JSON ein oder laden Sie eine Datei hoch.",
    },
    unlayer: {
      description:
        "F\u00fcgen Sie den JSON-Design-Export aus Unlayer (Ergebnis von saveDesign) unten ein.",
      emptyError:
        "F\u00fcgen Sie Ihr Unlayer-JSON ein oder laden Sie eine Datei hoch.",
    },
    html: {
      description:
        "F\u00fcgen Sie den rohen HTML-Quelltext einer E-Mail ein (MJML-Ausgabe, ESP-Export oder handgeschrieben). Beste Ergebnisse mit tabellenbasierten Layouts.",
      emptyError:
        "F\u00fcgen Sie Ihren HTML-Quelltext ein oder laden Sie eine Datei hoch.",
    },
    mjml: {
      description:
        "F\u00fcgen Sie unten ein MJML-Dokument ein. Von Templatical erzeugtes MJML wird exakt zur\u00fcckgelesen; handgeschriebenes MJML deckt die g\u00e4ngigen Tags ab und f\u00e4llt f\u00fcr den Rest auf HTML-Bl\u00f6cke zur\u00fcck.",
      emptyError:
        "F\u00fcgen Sie Ihren MJML-Quelltext ein oder laden Sie eine Datei hoch.",
    },
    topol: {
      description:
        'F\u00fcgen Sie unten ein Topol-Design-JSON ein \u2014 das Design selbst, nicht eine gesamte API-Antwort. Topols Editor \u00fcbergibt es Ihnen direkt; \u00fcber die API liegt es unter "definition" oder "json".',
      emptyError:
        "F\u00fcgen Sie Ihr Topol-Design-JSON ein oder laden Sie eine Datei hoch.",
    },
    stripo: {
      description:
        "F\u00fcgen Sie unten Stripo-HTML ein \u2014 einen Datei \u2192 HTML-Export oder das { html, css }-Objekt aus getTemplateData(). Der Konverter erkennt selbst, welche Variante Sie \u00fcbergeben.",
      emptyError:
        "F\u00fcgen Sie Ihr Stripo-HTML ein oder laden Sie eine Datei hoch.",
    },
    chamaileon: {
      description:
        "F\u00fcgen Sie unten ein Chamaileon-getDocument()-JSON ein \u2014 das persistierte Dokument, kein getEmailHtml()-Markup.",
      emptyError:
        "F\u00fcgen Sie Ihr Chamaileon-Dokument-JSON ein oder laden Sie eine Datei hoch.",
    },
    easyEmailPro: {
      description:
        "F\u00fcgen Sie unten ein Easy-Email-Pro-JSON ein \u2014 die persistierte Seite { subject, content }, keine EditorCore.toMJML()-Ausgabe.",
      emptyError:
        "F\u00fcgen Sie Ihr Easy-Email-Pro-JSON ein oder laden Sie eine Datei hoch.",
    },
  },
  mergeTagModal: {
    title: "Merge-Tag einf\u00fcgen",
  },
  dataSourceModal: {
    fetching: "Daten vom Endpunkt abrufen\u2026",
    fetchDescription:
      "Dies simuliert das Abrufen von Daten von Ihrem Endpunkt. In der Produktion ruft das SDK diese URL auf und zeigt die Antwort an, aus der der Benutzer w\u00e4hlen kann.",
    responseReceived: "Antwort erhalten \u2014 Element ausw\u00e4hlen",
  },
  exportModal: {
    title: "Vorlage exportieren",
    tabs: {
      preview: "Vorschau",
      html: "HTML",
      mjml: "MJML",
      json: "JSON",
    },
    description: {
      preview:
        "Die fertige E-Mail, in Ihrem Browser von MJML zu HTML kompiliert. Kopieren und Herunterladen liefern ihr HTML.",
      html: "Versandfertiges HTML. In Ihren ESP einfügen oder als finale E-Mail senden.",
      mjml: "MJML-Quelle. Mit dem MJML-Compiler oder kompatiblen Tools verwenden.",
      json: "Templatical Block-JSON. Zum erneuten Import oder Speichern der Vorlage.",
    },
    copy: "Kopieren",
    copied: "Kopiert!",
    download: "Herunterladen",
    compiling: "HTML wird kompiliert…",
    compileError: "HTML-Kompilierung fehlgeschlagen.",
    compileErrorDetails: "Fehler:",
    retry: "Erneut versuchen",
    previewWidth: "Vorschaubreite",
    desktop: "Desktop",
    mobile: "Mobil",
    previewFrame: "E-Mail-Vorschau",
  },
  buildInfo: {
    label: "SDK {version}",
    compare: "Commit {commit}: Änderungen seit v{version} auf GitHub",
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
    or: "oder",
  },
  error: {
    initFailed: "Editor konnte nicht initialisiert werden: {message}",
  },
  mergeTags: {
    firstName: "Vorname",
    lastName: "Nachname",
    email: "E-Mail",
    company: "Unternehmen",
    planName: "Tarifname",
  },
  a11y: {
    backToTemplates: "Zur\u00fcck zu Vorlagen",
    backToCatalog: "Zur\u00fcck zum Katalog",
    openScene: "Szene {name} öffnen",
    startFromScratch: "Neu beginnen mit leerer Leinwand",
    githubRepo: "GitHub-Repository",
    authMethod: "Authentifizierungsmethode",
    realtimeMode: "Echtzeitmodus",
    templateUuid: "Vorlagen-UUID",
    editorConfig: "Editor-Konfiguration",
    beefreeJsonContent: "BeeFree-JSON-Inhalt",
    unlayerJsonContent: "Unlayer-JSON-Inhalt",
    htmlSourceContent: "HTML-Quelltext-Inhalt",
    mjmlSourceContent: "MJML-Quelltext-Inhalt",
    topolSourceContent: "Topol-Design-JSON-Inhalt",
    stripoSourceContent: "Stripo-HTML-Inhalt",
    chamaileonSourceContent: "Chamaileon-Dokument-JSON-Inhalt",
    easyEmailProSourceContent: "Easy-Email-Pro-Seiten-JSON-Inhalt",
    selectLanguage: "Sprache auswählen",
    selectSdkLanguage: "SDK-Sprache auswählen",
    selectTheme: "Farbschema auswählen",
    toggleShadowDom: "Shadow-DOM-Mount umschalten",
  },
  theme: {
    auto: "Auto",
    light: "Hell",
    dark: "Dunkel",
  },
  shadowMode: {
    shadow: "Shadow DOM",
    light: "Light DOM",
  },
  cloud: {
    title: "Templatical Cloud",
    subtitle:
      "Alles aus dem selbst gehosteten Editor, plus Cloud-basierte Funktionen.",
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
      savedBlocks: "Gespeicherte Blöcke",
      testEmail: "Test-E-Mail",
      mcpIntegration: "MCP-Integration",
      commenting: "Kommentare",
      templateScoring: "Vorlagenbewertung",
      whiteLabel: "White Label",
      andMore: "und mehr \u2192",
    },
    backToOss: "\u2190 Zur\u00fcck zum Playground",
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
