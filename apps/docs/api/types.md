---
title: Types Reference
description: Complete reference for @templatical/types — shared TypeScript types, block factories, and utilities.
---

# Types Reference

`@templatical/types` provides all shared TypeScript types, block factory functions, and utilities.

```bash
npm install @templatical/types
```

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
  fontFamily: string;             // Default font family
  preheaderText?: string;         // Email preheader text
}
```

### Block

A discriminated union of all block types:

```ts
type Block =
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | SectionBlock
  | DividerBlock
  | VideoBlock
  | SpacerBlock
  | SocialIconsBlock
  | MenuBlock
  | TableBlock
  | CountdownBlock
  | HtmlBlock
  | CustomBlock;
```

### BlockType

```ts
type BlockType =
  | 'text' | 'image' | 'button' | 'section'
  | 'divider' | 'video' | 'spacer' | 'social-icons'
  | 'menu' | 'table' | 'countdown' | 'html' | 'custom';
```

## Base Types

### BaseBlock

All blocks extend this interface.

```ts
interface BaseBlock {
  id: string;
  type: BlockType;
  styles: BlockStyles;
  customCss?: string;
  visibility?: BlockVisibility;
  displayCondition?: DisplayCondition;
}
```

### BlockStyles

```ts
interface BlockStyles {
  padding: SpacingValue;
  margin: SpacingValue;
  backgroundColor?: string;
  responsive?: ResponsiveStyles;
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

### ResponsiveStyles

Partial style overrides for tablet and mobile viewports.

```ts
interface ResponsiveStyles {
  tablet?: Partial<BlockStyles>;
  mobile?: Partial<BlockStyles>;
}
```

### BlockVisibility

Controls on which viewports a block is visible.

```ts
interface BlockVisibility {
  desktop: boolean;
  tablet: boolean;
  mobile: boolean;
}
```

## Block Types

See [Blocks Guide](/guide/blocks) for detailed descriptions of each block type.

### TextBlock

```ts
interface TextBlock extends BaseBlock {
  type: 'text';
  content: string;          // HTML content
  fontSize: number;
  color: string;
  textAlign: string;
  fontWeight: string;
  fontFamily?: string;
}
```

### ImageBlock

```ts
interface ImageBlock extends BaseBlock {
  type: 'image';
  src: string;
  alt: string;
  width: number;
  align: string;
  linkUrl?: string;
  linkOpenInNewTab?: boolean;
  previewUrl?: string;
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
  borderRadius: number;
  fontSize: number;
  buttonPadding: SpacingValue;
  fontFamily?: string;
  openInNewTab?: boolean;
}
```

### SectionBlock

Container for multi-column layouts.

```ts
interface SectionBlock extends BaseBlock {
  type: 'section';
  columns: ColumnLayout;
  children: Block[][];      // Array of columns, each containing blocks
}

type ColumnLayout = '1' | '2' | '3' | '2-1' | '1-2';
```

### DividerBlock

```ts
interface DividerBlock extends BaseBlock {
  type: 'divider';
  lineStyle: string;
  color: string;
  thickness: number;
  width: number;            // Percentage (0-100)
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
  type: 'social-icons';
  icons: SocialIcon[];
  iconStyle: SocialIconStyle;
  iconSize: SocialIconSize;
  spacing: number;
  align: string;
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
  | 'reddit' | 'github' | 'dribbble' | 'behance';

type SocialIconStyle = 'solid' | 'outlined' | 'rounded' | 'square' | 'circle';
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
  textAlign: string;
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
  textAlign: string;
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

### CountdownBlock

```ts
interface CountdownBlock extends BaseBlock {
  type: 'countdown';
  targetDate: string;
  timezone: string;
  showDays: boolean;
  showHours: boolean;
  showMinutes: boolean;
  showSeconds: boolean;
  separator: string;
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
  expiredImageUrl: string;
  hideOnExpiry: boolean;
}
```

### HtmlBlock

```ts
interface HtmlBlock extends BaseBlock {
  type: 'html';
  content: string;          // Raw HTML
}
```

### CustomBlock

```ts
interface CustomBlock extends BaseBlock {
  type: 'custom';
  customType: string;
  fieldValues: Record<string, unknown>;
  renderedHtml?: string;
  dataSourceFetched?: boolean;
}
```

## Configuration Types

### MergeTag

```ts
interface MergeTag {
  label: string;
  value: string;
}
```

### MergeTagsConfig

```ts
interface MergeTagsConfig {
  syntax?: SyntaxPresetName | SyntaxPreset;
  tags?: MergeTag[];
}

type SyntaxPresetName = 'liquid' | 'handlebars' | 'mailchimp' | 'ampscript' | 'django';
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
  template: string;           // Liquid template
  dataSource?: DataSourceConfig;
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
}
```

### FontsConfig

```ts
interface FontsConfig {
  defaultFallback?: string;
  defaultFont?: string;
  customFonts?: CustomFont[];
}

interface CustomFont {
  name: string;
  url: string;
  fallback?: string;
}
```

### ViewportSize

```ts
type ViewportSize = 'desktop' | 'tablet' | 'mobile';
```

## Factory Functions

All factory functions accept an optional partial override object and return a complete block with a generated ID.

```ts
import {
  createTextBlock,
  createImageBlock,
  createButtonBlock,
  createSectionBlock,
  createDividerBlock,
  createVideoBlock,
  createSpacerBlock,
  createSocialIconsBlock,
  createMenuBlock,
  createTableBlock,
  createCountdownBlock,
  createHtmlBlock,
  createCustomBlock,
  createBlock,
  cloneBlock,
  createDefaultTemplateContent,
  generateId,
} from '@templatical/types';

// Create with defaults
const text = createTextBlock();

// Create with overrides
const heading = createTextBlock({
  content: '<h1>Hello</h1>',
  fontSize: 24,
  fontWeight: 'bold',
});

// Create any block by type string
const block = createBlock('button');

// Deep clone with new ID
const copy = cloneBlock(existingBlock);

// Empty template
const template = createDefaultTemplateContent();

// Generate a UUID
const id = generateId();
```

## Type Guards

```ts
import {
  isText, isImage, isButton, isSection,
  isDivider, isVideo, isSpacer, isSocialIcons,
  isMenu, isTable, isCountdown, isHtml, isCustomBlock,
} from '@templatical/types';

if (isText(block)) {
  console.log(block.content); // TypeScript knows this is TextBlock
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
