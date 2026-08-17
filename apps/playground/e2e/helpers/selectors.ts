/** Centralized test selectors — prefer data-testid for stability */

export const SELECTORS = {
  // Screens
  chooserScreen: '[data-testid="chooser-screen"]',
  editorScreen: '[data-testid="editor-screen"]',

  // Chooser
  templateCard: '[data-testid="template-card"]',
  blankTemplateCard: '[data-testid="blank-template-card"]',

  // Editor toolbar (playground)
  backButton: '[data-testid="toolbar-back"]',
  configButton: '[data-testid="toolbar-config"]',
  exportButton: '[data-testid="toolbar-export"]',
  shareButton: '[data-testid="toolbar-share"]',
  themeButton: '[data-testid="toolbar-theme"]',
  tourButton: '[data-testid="toolbar-tour"]',
  localeSelect: '[data-testid="locale-select"]',

  // Canvas
  editorContainer: '[data-testid="editor-container"]',
  canvasWrapper: '[data-testid="canvas-wrapper"]',
  canvasBody: ".tpl-body",
  canvasBlocks: ".tpl-canvas-blocks",
  canvasEmpty: ".tpl-canvas-empty",
  canvasEmptyIcon: ".tpl-canvas-empty-icon",
  canvasEmptyTitle: ".tpl-canvas-empty-title",

  // Blocks
  block: ".tpl-block",
  blockSelected: ".tpl-block--selected",
  blockActions: ".tpl-block-actions",
  blockDeleteBtn: ".tpl-block-delete-btn",
  blockDragHandle: ".tpl-block-btn",

  // Sidebar
  sidebarRail: ".tpl-sidebar-rail",

  // Saved blocks (OSS, backed by the playground's localStorage provider)
  savedBlocksRailBtn: 'button[aria-label="Browse saved blocks"]',
  savedBlocksBrowser: '[data-testid="saved-blocks-browser"]',
  savedBlocksBrowserTitle: "#tpl-saved-blocks-browser-title",
  savedBlocksCard: '[data-testid="saved-block-card"]',
  savedBlocksRenameBtn: 'button[aria-label="Rename"]',
  savedBlocksDeleteBtn: 'button[aria-label="Delete"]',
  saveBlockDialogTitle: "#tpl-save-block-title",
  savedBlocksSaveSummary: '[data-testid="saved-blocks-save-summary"]',
  // Pick session (canvas multi-pick started from a block's bookmark action)
  savedBlocksSaveAction: 'button[aria-label="Save as Block"]',
  savedBlocksPickBar: '[data-testid="saved-blocks-pick-bar"]',
  savedBlocksPickCount: '[data-testid="saved-blocks-pick-count"]',
  savedBlocksPickConfirm: '[data-testid="saved-blocks-pick-confirm"]',
  savedBlocksPickCancel: '[data-testid="saved-blocks-pick-cancel"]',
  blockPicked: "[data-tpl-picked]",
  // Save dialog's reorderable preview list (seeded in pick order)
  savedBlocksReorderList: '[data-testid="saved-blocks-reorder-list"]',
  savedBlocksReorderRow: '[data-testid="saved-blocks-reorder-row"]',
  savedBlocksReorderHandle: '[data-testid="saved-blocks-reorder-handle"]',
  // Categories (optional free-text grouping)
  savedBlocksNameInput: '[data-testid="saved-blocks-name-input"]',
  savedBlocksCategoryInput: '[data-testid="saved-blocks-category-input"]',
  savedBlocksCategoryFilter: '[data-testid="saved-blocks-category-filter"]',
  savedBlocksCategoryBadge: '[data-testid="saved-block-category"]',
  // Templates (BYO save/load; the playground's localStorage provider is always on)
  templateName: '[data-testid="template-name"]',
  templateNameInput: '[data-testid="template-name-input"]',
  templateSave: '[data-testid="template-save"]',
  saveStatusUnsaved: '[data-testid="save-status-unsaved"]',
  saveStatusSaved: '[data-testid="save-status-saved"]',
  saveStatusError: '[data-testid="save-status-error"]',

  // Version history (BYO; the playground's localStorage provider is always on)
  versionHistory: '[data-testid="version-history"]',
  versionHistoryToggle: '[data-testid="version-history-toggle"]',
  versionHistoryDropdown: '[data-testid="version-history-dropdown"]',
  versionHistoryEntry: '[data-testid="version-history-entry"]',
  versionHistoryEmpty: '[data-testid="version-history-empty"]',
  versionHistoryOlder: '[data-testid="version-history-older"]',
  versionHistoryNewer: '[data-testid="version-history-newer"]',
  versionPreviewBanner: '[data-testid="version-preview-banner"]',
  versionPreviewCancel: '[data-testid="version-preview-cancel"]',
  versionPreviewRestore: '[data-testid="version-preview-restore"]',
  restoreVersionDialog: '[data-testid="restore-version-dialog"]',
  restoreVersionCancel: '[data-testid="restore-version-cancel"]',
  restoreVersionDiscard: '[data-testid="restore-version-discard"]',
  restoreVersionSaveFirst: '[data-testid="restore-version-save-first"]',

  // Comments (BYO review store; the playground's localStorage provider is always on)
  commentsTrigger: '[data-testid="comments-trigger"]',
  commentsSidebar: '[data-testid="comments-sidebar"]',
  commentsFilterAll: '[data-testid="comments-filter-all"]',
  commentsFilterUnresolved: '[data-testid="comments-filter-unresolved"]',
  commentThread: '[data-testid="comment-thread"]',
  commentsInput: '[data-testid="comments-input"]',
  commentsSend: '[data-testid="comments-send"]',
  commentResolve: '[data-testid="comment-resolve"]',
  commentEdit: '[data-testid="comment-edit"]',
  commentDelete: '[data-testid="comment-delete"]',
  // `deletingId` is a single ref, so at most one confirm strip is rendered across
  // the whole panel — this needs no thread scoping to be unambiguous.
  commentDeleteConfirm: '[data-testid="comment-delete-confirm"]',
  commentReply: '[data-testid="comment-reply"]',

  // Test email (BYO sender; the playground's fake provider is always on)
  testEmailTrigger: '[data-testid="test-email-trigger"]',
  testEmailRecipient: '[data-testid="test-email-recipient"]',
  testEmailSend: '[data-testid="test-email-send"]',
  testEmailCancel: '[data-testid="test-email-cancel"]',
  testEmailSuccess: '[data-testid="test-email-success"]',
  testEmailError: '[data-testid="test-email-error"]',
  testEmailPreview: '[data-testid="test-email-preview"]',
  /**
   * The dialog itself. Scoping through this matters: the preview reuses the
   * header's `ViewportToggle`, so an unscoped `[role="radiogroup"]` would also
   * match the editor header's own viewport control.
   */
  testEmailDialog: '[role="dialog"][aria-labelledby="tpl-test-email-title"]',
  testEmailPreviewViewport:
    '[role="dialog"][aria-labelledby="tpl-test-email-title"] [role="radiogroup"]',
  // Shared chrome-free block renderer, also used by the saved-blocks previews.
  blockPreviewCanvas: '[data-testid="block-preview-canvas"]',
  savedBlocksEditCategory: '[data-testid="saved-blocks-edit-category"]',
  savedBlocksLoading: '[data-testid="saved-blocks-loading"]',
  savedBlocksBrowserClose: '[data-testid="saved-blocks-browser-close"]',
  savedBlocksPreviewCanvas: '[data-testid="block-preview-canvas"]',

  // Small-screen gate (#235)
  smallScreenNotice: '[data-testid="small-screen-notice"]',

  // Right sidebar
  rightSidebar: ".tpl-right-sidebar",
  rightTabContent: "#tpl-tab-content",
  rightTabSettings: "#tpl-tab-settings",
  rightTabIssues: "#tpl-tab-issues",
  rightPanelContent: "#tpl-tabpanel-content",
  rightPanelSettings: "#tpl-tabpanel-settings",
  rightPanelIssues: "#tpl-tabpanel-issues",

  // Text editing
  textToolbar: ".tpl-text-toolbar",
  textToolbarBtn: ".tpl-text-toolbar-btn",
  textToolbarBtnActive: ".tpl-text-toolbar-btn--active",
  textContent: ".tpl-text-content",
  // Rich-text color controls — the shared ColorPicker (hex wheel), not a native input
  textColorPicker: '[data-testid="text-color-picker"]',
  highlightColorPicker: '[data-testid="highlight-color-picker"]',

  // Viewport & toggles
  viewportGroup: '[role="radiogroup"][aria-label="Viewport"]',
  viewportDesktop: '[role="radio"][aria-label="Desktop"]',
  viewportMobile: '[role="radio"][aria-label="Mobile"]',
  darkModeToggle: ".tpl-dark-mode-toggle",
  previewToggle: ".tpl-preview-toggle",

  // Merge tag sample values. The mode toggle renders only when some configured
  // tag declares a `sample`, and only while a preview is showing.
  mergeTagModeToggle: '[data-testid="merge-tag-mode-toggle"]',
  // Preview resolution (the consumer `resolvePreview` hook)
  previewResolutionLoading: '[data-testid="preview-resolution-loading"]',
  previewResolutionFailed: '[data-testid="preview-resolution-failed"]',

  // Display conditions. The filter icon simulates a falsy condition; the restore
  // button undoes every such hide. Both step aside while a resolver owns the
  // preview — see the "a resolver owns display conditions" e2e group.
  /** Header of the sidebar's Display condition section — collapsed by default. */
  displayConditionSection: '[data-testid="display-condition-section"]',
  displayConditionSelect: '[data-testid="display-condition-select"]',
  conditionToggle: '[data-testid="condition-toggle"]',
  restoreHiddenBlocks: '[data-testid="restore-hidden-blocks"]',
  /** A merge tag still rendered as a chip — i.e. NOT substituted. */
  mergeTagSpan: "span[data-merge-tag]",
  /** The dotted-underline cue used for tags in plain-string fields. */
  mergeTagLabelCue: ".tpl-merge-tag-label",

  // Export modal
  exportModal: '[data-testid="export-modal"]',
  exportModalClose: '[data-testid="export-modal-close"]',
  exportTabMjml: '[data-testid="export-tab-mjml"]',
  exportTabHtml: '[data-testid="export-tab-html"]',
  exportTabJson: '[data-testid="export-tab-json"]',
  exportCopyBtn: '[data-testid="export-copy"]',
  exportDownloadBtn: '[data-testid="export-download"]',
  exportHtmlError: '[data-testid="export-html-error"]',

  // Feature overlay
  featureOverlay: '[data-testid="feature-overlay"]',
  featureOverlayClose: '[data-testid="feature-overlay-close"]',

  // Onboarding
  onboardingSpotlight: ".pg-onboarding-spotlight",
  onboardingTooltip: ".pg-onboarding-tooltip",
  onboardingSkip: '[data-testid="onboarding-skip"]',
  onboardingNext: '[data-testid="onboarding-next"]',

  // Rich-text editable root (TipTap wrapper)
  textEditable: ".tpl-text-editable",

  // Merge tag autocomplete
  mergeTagSuggestionPopup: '[data-testid="merge-tag-suggestion-popup"]',
  mergeTagSuggestionList: '[data-testid="merge-tag-suggestion-list"]',
  mergeTagSuggestionEmpty: '[data-testid="merge-tag-suggestion-empty"]',
  // Inline merge tag node rendered by MergeTagNodeView. The raw value
  // lives in data-tooltip on the inner display span.
  mergeTagNode: ".tpl-merge-tag-node",

  // Built-in merge tag picker (SDK)
  mergeTagPickerModal: '[data-testid="merge-tag-picker-modal"]',
  mergeTagPickerSearch: '[data-testid="merge-tag-picker-search"]',
  mergeTagPickerList: '[data-testid="merge-tag-picker-list"]',
  mergeTagPickerItem: '[data-testid="merge-tag-picker-item"]',
  mergeTagPickerGroupHeader: '[data-testid="merge-tag-picker-group-header"]',
  mergeTagPickerCancel: '[data-testid="merge-tag-picker-cancel"]',
  mergeTagPickerClose: '[data-testid="merge-tag-picker-close"]',
  mergeTagPickerEmpty: '[data-testid="merge-tag-picker-empty"]',

  // Playground's consumer-owned onRequest modal (separate from SDK picker)
  playgroundMergeTagModal: '[data-testid="playground-merge-tag-modal"]',

  // Config modal toggles (playground)
  configEnableOnRequestMergeTag: '[data-testid="enable-on-request-merge-tag"]',
  configApply: '[data-testid="config-apply"]',

  // Modals
  modalBackdrop: ".pg-modal-backdrop",

  // Template import (BeeFree / Unlayer)
  chooserMigrationBand: '[data-testid="chooser-migration-band"]',
  chooserImportBeefree: '[data-testid="chooser-import-beefree"]',
  chooserImportUnlayer: '[data-testid="chooser-import-unlayer"]',
  chooserImportHtml: '[data-testid="chooser-import-html"]',
  importModal: '[data-testid="import-modal"]',
  importTabBeefree: '[data-testid="import-tab-beefree"]',
  importTabUnlayer: '[data-testid="import-tab-unlayer"]',
  importTabHtml: '[data-testid="import-tab-html"]',
  importTextareaBeefree: '[data-testid="import-textarea-beefree"]',
  importTextareaUnlayer: '[data-testid="import-textarea-unlayer"]',
  importTextareaHtml: '[data-testid="import-textarea-html"]',
  importError: '[data-testid="import-error"]',
  importConfirm: '[data-testid="import-confirm"]',
} as const;

/** Dynamic selector for block by type */
export function blockByType(type: string) {
  return `[data-block-type="${type}"]`;
}

/** Dynamic selector for sidebar palette entry by block type */
export function paletteByType(type: string) {
  return `[data-palette-type="${type}"]`;
}

/** Dynamic selector for config tab */
export function configTab(name: string) {
  return `#config-tab-${name}`;
}

/** Dynamic selector for config panel */
export function configPanel(name: string) {
  return `#config-panel-${name}`;
}

/** Dynamic selector for an issue panel row by rule ID (e.g. "structure.empty-section"). */
export function issueRowByRule(ruleId: string): string {
  return `li:has(p:text-is("${ruleId}"))`;
}
