export default {
  chooser: {
    title: "Templatical Playground",
    subtitle: "Choose a starting point for your email template",
    startFromScratch: "Start from Scratch",
    emptyCanvas: "Empty canvas with default settings",
    migration: {
      headline: "Already using BeeFree, Unlayer, or hand-coded HTML?",
      description:
        "Bring your existing templates over in seconds — block mapping, layouts, and merge tags handled automatically.",
      importFromBeefree: "Import from BeeFree",
      importFromUnlayer: "Import from Unlayer",
      importFromHtml: "Import from HTML",
    },
  },
  cloudBanner: {
    title: "Unlock the full experience with Cloud",
    description:
      "Real-time collaboration, AI writing assistant, version history, template scoring, media library, and more.",
    cta: "Try Cloud Playground",
  },
  toolbar: {
    templates: "Templates",
    config: "Config",
    features: "Features",
    json: "JSON",
    export: "Export",
    downloadJson: "Download JSON",
    downloadMjml: "Download MJML",
    docs: "Docs",
    tryCloud: "Try Cloud",
    retry: "Retry",
    share: "Share",
    tour: "Tour",
  },
  jsonModal: {
    title: "Template JSON",
    copy: "Copy",
    copied: "Copied!",
  },
  configModal: {
    tabs: {
      options: "Options",
      content: "Content",
      theme: "Theme",
      defaults: "Defaults",
      callbacks: "Callbacks",
    },
    descriptions: {
      options: "mergeTags, displayConditions, customBlocks",
      content: "Template block structure",
      theme: "Colors and visual overrides (OKLch)",
      defaults: "blockDefaults, templateDefaults",
      callbacks: "onRequestMedia, mergeTags.onRequest",
    },
    defaultsPresetLabel: "Preset",
    defaultsPresets: {
      templatical: "Templatical Default",
      corporate: "Corporate",
      playful: "Playful",
      minimal: "Minimal",
    },
    defaultsHint:
      'Defaults for newly created blocks and templates. Pick a preset or edit the JSON below. Changes apply on "Apply & Reload".',
    callbacksHint:
      'Toggle callback handlers passed to the editor. Changes apply on "Apply & Reload".',
    onRequestMediaDesc:
      'Opens a demo image picker when the user clicks "Browse Media"',
    onRequestMergeTag:
      "Opens a merge tag picker when the user inserts a merge tag",
    cancel: "Cancel",
    apply: "Apply & Reload",
  },
  importModal: {
    title: "Import existing template",
    sources: {
      beefree: "From BeeFree",
      unlayer: "From Unlayer",
      html: "From HTML",
    },
    chooseFile: "Choose file",
    orPaste: "or paste below",
    import: "Import & Open",
    cancel: "Cancel",
    beefree: {
      description: "Paste the JSON export from your BeeFree editor below.",
      emptyError: "Paste your BeeFree JSON or upload a file.",
    },
    unlayer: {
      description:
        "Paste the JSON design export from Unlayer (saveDesign output) below.",
      emptyError: "Paste your Unlayer JSON or upload a file.",
    },
    html: {
      description:
        "Paste the raw HTML source of an email (MJML output, ESP export, or hand-coded). Best results with table-based layouts.",
      emptyError: "Paste your HTML source or upload a file.",
    },
  },
  mergeTagModal: {
    title: "Insert Merge Tag",
  },
  mediaModal: {
    title: "Select Image",
  },
  dataSourceModal: {
    fetching: "Fetching data from endpoint\u2026",
    fetchDescription:
      "This simulates retrieving data from your endpoint. In production, the SDK calls this URL and displays the response for the user to pick from.",
    responseReceived: "Response received \u2014 select an item",
  },
  featureModal: {
    title: "Features in this template",
    subtitle: "{name} showcases these SDK capabilities",
    dismiss: "Got it, start editing",
  },
  shareModal: {
    title: "Share Template",
    description:
      "Anyone with this link can view and edit a copy of your template.",
    copyLink: "Copy Link",
    copied: "Copied!",
    expiry: "Links expire after 30 days.",
    loading: "Creating share link\u2026",
    error: "Failed to create share link.",
    retry: "Try Again",
  },
  sharedTemplate: {
    loading: "Loading shared template\u2026",
    notFound: "This shared template was not found or has expired.",
    error: "Failed to load shared template.",
    goToPlayground: "Go to Playground",
  },
  common: {
    close: "Close",
    dismiss: "Dismiss",
    or: "or",
  },
  error: {
    initFailed: "Failed to initialize editor: {message}",
  },
  mergeTags: {
    firstName: "First Name",
    lastName: "Last Name",
    email: "Email",
    company: "Company",
    accountId: "Account ID",
    planName: "Plan Name",
    orderId: "Order ID",
    orderTotal: "Order Total",
    shippingMethod: "Shipping Method",
    estimatedDelivery: "Estimated Delivery",
    trackingUrl: "Tracking URL",
    unsubscribeUrl: "Unsubscribe URL",
    preferencesUrl: "Preferences URL",
    currentDate: "Current Date",
  },
  demoImages: {
    productShot: "Product Shot",
    teamPhoto: "Team Photo",
    abstract: "Abstract",
  },
  templates: {
    product: {
      name: "Product Launch",
      description: "Announcement with hero, features, and CTA",
    },
    newsletter: {
      name: "Newsletter",
      description: "Weekly digest with featured article and links",
    },
    welcome: {
      name: "Welcome Email",
      description: "Onboarding steps for new users",
    },
    order: {
      name: "Order Confirmation",
      description: "Order summary with items and shipping",
    },
    event: {
      name: "Event Invitation",
      description: "Event details with date, time, and RSVP",
    },
    reset: {
      name: "Password Reset",
      description: "Simple transactional reset link email",
    },
    sale: {
      name: "Black Friday Sale",
      description: "Promo with product picks and discount code",
    },
  },
  onboarding: {
    next: "Next",
    skip: "Skip tour",
    done: "Got it!",
    stepCounter: "{current} of {total}",
    canvas: {
      title: "Your email canvas",
      text: "This is where your email takes shape. Click any block to select and edit it.",
    },
    sidebar: {
      title: "Block library",
      text: "Drag blocks from here onto the canvas to add text, images, buttons, and more.",
    },
    rightSidebar: {
      title: "Content & Settings",
      text: "Select a block to edit its content here, or switch to Settings to adjust the overall template layout.",
    },
    config: {
      title: "Editor configuration",
      text: "Customize merge tags, display conditions, theme colors, and block defaults.",
    },
    json: {
      title: "Template JSON",
      text: "Inspect the raw JSON output of your template at any time.",
    },
    exportBtn: {
      title: "Export options",
      text: "Download your template as JSON or MJML to use in your application.",
    },
    share: {
      title: "Share your work",
      text: "Generate a shareable link so others can view and remix your template.",
    },
    cloud: {
      title: "Try Cloud",
      text: "Unlock AI writing, real-time collaboration, media library, and more.",
    },
  },
  a11y: {
    backToTemplates: "Back to templates",
    startFromScratch: "Start from scratch with empty canvas",
    chooseTemplate: "Choose {name} template",
    githubRepo: "GitHub repository",
    authMethod: "Authentication method",
    realtimeMode: "Realtime mode",
    templateUuid: "Template UUID",
    editorConfig: "Editor Configuration",
    beefreeJsonContent: "BeeFree JSON content",
    unlayerJsonContent: "Unlayer JSON content",
    htmlSourceContent: "HTML source content",
    selectLanguage: "Select language",
    selectTheme: "Select theme",
  },
  theme: {
    auto: "Auto",
    light: "Light",
    dark: "Dark",
  },
  cloud: {
    title: "Templatical Cloud",
    subtitle: "Everything in the OSS editor, plus cloud-powered features.",
    auth: {
      apiCredentials: "API Credentials",
      authProxy: "Auth Proxy",
      apiDescription:
        "Use your project\u2019s API credentials to connect directly. Meant only for development and testing \u2014 no backend required.",
      proxyDescription:
        "Point the SDK to your backend token endpoint. The editor will send a request to this URL to retrieve an access token before connecting.",
      clientId: "Client ID",
      clientSecret: "Client Secret",
      tenant: "Tenant",
      identitySigning: "Identity & Signing",
      optional: "optional",
      signingKey: "Signing Key",
      signingKeyHelp:
        "Found in your Templatical Cloud project settings under API Keys.",
      collaboration: "Collaboration",
      mcp: "MCP",
      realtimeDescription:
        "These modes are mutually exclusive. Collaboration lets multiple people edit together in real time with presence and block locking. MCP lets you connect your AI agent to the editor so it can read and modify the template \u2014 changes appear live as the agent works.",
      userName: "User Name",
      testEmail: "Test Email",
      credentialsWarning:
        "Credentials are stored in browser storage and sent directly from the browser. For production, use the Auth Proxy tab to route token requests through your backend.",
      authEndpoint: "Auth Endpoint",
      method: "Method",
      credentials: "Credentials",
      headers: "Headers",
      body: "Body",
      jsonOptional: "JSON, optional",
    },
    template: {
      loadExisting: "Load Existing Template",
      enterUuid: "Enter template UUID...",
      load: "Load",
      startFromScratch: "Start from Scratch",
    },
    features: {
      versionHistory: "Version History",
      autoSave: "Auto Save",
      aiWriting: "AI Writing",
      realtimeCollaboration: "Real-time Collaboration",
      mediaLibrary: "Media Library",
      savedModules: "Saved Modules",
      testEmail: "Test Email",
      mcpIntegration: "MCP Integration",
      commenting: "Commenting",
      templateScoring: "Template Scoring",
      whiteLabel: "White Label",
      andMore: "and more \u2192",
    },
    backToOss: "\u2190 Back to OSS Playground",
    editor: {
      back: "Back",
      cloud: "Cloud",
      newTemplate: "New Template",
      save: "Save",
      retry: "Retry",
    },
    errors: {
      requiredFields: "Client ID, Client Secret, and Tenant are required",
      authUrlRequired: "Auth URL is required",
      enterUuid: "Please enter a template UUID",
      initFailed: "Failed to initialize: {message}",
      invalidHeadersJson: "Auth headers contain invalid JSON — ignored",
      invalidBodyJson: "Auth body contains invalid JSON — ignored",
    },
  },
} as const;
