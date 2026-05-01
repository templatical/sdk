export default {
  // Footer (OSS only)
  footer: {
    poweredBy: "Powered by",
    openSource: "Open Source",
  },

  // History (undo/redo)
  history: {
    undo: "Undo",
    redo: "Redo",
    collabWarning: "Undo may affect collaborators' recent changes",
  },

  // Viewport toggle
  viewport: {
    label: "Viewport",
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
    emojiItemLabel: "Insert emoji {emoji}",
    closeEmojiPicker: "Close emoji picker",
  },

  // Block actions (BlockWrapper)
  blockActions: {
    drag: "Drag to reorder, or press Space to move with keyboard",
    dragLifted:
      "Moving {block}. Use up and down arrow keys to reposition, Space or Enter to drop, Escape to cancel.",
    duplicate: "Duplicate block",
    delete: "Delete block",
    hiddenOnViewport: "Hidden on {viewport}",
    saveAsModule: "Save as Module",
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

  // Sidebar
  sidebarNav: {
    browseModules: "Browse saved modules",
    expandSidebar: "Expand block sidebar",
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
};
