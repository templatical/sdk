export default {
  // Footer (OSS only)
  footer: {
    poweredBy: "Powered by",
    openSource: "Open Source",
  },

  // Header — template name + save state. Shown only when a templates provider
  // is configured.
  header: {
    save: "Save",
    saving: "Saving...",
    saved: "Saved",
    unsaved: "Unsaved",
    saveFailed: "Save failed",
    saveNoTemplate: "Load or create a template first",
    templateName: "Template name",
    rename: "Rename template",
    untitled: "Untitled",
    updatedAt: "Updated {time}",
    createdAt: "Created {time}",
    updatedJustNow: "Updated just now",
    createdJustNow: "Created just now",
  },

  // Relative timestamps, shared by every surface that shows one: the header's
  // updated line, saved blocks, comments and version history.
  time: {
    justNow: "Just now",
    minutesAgo: "{minutes}m ago",
    hoursAgo: "{hours}h ago",
    daysAgo: "{days}d ago",
  },

  // History (undo/redo)
  history: {
    collabWarning: "Undo may affect collaborators' recent changes",
    undo: "Undo",
    redo: "Redo",
  },

  // Viewport toggle
  viewport: {
    label: "Viewport",
    desktop: "Desktop",
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
    alignJustify: "Justify",
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
    emojiItemLabel: "Insert emoji {emoji}",
  },

  // Block actions (BlockWrapper)
  blockActions: {
    drag: "Drag to reorder, or press Space to move with keyboard",
    dragLifted:
      "Moving {block}. Use up and down arrow keys to reposition, Space or Enter to drop, Escape to cancel.",
    duplicate: "Duplicate block",
    delete: "Delete block",
    hiddenOnViewport: "Hidden on {viewport}",
    saveAsBlock: "Save as Block",
    conditionToggle: "Toggle display condition",
    comments: "Comments ({count})",
    lifted: "{block} lifted. Position {position} of {total}.",
    moved: "{block} moved to position {position} of {total}.",
    dropped: "{block} dropped at position {position} of {total}.",
    cancelled: "Move cancelled. {block} returned to position {position}.",
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
    borderRadius: "Border Radius",
    wrapperEnable: "Add wrapper",
    stackOnMobile: "Stack on mobile",
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
    colorLabel: "Link Color",
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
    widthCustom: "Custom",
    height: "Height",
    heightAuto: "Auto",
    heightCustom: "Custom",
    borderRadius: "Border Radius",
    linkUrl: "Link URL",
    openInNewTab: "Open in new tab",
    placeholderUrl: "Placeholder Image",
    optional: "(optional)",
    placeholderUrlPlaceholder: "https://... (design-time only)",
    placeholderUrlTooltip:
      "Since the image URL uses a merge tag, you can provide a real image here to preview the layout while designing. This is not included in the final output.",
    clickToAdd: "Click to add image URL",
    browseMedia: "Browse Media",
    dropToUpload: "Drop image to upload",
    uploading: "Uploading…",
    decorative: "Decorative image",
    decorativeHint:
      "Hidden from screen readers. Use only for spacers and visual flourishes.",
  },

  // Toolbar - Video
  video: {
    videoUrl: "Video URL",
    videoUrlPlaceholder: "https://youtube.com/...",
    openInNewTab: "Open in new tab",
    customThumbnail: "Custom Thumbnail",
    optional: "(optional)",
    thumbnailPlaceholder: "Auto-generated from video URL",
    altText: "Alt Text",
    altTextPlaceholder: "Video description",
    width: "Width",
    fullWidth: "Full Width",
    height: "Height",
    heightAuto: "Auto",
    heightCustom: "Custom",
    placeholderUrl: "Placeholder Thumbnail",
    placeholderUrlPlaceholder: "https://... (design-time only)",
    placeholderUrlTooltip:
      "Since the video URL uses a merge tag, you can provide a real thumbnail here to preview the layout while designing. This is not included in the final output.",
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
    width: "Width",
    widthAuto: "Fit to content",
    fullWidth: "Full Width",
    widthCustom: "Custom",
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
      website: "Website",
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
    sanitizationHint:
      "HTML is exported as-is and isn't sanitized — make sure the content is safe.",
  },

  // Toolbar - Common block settings
  blockSettings: {
    spacing: "Spacing",
    padding: "Padding",
    background: "Background",
    color: "Color",
    display: "Display",
    showOnDesktop: "Show on desktop",
    showOnMobile: "Show on mobile",
    hiddenOnDevice: "Hidden on {device}",
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
    textColor: "Text Color",
    linkColor: "Link Color",
    linkUnderline: "Underline Links",
    fontFamily: "Font Family",
    preheaderText: "Preheader Text",
    preheaderTextPlaceholder:
      "Preview text shown after subject line in inbox...",
    preheaderTextHint:
      "This text appears after the subject line in email client previews. Supports merge tags.",
    language: "Language",
    contentLocale: "Content language",
    contentLocaleHint:
      "BCP 47 code (e.g. en, de, pt-BR). Sets the rendered email's lang attribute so screen readers pronounce content correctly.",
    tips: "Tips",
    tip1: "600px is the standard width for email templates",
    tip2: "Use web-safe fonts for best compatibility",
    tip3: "Light backgrounds work best for readability",
  },

  // Spacing control
  spacingControl: {
    lockAll: "Lock all sides",
    unlock: "Unlock sides",
    top: "Top",
    right: "Right",
    bottom: "Bottom",
    left: "Left",
    decreaseTop: "Decrease top",
    increaseTop: "Increase top",
    decreaseLeft: "Decrease left",
    increaseLeft: "Increase left",
    decreaseRight: "Decrease right",
    increaseRight: "Increase right",
    decreaseBottom: "Decrease bottom",
    increaseBottom: "Increase bottom",
  },

  // Color Picker
  colorPicker: {
    pickColor: "Pick a color",
    hexValue: "Hex color value",
    notSet: "Not set",
    clear: "Clear color",
    presetColors: "Preset colors",
  },

  // Merge Tag
  mergeTag: {
    clickToEdit: "Click to edit",
    remove: "Remove merge tag",
    insert: "Insert merge tag",
    insertShort: "Merge tag",
    editValue: "Edit merge tag value",
    deleteMergeTag: "Delete merge tag",
    suggestionEmpty: "No matching merge tags",
    picker: {
      title: "Insert merge tag",
      searchPlaceholder: "Search merge tags",
      searchAriaLabel: "Search merge tags",
      noResults: "No matching merge tags",
      empty: "No merge tags configured",
      otherGroup: "Other",
      close: "Close",
      groupCount: "{count}",
      sample: "Preview: {sample}",
    },
  },

  // Logic tags (standalone, separate from merge tags)
  logicTag: {
    insert: "Insert logic",
    insertShort: "Logic",
    picker: {
      title: "Insert logic",
      searchPlaceholder: "Search logic tags",
      searchAriaLabel: "Search logic tags",
      noResults: "No matching logic tags",
      empty: "No logic tags configured",
      otherGroup: "Other",
      close: "Close",
    },
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

  // Sidebar
  savedBlocks: {
    title: "Saved Blocks",
    saveAsBlock: "Save as Block",
    name: "Name",
    namePlaceholder: "e.g. Header, Footer, CTA...",
    save: "Save Block",
    saving: "Saving...",
    cancel: "Cancel",
    empty: "No saved blocks yet",
    emptyHint: "Save blocks from your templates to reuse them later.",
    noResults: "No saved blocks match your search",
    search: "Search saved blocks...",
    loading: "Loading saved blocks…",
    category: "Category",
    categoryPlaceholder: "e.g. Headers, Promos... (optional)",
    allCategories: "All categories",
    filterByCategory: "Filter by category",
    insert: "Insert",
    rename: "Rename",
    delete: "Delete",
    deleteConfirm: "Delete this saved block?",
    blockCount: "{count} block(s)",
    browse: "Browse Saved Blocks",
    selectToPreview: "Select a saved block to preview",
    insertAtBeginning: "At beginning",
    insertAfterBlock: "After {block}",
    insertAtEnd: "At end",
    insertPosition: "Insert position",
    close: "Close",
    pickToolbar: "Saved block selection",
    pickCount: "{count} block(s) selected",
    pickHint: "Click blocks to add or remove them",
    savingCount: "Saving {count} block(s):",
    reorderHint: "Drag to reorder — blocks are saved in this order",
    reorderHandle: "Reorder {block}, position {position} of {total}",
    reorderAnnouncement: "{block} moved to position {position} of {total}",
    expand: "Expand",
    collapse: "Collapse",
    expandPreview: "Expand {block} preview",
    collapsePreview: "Collapse {block} preview",
  },
  comments: {
    button: "Comments",
    title: "Comments",
    placeholder: "Write a comment...",
    replyPlaceholder: "Write a reply...",
    reply: "Reply",
    resolve: "Resolve",
    unresolve: "Unresolve",
    delete: "Delete",
    edit: "Edit",
    cancel: "Cancel",
    save: "Save",
    noComments: "No comments yet",
    noCommentsHint:
      "Start a conversation by adding a comment to the template or a specific block.",
    deleteConfirm: "Delete this comment?",
    filterAll: "All",
    filterUnresolved: "Unresolved",
    filterBlock: "This block",
    jumpToBlock: "Block",
    ownedByYou: "You",
    edited: "edited",
    resolvedBy: "Resolved by {name}",
    replyOne: "{count} Reply",
    replyMany: "{count} Replies",
    missingBlock: "Missing block",
    saveTemplateFirst: "Save the template before commenting on this block.",
  },
  versionHistory: {
    tooltip: "Version history",
    dropdownTitle: "Version history",
    empty: "No versions yet",
    auto: "auto",
    olderVersion: "Older version",
    newerVersion: "Newer version",
  },
  versionPreview: {
    message: "You are previewing an earlier version of this template.",
    cancel: "Cancel",
    restore: "Restore this version",
    restoreConfirm: {
      title: "Restore this version?",
      unsavedWithSave:
        "You have unsaved changes. Save them first and they stay in your history — restore without saving and they are lost.",
      unsavedNoSave:
        "You have unsaved changes and nowhere to save them. Restoring this version will lose them.",
      saveAndRestore: "Save, then restore",
      restoreAnyway: "Restore anyway",
      cancel: "Cancel",
    },
  },
  previewResolution: {
    resolving: "Resolving preview…",
    failed: "Preview couldn't be resolved — showing the unresolved template.",
    hint: "Preview uses resolved data from your backend.",
  },
  mergeTagPreview: {
    label: "Merge tag view",
    sample: "Sample",
    labelView: "Label",
  },
  testEmail: {
    title: "Send Test Email",
    recipientLabel: "Recipient",
    recipientPlaceholder: "you@example.com",
    invalidAddress: "Enter a valid email address.",
    preview: "Preview",
    previewHint:
      "Merge tags are shown unresolved — your backend fills them in.",
    previewHintSample:
      "Merge tags show example values — your backend fills in the real data.",
    recipientNotAllowed: "That address isn't in the allowed list.",
    send: "Send",
    sending: "Sending...",
    cancel: "Cancel",
    success: "Test email sent successfully",
    button: "Test",
  },
  sidebarNav: {
    browseSavedBlocks: "Browse saved blocks",
    palette: "Block palette",
    insertBlock: "Insert {block} block",
  },

  // Landmark region labels for assistive technology
  landmarks: {
    canvas: "Email canvas",
    blockToolbar: "Block properties",
    rightSidebar: "Block properties and template settings",
    reorderAnnouncements: "Block reorder announcements",
  },

  // Design Reference (cloud)
  errors: {
    editorLoading: "Loading editor...",
    editorLoadFailed: "Failed to load editor.",
    retry: "Retry",
  },

  issues: {
    panelTitle: "Issues",
    panelTabLabel: "Issues",
    groupErrors: "Errors",
    groupWarnings: "Warnings",
    groupInfo: "Info",
    jump: "Jump to block",
    fix: "Fix",
    emptyState: "No issues — looking good.",
    badgeError: "Has errors",
    badgeWarning: "Has warnings",
    issueCountTooltip: "{count} issue(s)",
  },

  smallScreen: {
    title: "Larger screen required",
    message:
      "The editor needs more space than this screen offers. Open it on a tablet or desktop to start editing.",
  },
};
