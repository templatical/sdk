---
title: Types Reference
description: Complete reference for @templatical/types — shared TypeScript types, block factories, and utilities.
---

# Types Reference

`@templatical/types` provides all shared TypeScript types, block factory functions, and utilities.

::: code-group

```bash [npm]
npm install @templatical/types
```

```bash [pnpm]
pnpm add @templatical/types
```

```bash [yarn]
yarn add @templatical/types
```

```bash [bun]
bun add @templatical/types
```

:::

## Template Structure

### TemplateContent

The root type representing an email template.

```ts
interface TemplateContent {
  blocks: Block[];
  settings: TemplateSettings;
}
```

### TemplateSettings

```ts
interface TemplateSettings {
  width: number;                  // Template width in pixels (default: 600)
  backgroundColor: string;        // Background color
  textColor: string;              // Default text color; text blocks inherit it (default #1a1a1a)
  linkColor?: string;             // Link color; links inherit the text color when unset
  linkUnderline: boolean;         // Underline body links (default true)
  fontFamily: string;             // Default font family
  preheaderText?: string;         // Email preheader text
  locale: string;                 // BCP-47 content language; <html lang> (default 'en')
  locales?: string[];             // Other language versions; the default is locale
  l10n?: Record<string, SettingsLocaleLayer>; // Per-language settings layers
  direction?: ContentDirection;   // 'ltr' | 'rtl'; unset follows the content language
}

type ContentDirection = 'ltr' | 'rtl';
```

### Block

A discriminated union of all block types:

```ts
type Block =
  | TitleBlock
  | ParagraphBlock
  | ImageBlock
  | ButtonBlock
  | SectionBlock
  | DividerBlock
  | VideoBlock
  | SpacerBlock
  | SocialIconsBlock
  | MenuBlock
  | TableBlock
  | HtmlBlock
  | CountdownBlock
  | CustomBlock
  | SlotBlock
  | WrapperBlock;
```

### BlockType

```ts
type BlockType =
  | 'title' | 'paragraph' | 'image' | 'button' | 'section'
  | 'divider' | 'video' | 'spacer' | 'social'
  | 'menu' | 'table' | 'html' | 'countdown' | 'custom'
  | 'slot' | 'wrapper';
```

## Localization {#localization}

Language versions add optional `BaseBlock.l10n`, `TemplateSettings.locales` and `TemplateSettings.l10n`. The public declarations below are from `@templatical/types`; `definitions` defaults to `[]` for custom text-field discovery.

<<< @/snippets/localization-contract.ts

`readPath` resolves array elements by id and returns `undefined` for an unresolved path. `writePath` clones the value, treats `null` as property deletion and returns `false` when the parent cannot resolve. `isSafePath` rejects empty and prototype-key segments. `isLocaleTag` accepts a 2–3 letter language followed by optional 2–8 character alphanumeric subtags. `defaultLocaleOf` returns `settings.locale`, falling back to `en`.

`TRANSLATABLE_FIELDS` lists each block type's text path patterns, where `*` is an element id or, for custom blocks, a field key: title, paragraph and HTML `content`, image and video `alt`, button `text`, countdown labels and `expiredMessage`, menu `items.*.text`, table `rows.*.cells.*.content` and custom `fieldValues.*`. `SETTINGS_TRANSLATABLE_FIELDS` is `["preheaderText"]`. `translatableFields(block, definitions)` expands one block's patterns into concrete paths and keeps only custom fields whose definition type is `text` or `textarea`. A locale `text` entry must name one of these paths; every other override goes in `set`.

`pruneLocaleOrphans(block: Block): Block` recursively removes text paths that no longer resolve and set paths whose parent no longer resolves. `pruneSettingsLocaleOrphans(settings: TemplateSettings): TemplateSettings` applies the same rule to settings. Both are pure and omit empty localization members. `isStructuralLocalePath(block: Block, path: string, value?: unknown): boolean` identifies section columns, whole built-in lists and element ids that locale overrides must not replace. Pass the proposed `set` value to check a whole-element replacement: its id must stay unchanged, and a table row must retain its cell ids in the same order. Custom `fieldValues.*` overrides are exempt.

