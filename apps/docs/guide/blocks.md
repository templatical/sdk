---
title: Block Types
description: Reference for all 12 built-in block types in Templatical.
---

# Block Types

Blocks are the building units of every Templatical template. Each block represents a distinct piece of content -- a paragraph, an image, a button. Blocks can be placed directly in the template or inside sections for multi-column layouts. The editor renders them top-to-bottom in the order they appear.

Every block extends a common `Block` base with shared properties (`id`, `type`, `styles`, `displayCondition`, `mergeTag`, `customCss`, `visibility`), and each type adds its own specific properties.

To create blocks programmatically, see [Programmatic Templates](/guide/programmatic-templates).

## Choosing the right block

| Need | Block | Notes |
|------|-------|-------|
| Formatted text, headings | [Text](#text) | Rich text editor with inline formatting |
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

## Text

Rich text content rendered as HTML. The editor uses [Tiptap](https://tiptap.dev) for inline editing with formatting controls (bold, italic, links, alignment, etc.).

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `content` | `string` | `''` | HTML content |
| `fontSize` | `number` | `16` | Font size in px |
| `color` | `string` | `'#000000'` | Text color |
| `textAlign` | `'left' \| 'center' \| 'right'` | `'left'` | Horizontal alignment |
| `fontWeight` | `string` | `'normal'` | CSS font weight |
| `fontFamily` | `string` | `undefined` | Font family override |

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
| `previewUrl` | `string` | `undefined` | Placeholder shown in the editor when `src` uses a merge tag |

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
| `buttonPadding` | `SpacingValue` | `{ top: 12, right: 24, bottom: 12, left: 24 }` | Inner padding |
| `fontFamily` | `string` | `undefined` | Font family override |
| `openInNewTab` | `boolean` | `true` | Link target behavior |

## Divider

A horizontal line separator.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `lineStyle` | `'solid' \| 'dashed' \| 'dotted'` | `'solid'` | Line style |
| `color` | `string` | `'#cccccc'` | Line color |
| `thickness` | `number` | `1` | Line thickness in px |
| `width` | `string` | `'100%'` | Line width |

## Spacer

Empty vertical space.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `height` | `number` | `20` | Height in px |

## HTML

Injects raw HTML into the template. Use this for content that cannot be expressed with other block types.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `content` | `string` | `''` | Raw HTML markup |

## Social Icons

A row of social media icons linking to platform profiles.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `icons` | `SocialIcon[]` | `[]` | List of social icons |
| `iconStyle` | `'solid' \| 'outlined' \| 'rounded' \| 'square' \| 'circle'` | `'solid'` | Visual style |
| `iconSize` | `'small' \| 'medium' \| 'large'` | `'medium'` | Icon size |
| `spacing` | `number` | `8` | Space between icons in px |
| `align` | `'left' \| 'center' \| 'right'` | `'center'` | Horizontal alignment |

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

## Video

Displays a video thumbnail that links to the video URL.

::: tip Email client note
Email clients do not support embedded video playback. The renderer outputs a clickable thumbnail image that links to the video URL. Always provide a good `thumbnailUrl` -- it's the only thing recipients see in their inbox.
:::

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `url` | `string` | `''` | Video URL (YouTube, Vimeo, etc.) |
| `thumbnailUrl` | `string` | `''` | Thumbnail image URL |
| `alt` | `string` | `''` | Alt text for thumbnail |
| `width` | `number` | `600` | Display width in px |
| `align` | `'left' \| 'center' \| 'right'` | `'center'` | Horizontal alignment |
| `openInNewTab` | `boolean` | `true` | Link target behavior |
| `previewUrl` | `string` | `undefined` | Editor-only placeholder |

## Section

A layout container that holds one or more columns. See [Sections and Columns](/guide/sections-and-columns) for full details.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `columns` | `ColumnLayout` | `'1'` | Column layout preset |
| `children` | `Block[][]` | `[[]]` | Array of block arrays, one per column |

## Custom

A user-defined block type powered by field definitions and a Liquid template. See [Custom Blocks](/guide/custom-blocks) for full details.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `customType` | `string` | | Unique identifier for the custom block type |
| `fieldValues` | `Record<string, any>` | `{}` | Current values for defined fields |
| `renderedHtml` | `string` | `''` | Cached rendered output |
| `dataSourceFetched` | `boolean` | `false` | Whether the data source has been fetched |
