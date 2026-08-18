// Blocks
export type {
  BaseBlock,
  Block,
  BlockStyles,
  BlockType,
  BlockVisibility,
  ButtonBlock,
  ColumnLayout,
  CountdownBlock,
  CustomBlock,
  DividerBlock,
  HtmlBlock,
  ImageBlock,
  MenuBlock,
  MenuItemData,
  SectionBlock,
  SectionWrapper,
  SocialIcon,
  SocialIconSize,
  SocialIconStyle,
  SocialIconsBlock,
  SocialPlatform,
  SpacerBlock,
  SpacingValue,
  TableBlock,
  TableCellData,
  TableRowData,
  TitleBlock,
  ParagraphBlock,
  HeadingLevel,
  VideoBlock,
} from "./blocks";
export { HEADING_LEVEL_FONT_SIZE } from "./blocks";

// Social icon glyphs (shared by the editor's inline SVG + the renderer's PNG rasterizer)
export type { SocialIconGlyph } from "./social";
export { SOCIAL_ICON_GLYPHS } from "./social";

// Saved blocks (reusable user-authored block groups + the storage contract)
export type {
  SavedBlock,
  SavedBlockInput,
  SavedBlockPatch,
  SavedBlocksListParams,
  SavedBlocksProvider,
} from "./saved-blocks";

// Test email (the bring-your-own sending contract)
export type { TestEmailPayload, TestEmailProvider } from "./test-email";

// Type guards
export {
  isButton,
  isCountdown,
  isCustomBlock,
  isDivider,
  isHtml,
  isImage,
  isMenu,
  isSection,
  isSocialIcons,
  isSpacer,
  isTable,
  isTitle,
  isParagraph,
  isVideo,
} from "./guards";

// Template
export type { TemplateContent, TemplateSettings } from "./template";
export { createDefaultTemplateContent } from "./template";

// Defaults
export type { BlockDefaults, TemplateDefaults } from "./defaults";
export {
  deepMergeDefaults,
  DEFAULT_BLOCK_DEFAULTS,
  DEFAULT_TEMPLATE_DEFAULTS,
  TITLE_BLOCK_DEFAULTS,
  PARAGRAPH_BLOCK_DEFAULTS,
  IMAGE_BLOCK_DEFAULTS,
  BUTTON_BLOCK_DEFAULTS,
  DIVIDER_BLOCK_DEFAULTS,
  SECTION_BLOCK_DEFAULTS,
  VIDEO_BLOCK_DEFAULTS,
  SOCIAL_ICONS_BLOCK_DEFAULTS,
  SPACER_BLOCK_DEFAULTS,
  HTML_BLOCK_DEFAULTS,
  MENU_BLOCK_DEFAULTS,
  TABLE_BLOCK_DEFAULTS,
  COUNTDOWN_BLOCK_DEFAULTS,
} from "./defaults";

// Custom blocks
export type {
  CustomBlockBooleanField,
  CustomBlockColorField,
  CustomBlockDefinition,
  CustomBlockField,
  CustomBlockFieldBase,
  CustomBlockFieldType,
  CustomBlockImageField,
  CustomBlockNumberField,
  CustomBlockRepeatableField,
  CustomBlockSelectField,
  CustomBlockTextField,
  CustomBlockTextareaField,
  DataSourceConfig,
  DataSourceFetchContext,
  SelectOption,
} from "./custom-blocks";

// Block factory
export {
  cloneBlock,
  createBlock,
  createButtonBlock,
  createCountdownBlock,
  createCustomBlock,
  createDividerBlock,
  createHtmlBlock,
  createImageBlock,
  createMenuBlock,
  createSectionBlock,
  createSocialIconsBlock,
  createSpacerBlock,
  createTableBlock,
  createTitleBlock,
  createParagraphBlock,
  createVideoBlock,
  generateId,
} from "./factory";

// Event emitter
export { EventEmitter } from "./events";

// Utilities
export { safeClone } from "./clone";
export { findOpenTagEnd, getTagAttrValue } from "./html-scan";

// Merge tags
export type { SyntaxPreset, SyntaxPresetName } from "./merge-tags";
export {
  containsMergeTag,
  getLogicMergeTagKeyword,
  getMergeTagLabel,
  getMergeTagSample,
  hasMergeTagSamples,
  getSyntaxClosingChar,
  getSyntaxTriggerChar,
  isLogicMergeTagValue,
  isMergeTagValue,
  resolveHtmlLogicMergeTagLabels,
  resolveHtmlMergeTagLabels,
  resolveSyntax,
  restoreMergeTagMarkup,
  substituteHtmlMergeTagSamples,
  substituteTextMergeTagSamples,
  SYNTAX_PRESETS,
} from "./merge-tags";

// Preview resolution
export type {
  PreviewResolveContext,
  ResolvePreview,
} from "./preview-resolution";
export { isRenderableTemplateContent } from "./preview-resolution";

// Config
export type {
  ColorsConfig,
  CustomFont,
  DisplayCondition,
  DisplayConditionsConfig,
  ExportResult,
  FontsConfig,
  LogicTagsConfig,
  LogicPair,
  LogicTag,
  MediaResult,
  MergeTag,
  MergeTagsConfig,
  ThemeOverrides,
  UiTheme,
  ViewportSize,
} from "./config";
export { SdkError } from "./config";

// Cloud types (zero runtime cost — all type-only except re-exported ViewportSize/SyntaxPreset)
export type {
  AiChatMessage,
  AiConfig,
  AiGenerateOptions,
  AiScoreOptions,
  AiStreamEvent,
  ApiError,
  ApiResponse,
  AuthConfig,
  AuthRequestOptions,
  CategoryScore,
  Collaborator,
  CollaborationConfig,
  Comment,
  CommentEvent,
  CommentEventType,
  CommentThread,
  CreateCommentData,
  DirectAuthConfig,
  EditorState,
  FindingSeverity,
  SdkAuthConfig,
  HealthCheckResult,
  McpConfig,
  McpOperation,
  McpOperationPayload,
  PlanConfig,
  PlanFeatures,
  PlanLimits,
  ProxyAuthConfig,
  RewriteData,
  SaveResult,
  ScoringCategory,
  ScoringFinding,
  ScoringResult,
  Template,
  TemplateSnapshot,
  TestEmailConfig,
  TokenData,
  UpdateCommentData,
  UserConfig,
  WebSocketServerConfig,
} from "./cloud";
