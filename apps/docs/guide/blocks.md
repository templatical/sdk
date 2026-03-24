---
title: Block Types
description: Reference for all 13 built-in block types in Templatical, including properties and factory functions.
---

# Block Types

Templatical ships with 13 built-in block types. Every block extends a common `Block` base with shared properties (`id`, `type`, `styles`, `displayCondition`, `mergeTag`, `customCss`, `visibility`), and each type adds its own specific properties.

All block factories and type guards are exported from `@templatical/types`.

```ts
import {
  createTextBlock,
  createImageBlock,
  createBlock,
  cloneBlock,
  isText,
  isImage,
} from '@templatical/types';
```

## Text

Rich text content rendered as HTML.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `content` | `string` | `''` | HTML content |
| `fontSize` | `number` | `16` | Font size in px |
| `color` | `string` | `'#000000'` | Text color |
| `textAlign` | `'left' \| 'center' \| 'right'` | `'left'` | Horizontal alignment |
| `fontWeight` | `string` | `'normal'` | CSS font weight |
| `fontFamily` | `string` | `undefined` | Font family override |

```ts
const block = createTextBlock({
  content: '<p>Welcome, {{name}}!</p>',
  fontSize: 18,
  textAlign: 'center',
});
```

## Image

Displays an image with optional link wrapping.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `src` | `string` | `''` | Image URL |
| `alt` | `string` | `''` | Alt text |
| `width` | `number` | `600` | Display width in px |
| `align` | `'left' \| 'center' \| 'right'` | `'center'` | Horizontal alignment |
| `linkUrl` | `string` | `undefined` | Wraps image in a link |
| `linkOpenInNewTab` | `boolean` | `true` | Link target behavior |
| `previewUrl` | `string` | `undefined` | Placeholder shown in the editor |

```ts
const block = createImageBlock({
  src: 'https://cdn.example.com/hero.png',
  alt: 'Hero banner',
  width: 560,
  linkUrl: 'https://example.com',
});
```

## Button

A call-to-action button with customizable appearance.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `text` | `string` | `'Click me'` | Button label |
| `url` | `string` | `''` | Link URL |
| `backgroundColor` | `string` | `'#007bff'` | Button background color |
| `textColor` | `string` | `'#ffffff'` | Button text color |
| `borderRadius` | `number` | `4` | Corner radius in px |
| `fontSize` | `number` | `16` | Font size in px |
| `buttonPadding` | `string` | `'12px 24px'` | Inner padding |
| `fontFamily` | `string` | `undefined` | Font family override |
| `openInNewTab` | `boolean` | `true` | Link target behavior |

```ts
const block = createButtonBlock({
  text: 'Get Started',
  url: 'https://example.com/signup',
  backgroundColor: '#6366f1',
  borderRadius: 8,
});
```

## Divider

A horizontal line separator.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `lineStyle` | `'solid' \| 'dashed' \| 'dotted'` | `'solid'` | Line style |
| `color` | `string` | `'#cccccc'` | Line color |
| `thickness` | `number` | `1` | Line thickness in px |
| `width` | `string` | `'100%'` | Line width |

```ts
const block = createDividerBlock({
  lineStyle: 'dashed',
  color: '#e5e7eb',
  thickness: 2,
});
```

## Spacer

Empty vertical space.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `height` | `number` | `20` | Height in px |

```ts
const block = createSpacerBlock({ height: 40 });
```

## HTML

Injects raw HTML into the template. Use this for content that cannot be expressed with other block types.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `content` | `string` | `''` | Raw HTML markup |

```ts
const block = createHtmlBlock({
  content: '<div style="text-align:center;">Custom markup</div>',
});
```

## Social Icons

A row of social media icons linking to platform profiles.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `icons` | `SocialIcon[]` | `[]` | List of social icons |
| `iconStyle` | `'solid' \| 'outlined' \| 'rounded' \| 'square' \| 'circle'` | `'solid'` | Visual style |
| `iconSize` | `'small' \| 'medium' \| 'large'` | `'medium'` | Icon size |
| `spacing` | `number` | `8` | Space between icons in px |
| `align` | `'left' \| 'center' \| 'right'` | `'center'` | Horizontal alignment |

16 platforms are supported: Facebook, Twitter/X, Instagram, LinkedIn, YouTube, TikTok, Pinterest, Snapchat, GitHub, Dribbble, Behance, Medium, Discord, Telegram, WhatsApp, and Reddit.

Each `SocialIcon` has:

```ts
interface SocialIcon {
  platform: string;
  url: string;
  enabled: boolean;
}
```

```ts
const block = createSocialIconsBlock({
  iconStyle: 'circle',
  iconSize: 'large',
  icons: [
    { platform: 'twitter', url: 'https://x.com/acme', enabled: true },
    { platform: 'github', url: 'https://github.com/acme', enabled: true },
  ],
});
```

## Menu

A horizontal navigation menu with text links.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `items` | `MenuItemData[]` | `[]` | Menu items |
| `fontSize` | `number` | `14` | Font size in px |
| `fontFamily` | `string` | `undefined` | Font family override |
| `color` | `string` | `'#000000'` | Text color |
| `linkColor` | `string` | `'#007bff'` | Link color |
| `textAlign` | `'left' \| 'center' \| 'right'` | `'center'` | Alignment |
| `separator` | `string` | `'\|'` | Character between items |
| `separatorColor` | `string` | `'#cccccc'` | Separator color |
| `spacing` | `number` | `8` | Space around separator |

