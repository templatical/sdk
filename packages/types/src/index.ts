// Blocks
export type {
  BaseBlock,
  Block,
  BlockStyles,
  BlockType,
  BlockVisibility,
  BorderCorner,
  BorderRadiusValue,
  BorderSide,
  BorderSideValue,
  BorderStyle,
  BorderValue,
  CornerRadius,
  ButtonBlock,
  ColumnLayout,
  CountdownBlock,
  CustomBlock,
  DividerBlock,
  DividerPercentWidth,
  HtmlBlock,
  ImageBlock,
  MenuBlock,
  MenuItemData,
  SectionBlock,
  SectionWrapper,
  SlotBlock,
  SocialIcon,
  SocialIconTone,
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
  WrapperBlock,
} from "./blocks";
export {
  HEADING_LEVEL_FONT_SIZE,
  TITLE_FONT_WEIGHT,
  TITLE_LINE_HEIGHT,
  RICH_TEXT_SPACING,
  BORDER_CORNERS,
  BORDER_SIDES,
  toBorderCss,
  toBorderDeclarations,
  toBorderRadiusCss,
  uniformBorder,
} from "./blocks";

// Background images (sections and wrapper bands)
export type {
  BackgroundImage,
  BackgroundPositionX,
  BackgroundPositionY,
  BackgroundSize,
  ResolvedBackgroundImage,
} from "./background-image";
export {
  BACKGROUND_POSITIONS_X,
  BACKGROUND_POSITIONS_Y,
  BACKGROUND_SIZES,
  createBackgroundImage,
  encodeCssUrl,
  resolveBackgroundImage,
} from "./background-image";

// Hero mode (a one-column section rendered as mj-hero)
export type {
  AppliedHero,
  HeroCandidate,
  HeroNotAppliedReason,
  HeroVerticalAlign,
  ResolvedHero,
  SectionHero,
} from "./hero";
export { HERO_VERTICAL_ALIGNS, imageAspectRatio, resolveHero } from "./hero";

// Social icon glyphs (shared by the editor's inline SVG + the renderer's PNG rasterizer)
export type { SocialIconGlyph } from "./social";
export {
  SOCIAL_ICON_TONES,
  SOCIAL_ICON_GLYPHS,
  SOCIAL_ICON_STYLES,
  SOCIAL_ICON_TONE_COLORS,
  socialIconAssetDir,
  socialIconColors,
  socialIconGlyphScale,
  socialIconHalo,
} from "./social";

// Saved blocks (reusable user-authored block groups + the storage contract)
export type {
  SavedBlock,
  SavedBlockInput,
  SavedBlockPatch,
  SavedBlocksListParams,
  SavedBlocksOptions,
  SavedBlocksProvider,
} from "./saved-blocks";

// Test email (the bring-your-own sending contract)
export type {
  TestEmailOptions,
  TestEmailPayload,
  TestEmailProvider,
} from "./test-email";

// Media (the bring-your-own DAM / gallery contract)
export type {
  MediaAsset,
  MediaAssetPatch,
  MediaCategory,
  MediaCreateInput,
  MediaFolder,
  MediaFolderInput,
  MediaFoldersProvider,
  MediaListPage,
  MediaListParams,
  MediaOptions,
  MediaProvider,
  MediaRequestContext,
  MediaStorageInfo,
  MediaUsageInfo,
} from "./media";

// Templates (the bring-your-own save/load contract)
export type {
  Template,
  TemplatePatch,
  TemplatesOptions,
  TemplateSaveTrigger,
  TemplatesProvider,
} from "./templates";

// Render (the bring-your-own MJML/HTML contract)
export type { RenderPayload, RenderProvider } from "./render";

// Version history (the bring-your-own version contract)
export type {
  TemplateVersion,
  VersionHistoryListParams,
  VersionHistoryListResult,
  VersionHistoryOptions,
  VersionHistoryProvider,
} from "./version-history";

// Comments (the bring-your-own review contract)
export type {
  Comment,
  CommentAuthor,
  CommentChange,
  CommentEventMeta,
  CommentInput,
  CommentPatch,
  CommentsListParams,
  CommentsOptions,
  CommentsProvider,
} from "./comments";

// Who is editing — a top-level config key, read by comments and by
// collaboration presence.
export type { EditorUser } from "./user";

