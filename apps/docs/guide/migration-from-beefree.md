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
| `html-fallback` | No block equivalent — an unknown module type (forms included), an [Icons](#icons) module other than a lone icon without text, or an [addon](#addons) with no payload the importer reads. Output is an `HtmlBlock`; see [Block Mapping](#block-mapping) for its content. |
| `skipped` | No output, and `templaticalBlockType` is `null`: an empty module, an Icons module with no icons, or a [divider that draws no line](#undrawn-dividers) and takes no space. |

The JSON BeeFree's editor persists (`page.rows`) is the input. A compiled HTML export is a different envelope — use [`@templatical/import-html`](/guide/migration-from-html).

## Languages {#languages}

The default comes from `language.value` at `page.body.language`, `page.language`, then the root, in that order. Translations in module descriptor payloads (or on the module) become `l10n` text: heading `text`, paragraph/list `html`, button `label`, image `alt`, video `thumbAlt`, and menu item `text` by position. A menu item-count mismatch drops that menu translation with a warning. `head.meta.preheader` supplies the default preheader; `head.meta.translations[locale].preheader` supplies its translation.

Translated `subject`, `title` and `description` stay host-owned and produce warnings. Unknown translation keys, including URL or image-source keys, warn once per key and language. A translation targeting an HTML fallback is dropped with a warning.

The mappings follow [Beefree's documented JSON](https://docs.beefree.io/beefree-sdk/ai-and-mcp/ai-addons/deepl), checked 2026-10-28. Fixtures are built from that documentation, not real multilingual exports.

Codes normalize `_` to `-` and must pass `isLocaleTag`. Unsupported tags are dropped with a warning naming the language. Text entries carry `{ value, sourceHash }`, hashed from the imported default. Enable `init({ localization: { locales } })` with the imported languages to show the Languages menu. Check the result with `template-tools validate imported.json --locale <tag>` and inspect `report.warnings`.

## Options {#options}

`convertBeeFreeTemplate` accepts a second argument of type `ConvertBeeFreeOptions`. `defaultLocale?: string` supplies `settings.locale` when the source declares no default language; the fallback is `"en"`. A declared default wins. Locale codes normalize `_` to `-`. A declared default or `defaultLocale` that still isn't a language tag, such as a templated <code v-pre>{{lang}}</code>, is ignored with a `report.warnings` entry naming it, and the next valid value or `"en"` applies.

```ts
export interface ConvertBeeFreeOptions {
  defaultLocale?: string;
}
```

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
| Divider | `divider`, or `spacer` when it [draws no line](#undrawn-dividers) | Converted (approximated when a partial-width divider is aligned left or right; skipped when it draws no line and takes no space) |
| Spacer | `spacer` | Converted |
| Social | `social` | Converted |
| Icons | `image` for one icon without text, otherwise `html` ([Icons](#icons)) | Converted, or HTML fallback |
| Addon | the block for the payload it carries ([Addons](#addons)) | As that module |
| Empty | none | Skipped |
| Html | `html` | Converted |
| Menu | `menu` | Approximated (styles may differ) |
| Video | `video` | Converted |
| Table | `table` | Converted |

Unknown module types — forms included — are converted to HTML blocks as a fallback, reported `html-fallback`. The block's content is the module's `descriptor.text.html`, `descriptor.html.html` or `descriptor.heading.text`, the first one set. With none of them, it is a `<!-- Unsupported BeeFree module: <type> -->` comment and renders nothing.

### Image width {#image-width}

| BeeFree image | `ImageBlock.width` | Status |
|---|---|---|
| `computedStyle.class` includes `fullwidth` | `"full"` | Converted |
| `computedStyle.width` narrower than the image's room | the px number, rounded | Converted |
| `computedStyle.width` as wide as the room or wider | `"full"` | Converted |
| no `computedStyle.width` | `image.width`, by the same rule | Converted |
| no width at all | `"full"` | Converted |

`image.width` and `image.height` are the image file's size, and `computedStyle.width` is the width BeeFree shows it at, for both of BeeFree's sizing classes: a `fixedwidth` image at the width set in the editor, and an `autowidth` image at its file's width, capped at the column. Older exports write `computedStyle.width` as a number of pixels (`187.5`) and class an image that fills its column `fullwidth`. Their computed width leaves out the column's padding, which the import doesn't carry over, so the class decides. The image's room is its column's content width less the image's left and right padding. `image.height` is not imported, so the image keeps the file's aspect ratio at the width it is shown at. An image with no `text-align` takes its alignment from `computedStyle.class` (`left`, `center` or `right`).

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

### Dividers that draw no line {#undrawn-dividers}

A divider draws no line when its `border-top` is 0 wide, `none` or `hidden`, or transparent: `transparent`, or a colour with an alpha of 0 such as `rgba(0, 0, 0, 0)` or `#ffffff00`. BeeFree templates use these dividers to add space.

| BeeFree divider | Result | Status |
|---|---|---|
| draws a line | `divider`, by the rules above | Converted |
| draws no line, and its padding and transparent border add up to more than 0px | `spacer` | Converted, with a `note` naming the height |
| draws no line and takes no space | no block | Skipped |

The spacer's `height` is the divider's `padding-top` plus `padding-bottom` plus the width of a transparent border. A `none` or `hidden` border takes no space, so its width doesn't count. A spacer renders no padding, so its own padding is 0, and the divider's `background-color` carries over. A divider with no `border-top` at all imports as a 1px solid black line.

### Icons {#icons}

The Icons module (`mailup-bee-newsletter-modules-icons`) shows a row of icons, each with optional text. BeeFree draws every icon at `computedStyle.iconHeight` (32px when unset), its width following the file's size in the icon's `width` and `height`, inside the padding in `computedStyle.iconSpacing`.

| Icons module | Result | Status |
|---|---|---|
| one icon, no text, `width` and `height` stated | `image` at the icon height | Converted |
| several icons, text, or an icon whose file size is unknown | `html`: a table with the icons side by side | HTML fallback, with the `note` `Icons module rebuilt as an HTML table.` |
| no icons | no block | Skipped |

The image keeps the icon's `alt` and links to its `href`. It sits where the module's `text-align` puts it, its padding is the module's padding plus `iconSpacing`, and the file's size becomes `naturalWidth` and `naturalHeight`.

The table puts each icon's `text` on the side `textPosition` names (`left`, `right`, `top` or `bottom`), in the module's `color`, `font-family`, `font-size` and `font-weight`, with `computedStyle.itemsSpacing` between icons. Icon and text link to `href` and open in `target`. Templatical has no block that lays icons out in a row, so the table is edited as HTML.

### Addons {#addons}

An addon module (`mailup-bee-newsletter-modules-addon`) keeps the payload of the module it stands in for, so it converts as that module and is reported as that module would be. The importer looks for these payloads in the descriptor, in this order:

| Payload | Converts as |
|---|---|
| `image` | Image |
| `html` | Html |
| `heading` | Heading |
| `paragraph` or `text` | Paragraph |
| `list` | List |
| `button` | Button |
| `divider` | Divider |
| `menu` | Menu |
| `iconsList` | Icons |

An image addon links to `image.href` only. GIPHY's addon also writes `image.url`, the GIF's page on giphy.com, which isn't imported. An addon with none of these payloads becomes the `<!-- Unsupported BeeFree module: … -->` comment, reported `html-fallback`. The image payload is checked against a real GIPHY export; the others follow BeeFree's [addon content types](https://docs.beefree.io/beefree-sdk/builder-addons/custom-addons/custom-addon-types).

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
- **Background color** -- `page.body.content.style.background-color` maps to `settings.backgroundColor`, with `page.body.container.style.background-color` as the fallback and `#ffffff` when neither is set. A row's `content.style.background-color` becomes its section's `backgroundColor`; a single-column row with one is wrapped in a one-column section so the color survives. A row's `container.style` color — the full-width band behind the row — is not read, so it's dropped.
- **Background images** -- A row's `content.style` `background-image` becomes its section's `backgroundImage`, with `background-size`, `background-position` and `background-repeat` (CSS's initial values where unset), and wraps a single-column row in a section as a color does. The `container.style` band's image shows only while the content area has neither an image nor a color: then the section paints it at the content width; otherwise it's dropped. A size that fills a side (`100%`, or a px width at least the email's) becomes `cover` and any other length or percentage `auto`; a percentage position snaps to the nearest of left, center and right (top, center and bottom); `repeat-x` and `repeat-y` become `repeat`. `report.warnings` names every band image and every value with no exact keyword.
- **Text color** -- `page.body.content.style.color` maps to `settings.textColor`, `#1a1a1a` when it is unset. Text, paragraph, list, heading, menu and table modules with no color of their own follow it.
- **Links** -- `page.body.content.computedStyle.linkColor` maps to `settings.linkColor`. `settings.linkUnderline` is `true`: BeeFree sets underlines per link, in each link's markup.
- **Font family** -- The default font family carries over to `settings.fontFamily`. The whole stack carries over, so its fallbacks survive; a stack that is exactly a built-in font's own (`Arial, sans-serif`) is stored as the bare name. A module whose `font-family` is `inherit`, `initial`, `unset` or `revert` sets no font of its own and takes `settings.fontFamily`.

## Known Limitations

- **Custom fonts** -- BeeFree custom font declarations are not automatically imported. Add them manually via the `fonts` config option.
- **Conditional display** -- BeeFree dynamic content rules do not have a direct equivalent and are dropped during conversion.
- **Icons** -- An Icons module with text or several icons becomes an HTML table, edited as HTML ([Icons](#icons)). In a Social module, custom icon uploads are not migrated; standard social platform icons are mapped by name.
- **Forms** -- BeeFree form modules have no Templatical equivalent. Each becomes an `html-fallback` HTML block, and the form's fields and submit action are not reproduced.
- **Per-block link colors** -- A text module's own link color (`computedStyle.linkColor`) is dropped; its links take `settings.linkColor`.
- **Advanced styling** -- Some granular BeeFree style properties (e.g., per-column padding overrides) may not be fully preserved.

## Verifying Converted Templates

After conversion, review the output in the editor to check for:

1. Missing images (re-upload or update URLs if needed)
2. Font rendering (add custom fonts to the editor config)
3. Column proportions (adjust layouts if the automatic mapping doesn't match)
4. Spacing and padding (fine-tune in the block settings panel)
