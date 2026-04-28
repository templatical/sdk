---
title: Migrating from Unlayer
description: How to move email templates from Unlayer to Templatical — schema mapping, manual conversion approach, and what's coming next.
---

# Migrating from Unlayer

This guide helps you migrate email templates from Unlayer's `react-email-editor` (and the Unlayer Cloud editor) to Templatical.

::: tip Automated importer coming
We're building an automated **`@templatical/import-unlayer`** package — same shape as the existing [`@templatical/import-beefree`](/guide/migration-from-beefree) importer. It's actively in development. Until it ships, this page documents the manual path. Subscribe to [GitHub Releases](https://github.com/templatical/sdk/releases) or watch [Discussions](https://github.com/templatical/sdk/discussions) to be notified when it lands.
:::

## What you have vs. what you need

Unlayer stores templates as a proprietary JSON design object you fetch from the editor with `editor.exportHtml(...)` or `editor.saveDesign(...)`. Templatical stores templates as a different proprietary JSON shape with explicit block types, design tokens, and a content tree.

Both formats describe the same logical thing — an email composed of rows, columns, and content modules — but the field names, nesting, and feature coverage differ.

## Path 1 — Rebuild visually (recommended for small libraries)

If you have **fewer than 20 templates**, the fastest path is usually to recreate them visually in Templatical:

1. Open your existing Unlayer template in Unlayer's editor and keep it visible as a reference.
2. Open the Templatical editor (or [the playground](https://play.templatical.com)) side-by-side.
3. Drag in the equivalent Templatical blocks for each Unlayer module — see the [mapping table](#unlayer-module-mapping) below.
4. Copy text content directly. Re-upload images using your media library.
5. Apply theme colors, fonts, and spacing using Templatical's design tokens.

Most templates port over in 5–15 minutes once you've done the first one or two.

## Path 2 — Write a one-off conversion script

If you have **dozens or hundreds of templates** and don't want to wait for the official importer, you can write a one-off script using the [mapping table](#unlayer-module-mapping). The shape is straightforward:

```ts
import { writeFileSync } from 'node:fs';
import {
  createTitleBlock,
  createParagraphBlock,
  createImageBlock,
  createButtonBlock,
  createSectionBlock,
} from '@templatical/types';
import type { TemplateContent, Block } from '@templatical/types';

interface UnlayerDesign {
  body: {
    rows: UnlayerRow[];
    values: { backgroundColor?: string; contentWidth?: string };
  };
}

function convertUnlayerDesign(design: UnlayerDesign): TemplateContent {
  const blocks: Block[] = design.body.rows.map(convertRow);

  return {
    blocks,
    settings: {
      width: parseInt(design.body.values.contentWidth ?? '600'),
      backgroundColor: design.body.values.backgroundColor ?? '#ffffff',
      // …other settings as needed
    },
  };
}

function convertRow(row: UnlayerRow): Block {
  // Map columns/cells to Templatical SectionBlock children.
  // See the mapping table below for module-level conversion.
  return createSectionBlock({ /* … */ });
}
```

Use [`@templatical/types`](/api/types) factory functions (`createTitleBlock`, `createImageBlock`, etc.) to build blocks — they apply sensible defaults and assign UUIDv7 IDs for you.

::: warning
Your conversion script will need iteration. Run it on a small sample first, render the result with `@templatical/renderer`, and visually compare in the playground before bulk-converting your library.
:::

## Unlayer module mapping {#unlayer-module-mapping}

This is a directional reference, not an exhaustive spec. Unlayer has paid-tier modules and custom blocks that don't have direct equivalents.

| Unlayer module | Templatical block | Notes |
|---|---|---|
| `row` (with `columns`) | `SectionBlock` (with `columns`) | Section = row + multi-column layout. Templatical sections support 1–4 columns that stack on mobile. |
| `column` | Section column | A column inside a section, holds a list of blocks. |
| `heading` | `TitleBlock` | Heading levels (h1–h6) map to Templatical's `level` property. |
| `text` | `ParagraphBlock` | Inline rich text. Use TipTap-compatible HTML for runs. |
| `image` | `ImageBlock` | `src`, `alt`, `href`, `width`. Re-host images via your media library. |
| `button` | `ButtonBlock` | `text`, `href`, `backgroundColor`, `color`, padding. |
| `divider` | `DividerBlock` | Color, width, padding. |
| `social` | `SocialIconsBlock` | Each icon → a `SocialIcon` entry with `platform` and `href`. |
| `menu` | `MenuBlock` | Menu items → `MenuItemData` entries. |
| `html` | `HtmlBlock` | Raw HTML pass-through. |
| `video` | `VideoBlock` | `src`, `thumbnail`, `href`. |
| Spacer | `SpacerBlock` | Vertical spacing only. |
| Custom modules / paid-tier modules | `HtmlBlock` (fallback) | Convert to a raw HTML block, or implement a [custom block](/guide/custom-blocks) if it's reusable. |

## Things that don't map automatically

These features differ enough between the two products that you'll need to translate them by hand:

- **Display conditions** — Unlayer's conditional content syntax differs from Templatical's [display conditions](/guide/display-conditions). Plan to rewrite condition expressions.
- **Merge tags** — both products support merge tags, but the placeholder syntax may differ. Review [Templatical's merge tag config](/guide/merge-tags) and update tag tokens in your text content accordingly.
- **Custom CSS** — Unlayer's tier-gated custom CSS doesn't translate directly. Use Templatical's [theming system](/guide/theming) and [design tokens](/guide/theming) instead.
- **AMP for Email** — not currently supported in Templatical.
- **Page / popup / document templates** — Unlayer's non-email builders have no Templatical equivalent.

## What to do if you hit something this guide doesn't cover

[Open a discussion](https://github.com/templatical/sdk/discussions) with a redacted snippet of the Unlayer JSON and what you're trying to achieve. We're using these reports to prioritize which Unlayer features the automated importer covers first.