// Operations (vocabulary v2) and the engine that applies them
export type {
  AddBlockOperation,
  BlockParent,
  DeleteBlockOperation,
  MoveBlockOperation,
  Operation,
  OperationContext,
  OperationErrorCode,
  OperationLock,
  SetContentOperation,
  UpdateBlockOperation,
  UpdateSettingsOperation,
} from "./operations";
export {
  applyOperations,
  applyOperationsInPlace,
  getColumnCount,
  OperationError,
} from "./operations";
export { invertOperations } from "./invert-operations";
export { deepEqual } from "./deep-equal";

// Collaboration (the bring-your-own realtime contract)
export type {
  BlockLock,
  BlockLockHolder,
  CollaborationActor,
  CollaborationConflictCode,
  CollaborationConnectionState,
  CollaborationHandlers,
  CollaborationJoin,
  CollaborationMember,
  CollaborationProvider,
  CollaborationRemoteChange,
  OperationBatch,
  OperationsAfterResult,
  RevisionedBatch,
} from "./collaboration";
export { CollaborationConflict } from "./collaboration";

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
  isSlot,
  isSocialIcons,
  isSpacer,
  isTable,
  isTitle,
  isParagraph,
  isVideo,
  isWrapper,
} from "./guards";

// Template
export type { TemplateContent, TemplateSettings } from "./template";
export { createDefaultTemplateContent } from "./template";
export type { ContentDirection } from "./direction";
export {
  RTL_LANGUAGE_PRIMARY_SUBTAGS,
  isRtlLanguageTag,
  resolveContentDirection,
} from "./direction";

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
  createSlotBlock,
  createSocialIconsBlock,
  createSpacerBlock,
  createTableBlock,
  createTitleBlock,
  createParagraphBlock,
  createVideoBlock,
  createWrapperBlock,
  generateId,
} from "./factory";

// Layout overlay (pure splice of authored content into a slot)
export {
  applyLayout,
  assertNoSlotInContent,
  assertNoWrapperInContent,
  layoutWrapsSlot,
  validateLayout,
} from "./layout";

// Event emitter
export { EventEmitter } from "./events";

// Utilities
export { safeClone } from "./clone";
export { findOpenTagEnd, getTagAttrValue } from "./html-scan";
export { fillEmptyParagraphs, isBlankRichText } from "./rich-text";
export type { FontFamily } from "./fonts";
export {
  BUILT_IN_FONT_STACKS,
  canonicalFontStack,
  firstFontFamily,
  formatFontFamilies,
  isGenericFontFamily,
  normalizeFontStack,
  parseFontFamilies,
  quoteFontFamily,
  resolveFontStack,
} from "./fonts";

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
  MergeTagRequestContext,
  MergeTagsConfig,
  TemplateSettingsConfig,
  ThemeOverrides,
  UiTheme,
  ViewportSize,
} from "./config";
export { SdkError } from "./config";
export { ThrottledError } from "./config";
export type { SdkErrorCode } from "./config";

// AI (the bring-your-own AI contract)
export type {
  AiAppliedBatch,
  AiChatMessage,
  AiChatRequest,
  AiAltTextRequest,
  AiConversationProvider,
  AiChatAttachment,
  AiErrorCode,
  AiFeatureName,
  AiFixFinding,
  AiFixRequest,
  AiLimitDetails,
  AiMergeTag,
  AiMergeTags,
  AiMergeTagSyntax,
  AiMessageBatch,
  AiMessageKind,
  AiOperationsResult,
  AiProvider,
  AiReplay,
  AiReplayContext,
  AiReplayOutcome,
  AiRequestBase,
  AiRewriteHandlers,
  AiRewritePreset,
  AiRewriteRequest,
  AiTurnHandlers,
  AiTurnResult,
} from "./ai";

// Cloud types (zero runtime cost — all type-only except re-exported ViewportSize/SyntaxPreset)
export type {
  ApiError,
  ApiResponse,
  AuthConfig,
  AuthRequestOptions,
  CommentResponse,
  CreateCommentData,
  DirectAuthConfig,
  SdkAuthConfig,
  HealthCheckResult,
  MediaCategoryData,
  MediaConfig,
  PlanConfig,
  PlanFeatures,
  PlanLimits,
  ProxyAuthConfig,
  StorageInfo,
  TemplateVersionResponse,
  TestEmailConfig,
  TokenData,
  UpdateCommentData,
  UserConfig,
  WebSocketServerConfig,
} from "./cloud";
