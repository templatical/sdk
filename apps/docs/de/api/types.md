---
title: Typen-Referenz
description: Vollständige Referenz für @templatical/types — gemeinsame TypeScript-Typen, Block-Factories und Hilfsfunktionen.
---

# Typen-Referenz

`@templatical/types` stellt alle gemeinsamen TypeScript-Typen, Block-Factory-Funktionen und Hilfsfunktionen bereit.

```bash
npm install @templatical/types
```

## Template-Struktur

### TemplateContent

Der Root-Typ, der ein E-Mail-Template repräsentiert.

```ts
interface TemplateContent {
  blocks: Block[];
  settings: TemplateSettings;
}
```

### TemplateSettings

```ts
interface TemplateSettings {
  width: number;                  // Template-Breite in Pixeln (Standard: 600)
  backgroundColor: string;        // Hintergrundfarbe
  fontFamily: string;             // Standard-Schriftfamilie
  preheaderText?: string;         // E-Mail-Preheader-Text
}
```

### Block

Eine diskriminierte Union aller Blocktypen:

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
  | CustomBlock;
```

### BlockType

```ts
type BlockType =
  | 'title' | 'paragraph' | 'image' | 'button' | 'section'
  | 'divider' | 'video' | 'spacer' | 'social'
  | 'menu' | 'table' | 'html' | 'custom';
```

## Basistypen

### BaseBlock

Alle Blöcke erweitern dieses Interface.

```ts
interface BaseBlock {
  id: string;
  type: string;
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

Partielle Stil-Überschreibungen für Tablet- und Mobile-Viewports.

```ts
interface ResponsiveStyles {
  tablet?: Partial<BlockStyles>;
  mobile?: Partial<BlockStyles>;
}
```

### BlockVisibility

Steuert, auf welchen Viewports ein Block sichtbar ist.

```ts
interface BlockVisibility {
  desktop: boolean;
  tablet: boolean;
  mobile: boolean;
}
```

## Blocktypen

Detaillierte Beschreibungen der einzelnen Blocktypen finden Sie im [Blocks-Leitfaden](/de/guide/blocks).

### TitleBlock

```ts
interface TitleBlock extends BaseBlock {
  type: 'title';
  content: string;          // HTML-Inhalt
  level: 1 | 2 | 3 | 4;   // H1=36px, H2=28px, H3=22px, H4=18px
  color: string;
  textAlign: 'left' | 'center' | 'right';
  fontFamily?: string;
}
```

### ParagraphBlock

```ts
interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  content: string;          // HTML-Inhalt (alle Formatierungen sind inline über TipTap)
}
```

### ImageBlock

```ts
interface ImageBlock extends BaseBlock {
  type: 'image';
  src: string;
  alt: string;
  width: number | 'full';
  align: 'left' | 'center' | 'right';
  linkUrl?: string;
  linkOpenInNewTab?: boolean;
  placeholderUrl?: string;
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

Container für mehrspaltige Layouts.

```ts
interface SectionBlock extends BaseBlock {
  type: 'section';
  columns: ColumnLayout;
  children: Block[][];      // Array von Spalten, die jeweils Blöcke enthalten
}

type ColumnLayout = '1' | '2' | '3' | '2-1' | '1-2';
```

### DividerBlock

```ts
interface DividerBlock extends BaseBlock {
  type: 'divider';
  lineStyle: 'solid' | 'dashed' | 'dotted';
  color: string;
  thickness: number;
  width: number | 'full';
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
  | 'reddit' | 'github' | 'dribbble' | 'behance';

// Insgesamt 16 Plattformen

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
  content: string;          // Rohes HTML
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

## Konfigurationstypen

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
  onRequest?: () => Promise<MergeTag | null>;
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
  template: string;           // Liquid-Template
  dataSource?: DataSourceConfig;
}
```

Details zu den Feldtypen finden Sie unter [Benutzerdefinierte Blöcke](/de/guide/custom-blocks).

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

## Factory-Funktionen

Alle Factory-Funktionen akzeptieren ein optionales Partial-Override-Objekt und geben einen vollständigen Block mit generierter ID zurück.

```ts
import {
  createTitleBlock,
  createParagraphBlock,
  createImageBlock,
  createButtonBlock,
  createSectionBlock,
  createDividerBlock,
  createVideoBlock,
  createSpacerBlock,
  createSocialIconsBlock,
  createMenuBlock,
  createTableBlock,
  createHtmlBlock,
  createCustomBlock,
  createBlock,
  cloneBlock,
  createDefaultTemplateContent,
  generateId,
} from '@templatical/types';

// Mit Standardwerten erstellen
const paragraph = createParagraphBlock();

// Mit Überschreibungen erstellen
const heading = createTitleBlock({
  content: '<h1>Hello</h1>',
  level: 1,
});

// Beliebigen Block per Typ-String erstellen
const block = createBlock('button');

// Deep Clone mit neuer ID
const copy = cloneBlock(existingBlock);

// Leeres Template
const template = createDefaultTemplateContent();

// Eine UUID generieren
const id = generateId();
```

## Type Guards

```ts
import {
  isTitle, isParagraph, isImage, isButton, isSection,
  isDivider, isVideo, isSpacer, isSocialIcons,
  isMenu, isTable, isHtml, isCustomBlock,
} from '@templatical/types';

if (isTitle(block)) {
  console.log(block.level); // TypeScript weiß, dass dies ein TitleBlock ist
}
```

## EventEmitter

Ein typisierter Event-Emitter für Subscription-Muster.

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
unsubscribe(); // Listener entfernen
```

### Methoden

| Methode | Beschreibung |
|--------|-------------|
| `on(event, handler)` | Abonnieren. Gibt eine Unsubscribe-Funktion zurück |
| `off(event, handler)` | Einen bestimmten Handler abbestellen |
| `emit(event, data)` | Ein Ereignis auslösen |
| `removeAllListeners(event?)` | Alle Listener entfernen, optional für ein bestimmtes Ereignis |
| `listenerCount(event)` | Anzahl der Listener für ein Ereignis |
