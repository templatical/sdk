---
title: Block Types
description: Reference for all 14 built-in block types in Templatical.
---

# Block Types

Blocks are the building units of every Templatical template. Each block represents a distinct piece of content -- a paragraph, an image, a button. Blocks can be placed directly in the template or inside sections for multi-column layouts. The editor renders them top-to-bottom in the order they appear.

Every block extends a common `Block` base with shared properties (`id`, `type`, `styles`, `displayCondition`, `customCss`, `visibility`), and each type adds its own specific properties.

To create blocks programmatically, see [Programmatic Templates](/guide/programmatic-templates). For default property values and how to customize them, see [Block & Template Defaults](/guide/defaults).

## Choosing the right block

| Need | Block | Notes |
|------|-------|-------|
| Headings, titles | [Title](#title) | Fixed-size headings (H1-H4) with block-level formatting |
| Body text, paragraphs | [Paragraph](#paragraph) | Rich text with inline formatting via TipTap |
| Photos, banners, logos | [Image](#image) | Optional link wrapping, responsive width |
| Call-to-action | [Button](#button) | Bulletproof buttons that work in all email clients |
| Multi-column layout | [Section](#section) | The only block that holds other blocks |
| Visual separation | [Divider](#divider) | Horizontal line with style options |
| Vertical spacing | [Spacer](#spacer) | Empty space between blocks |
| Social links | [Social Icons](#social-icons) | 16 platforms, 5 icon styles |
| Navigation links | [Menu](#menu) | Horizontal link list with separators |
| Tabular data | [Table](#table) | Data table with optional header styling |
| Video preview | [Video](#video) | Clickable thumbnail (email clients don't support embedded video) |
| Raw markup | [HTML](#html) | Escape hatch for custom code |
| Domain-specific content | [Custom](#custom) | Your own block types with fields and Liquid templates |

## Title

A heading block with fixed size levels. Use titles for headings, section headers, and other prominent text.

| Property | Type | Description |
|----------|------|-------------|
| `content` | `string` | HTML content |
| `level` | `1 \| 2 \| 3 \| 4` | Heading level (H1=36px, H2=28px, H3=22px, H4=18px) |
| `color` | `string` | Text color |
| `textAlign` | `'left' \| 'center' \| 'right'` | Horizontal alignment |
| `fontFamily` | `string` | Font family override |

## Paragraph

Body text rendered as HTML. The editor uses [Tiptap](https://tiptap.dev) for inline editing with formatting controls (bold, italic, links, alignment, font size, color, etc.). All formatting is applied inline -- there are no block-level formatting properties.

| Property | Type | Description |
|----------|------|-------------|
| `content` | `string` | HTML content |

## Image

Displays an image with optional link wrapping.

| Property | Type | Description |
|----------|------|-------------|
| `src` | `string` | Image URL |
| `alt` | `string` | Alt text |
| `width` | `number \| 'full'` | Display width in px, or `'full'` for 100% |
| `align` | `'left' \| 'center' \| 'right'` | Horizontal alignment |
| `linkUrl` | `string` | Wraps image in a link |
| `linkOpenInNewTab` | `boolean` | Link target behavior |
| `placeholderUrl` | `string` | Placeholder shown in the editor when `src` uses a merge tag |

## Button

A call-to-action button with customizable appearance.

| Property | Type | Description |
|----------|------|-------------|
| `text` | `string` | Button label |
| `url` | `string` | Link URL |
| `backgroundColor` | `string` | Button background color |
| `textColor` | `string` | Button text color |
| `borderRadius` | `number` | Corner radius in px |
| `fontSize` | `number` | Font size in px |
| `buttonPadding` | `SpacingValue` | Inner padding |
| `fontFamily` | `string` | Font family override |
| `openInNewTab` | `boolean` | Link target behavior |

## Divider

A horizontal line separator.

| Property | Type | Description |
|----------|------|-------------|
| `lineStyle` | `'solid' \| 'dashed' \| 'dotted'` | Line style |
| `color` | `string` | Line color |
| `thickness` | `number` | Line thickness in px |
| `width` | `number \| 'full'` | Line width in px, or `'full'` for 100% |

## Spacer

Empty vertical space.

| Property | Type | Description |
|----------|------|-------------|
| `height` | `number` | Height in px |

## HTML

Injects raw HTML into the template. Use this for content that cannot be expressed with other block types.

| Property | Type | Description |
|----------|------|-------------|
| `content` | `string` | Raw HTML markup |

## Social Icons

A row of social media icons linking to platform profiles.

| Property | Type | Description |
|----------|------|-------------|
| `icons` | `SocialIcon[]` | List of social icons |
| `iconStyle` | `'solid' \| 'outlined' \| 'rounded' \| 'square' \| 'circle'` | Visual style |
| `iconSize` | `'small' \| 'medium' \| 'large'` | Icon size |
| `spacing` | `number` | Space between icons in px |
| `align` | `'left' \| 'center' \| 'right'` | Horizontal alignment |

16 platforms are supported: Facebook, Twitter/X, Instagram, LinkedIn, YouTube, TikTok, Pinterest, Email, WhatsApp, Telegram, Discord, Snapchat, Reddit, GitHub, Dribbble, and Behance.

Each `SocialIcon` has:

```ts
interface SocialIcon {
  id: string;
  platform: SocialPlatform;
  url: string;
}
```

## Menu

A horizontal navigation menu with text links.

| Property | Type | Description |
|----------|------|-------------|
| `items` | `MenuItemData[]` | Menu items |
| `fontSize` | `number` | Font size in px |
| `fontFamily` | `string` | Font family override |
| `color` | `string` | Text color |
| `linkColor` | `string` (optional) | Link color |
| `textAlign` | `'left' \| 'center' \| 'right'` | Alignment |
| `separator` | `string` | Character between items |
| `separatorColor` | `string` | Separator color |
| `spacing` | `number` | Space around separator |

Each `MenuItemData` has:

```ts
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

## Table

A data table with optional header row styling.

| Property | Type | Description |
|----------|------|-------------|
| `rows` | `TableRowData[]` | Table rows |
| `hasHeaderRow` | `boolean` | Style first row as header |
| `headerBackgroundColor` | `string` (optional) | Header row background |
| `borderColor` | `string` | Border color |
| `borderWidth` | `number` | Border width in px |
| `cellPadding` | `number` | Cell padding in px |
| `fontSize` | `number` | Font size in px |
| `fontFamily` | `string` | Font family override |
| `color` | `string` | Text color |
| `textAlign` | `'left' \| 'center' \| 'right'` | Cell text alignment |

## Video

Displays a video thumbnail that links to the video URL.

::: tip Email client note
Email clients do not support embedded video playback. The renderer outputs a clickable thumbnail image that links to the video URL. Always provide a good `thumbnailUrl` -- it's the only thing recipients see in their inbox.
:::

| Property | Type | Description |
|----------|------|-------------|
| `url` | `string` | Video URL (YouTube, Vimeo, etc.) |
| `thumbnailUrl` | `string` | Thumbnail image URL |
| `alt` | `string` | Alt text for thumbnail |
| `width` | `number \| 'full'` | Display width in px, or `'full'` for 100% |
| `align` | `'left' \| 'center' \| 'right'` | Horizontal alignment |
| `openInNewTab` | `boolean` | Link target behavior |
| `placeholderUrl` | `string` | Editor-only placeholder |

## Section

A layout container that holds one or more columns. See [Sections and Columns](/guide/sections-and-columns) for full details.

| Property | Type | Description |
|----------|------|-------------|
| `columns` | `ColumnLayout` | Column layout preset |
| `children` | `Block[][]` | Array of block arrays, one per column |

## Custom

A user-defined block type powered by field definitions and a Liquid template. See [Custom Blocks](/guide/custom-blocks) for full details.

| Property | Type | Description |
|----------|------|-------------|
| `customType` | `string` | Unique identifier for the custom block type |
| `fieldValues` | `Record<string, unknown>` | Current values for defined fields |
| `renderedHtml` | `string` | Cached rendered output |
| `dataSourceFetched` | `boolean` | Whether the data source has been fetched |
