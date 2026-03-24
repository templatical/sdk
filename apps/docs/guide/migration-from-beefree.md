---
title: Migration from BeeFree
description: Convert BeeFree email templates to Templatical format using @templatical/import-beefree.
---

# Migration from BeeFree

The `@templatical/import-beefree` package converts BeeFree (BEE) JSON templates into Templatical's `TemplateContent` format.

::: warning
This package is in active development. Some block types and advanced features may not be fully supported yet. Test your converted templates before using them in production.
:::

## Installation

```bash
npm install @templatical/import-beefree
```

## Usage

```ts
import { convertFromBeefree } from '@templatical/import-beefree';

// Load your BeeFree template JSON
const beefreeJson = await fetch('/api/beefree-templates/123').then(r => r.json());

// Convert to Templatical format
const content = convertFromBeefree(beefreeJson);

// Use in the editor
const editor = init({
  container: '#editor',
  content,
});
```

## Block Mapping

BeeFree block types map to Templatical equivalents:

| BeeFree Block | Templatical Block | Notes |
|---|---|---|
| `mailup.bee.newsletter.modules.Paragraph` | `text` | HTML content preserved |
| `mailup.bee.newsletter.modules.Image` | `image` | `src`, `alt`, `width`, link properties |
| `mailup.bee.newsletter.modules.Button` | `button` | Style properties mapped |
| `mailup.bee.newsletter.modules.Divider` | `divider` | Line style, color, thickness |
| `mailup.bee.newsletter.modules.Spacer` | `spacer` | Height value |
| `mailup.bee.newsletter.modules.Social` | `social` | Icon platforms and URLs |
| `mailup.bee.newsletter.modules.Html` | `html` | Raw HTML content |
| `mailup.bee.newsletter.modules.Menu` | `menu` | Menu items and styling |
| `mailup.bee.newsletter.modules.Video` | `video` | URL and thumbnail |

## Column Layout Conversion

BeeFree organizes content into rows with columns. These map to Templatical's `SectionBlock` with the appropriate `ColumnLayout`:

| BeeFree Columns | Templatical Layout |
|---|---|
| 1 column (100%) | `'1'` |
| 2 equal columns | `'2'` |
| 3 equal columns | `'3'` |
| 2 columns (~33/66) | `'1-2'` |
| 2 columns (~66/33) | `'2-1'` |

Column widths that don't match a standard ratio are mapped to the closest available layout.

## Template Settings

Global template settings are converted where possible:

- **Width** -- BeeFree `page.body.content.computedStyle.messageWidth` maps to `settings.width`
- **Background color** -- Row and body background colors are preserved
- **Font family** -- The default font family carries over to `settings.fontFamily`

## Known Limitations

- **Custom fonts** -- BeeFree custom font declarations are not automatically imported. Add them manually via the `fonts` config option.
- **Conditional display** -- BeeFree dynamic content rules do not have a direct equivalent and are dropped during conversion.
- **Icons** -- BeeFree custom icon uploads are not migrated. Standard social platform icons are mapped by name.
- **Forms** -- BeeFree form blocks have no Templatical equivalent and are skipped.
- **Countdown timers** -- Partial support. Basic countdown blocks are converted, but advanced styling options may not carry over.
- **Advanced styling** -- Some granular BeeFree style properties (e.g., per-column padding overrides, content-area background images) may not be fully preserved.

## Verifying Converted Templates

After conversion, review the output in the editor to check for:

1. Missing images (re-upload or update URLs if needed)
2. Font rendering (add custom fonts to the editor config)
3. Column proportions (adjust layouts if the automatic mapping doesn't match)
4. Spacing and padding (fine-tune in the block settings panel)
