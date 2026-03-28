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
import { convertBeeFreeTemplate } from '@templatical/import-beefree';

// Load your BeeFree template JSON
const beefreeJson = await fetch('/api/beefree-templates/123').then(r => r.json());

// Convert to Templatical format
const { content, report } = convertBeeFreeTemplate(beefreeJson);

// Use in the editor
const editor = init({
  container: '#editor',
  content,
});

// Check the conversion report for any issues
console.log(report);
```

The function returns an `ImportResult` with:
- `content` — the converted `TemplateContent` ready for the editor
- `report` — a conversion report with the status of each block (`converted`, `approximated`, `html-fallback`, or `skipped`)

## Block Mapping

BeeFree block types map to Templatical equivalents:

| BeeFree Module | Templatical Block | Status |
|---|---|---|
| Text | `text` | Converted |
| Paragraph | `text` | Converted |
| Heading | `text` | Converted (wrapped in heading tags) |
| List | `text` | Converted |
| Image | `image` | Converted |
| Button | `button` | Converted |
| Divider | `divider` | Converted |
| Spacer | `spacer` | Converted |
| Social | `social` | Converted (16 platforms mapped) |
| Html | `html` | Converted |
| Menu | `menu` | Approximated (styles may differ) |
| Video | `video` | Converted |
| Table | `table` | Converted |

Unknown module types are converted to HTML blocks as a fallback.

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
- **Advanced styling** -- Some granular BeeFree style properties (e.g., per-column padding overrides, content-area background images) may not be fully preserved.

## Verifying Converted Templates

After conversion, review the output in the editor to check for:

1. Missing images (re-upload or update URLs if needed)
2. Font rendering (add custom fonts to the editor config)
3. Column proportions (adjust layouts if the automatic mapping doesn't match)
4. Spacing and padding (fine-tune in the block settings panel)