`elementIdIssues(content: TemplateContent): { path: string; id: string }[]` reports menu item, social icon, table row and table cell ids containing `.` or `/`, depth first, including section columns and layout wrappers. It is pure; paths use array indices, for example `blocks[2].items[0].id`. `validateTemplate` reports each issue as `<path>: Element id "<id>" must not contain "." or "/".`; `addBlock`, `updateBlock` and `setContent` refuse one they introduce (on a new block, or new on its block) with `invalid_operation` and the carrying block's `blockId`; an id already on its block stays editable.

`sourceHash` is FNV-1a 32-bit over UTF-8 bytes, as eight lowercase hex digits: `""` → `811c9dc5`, `"a"` → `e40c292c`, `"foobar"` → `bf9cf968`. `localizeBlock` projects one block without recursing or filtering hidden blocks. `resolveLocale(content, locale, options?: { missing?: "throw" | "default" })` projects a complete template or layout, including wrapper children, drops hidden blocks recursively and strips localization fields. Omitted `missing` or `missing: "throw"` throws `unknown_locale` for a version the document lacks. With `missing: "default"`, an unknown version projects the document's default and keeps its default `settings.locale`. Known versions are unaffected. Both helpers are pure.

`localeCoverage` returns field ids (`<blockId>/<path>` or `settings/<path>`) in document order, settings last. Missing nonempty defaults go in `missing`; text with a changed `sourceHash` goes in `stale`; current text goes in `translated`. Hidden blocks and their descendants are excluded. Pass custom definitions to discover `text` and `textarea` fields. Use coverage for a non-default version; it does not project or validate a locale for you.

`addLocale`, `removeLocale`, `setDefaultLocale`, `updateBlockLocale` and `updateSettingsLocale` join `Operation`. `addLocale.position` defaults to the end; removal can guard the complete layer with `expect`. Updates apply `unset`, `text`, `set`, then block `hidden`, and use the nested `LocaleLayerExpect` shape. See [Localized templates](/guide/localized-templates) for editing, field paths, fallback and the upgrade-first rule.

## Translation {#translation}

`TranslationProvider` is the independent `init({ translation })` contract. `TranslationRequest`, `TranslationField`, `TranslationResult`, `TranslationErrorCode` and `LocaleString`, plus the pure helpers and call bounds, are exported from `@templatical/types`:

<<< @/snippets/translation-contract.ts

`TRANSLATION_MAX_FIELDS = 50` and `TRANSLATION_MAX_CHARS = 20_000` cap each call. `TRANSLATABLE_HTML_FIELDS` is `{ title: ["content"], paragraph: ["content"] }`; every other eligible field is `text`. HTML blocks remain manually translatable and are excluded from `localeStrings`.

`maskTags(text, syntax, format, options?: { doNotTranslate?: readonly string[] })` masks chips whole only in HTML and raw value/logic tags in either format. Text tokens are `<x id="n"/>`; attribute tokens are `__xn__`, sharing source-order ids from 1 per field. `unmaskTags(text, tokens)` restores original bytes only for the exact id multiset, otherwise `null`.

