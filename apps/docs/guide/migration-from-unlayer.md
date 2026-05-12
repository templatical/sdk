---
title: Migration from Unlayer
description: Convert Unlayer email templates to Templatical format using @templatical/import-unlayer.
---

# Migration from Unlayer

The `@templatical/import-unlayer` package converts Unlayer design JSON (the output of `editor.saveDesign(...)` from `react-email-editor` or the Unlayer hosted editor) into Templatical's `TemplateContent` format.

::: warning
This package is in active development. Some content types and advanced features may not be fully supported yet. Test your converted templates before using them in production.
:::

## Installation

```bash
npm install @templatical/import-unlayer
```

## Usage

```ts
import { convertUnlayerTemplate } from '@templatical/import-unlayer';

// Load your Unlayer design JSON (whatever editor.saveDesign returned)
const unlayerJson = await fetch('/api/unlayer-templates/123').then(r => r.json());

// Convert to Templatical format
const { content, report } = convertUnlayerTemplate(unlayerJson);

// Use in the editor
const editor = await init({
  container: '#editor',
  content,
});

// Check the conversion report for any issues
console.log(report);
```

The function returns an `ImportResult` with:
- `content` — the converted `TemplateContent` ready for the editor
- `report` — a conversion report with the status of each content node (`converted`, `approximated`, `html-fallback`, or `skipped`)

## Block Mapping

Unlayer content types map to Templatical equivalents:

| Unlayer Content | Templatical Block | Status |
|---|---|---|
| Text | `paragraph` | Converted |
| Heading | `title` | Converted |
| Image | `image` | Converted |
| Button | `button` | Converted |
| Divider | `divider` | Converted |
| Html | `html` | Converted |
| Menu | `menu` | Approximated (styles may differ) |
| Social | `social` | Converted (16 platforms mapped) |
| Video | `video` | Converted |
| Timer | `html` | HTML fallback (rebuild manually) |
| Form | — | Skipped |

Unknown content types are converted to HTML blocks as a fallback.

## Column Layout Conversion

Unlayer organizes content into rows with columns whose widths come from a `cells` weight array. These map to Templatical's `SectionBlock` with the appropriate `ColumnLayout`:

| Unlayer cells | Templatical Layout |
|---|---|
| `[1]` (single column) | flattened — no section wrapper |
| `[1, 1]` (equal halves) | `'2'` |
| `[1, 1, 1]` (equal thirds) | `'3'` |
| `[1, 2]` | `'1-2'` |
| `[2, 1]` | `'2-1'` |
| 4+ cells | flattened to single column with a warning |

Cell ratios that don't match a standard layout are mapped to the closest available one.

## Template Settings

Global template settings are converted where possible:

- **Width** — Unlayer `body.values.contentWidth` maps to `settings.width`
- **Background color** — `body.values.backgroundColor` is preserved; row-level backgrounds carry over to the corresponding `SectionBlock`
- **Font family** — `body.values.fontFamily.value` carries over to `settings.fontFamily`

## Known Limitations

- **Custom fonts** — Unlayer custom font declarations are not automatically imported. Add them manually via the `fonts` config option.
- **Display conditions / dynamic content** — Unlayer's conditional content syntax has no direct equivalent and is dropped during conversion. Use Templatical's [display conditions](/guide/display-conditions) to recreate them.
- **Custom modules / paid-tier blocks** — Unlayer custom blocks are converted to placeholder HTML blocks. Recreate them as a [custom block](/guide/custom-blocks) if reusable.
- **Forms** — Unlayer form blocks are skipped. Most email clients block form submission for security reasons; rebuild the call-to-action as a button linking to a hosted form.
- **Timers / countdowns** — Imported as a placeholder HTML block. Recreate using Templatical's `CountdownBlock`.
- **AMP for Email** — not currently supported in Templatical.

## Verifying Converted Templates

After conversion, review the output in the editor to check for:

1. Missing images (re-upload or update URLs if needed)
2. Font rendering (add custom fonts to the editor config)
3. Column proportions (adjust layouts if the automatic mapping doesn't match)
4. Spacing and padding (fine-tune in the block settings panel)
