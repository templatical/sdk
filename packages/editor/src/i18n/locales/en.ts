export default {
  // Loading
  loading: {
    initializing: "Initializing...",
  },

  // Error
  error: {
    title: "Something went wrong",
    defaultMessage:
      "The editor could not connect to Templatical. Check your network connection and try again.",
    authFailed: "Authentication failed. Please check your credentials.",
    templateNotFound:
      "The requested template could not be found. Please verify the template ID is correct.",
    retry: "Try Again",
  },

  // Header
  header: {
    title: "Templatical",
    unsaved: "Unsaved",
    saving: "Saving...",
    save: "Save",
    templatesUsed: "{used}/{max} templates used",
  },

  // Footer (OSS only)
  footer: {
    poweredBy: "Powered by",
    openSource: "Open Source",
  },

  // Snapshot preview banner
  snapshotPreview: {
    message: "You are previewing a previous snapshot of this template.",
    cancel: "Cancel",
    restore: "Restore this snapshot",
  },

  // History (undo/redo)
  history: {
    undo: "Undo",
    redo: "Redo",
    collabWarning: "Undo may affect collaborators' recent changes",
  },

  // Viewport toggle
  viewport: {
    desktop: "Desktop",
    tablet: "Tablet",
    mobile: "Mobile",
  },

  // Dark mode preview
  darkMode: {
    enable: "Dark Mode Preview",
    disable: "Light Mode Preview",
  },

  // Preview mode
  previewMode: {
    enable: "Preview Mode",
    disable: "Exit Preview",
  },

  // Sidebar - Block types
  blocks: {
    section: "Section",
    image: "Image",
    title: "Title",
    paragraph: "Paragraph",
    button: "Button",
    divider: "Divider",
    video: "Video",
    social: "Social",
    spacer: "Spacer",
    html: "HTML",
    menu: "Menu",
    table: "Table",
    countdown: "Countdown",
  },

  // Right sidebar
  sidebar: {
    content: "Content",
    settings: "Settings",
    noSelection: "No element selected",
    noSelectionHint: "Select a block on the canvas to edit it",
  },

  // Toolbar - Common
  toolbar: {
    duplicate: "Duplicate",
    delete: "Delete",
  },

  // Title editor toolbar
  titleEditor: {
    toolbar: "Title formatting",
    bold: "Bold (Ctrl+B)",
    italic: "Italic (Ctrl+I)",
    addLink: "Add Link",
  },

  // Paragraph editor toolbar
  paragraphEditor: {
    toolbar: "Text formatting",
    bold: "Bold (Ctrl+B)",
    italic: "Italic (Ctrl+I)",
    underline: "Underline (Ctrl+U)",
    strikethrough: "Strikethrough",
    subscript: "Subscript",
    superscript: "Superscript",
    addLink: "Add Link",
    bulletList: "Bullet List",
    numberedList: "Numbered List",
    alignLeft: "Align Left",
    alignCenter: "Align Center",
    alignRight: "Align Right",
    clearFormatting: "Clear Formatting",
    insertEmoji: "Insert Emoji",
    fontFamily: "Font Family",
    defaultFont: "Default",
    fontSize: "Font Size",
    defaultSize: "Default",
    textColor: "Text Color",
    highlightColor: "Highlight Color",
    lineHeight: "Line Height",
    letterSpacing: "Letter Spacing",
  },

  // Block actions (BlockWrapper)
  blockActions: {
    drag: "Drag to reorder",
    duplicate: "Duplicate block",
    delete: "Delete block",
    hiddenOnViewport: "Hidden on {viewport}",
    saveAsModule: "Save as Module",
    conditionToggle: "Toggle display condition",
    comments: "Comments ({count})",
  },

  // Toolbar - Section
  section: {
    dropHere: "Drop blocks here",
    columns: "Columns",
    column1: "1 Column",
    column2: "2 Columns",
    column3: "3 Columns",
    ratio12: "1:2 Ratio",
    ratio21: "2:1 Ratio",
  },

  // Text editor link dialog
  linkDialog: {
    editLink: "Edit Link",
    insertLink: "Insert Link",
    updateLink: "Update Link",
    removeLink: "Remove Link",
    cancel: "Cancel",
    urlPlaceholder: "https://example.com",
    urlLabel: "URL",
  },

  // Toolbar - Title
  title: {
    level: "Heading Level",
    heading1: "Heading 1 (36px)",
    heading2: "Heading 2 (28px)",
    heading3: "Heading 3 (22px)",
    heading4: "Heading 4 (18px)",
    fontFamily: "Font Family",
    inheritFont: "Use template font",
    color: "Color",
    align: "Align",
    alignLeft: "Left",
    alignCenter: "Center",
    alignRight: "Right",
    weight: "Weight",
    normal: "Normal",
    bold: "Bold",
  },

  // Emoji picker
  emoji: {
    smileys: "Smileys",
    gestures: "Gestures",
    objects: "Objects",
  },

  // Toolbar - Image
  image: {
    imageUrl: "Image URL",
    imageUrlPlaceholder: "https://...",
    altText: "Alt Text",
    altTextPlaceholder: "Image description",
    width: "Width",
    fullWidth: "Full Width",
    linkUrl: "Link URL",
    openInNewTab: "Open in new tab",
    placeholderUrl: "Placeholder Image",
    placeholderUrlPlaceholder: "https://... (design-time only)",
    placeholderUrlTooltip:
      "Since the image URL uses a placeholder, you can provide a real image here to preview the layout while designing. This is not included in the final output.",
    clickToAdd: "Click to add image URL",
    browseMedia: "Browse Media",
  },

  // Toolbar - Video
  video: {
    videoUrl: "Video URL",
    videoUrlPlaceholder: "https://youtube.com/...",
    youtube: "YouTube",
    vimeo: "Vimeo",
    detected: "Video detected — thumbnail will be generated automatically",
    openInNewTab: "Open in new tab",
    customThumbnail: "Custom Thumbnail",
    optional: "(optional)",
    thumbnailPlaceholder: "Auto-generated from video URL",
    altText: "Alt Text",
    altTextPlaceholder: "Video description",
    width: "Width",
    fullWidth: "Full Width",
    placeholderUrl: "Placeholder Thumbnail",
    placeholderUrlPlaceholder: "https://... (design-time only)",
    placeholderUrlTooltip:
      "Since the video URL uses a placeholder, you can provide a real thumbnail here to preview the layout while designing. This is not included in the final output.",
    addVideo: "Add a video URL",
  },

  // Toolbar - Button
  button: {
    fontFamily: "Font Family",
    inheritFont: "Use template font",
    text: "Text",
    url: "URL",
    urlPlaceholder: "https://...",
    openInNewTab: "Open in new tab",
    background: "Background",
    textColor: "Text Color",
    borderRadius: "Border Radius",
    fontSize: "Font Size",
  },

  // Toolbar - Divider
  divider: {
    style: "Style",
    solid: "Solid",
    dashed: "Dashed",
    dotted: "Dotted",
    color: "Color",
    thickness: "Thickness",
  },

  // Toolbar - Social Icons
  social: {
    icons: "Icons",
    addIcon: "Add Icon",
    addIcons: "Add social icons",
    removeIcon: "Remove",
    platform: "Platform",
    url: "URL",
    urlPlaceholder: "https://...",
    style: "Style",
    styleSolid: "Solid",
    styleOutlined: "Outlined",
    styleRounded: "Rounded",
    styleSquare: "Square",
    styleCircle: "Circle",
    size: "Size",
    sizeSmall: "S",
    sizeMedium: "M",
    sizeLarge: "L",
    spacing: "Spacing",
    align: "Alignment",
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
    items: "Menu Items",
    addItem: "Add Item",
    removeItem: "Remove",
    text: "Text",
    url: "URL",
    urlPlaceholder: "https://example.com",
    openInNewTab: "Open in new tab",
    bold: "Bold",
    underline: "Underline",
    color: "Color",
    linkColor: "Link Color",
    fontSize: "Font Size",
    fontFamily: "Font Family",
    separator: "Separator",
    separatorColor: "Separator Color",
    spacing: "Spacing",
    textAlign: "Alignment",
    addLinks: "Add menu links",
  },

  // Toolbar - Table
  table: {
    dimensions: "Dimensions",
    rows: "Rows",
    columns: "Columns",
    addRow: "Add Row",
    removeRow: "Remove Row",
    addColumn: "Add Column",
    removeColumn: "Remove Column",
    hasHeaderRow: "Header row",
    headerBackgroundColor: "Header Background",
    noHeaderBg: "No background",
    borderColor: "Border Color",
    borderWidth: "Border Width",
    cellPadding: "Cell Padding",
    fontFamily: "Font Family",
    fontSize: "Font Size",
    color: "Text Color",
    textAlign: "Alignment",
    cellPlaceholder: "Enter text...",
    empty: "Add a table",
  },

  // Toolbar - Spacer
  spacer: {
    height: "Height",
  },

  // Toolbar - Countdown
  countdown: {
    targetDate: "Target Date",
    timezone: "Timezone",
    display: "Display",
    days: "Days",
    hours: "Hours",
    minutes: "Minutes",
    seconds: "Seconds",
    separator: "Separator",
    fontFamily: "Font Family",
    inheritFont: "Default",
    digitFontSize: "Digit Size",
    digitColor: "Digit Color",
    labelColor: "Label Color",
    labelFontSize: "Label Size",
    background: "Background",
    labels: "Labels",
    expiry: "Expired Message",
    expiredMessagePlaceholder: "This offer has expired",
    expiredImageUrl: "Expired Image URL",
    hideOnExpiry: "Hide when expired",
    setDate: "Set a target date in the settings panel",
    hidden: "Hidden (expired)",
  },

  // Custom Blocks
  customBlocks: {
    definitionNotFound: "Unknown block type — this block is not registered",
    renderError:
      "This block could not be rendered. Check the block template for errors.",
    fields: {
      required: "Required",
      addItem: "Add item",
      removeItem: "Remove",
      maxItemsReached: "Maximum items reached",
      minItemsRequired: "Minimum {count} items required",
    },
    toolbar: {
      noDefinition:
        "Register this block type in your SDK configuration to edit its properties",
    },
    dataSource: {
      fetchButton: "Load content",
      changeButton: "Change",
      fetching: "Loading...",
      readOnlyTooltip: "This value is loaded from your data source",
      fetchError: "Failed to load content",
    },
  },

  // Toolbar - HTML
  html: {
    content: "HTML Content",
    preview: "Custom HTML block",
    empty: "Add HTML content in the panel",
    sanitizationHint: "Scripts and unsafe elements are removed on export.",
  },

  // Toolbar - Common block settings
  blockSettings: {
    spacing: "Spacing",
    padding: "Padding",
    margin: "Margin",
    background: "Background",
    color: "Color",
    display: "Display",
    showOnDesktop: "Show on desktop",
    showOnTablet: "Show on tablet",
    showOnMobile: "Show on mobile",
    hiddenOnDevice: "Hidden on {device}",
    customCss: "Custom CSS",
    css: "CSS",
    cssPlaceholder: "/* Custom styles */",
    displayCondition: "Display Condition",
    selectCondition: "Select condition",
    removeCondition: "Remove condition",
    noCondition: "Always visible",
    conditionApplied: "Condition applied",
    customCondition: "Custom condition",
    customConditionLabel: "Condition name",
    customConditionBefore: "Before (opening logic)",
    customConditionAfter: "After (closing logic)",
    applyCondition: "Apply",
    cancelCondition: "Cancel",
    customBadge: "Custom",
    restoreHiddenBlocks: "Show all hidden blocks",
  },

  // Template settings
  templateSettings: {
    layout: "Layout",
    widthPreset: "Width Preset",
    customWidth: "Custom Width",
    appearance: "Appearance",
    backgroundColor: "Background Color",
    fontFamily: "Font Family",
    preheaderText: "Preheader Text",
    preheaderTextPlaceholder:
      "Preview text shown after subject line in inbox...",
    preheaderTextHint:
      "This text appears after the subject line in email client previews. Supports placeholders.",
    tips: "Tips",
    tip1: "600px is the standard width for email templates",
    tip2: "Use web-safe fonts for best compatibility",
    tip3: "Light backgrounds work best for readability",
  },

  // Spacing control
  spacingControl: {
    lockAll: "Lock all sides",
    unlock: "Unlock sides",
    decreaseTop: "Decrease top",
    increaseTop: "Increase top",
    decreaseLeft: "Decrease left",
    increaseLeft: "Increase left",
    decreaseRight: "Decrease right",
    increaseRight: "Increase right",
    decreaseBottom: "Decrease bottom",
    increaseBottom: "Increase bottom",
  },

  // Merge Tag
  mergeTag: {
    clickToEdit: "Click to edit",
    remove: "Remove merge tag",
    insert: "Insert merge tag",
    add: "Add merge tag",
    editValue: "Edit merge tag value",
    deleteMergeTag: "Delete merge tag",
  },

  // Snapshot history (cloud)
  snapshotHistory: {
    tooltip: "Version history",
    dropdownTitle: "Version History",
    noSnapshots: "No versions yet",
    auto: "auto",
    justNow: "Just now",
    minutesAgo: "{minutes}m ago",
    hoursAgo: "{hours}h ago",
    daysAgo: "{days}d ago",
    olderSnapshot: "Older version",
    newerSnapshot: "Newer version",
  },

  // Canvas
  canvas: {
    noBlocks: "No blocks yet",
    dragHint: "Start from scratch by dragging blocks from the sidebar",
    dropHere: "Drop here",
    aiHintChat: "or let",
    aiHintChatSuffix: "generate a complete template for you in seconds",
    aiHintDesign:
      "Have an existing design? Upload a screenshot, image, or PDF and",
    aiHintDesignSuffix: "will instantly recreate it",
  },

  // Media Library (cloud)
  mediaLibrary: {
    title: "Media Library",
    searchPlaceholder: "Search files...",
    allFiles: "All Files",
    filterAll: "All Types",
    filterImages: "Images",
    filterDocuments: "Documents",
    filterVideos: "Videos",
    filterAudio: "Audio",
    newFolder: "New Folder",
    folderName: "Folder name",
    noFiles: "No files found",
    dropOrClick: "Drop files here or click to upload",
    acceptedFormats: "Images, PDF, Video, Audio, Documents (max 10MB)",
    uploading: "Uploading...",
    uploadingProgress: "Uploading {current} of {total}...",
    selectImage: "Select Image",
    selectFile: "Select File",
    deleteSelected: "Delete",
    copyUrl: "Copy URL",
    copied: "Copied!",
    browseMedia: "Browse Media Library",
    renameFolder: "Rename folder",
    addSubfolder: "Add subfolder",
    subfolderName: "Subfolder name",
    sortNewest: "Newest First",
    sortOldest: "Oldest First",
    sortNameAsc: "Name A-Z",
    sortNameDesc: "Name Z-A",
    sortSizeAsc: "Smallest First",
    sortSizeDesc: "Largest First",
    moveSelected: "Move",
    moveToRoot: "All Files",
    currentFolder: "(current)",
    confirmDelete: "Delete this file?",
    renameFile: "Rename",
    editFile: "Edit File",
    fileName: "Filename",
    altText: "Alt Text",
    altTextPlaceholder: "Describe this image for accessibility",
    saveChanges: "Save",
    cancel: "Cancel",
    frequentlyUsed: "Frequently Used",
    deleteWarningTitle: "Delete File",
    deleteWarningMessage:
      "This file will be permanently deleted and cannot be recovered.",
    deleteWarningUsageNote:
      "The following files are used in templates. Deleting them may break those templates.",
    deleteAnyway: "Delete file",
    usedInTemplates: "Used in {count} template(s)",
    viewGrid: "Grid view",
    viewList: "List view",
    showFolders: "Show folders",
    hideFolders: "Hide folders",
    importFromUrl: "Import from URL",
    importUrlPlaceholder: "https://example.com/image.jpg",
    import: "Import",
    importing: "Importing...",
    importError: "Failed to import from URL",
    conversionLabel: "Size",
    conversionOriginal: "Original",
    conversionSmall: "Small (150px)",
    conversionMedium: "Medium (600px)",
    conversionLarge: "Large (1200px)",
    replaceFile: "Replace File",
    replaceWarningTitle: "Replace File",
    replaceWarningMessage:
      "You are about to replace this file. The replacement must have the same file extension ({extension}).",
    replaceWarningUsageNote:
      "This file is used in {count} template(s). Replacing it will update all references.",
    replaceSelectFile: "Select replacement file",
    replace: "Replace",
    replacing: "Replacing...",
    replaceError: "Failed to replace file",
    saving: "Saving...",
    cropAspectRatio: "Aspect Ratio",
    cropFree: "Free",
    cropSquare: "1:1",
    cropLandscape43: "4:3",
    cropLandscape169: "16:9",
    cropOriginal: "Original",
    cropMaxWidth: "Max Width",
    cropMaxHeight: "Max Height",
    cropOutputSize: "Output Size",
    cropPixels: "px",
    cropOptional: "(optional)",
    storageTooltip: "{used} of {total} used ({remaining} remaining)",
  },

  // Test Email (cloud)
  testEmail: {
    title: "Send Test Email",
    recipientLabel: "Recipient",
    send: "Send",
    sending: "Sending...",
    cancel: "Cancel",
    success: "Test email sent successfully",
    button: "Test",
  },

  // AI Rewrite (cloud)
  aiRewrite: {
    title: "AI Rewrite",
    tone: "Tone",
    length: "Length",
    clarity: "Clarity",
    professional: "Professional",
    casual: "Casual",
    friendly: "Friendly",
    urgent: "Urgent",
    persuasive: "Persuasive",
    shorter: "Shorter",
    longer: "Longer",
    summarize: "Summarize",
    simplify: "Simplify",
    fixGrammar: "Fix grammar",
    improveReadability: "Improve readability",
    customInstruction: "Custom instruction",
    customPlaceholder: "Describe how to rewrite...",
    rewrite: "Rewrite",
    rewriting: "Rewriting...",
    undo: "Undo",
    redo: "Redo",
    refine: "Refine further",
    error: "Failed to rewrite text",
  },

  // AI Chat (cloud)
  aiChat: {
    title: "AI Assistant",
    button: "AI",
    inputPlaceholder: "Describe your email template...",
    send: "Send",
    generating: "Generating...",
    applied: "Changes applied to template.",
    applyFailed: "Could not apply changes to template. Please try again.",
    revert: "Revert changes",
    reapply: "Re-apply changes",
    error: "Failed to generate template",
    clear: "Clear chat",
    placeholder:
      "Describe the email template you want to create, or ask to modify the current one.",
    loadingHistory: "Loading conversation...",
  },

  // Template Scoring (cloud)
  scoring: {
    button: "Score",
    title: "Template Score",
    rescore: "Re-score",
    scoring: "Analyzing template...",
    overallScore: "Overall Score",
    categories: {
      spam: "Spam Risk",
      readability: "Readability",
      accessibility: "Accessibility",
      bestPractices: "Best Practices",
    },
    severity: {
      high: "High",
      medium: "Medium",
      low: "Low",
    },
    fix: "Fix with AI",
    fixing: "Fixing...",
    fixed: "Fixed",
    findings: "findings",
    noFindings: "No issues found",
    error: "Failed to analyze template",
    fixError: "Failed to apply fix",
    emptyState:
      "Score your template to get actionable feedback on spam risk, readability, accessibility, and best practices.",
  },

  // AI Feature Menu (cloud)
  aiMenu: {
    aiAssistant: "AI Assistant",
    aiAssistantDesc: "Chat with AI to create or modify your template",
    designToTemplate: "Design to Template",
    designToTemplateDesc: "Generate a template from an image or PDF",
    templateScore: "Template Score",
    templateScoreDesc: "Analyze quality, spam risk, and accessibility",
    disclaimer: "AI can make mistakes. Please verify before approving.",
  },

  // Comments (cloud)
  comments: {
    title: "Comments",
    placeholder: "Write a comment...",
    replyPlaceholder: "Write a reply...",
    reply: "Reply",
    resolve: "Resolve",
    unresolve: "Unresolve",
    resolved: "Resolved",
    delete: "Delete",
    edit: "Edit",
    cancel: "Cancel",
    save: "Save",
    noComments: "No comments yet",
    noCommentsHint:
      "Start a conversation by adding a comment to the template or a specific block.",
    addComment: "Add comment",
    deleteConfirm: "Delete this comment?",
    filterAll: "All",
    filterUnresolved: "Unresolved",
    filterBlock: "This block",
    ownedByYou: "You",
    edited: "edited",
    resolvedBy: "Resolved by {name}",
    replyOne: "{count} Reply",
    replyMany: "{count} Replies",
    missingBlock: "Missing block",
    saveTemplateFirst: "Save the template before commenting on this block.",
    button: "Comments",
  },

  // Collaboration (cloud)
  collaboration: {
    connected: "Collaboration mode active",
    disconnected: "Collaboration disconnected",
    reconnecting: "Reconnecting...",
    blockLockedBy: "Editing by {name}",
    usersOnline: "{count} users online",
  },

  // Sidebar
  sidebarNav: {
    browseModules: "Browse saved modules",
    expandSidebar: "Expand block sidebar",
  },

  // Saved Modules (cloud)
  modules: {
    title: "Saved Modules",
    saveAsModule: "Save as Module",
    moduleName: "Module Name",
    moduleNamePlaceholder: "e.g. Header, Footer, CTA...",
    selectBlocks: "Select Blocks",
    save: "Save Module",
    saving: "Saving...",
    cancel: "Cancel",
    noModules: "No saved modules yet",
    noModulesHint: "Save blocks from your templates to reuse them later.",
    search: "Search modules...",
    insert: "Insert",
    delete: "Delete",
    deleteConfirm: "Delete this module?",
    blockCount: "{count} block(s)",
    browse: "Browse Modules",
    selectToPreview: "Select a module to preview",
    insertAtBeginning: "At beginning",
    insertAfterBlock: "After {block}",
    insertAtEnd: "At end",
    insertPosition: "Insert position",
    close: "Close",
  },

  // Design Reference (cloud)
  designReference: {
    title: "Design Reference",
    button: "Design",
    uploadImage: "Image",
    uploadPdf: "PDF",
    dropHint: "Drop a file here or click to browse",
    acceptedImages: "PNG, JPG, WebP (max 10MB)",
    acceptedPdf: "PDF (max 10MB)",
    promptLabel: "Instructions (optional)",
    promptPlaceholder:
      "Describe any adjustments or preferences for the generated template...",
    generate: "Generate from design",
    generating: "Analyzing design and generating template...",
    replaceWarning:
      "Generating from a design reference will replace the existing template content.",
    replaceConfirm: "Replace and generate",
    replaceCancel: "Cancel",
    error: "Failed to generate template from design",
    fileTooLarge: "File is too large. Maximum size is 10MB.",
    invalidFileType:
      "This file type is not supported. Upload a PNG, JPG, WebP, or PDF.",
  },
} as const;