Pass the same `doNotTranslate?: readonly string[]` to `maskTags`, `localeStrings` and `applyLocaleStrings` to protect configured terms in text and HTML attribute values. Terms are trimmed, case-sensitive whole words (Unicode letters, numbers and `_` are word characters), matched longest first without overlaps; tags and chips take precedence. Terms share the tags’ id sequence, and the exact check restores each occurrence byte for byte or rejects it as `tags_changed`. The option defaults to no terms. See [translation masking](/backend/translation#provider-contract) for limits and the editor configuration.

`localeStrings` requires `only: "gaps" | "all"` explicitly; the editor defaults to gaps. It skips empty defaults, covering `set` overrides and hidden blocks. `blockId` limits selection to that block. Existing translations are masked with source ids. Coverage alone selects gaps (missing and stale) or all fields (also current). If stored tags or protected terms cannot be masked with the current source's tokens, the field still includes its masked current default and `sourceHash`, with `text` omitted; translation starts from that current default. It returns extraction-time `sourceHash` values from unmasked defaults.

`applyLocaleStrings` returns operations without applying them: one `updateBlockLocale` per block and at most one `updateSettingsLocale`. It stamps each translation with the supplied extraction hash, never a hash recomputed at apply time, so an out-of-date entry from `localeStrings`, whose `text` is its stored translation, becomes current when applied unchanged. Overlapping `set` overrides project shallowest path first, so deeper paths take precedence. Rejections are `tags_changed`, `unknown_field` or `not_translatable`. These helpers do not sanitize HTML. See [the JSON round trip](/guide/localized-templates#translating) and [the provider contract](/backend/translation).

## HTML URL policy

`SAFE_LINK_SCHEMES` lists the schemes accepted by the editor. `DANGEROUS_SCRIPT_SCHEMES` lists the script-capable or arbitrary-payload schemes reported by the link linter. `normalizeUrlForSchemeCheck(value: string): string` removes tab, LF and CR, leading U+0000–U+0020 characters and trailing whitespace. `extractUrlScheme(value: string): string | null` returns the normalized lower-case scheme, or `null` for a relative URL or fragment. `DATA_IMAGE_SRC_PATTERN` matches the image data MIME types accepted in `src`. `isSafeHtmlUrl(value: string, attribute: string): boolean` applies this shared URL-value policy.

`isSafeUrlAttribute(name: string, value: string): boolean` applies `isSafeHtmlUrl` to `HTML_URL_ATTRIBUTES`, the editor sanitizer hook's shared set: `href`, `xlink:href`, `background`, `poster` and `src`. Pass the value with character references decoded, as a browser reads it; attribute names are case-insensitive. After normalization, these attributes accept an empty value, a URL without a scheme, a `#` fragment or the schemes `http`, `https`, `mailto`, `tel`, `ftp`, `ftps`, `sms`, `xmpp` and `cid`. Only `src` also accepts a `data:image/` URL of type `png`, `jpeg`, `jpg`, `gif`, `webp` or `svg+xml` followed by `;`. Other schemes return `false`. The sanitizer config's shared `HTML_FORBIDDEN_ATTRIBUTES` set (`srcdoc`, `ping`, `formaction` and `action`) always returns `false`, including for empty or HTTPS values. Other attributes return `true`. The editor's DOMPurify sanitizer and `template-tools strings import` use this shared policy; the helper does not validate tags, `on*` handlers or other DOMPurify rules, which callers must check separately.

## Base Types

### BaseBlock

All blocks extend this interface.

```ts
interface BaseBlock {
  id: string;
  type: string;
  styles: BlockStyles;
  visibility?: BlockVisibility;
  displayCondition?: DisplayCondition;
  l10n?: Record<string, BlockLocaleLayer>;
}
```

### BlockStyles

```ts
interface BlockStyles {
  padding: SpacingValue;
  backgroundColor?: string;
}
```

### SpacingValue

```ts
interface SpacingValue {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
```

### BorderValue

A border described per side, like `SpacingValue`: each side has its own width, style and color, and a width of `0` leaves that side undrawn. Sections, images and buttons accept one.

```ts
interface BorderSideValue {
  width: number;   // px; 0 = side not drawn
  style: 'solid' | 'dashed' | 'dotted';
  color: string;
}

interface BorderValue {
  top: BorderSideValue;
  right: BorderSideValue;
  bottom: BorderSideValue;
  left: BorderSideValue;
}
```

### BorderRadiusValue

A corner radius in px: one number for all corners, or one per corner. Sections, section wrappers, images and buttons accept it.

```ts
type BorderRadiusValue =
  | number
  | { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };
```

### BlockVisibility

Controls on which viewports a block is visible.

```ts
interface BlockVisibility {
  desktop: boolean;
  mobile: boolean;
}
```

## Block Types

See [Blocks Guide](/guide/blocks) for detailed descriptions of each block type.

### TitleBlock

```ts
interface TitleBlock extends BaseBlock {
  type: 'title';
  content: string;
  level: HeadingLevel;
  color?: string;
  textAlign: 'left' | 'center' | 'right';
  fontFamily?: string;
}

type HeadingLevel = 1 | 2 | 3 | 4;
```

### ParagraphBlock

```ts
interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  content: string;
  paragraphSpacing?: number;
}
```

### ImageBlock

```ts
interface ImageBlock extends BaseBlock {
  type: 'image';
  src: string;
  alt: string;
  width: number | 'full';
  /** Absent derives the height from the width, keeping the aspect ratio. */
  height?: number;
  /** The image file's own size, for the aspect-ratio lock. Never rendered. */
  naturalWidth?: number;
  naturalHeight?: number;
  align: 'left' | 'center' | 'right';
  /** Corner radius in px. Omitted/0 = square corners. */
  borderRadius?: BorderRadiusValue;
  /** Omitted = no border. */
  border?: BorderValue;
  linkUrl?: string;
  linkOpenInNewTab?: boolean;
  placeholderUrl?: string;
  decorative?: boolean;
}
```

### ButtonBlock

```ts
interface ButtonBlock extends BaseBlock {
  type: 'button';
  text: string;
  url: string;
  backgroundColor: string;
  textColor: string;
  borderRadius: BorderRadiusValue;
  /** Outline button: backgroundColor 'transparent' (the keyword), plus a textColor. An empty fill exports as that keyword. */
  border?: BorderValue;
  fontSize: number;
  buttonPadding: SpacingValue;
  fontFamily?: string;
  openInNewTab?: boolean;
  width?: number | 'full';
  align: 'left' | 'center' | 'right';
}
```

### SectionBlock

Container for multi-column layouts.

```ts
interface SectionBlock extends BaseBlock {
  type: 'section';
  columns: ColumnLayout;
  children: Block[][];
  stackOnMobile?: boolean;
  borderRadius?: BorderRadiusValue;
  border?: BorderValue;
  backgroundImage?: BackgroundImage;
  hero?: SectionHero;
  wrapper?: SectionWrapper;
}

interface SectionWrapper {
  backgroundColor?: string;
  padding?: SpacingValue;
  borderRadius?: BorderRadiusValue;
  backgroundImage?: BackgroundImage;
}

type ColumnLayout = '1' | '2' | '3' | '2-1' | '1-2';

interface BackgroundImage {
  url: string;
  size: 'cover' | 'contain' | 'auto';
  position: {
    x: 'left' | 'center' | 'right';
    y: 'top' | 'center' | 'bottom';
  };
  repeat: boolean; // false: painted once
  naturalWidth?: number;   // the image file's own size in px; a hero's 'image' height keeps this shape
  naturalHeight?: number;
}

interface SectionHero {
  height: 'image' | number; // 'image': as tall as the image across the desktop box; a number: fixed px, padding included
  verticalAlign: 'top' | 'middle' | 'bottom';
}
```

### DividerBlock

```ts
/** "0%" to "100%" */
type DividerPercentWidth = `${number}%`;

interface DividerBlock extends BaseBlock {
  type: 'divider';
  lineStyle: 'solid' | 'dashed' | 'dotted';
  color: string;
  thickness: number;
  width: number | 'full' | DividerPercentWidth;
}
```

### VideoBlock

Renders as a linked thumbnail image -- email clients do not support embedded playback.

```ts
interface VideoBlock extends BaseBlock {
  type: 'video';
  url: string;
  openInNewTab?: boolean;
  thumbnailUrl: string;   // Auto-derived from a YouTube/Vimeo url when empty
  alt: string;
  width: number | 'full';
  /** Absent derives the height from the width, keeping the aspect ratio. */
  height?: number;
  align: 'left' | 'center' | 'right';
  placeholderUrl?: string;
}
```

### SpacerBlock

```ts
interface SpacerBlock extends BaseBlock {
  type: 'spacer';
  height: number;
}
```

### SocialIconsBlock

```ts
interface SocialIconsBlock extends BaseBlock {
  type: 'social';
  icons: SocialIcon[];
  iconStyle: SocialIconStyle;
  iconTone?: SocialIconTone; // absent means 'brand'
  iconSize: SocialIconSize;
  spacing: number;
  align: 'left' | 'center' | 'right';
}

interface SocialIcon {
  id: string;
  platform: SocialPlatform;
  url: string;
}

type SocialPlatform =
  | 'facebook' | 'twitter' | 'instagram' | 'linkedin'
  | 'youtube' | 'tiktok' | 'pinterest' | 'email'
  | 'whatsapp' | 'telegram' | 'discord' | 'snapchat'
  | 'reddit' | 'github' | 'dribbble' | 'behance'
  | 'website';


type SocialIconStyle =
  | 'solid' | 'outlined' | 'rounded' | 'square' | 'circle' | 'plain';
type SocialIconTone = 'brand' | 'dark' | 'light';
type SocialIconSize = 'small' | 'medium' | 'large';
```

### MenuBlock

```ts
interface MenuBlock extends BaseBlock {
  type: 'menu';
  items: MenuItemData[];
  fontSize: number;
  fontFamily?: string;
  color: string;
  linkColor?: string;
  textAlign: 'left' | 'center' | 'right';
  separator: string;
  separatorColor: string;
  spacing: number;
}

interface MenuItemData {
  id: string;
  text: string;
  url: string;
  openInNewTab: boolean;
  bold: boolean;
  underline: boolean;
  color?: string;
}
```

### TableBlock

```ts
interface TableBlock extends BaseBlock {
  type: 'table';
  rows: TableRowData[];
  hasHeaderRow: boolean;
  headerBackgroundColor?: string;
  borderColor: string;
  borderWidth: number;
  cellPadding: number;
  fontSize: number;
  fontFamily?: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
}

interface TableRowData {
  id: string;
  cells: TableCellData[];
}

interface TableCellData {
  id: string;
  content: string;
}
```

### HtmlBlock

```ts
interface HtmlBlock extends BaseBlock {
  type: 'html';
  content: string;          // Raw HTML
}
```

### CountdownBlock

Renders as an animated GIF, which requires the Templatical Cloud backend -- `@templatical/renderer` emits a `templatical:unrenderable-block` marker instead. See [Blocks with no renderer](/backend/render#blocks-with-no-renderer).

```ts
interface CountdownBlock extends BaseBlock {
  type: 'countdown';
  targetDate: string;       // Local date/time, 'YYYY-MM-DDTHH:mm'
  timezone: string;         // IANA name the target is read in, e.g. 'Europe/Berlin'
  showDays: boolean;
  showHours: boolean;
  showMinutes: boolean;
  showSeconds: boolean;
  separator: ':' | '-' | ' ';
  digitFontSize: number;
  digitColor: string;
  labelColor: string;
  labelFontSize: number;
  backgroundColor: string;
  fontFamily?: string;
  labelDays: string;
  labelHours: string;
  labelMinutes: string;
  labelSeconds: string;
  expiredMessage: string;
  expiredImageUrl: string;  // Shown instead of the timer once expired
  hideOnExpiry: boolean;
}
```

### CustomBlock

```ts
interface CustomBlock extends BaseBlock {
  type: 'custom';
  customType: string;
  fieldValues: Record<string, unknown>;
  renderedHtml?: string;
  renderedStylesheet?: string;
  dataSourceFetched?: boolean;
}

interface SlotBlock extends BaseBlock {
  type: 'slot';
}

interface WrapperBlock extends BaseBlock {
  type: 'wrapper';
  children: Block[];
  borderRadius?: number;
  backgroundImage?: BackgroundImage;
}
```

`slot` and `wrapper` are layout markers. The skill never emits them. See [Layout](/guide/layout).

## Configuration Types

### MergeTag

```ts
interface MergeTag {
  label: string;
  value: string;
  group?: string;        // picker-only grouping label
  description?: string;  // picker-only helper text
  sample?: string;       // preview-only example value; never written to MJML
}

interface MergeTagRequestContext {
  reason: 'insert' | 'edit';
  current?: MergeTag;    // on edit, when the token matches tags
}
```

### MergeTagsConfig

```ts
interface MergeTagsConfig {
  syntax?: SyntaxPresetName | SyntaxPreset;
  tags?: MergeTag[];
  onRequest?: (context?: MergeTagRequestContext) => Promise<MergeTag | null>;
  showRawValue?: boolean;   // reveal raw token in tooltip (default true)
  autocomplete?: boolean;   // typing-based autocomplete (default true)
}

type SyntaxPresetName = 'liquid' | 'handlebars' | 'mailchimp' | 'ampscript';
```

### DisplayCondition

```ts
interface DisplayCondition {
  label: string;
  before: string;
  after: string;
  group?: string;
  description?: string;
}
```

### DisplayConditionsConfig

```ts
interface DisplayConditionsConfig {
  conditions: DisplayCondition[];
  allowCustom?: boolean;
}
```

### CustomBlockDefinition

```ts
interface CustomBlockDefinition {
  type: string;
  name: string;
  icon?: string;
  description?: string;
  fields: CustomBlockField[];
  template: string;                       // Liquid template
  dataSource?: DataSourceConfig;
  defaultStyles?: Partial<BlockStyles>;   // styles applied to new instances
  stylesheet?: string;                    // CSS emitted once into mj-head
}
```

See [Custom Blocks](/guide/custom-blocks) for field type details.

### ThemeOverrides

```ts
interface ThemeOverrides {
  bg?: string;
  bgElevated?: string;
  bgHover?: string;
  bgActive?: string;
  border?: string;
  borderLight?: string;
  text?: string;
  textMuted?: string;
  textDim?: string;
  primary?: string;
  primaryHover?: string;
  primaryLight?: string;
  secondary?: string;
  secondaryHover?: string;
  secondaryLight?: string;
  success?: string;
  successLight?: string;
  warning?: string;
  warningLight?: string;
  danger?: string;
  dangerLight?: string;
  canvasBg?: string;
  dark?: Omit<ThemeOverrides, 'dark'>;
}
```

### FontsConfig

```ts
interface FontsConfig {
  defaultFallback?: string;
  defaultFont?: string;
  customFonts?: CustomFont[];
  builtIns?: boolean | string[];  // true/omitted: all seven; false: none; string[]: allowlist — see /guide/fonts
}

interface CustomFont {
  name: string;
  url: string;
  fallback?: string;
}
```

### ViewportSize

```ts
type ViewportSize = 'desktop' | 'mobile';
```

## Factory Functions

The block factory functions below accept an optional partial override object and return a complete block with a generated ID. `createCustomBlockLiquid(liquidjs)` is also exported for headless custom-block rendering; see the [Custom blocks guide](/guide/custom-blocks) for its contract and optional liquidjs peer.

The factory's public module shape has no declaration dependency on `liquidjs`. Passing the actual module preserves its `Liquid` instance type:

```ts
export interface CustomBlockLiquidModule {
  Liquid: new (...args: any[]) => any;
  Tag: abstract new (...args: any[]) => any;
  CycleTag: new (...args: any[]) => any;
  Value: new (...args: any[]) => any;
  toValue: (value: any) => any;
}

export declare function createCustomBlockLiquid<M extends CustomBlockLiquidModule>(module: M): InstanceType<M['Liquid']>;
```

```ts
import {
  createTitleBlock,
  createParagraphBlock,
  createImageBlock,
  createButtonBlock,
  createSectionBlock,
  createBackgroundImage,
  createDividerBlock,
  createVideoBlock,
  createSpacerBlock,
  createSocialIconsBlock,
  createMenuBlock,
  createTableBlock,
  createHtmlBlock,
  createCountdownBlock,
  createCustomBlock,
  createBlock,
  cloneBlock,
  createDefaultTemplateContent,
  generateId,
} from '@templatical/types';

// Countdown GIFs need Cloud or a `blockRenderers.countdown` override; the OSS renderer emits a placeholder.

// Create with defaults
const paragraph = createParagraphBlock();

// Create with overrides
const heading = createTitleBlock({
  content: '<h1>Hello</h1>',
  level: 1,
});

// Create any block by type string
const block = createBlock('button');

// A section background image from its URL: centered, cover, not tiled
const section = createSectionBlock({
  backgroundImage: createBackgroundImage('https://cdn.example.com/hero.jpg'),
});

// Deep clone with new IDs, nested rows, items and icons included
const copy = cloneBlock(existingBlock);

// Empty template
const template = createDefaultTemplateContent();

// Generate a UUID
const id = generateId();
```

## Type Guards

```ts
import {
  isTitle, isParagraph, isImage, isButton, isSection,
  isDivider, isVideo, isSpacer, isSocialIcons,
  isMenu, isTable, isHtml, isCountdown, isCustomBlock,
} from '@templatical/types';

if (isTitle(block)) {
  console.log(block.level); // TypeScript knows this is TitleBlock
}
```

## EventEmitter

A typed event emitter for subscription patterns.

```ts
import { EventEmitter } from '@templatical/types';

type Events = {
  change: TemplateContent;
  select: string | null;
};

const emitter = new EventEmitter<Events>();

const unsubscribe = emitter.on('change', (content) => {
  console.log('Changed:', content);
});

emitter.emit('change', templateContent);
unsubscribe(); // Remove listener
```

### Methods

| Method | Description |
|--------|-------------|
| `on(event, handler)` | Subscribe. Returns unsubscribe function |
| `off(event, handler)` | Unsubscribe a specific handler |
| `emit(event, data)` | Emit an event |
| `removeAllListeners(event?)` | Remove all listeners, optionally for a specific event |
| `listenerCount(event)` | Number of listeners for an event |

## Storage contracts

`Template`, `TemplatePatch`, `SavedBlockInput`, `CommentsProvider`, `MediaProvider` and the rest of the BYO storage shapes live under [Connect your backend](/backend/). This page is the block model and editor config.

## Operations and collaboration

`Operation`, including the locale operations, `BlockParent`, `OperationErrorCode`, `OperationError`, `applyOperations`, `applyOperationsInPlace` and `getColumnCount` are described in the [Operations reference](/api/operations). The collaboration contract — `CollaborationProvider`, `CollaborationHandlers`, `OperationBatch`, `RevisionedBatch`, `CollaborationActor`, `CollaborationMember`, `BlockLock`, `BlockLockHolder`, `CollaborationConflict` and `CollaborationRemoteChange` — is on [Collaboration](/backend/collaboration). `Template` carries `revision` and `locks` for a collaborating store.

## AI

`AiProvider`, `AiConversationProvider`, the AI requests, handlers, results, `AiChatMessage` and `AiMergeTags` form the MIT provider contract in `@templatical/types`. [AI](/backend/ai#the-contract) describes the contract; the [AI API reference](/api/ai-kit) covers the HTTP client, server kit and wire.

`SdkError(message, statusCode?, code?, details?)` carries AI error codes and optional `details`. `ThrottledError` extends it with `retryAfterMs`, status 429 and code `rate_limited`. `invertOperations(content, ops)` returns a batch's guarded inverse; it lives in `@templatical/types` and is re-exported by `@templatical/core`.
