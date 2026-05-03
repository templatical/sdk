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
  jsonButton: '[data-testid="toolbar-json"]',
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
  rightPanelContent: "#tpl-tabpanel-content",
  rightPanelSettings: "#tpl-tabpanel-settings",

  // Text editing
  textToolbar: ".tpl-text-toolbar",
  textToolbarBtn: ".tpl-text-toolbar-btn",
  textToolbarBtnActive: ".tpl-text-toolbar-btn--active",
  textContent: ".tpl-text-content",

  // Viewport & toggles
  viewportGroup: '[role="radiogroup"][aria-label="Viewport"]',
  viewportDesktop: '[role="radio"][aria-label="Desktop"]',
  viewportTablet: '[role="radio"][aria-label="Tablet"]',
  viewportMobile: '[role="radio"][aria-label="Mobile"]',
  darkModeToggle: ".tpl-dark-mode-toggle",
  previewToggle: ".tpl-preview-toggle",

  // Export
  exportMenu: '[role="menu"]',
  exportMenuItem: '[role="menuitem"]',
  exportJsonItem: '[data-testid="export-json"]',
  exportMjmlItem: '[data-testid="export-mjml"]',

  // JSON modal
  jsonModal: '[data-testid="json-modal"]',
  jsonModalContent: '[aria-label="Template JSON content"]',
  jsonModalClose: '[data-testid="json-modal"] .pg-modal-close',

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

  // Modals
  modalBackdrop: ".pg-modal-backdrop",

  // Template import (BeeFree / Unlayer)
  chooserMigrationBand: '[data-testid="chooser-migration-band"]',
  chooserImportBeefree: '[data-testid="chooser-import-beefree"]',
  chooserImportUnlayer: '[data-testid="chooser-import-unlayer"]',
  importModal: '[data-testid="import-modal"]',
  importTabBeefree: '[data-testid="import-tab-beefree"]',
  importTabUnlayer: '[data-testid="import-tab-unlayer"]',
  importTextareaBeefree: '[data-testid="import-textarea-beefree"]',
  importTextareaUnlayer: '[data-testid="import-textarea-unlayer"]',
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
