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

::: code-group

```bash [npm]
npm install @templatical/import-beefree
```

```bash [pnpm]
pnpm add @templatical/import-beefree
```

```bash [yarn]
yarn add @templatical/import-beefree
```

```bash [bun]
bun add @templatical/import-beefree
```

:::

### Without a build step (CDN)

You can also load it from a CDN:

```html
<script type="module">
  import { convertBeeFreeTemplate } from 'https://cdn.jsdelivr.net/npm/@templatical/import-beefree/+esm';
  // ...then convert as shown in Usage below
</script>
```

## Usage {#usage}

```ts
import { convertBeeFreeTemplate } from '@templatical/import-beefree';

// Load your BeeFree template JSON
const res = await fetch('/api/beefree-templates/123');
const beefreeJson = await res.json();

// Convert to Templatical format
const { content, report } = convertBeeFreeTemplate(beefreeJson);

// Use in the editor
const editor = await init({
  container: '#editor',
  content,
});

// Check the conversion report for any issues
console.log(report);
```

[Open in playground](https://play.templatical.com/scenes/import-beefree)

The function returns an `ImportResult` with:
- `content` — the converted `TemplateContent` ready for the editor
- `report` — a conversion report with the status of each block (`converted`, `approximated`, `html-fallback`, or `skipped`)

| Status | Meaning |
|---|---|
| `converted` | Mapped to a Templatical block with no loss of fidelity. |
| `approximated` | Mapped, with a clamp or flatten — `note` states what changed. |
| `html-fallback` | No block equivalent — an unknown module type, forms included. Output is an `HtmlBlock`; see [Block Mapping](#block-mapping) for its content. |
| `skipped` | No output. This converter does not emit it: every module produces a block. |

The JSON BeeFree's editor persists (`page.rows`) is the input. A compiled HTML export is a different envelope — use [`@templatical/import-html`](/guide/migration-from-html).

## Block Mapping

BeeFree block types map to Templatical equivalents:

| BeeFree Module | Templatical Block | Status |
|---|---|---|
| Text | `paragraph` | Converted |
| Paragraph | `paragraph` | Converted |
| Heading | `title` | Converted |
| List | `paragraph` | Converted |
| Image | `image` | Converted |
| Button | `button` | Converted |
| Divider | `divider` | Converted (approximated when a partial-width divider is aligned left or right) |
| Spacer | `spacer` | Converted |
| Social | `social` | Converted |
| Html | `html` | Converted |
| Menu | `menu` | Approximated (styles may differ) |
| Video | `video` | Converted |
| Table | `table` | Converted |

Unknown module types — forms included — are converted to HTML blocks as a fallback, reported `html-fallback`. The block's content is the module's `descriptor.text.html`, `descriptor.html.html` or `descriptor.heading.text`, the first one set. With none of them, it is a `<!-- Unsupported BeeFree module: <type> -->` comment and renders nothing.

### Divider width

| BeeFree `width` | `DividerBlock.width` | Status |
|---|---|---|
| missing, or `100%` | `"full"` | Converted |
| a percentage under `100%`, such as `50%` | the same percentage to two decimals, `"50%"` | Converted |
| below `0%` or above `100%` | clamped to `"0%"` or `"full"` | Approximated |
| px, narrower than its column's content width | the px number | Converted |
| px, as wide as its column's content width or wider | `"full"` | Converted |
| a negative px width | `0` | Approximated |
| any other value | `"full"` | Approximated |

A column's content width is its share of `settings.width`, by the section's column layout, less the divider's left and right padding. A row of four or more columns is flattened, and its modules span the whole `settings.width`.

Templatical centres every divider. A partial-width divider that BeeFree aligns left or right (`computedStyle.align`) is approximated, and its `note` names the alignment.

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

- **Width** -- `page.body.content.computedStyle.messageWidth` maps to `settings.width`, with `page.body.content.style.width` as the fallback and 600 when neither is set
- **Background color** -- `page.body.content.style.background-color` maps to `settings.backgroundColor`, with `page.body.container.style.background-color` as the fallback and `#ffffff` when neither is set. A row's `content.style.background-color` becomes its section's `backgroundColor`; a single-column row with one is wrapped in a one-column section so the color survives. A row's `container.style` colour — the full-width band behind the row — is not read, so it's dropped.
- **Background images** -- A row's `content.style` `background-image` becomes its section's `backgroundImage`, with `background-size`, `background-position` and `background-repeat` (CSS's initial values where unset), and wraps a single-column row in a section as a colour does. The `container.style` band's image shows only while the content area has neither an image nor a colour: then the section paints it at the content width; otherwise it's dropped. A size that fills a side (`100%`, or a px width at least the email's) becomes `cover` and any other length or percentage `auto`; a percentage position snaps to the nearest of left, center and right (top, center and bottom); `repeat-x` and `repeat-y` become `repeat`. `report.warnings` names every band image and every value with no exact keyword.
- **Text color** -- `page.body.content.style.color` maps to `settings.textColor`, `#1a1a1a` when it is unset. Text, paragraph, list, heading, menu and table modules with no color of their own follow it.
- **Links** -- `page.body.content.computedStyle.linkColor` maps to `settings.linkColor`. `settings.linkUnderline` is `true`: BeeFree sets underlines per link, in each link's markup.
- **Font family** -- The default font family carries over to `settings.fontFamily`. The whole stack carries over, so its fallbacks survive; a stack that is exactly a built-in font's own (`Arial, sans-serif`) is stored as the bare name. A module whose `font-family` is `inherit`, `initial`, `unset` or `revert` sets no font of its own and takes `settings.fontFamily`.

## Known Limitations

- **Custom fonts** -- BeeFree custom font declarations are not automatically imported. Add them manually via the `fonts` config option.
- **Conditional display** -- BeeFree dynamic content rules do not have a direct equivalent and are dropped during conversion.
- **Icons** -- BeeFree custom icon uploads are not migrated. Standard social platform icons are mapped by name.
- **Forms** -- BeeFree form modules have no Templatical equivalent. Each becomes an `html-fallback` HTML block, and the form's fields and submit action are not reproduced.
- **Per-block link colors** -- A text module's own link color (`computedStyle.linkColor`) is dropped; its links take `settings.linkColor`.
- **Advanced styling** -- Some granular BeeFree style properties (e.g., per-column padding overrides) may not be fully preserved.

## Verifying Converted Templates

After conversion, review the output in the editor to check for:

1. Missing images (re-upload or update URLs if needed)
2. Font rendering (add custom fonts to the editor config)
3. Column proportions (adjust layouts if the automatic mapping doesn't match)
4. Spacing and padding (fine-tune in the block settings panel)
