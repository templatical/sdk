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

  // Viewport & toggles
  viewportGroup: '[role="radiogroup"][aria-label="Viewport"]',
  viewportDesktop: '[role="radio"][aria-label="Desktop"]',
  viewportMobile: '[role="radio"][aria-label="Mobile"]',
  darkModeToggle: ".tpl-dark-mode-toggle",
  previewToggle: ".tpl-preview-toggle",

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
  configEnableOnRequestMergeTag:
    '[data-testid="enable-on-request-merge-tag"]',
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