Each `MenuItemData` has:

```ts
interface MenuItemData {
  text: string;
  url: string;
}
```

```ts
const block = createMenuBlock({
  items: [
    { text: 'Home', url: 'https://example.com' },
    { text: 'Blog', url: 'https://example.com/blog' },
    { text: 'Docs', url: 'https://docs.example.com' },
  ],
  separator: '-',
});
```

## Table

A data table with optional header row styling.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `rows` | `TableRowData[]` | `[]` | Table rows |
| `hasHeaderRow` | `boolean` | `true` | Style first row as header |
| `headerBackgroundColor` | `string` | `'#f3f4f6'` | Header row background |
| `borderColor` | `string` | `'#e5e7eb'` | Border color |
| `borderWidth` | `number` | `1` | Border width in px |
| `cellPadding` | `number` | `8` | Cell padding in px |
| `fontSize` | `number` | `14` | Font size in px |
| `fontFamily` | `string` | `undefined` | Font family override |
| `color` | `string` | `'#000000'` | Text color |
| `textAlign` | `'left' \| 'center' \| 'right'` | `'left'` | Cell text alignment |

```ts
const block = createTableBlock({
  hasHeaderRow: true,
  rows: [
    { cells: [{ content: 'Plan' }, { content: 'Price' }] },
    { cells: [{ content: 'Starter' }, { content: '$9/mo' }] },
    { cells: [{ content: 'Pro' }, { content: '$29/mo' }] },
  ],
});
```

## Video

Displays a video thumbnail that links to the video URL. Since email clients do not support embedded video playback, a clickable thumbnail image is rendered instead.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `url` | `string` | `''` | Video URL (YouTube, Vimeo, etc.) |
| `thumbnailUrl` | `string` | `''` | Thumbnail image URL |
| `alt` | `string` | `''` | Alt text for thumbnail |
| `width` | `number` | `600` | Display width in px |
| `align` | `'left' \| 'center' \| 'right'` | `'center'` | Horizontal alignment |
| `openInNewTab` | `boolean` | `true` | Link target behavior |
| `previewUrl` | `string` | `undefined` | Editor-only placeholder |

```ts
const block = createVideoBlock({
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  alt: 'Product demo video',
});
```

## Countdown

A live countdown timer that renders as digit groups with labels.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `targetDate` | `string` | | ISO date string for the countdown target |
| `timezone` | `string` | `'UTC'` | IANA timezone identifier |
| `showDays` | `boolean` | `true` | Show days digit |
| `showHours` | `boolean` | `true` | Show hours digit |
| `showMinutes` | `boolean` | `true` | Show minutes digit |
| `showSeconds` | `boolean` | `true` | Show seconds digit |
| `separator` | `string` | `':'` | Character between digit groups |
| `digitFontSize` | `number` | `32` | Digit font size in px |
| `digitColor` | `string` | `'#000000'` | Digit text color |
| `labelColor` | `string` | `'#666666'` | Label text color |

```ts
const block = createCountdownBlock({
  targetDate: '2026-12-31T23:59:59',
  timezone: 'America/New_York',
  showSeconds: false,
  digitFontSize: 48,
  digitColor: '#6366f1',
});
```

## Section

A layout container that holds one or more columns. See [Sections and Columns](/guide/sections-and-columns) for full details.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `columns` | `ColumnLayout` | `'1'` | Column layout preset |
| `children` | `Block[][]` | `[[]]` | Array of block arrays, one per column |

```ts
const block = createSectionBlock({
  columns: '2',
  children: [
    [createTextBlock({ content: '<p>Left column</p>' })],
    [createImageBlock({ src: 'https://cdn.example.com/photo.jpg' })],
  ],
});
```

## Custom

A user-defined block type powered by field definitions and a Liquid template. See [Custom Blocks](/guide/custom-blocks) for full details.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `customType` | `string` | | Unique identifier for the custom block type |
| `fieldValues` | `Record<string, any>` | `{}` | Current values for defined fields |
| `renderedHtml` | `string` | `''` | Cached rendered output |
| `dataSourceFetched` | `boolean` | `false` | Whether the data source has been fetched |

```ts
const block = createCustomBlock({
  customType: 'product-card',
  fieldValues: {
    title: 'Wireless Headphones',
    price: 79.99,
    imageUrl: 'https://cdn.example.com/headphones.jpg',
  },
});
```

## Utilities

### Generic factory

Create any block by type string:

```ts
import { createBlock } from '@templatical/types';

const block = createBlock('text'); // TextBlock with defaults
```

### Cloning

Deep-clone a block with a new ID:

```ts
import { cloneBlock } from '@templatical/types';

const copy = cloneBlock(existingBlock);
// copy.id !== existingBlock.id
```

### Type guards

Narrow a `Block` union to a specific type:

```ts
import { isText, isImage, isButton, isSection } from '@templatical/types';

if (isText(block)) {
  console.log(block.content); // TypeScript knows this is TextBlock
}

if (isImage(block)) {
  console.log(block.src);
}
```

Every block type has a corresponding guard: `isText()`, `isImage()`, `isButton()`, `isDivider()`, `isSpacer()`, `isHtml()`, `isSocialIcons()`, `isMenu()`, `isTable()`, `isVideo()`, `isCountdown()`, `isSection()`, `isCustom()`.
