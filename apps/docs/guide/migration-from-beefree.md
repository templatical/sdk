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
npm install @templatical/import-beefree @templatical/editor @templatical/renderer
```

```bash [pnpm]
pnpm add @templatical/import-beefree @templatical/editor @templatical/renderer
```

```bash [yarn]
yarn add @templatical/import-beefree @templatical/editor @templatical/renderer
```

```bash [bun]
bun add @templatical/import-beefree @templatical/editor @templatical/renderer
```

:::

### Without a build step (CDN)

You can also load it from a CDN:

```html
<script type="module">
  import { convertBeeFreeTemplate } from "https://cdn.jsdelivr.net/npm/@templatical/import-beefree/+esm";
  // ...then convert as shown in Usage below
</script>
```

## Usage {#usage}

```ts
import { convertBeeFreeTemplate } from "@templatical/import-beefree";
import { init } from "@templatical/editor";
import { renderToMjml } from "@templatical/renderer";

// Load your BeeFree template JSON
const res = await fetch("/api/beefree-templates/123");
const beefreeJson = await res.json();

// Convert to Templatical format
const { content, report, customFonts } = convertBeeFreeTemplate(beefreeJson);

// Use in the editor
const editor = await init({
  container: "#editor",
  content,
  fonts: { customFonts },
});

// Load the same faces when rendering
const mjml = await renderToMjml(content, { customFonts });

// Check the conversion report for any issues
console.log(report);
```

[Open in playground](https://play.templatical.com/scenes/import-beefree)

The function returns an `ImportResult` with:

- `content` — the converted `TemplateContent` ready for the editor
- `report` — a conversion report with the status of each block (`converted`, `approximated`, `html-fallback`, or `skipped`)
- `customFonts` — `{ name, url }[]` from `page.body.webFonts` entries that have a URL. Pass the array to `init({ fonts: { customFonts } })` and to `renderToMjml`. System stacks (`Arial`, `Helvetica Neue`, …) and `inherit` are omitted. A font the template uses that has no URL, and is not one of those stacks, is named in `report.warnings`.

| Status          | Meaning                                                                                                                                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `converted`     | Mapped to a Templatical block with no loss of fidelity.                                                                                                                                                                                                                 |
| `approximated`  | A lossy mapping. The `note`, when set, names the exact change, such as a clamp, a button letter-spacing or percentage width that is not carried, or an image percentage width stored as px. Table-cell HTML reduced to plain text is reported here and named in `report.warnings`. |
| `html-fallback` | No block equivalent — an unknown module type (forms included), an [Icons](#icons) module with icons other than one icon with no text, a non-empty image and positive px file width and height, or an [addon](#addons) with no payload the importer reads. Output is an `HtmlBlock`; see [Block Mapping](#block-mapping) for its content. |
| `skipped`       | No output, and `templaticalBlockType` is `null`: an empty module, an Icons module with no icons, or a [divider that draws no line](#undrawn-dividers) and takes no space.                                                                                               |

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

| BeeFree Module | Templatical Block                                                     | Status                                                                                                                           |
| -------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Text           | `paragraph`                                                           | Converted                                                                                                                        |
| Paragraph      | `paragraph`                                                           | Converted                                                                                                                        |
| Heading        | `title`                                                               | Converted                                                                                                                        |
| List           | `paragraph`                                                           | Converted                                                                                                                        |
| Image          | `image`                                                               | Converted                                                                                                                        |
| Button         | `button`                                                              | Converted (approximated when letter-spacing, partial bold in the label or a percentage width other than 100% is not carried)     |
| Divider        | `divider`, or `spacer` when it [draws no line](#undrawn-dividers)     | Converted (approximated when a partial-width divider is aligned left or right; skipped when it draws no line and takes no space) |
| Spacer         | `spacer`                                                              | Converted                                                                                                                        |
| Social         | `social`                                                              | Converted                                                                                                                        |
| Icons          | `image` for one icon with no text, a non-empty image and positive px file width and height; otherwise `html` ([Icons](#icons)) | Converted, or HTML fallback |
| Addon          | the block for the payload it carries ([Addons](#addons))              | As that module                                                                                                                   |
| Empty          | none                                                                  | Skipped                                                                                                                          |
| Html           | `html`                                                                | Converted                                                                                                                        |
| Menu           | `menu`                                                                | Approximated (styles may differ)                                                                                                 |
| Video          | `video`                                                               | Converted                                                                                                                        |
| Table          | `table`                                                               | Converted (approximated when cell HTML is reduced to plain text)                                                                 |

Unknown module types — forms included — are converted to HTML blocks as a fallback, reported `html-fallback`. The block's content is the module's `descriptor.text.html`, `descriptor.html.html` or `descriptor.heading.text`, the first one set. With none of them, it is a `<!-- Unsupported BeeFree module: <type> -->` comment and renders nothing.

Text and list modules set `paragraphSpacing` to `0`: BeeFree text paragraphs are margin 0, and an omitted gap would render as 8px. A `<p>` with an explicit px `margin-bottom`, or the bottom length of a `margin` shorthand, sets that gap instead. A non-px length is ignored. The first such length wins when paragraphs disagree. A paragraph module's `computedStyle.paragraphSpacing` (the gap BeeFree renders between its paragraphs, usually `16px`) sets `paragraphSpacing` and wins over a margin in the HTML.

A text, paragraph or list module's `style` is applied to each block root in its HTML (`p`, `h1`–`h6`, `div`, `ul`, `ol`, `li`). `text-align`, `line-height` and `font-size` go on the element. The line box uses the element's font size, and rendered text defaults to 14px, so a size that lived only on an inner span would make every line taller than BeeFree. `color`, a CSS `font-weight` (`normal`, `bold`, `bolder`, `lighter`, a CSS-wide keyword such as `inherit`, or a number from 1 to 1000; the importer drops any other value, including a `var()` reference), `font-family` stacks of at most 256 characters, `letter-spacing` and the same `font-size` wrap the text of a root that holds no nested block. A longer font stack is dropped with an `approximated` note. A declaration the HTML already sets on that element stays. `line-height` comes from the module and replaces any `line-height` in the HTML; a percentage is stored as a unitless ratio (`120%` is `1.2`, `200%` is `2`). `letter-spacing` of `0` or `normal` is omitted. An `<a>` keeps a `color` it already sets. Otherwise the module's `linkColor` or `link-color`, from `style` and then `computedStyle`, is written on the anchor. With neither, the link takes `settings.linkColor`.

A list module also writes BeeFree's list box inline on each `<ul>`, `<ol>` and `<li>`, so it wins over the renderer's list spacing (8px on the list, 4px on an item, 24px of indent). The list's `margin-top` and `margin-bottom` are `0`, and each item's `margin` is `0`. `list-style-type` is `revert`. `padding-left` is half of `computedStyle.liIndent` on the outer list and the full indent on a nested list (`40px` when that indent is missing, so 20px and 40px); a right-to-left list uses `padding-right`. A `margin`, padding or marker the HTML already sets stays. A list inside a text or paragraph module is left as written.

### Buttons {#buttons}

A button keeps its colours, radius, padding, font size, font family, width and border. Each side uses a readable, non-negative px `padding-<side>` longhand first, then that side of a readable `padding` shorthand with one to four values. An explicit `0px` stays 0. A shorthand with any negative side is discarded as a whole; a negative longhand leaves the shorthand value available. A missing or unreadable side uses 12px on top and bottom or 24px on left and right.

`font-weight` maps to `fontWeight`: a number at or under 450, or `normal`, is `"regular"` (400); from 451 through 600, including `600`, is `"medium"` (500); above 600, or `bold` / `bolder`, is omitted and the label renders bold (700). A tie between two steps takes the lighter one. When every non-whitespace text run in the label is bold through `<strong>`, `<b>` or an inline `font-weight` of at least 600, `fontWeight` is omitted regardless of the style weight. A missing or unreadable weight otherwise imports as `"regular"`. The label is flattened to plain text. When only part of it is bold and the mapped weight is `"regular"` or `"medium"`, that partial bold is lost and one `note` records the imported button weight. A `letter-spacing` other than `0` or `normal` is not carried, and neither is a percentage width other than `100%`. One short `note` names what was left out, and the module is reported `approximated`.

The label renders at 1.2× its font size. A taller line-height — a percentage of the font size, a unitless ratio, or a px length — is split across the top and bottom padding, rounded to whole pixels after the padding values above are read. The added padding is never negative, so `120%` or less leaves the padding as written. BeeFree's usual `200%` is what makes the button taller.

| BeeFree `width`                               | `ButtonBlock.width`                         | Status       |
| --------------------------------------------- | ------------------------------------------- | ------------ |
| missing, or `auto`                            | omitted (sizes to the label)                | Converted    |
| `100%`                                        | `"full"`                                    | Converted    |
| a percentage other than `100%`, such as `50%` | omitted (sizes to the label), with a `note` | Approximated |
| a positive px width                           | that many pixels, rounded                   | Converted    |

The button's place in the column is the module's `text-align` (`left`, `center` or `right`), or the button style's `text-align` when the module sets none. `border-top`, `border-right`, `border-bottom` and `border-left` become `border`. A side that paints nothing — width 0, `none`, `hidden` or transparent — is stored with width 0. When no side paints, `border` is omitted. A style other than `solid`, `dashed` or `dotted` is imported as `solid`.

### Image width {#image-width}

| BeeFree image                                                  | `ImageBlock.width`                                   | Status       |
| -------------------------------------------------------------- | ---------------------------------------------------- | ------------ |
| `computedStyle.class` includes `fullwidth`                     | `"full"`                                             | Converted    |
| `computedStyle.width` narrower than the image's room           | the px number, rounded                               | Converted    |
| `computedStyle.width` as wide as the room or wider             | `"full"`                                             | Converted    |
| `computedStyle.width` a percentage under `100%`, such as `50%` | that share of the room in px, rounded, with a `note` | Approximated |
| `computedStyle.width` `100%` or more                           | `"full"`                                             | Converted    |
| no `computedStyle.width`                                       | `image.width`, by the same rule                      | Converted    |
| no width at all                                                | `"full"`                                             | Converted    |

`image.width` and `image.height` are the image file's size, and `computedStyle.width` is the width BeeFree shows it at, for both of BeeFree's sizing classes: a `fixedwidth` image at the width set in the editor, and an `autowidth` image at its file's width, capped at the column. Older exports write `computedStyle.width` as a number of pixels (`187.5`) and class an image that fills its column `fullwidth`. Their computed width leaves out the column's padding, so the class decides. The image's room is its column's content width less the image's left and right padding. On a snapped row that room is the snapped column: padding given back from the inner edge is part of it, and column padding the module keeps on either side is not, including when none of that padding comes back. `ImageBlock` stores px, which keeps its size on a phone where a percentage would shrink with the column, so a percentage width is reported `approximated`. `image.height` is not imported, so the image keeps the file's aspect ratio at the width it is shown at. An image with no `text-align` takes its alignment from `computedStyle.class` (`left`, `center` or `right`).

BeeFree keeps an image at its desktop width on a phone when that image sits in a column narrower than the email. The import sets `fluidOnMobile` to `false` on such an image when it fills that column, so it does not grow to the stacked column. An image in a full-width row, and one that does not fill its column, leaves `fluidOnMobile` unset. See [Width on phones](/guide/images#width-on-phones).

### Divider width

| BeeFree `width`                                    | `DividerBlock.width`                         | Status       |
| -------------------------------------------------- | -------------------------------------------- | ------------ |
| missing, or `100%`                                 | `"full"`                                     | Converted    |
| a percentage under `100%`, such as `50%`           | the same percentage to two decimals, `"50%"` | Converted    |
| below `0%` or above `100%`                         | clamped to `"0%"` or `"full"`                | Approximated |
| px, narrower than its column's content width       | the px number                                | Converted    |
| px, as wide as its column's content width or wider | `"full"`                                     | Converted    |
| a negative px width                                | `0`                                          | Approximated |
| any other value                                    | `"full"`                                     | Approximated |

A column's content width is its share of `settings.width`, by the section's column layout, less the divider's left and right padding. A row of five or more columns is flattened, and its modules span the whole `settings.width`. A four-column row keeps four columns. The warning names the source ratio.

Templatical centres every divider. A partial-width divider that BeeFree aligns left or right (`computedStyle.align`) is approximated, and its `note` names the alignment.

### Dividers that draw no line {#undrawn-dividers}

A divider draws no line when its `border-top` is 0 wide, `none` or `hidden`, or transparent: `transparent`, or a colour with an alpha of 0 such as `rgba(0, 0, 0, 0)` or `#ffffff00`. BeeFree templates use these dividers to add space.

| BeeFree divider                                                               | Result                        | Status                                     |
| ----------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------ |
| draws a line                                                                  | `divider`, by the rules above | Converted                                  |
| draws no line, and its padding and transparent border add up to more than 0px | `spacer`                      | Converted, with a `note` naming the height |
| draws no line and takes no space                                              | no block                      | Skipped                                    |

The spacer's `height` is the divider's `padding-top` plus `padding-bottom` plus the width of a transparent border. A `none` or `hidden` border takes no space, so its width doesn't count. A spacer renders no padding, so its own padding is 0, and the divider's `background-color` carries over. A divider with no `border-top` at all imports as a 1px solid black line.

### Icons {#icons}

The Icons module (`mailup-bee-newsletter-modules-icons`) shows a row of icons, each with optional text. BeeFree draws every icon at `computedStyle.iconHeight` (32px when unset), its width following the file's size in the icon's `width` and `height`, inside the padding in `computedStyle.iconSpacing`.

| Icons module                                               | Result                                      | Status                                                                  |
| ---------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| one icon, no text, a non-empty image, positive px `width` and `height` | `image` at the icon height                  | Converted                                                               |
| several icons, text, or one icon missing the image or a positive px `width` or `height` | `html`: a table with the icons side by side | HTML fallback, with the `note` `Icons module rebuilt as an HTML table.` |
| no icons                                                   | no block                                    | Skipped                                                                 |

The image keeps the icon's `alt` and links to its `href`. It sits where the module's `text-align` puts it, its padding is the module's padding plus `iconSpacing`, and the file's size becomes `naturalWidth` and `naturalHeight`.

The table puts each icon's `text` on the side `textPosition` names (`left`, `right`, `top` or `bottom`), in the module's `color`, `font-family`, `font-size` and `font-weight`, with `computedStyle.itemsSpacing` between icons. Icon and text link to `href` and open in `target`. Templatical has no block that lays icons out in a row, so the table is edited as HTML.

Both results drop an icon's `href` or `image` when the editor's HTML URL policy (`isSafeHtmlUrl` in `@templatical/types`) rejects it, such as a `javascript:`, `vbscript:` or non-image `data:` URL, and add a `report.warnings` entry naming it. The table is markup the importer writes, and an HTML block renders unsanitized.

### Addons {#addons}

An addon module (`mailup-bee-newsletter-modules-addon`) keeps the payload of the module it stands in for, so it converts as that module: the payload decides the block and its status. Its report entry keeps `beeFreeModuleType: "mailup-bee-newsletter-modules-addon"`. The importer looks for these payloads in the descriptor, in this order:

| Payload               | Converts as |
| --------------------- | ----------- |
| `image`               | Image       |
| `html`                | Html        |
| `heading`             | Heading     |
| `paragraph` or `text` | Paragraph   |
| `list`                | List        |
| `button`              | Button      |
| `divider`             | Divider     |
| `menu`                | Menu        |
| `iconsList`           | Icons       |

An image addon links to `image.href` only. GIPHY's addon also writes `image.url`, the GIF's page on giphy.com, which isn't imported. An addon with none of these payloads becomes the `<!-- Unsupported BeeFree module: … -->` comment, reported `html-fallback`. The image payload is checked against a real GIPHY export; the others follow BeeFree's [addon content types](https://docs.beefree.io/beefree-sdk/builder-addons/custom-addons/custom-addon-types).

## Column Layout Conversion {#column-layout-conversion}

BeeFree organizes content into rows with columns. These map to Templatical's `SectionBlock` with the appropriate `ColumnLayout`:

| BeeFree Columns    | Templatical Layout |
| ------------------ | ------------------ |
| 1 column (100%)    | `'1'`              |
| 2 equal columns    | `'2'`              |
| 3 equal columns    | `'3'`              |
| 2 columns (~33/66) | `'1-2'`            |
| 2 columns (~66/33) | `'2-1'`            |
| 2 columns (25/75)  | `'1-3'`            |
| 2 columns (75/25)  | `'3-1'`            |
| 3 columns (25/50/25) | `'1-2-1'`        |
| 4 equal columns    | `'4'`              |

Column widths that don't match a standard ratio are mapped to the closest layout of the same column count, measured in the same thousandths as an exact match. A 7/12 row and a 5/12 row map to the even split `2` (7/12 is 583 thousandths: 83 from even, 84 from 2/3). A 6-4-2 row maps to `3` and a 2-8-2 row maps to `1-2-1`. That snap is one `report.warnings` line naming the source ratio, for example `Column ratio 6-4-2 was mapped to the nearest layout "3"`. `8-4`, `4-8`, `6-6`, an even `4-4-4`, `3-9`, `9-3`, `3-6-3` and an even `3-3-3-3` match `2-1`, `1-2`, `2`, `3`, `1-3`, `3-1`, `1-2-1` and `4` and do not warn. A row of five or more columns is flattened to one column; the warning names that ratio too (`3-3-3-3-3`).

A column's padding, background and border live on the column. A single-column row folds that padding into the section padding (added to the row's own padding, which is not imported, so it starts at 0), uses the column `background-color` when it is set and otherwise the row's content background, and maps `border-top` / `border-right` / `border-bottom` / `border-left` onto the section border. The row is wrapped in a one-column section when any of those is set. A non-px or negative padding is ignored. A border style other than `solid`, `dashed` or `dotted` is imported as `solid`.

A multi-column row, including one flattened from five or more columns, adds each column's padding to its modules: left and right on every module, top on the first, bottom on the last. When the snapped layout makes a column narrower than its BeeFree grid share of the row, that shortfall comes back out of the padding facing the next column: the right side of a left column, the left side of a right column, and the right side then the left side of a middle column. The outer edge stays, and the padding does not go below 0. A column the snap makes wider, and a ratio that already matches, keep the summed padding.

In a row with two to four columns, the first column's drawn left border and the last column's drawn right border become the section's left and right border. A drawn top or bottom border becomes the section border when every column draws that side with the same width, style and color. Promotion requires at least one drawn column side, no painted column background, no drawn inner border, no top or bottom border that differs between columns, and no overlap with a drawn row-border side. When one of these fails, every column side is dropped, the outer left and right edges included. Promoted borders add no column-box warning. Otherwise column backgrounds and borders are dropped with one `report.warnings` entry per row: `Column background/border was dropped; a multi-column row has no per-column box.` A row flattened from five or more columns keeps this drop behavior. A transparent background or a border that paints nothing does not warn. When columns stack on a phone, BeeFree draws the left edge only beside the first column and the right edge only beside the last, and a top or bottom border drawn on every column appears between the stacked columns too. The section border frames the whole stack, with no lines between its columns, and the import adds no warning for this.

## Template Settings

Global template settings are converted where possible:

- **Width** -- `page.body.content.computedStyle.messageWidth` maps to `settings.width`, with `page.body.content.style.width` as the fallback and 600 when neither is set
- **Background color** -- `page.body.content.style.background-color` maps to `settings.backgroundColor`, with `page.body.container.style.background-color` as the fallback and `#ffffff` when neither is set. A row's `content.style.background-color` becomes its section's `backgroundColor` (the inner box); a single-column row with one is wrapped in a one-column section so the color survives. A single column's own `background-color` replaces it when set. A row's `container.style.background-color` — the band outside that box — becomes `section.wrapper.backgroundColor` with `wrapper.fullWidth: true`. The band runs to the window edge and the section fill stays the content color, so the copy stays in the content box. The wrapper is omitted when the band is transparent, or the same color as the section fill and the container has no image.
- **Row visibility** -- `content.computedStyle.hideContentOnMobile` and `hideContentOnDesktop` set the section's `visibility` (`{ desktop, mobile }`). Either flag wraps the row in a section. Both unset or false leaves `visibility` unset.
- **Mobile stacking** -- `content.computedStyle.rowColStackOnMobile: false` sets `stackOnMobile: false` on a multi-column section, so the columns stay side by side on a phone. `true` or an omitted flag leaves `stackOnMobile` unset, and the columns stack. On a one-column row, or a row flattened from five or more columns, the flag is dropped with one warning: `rowColStackOnMobile false was dropped; Templatical keeps columns side by side only on a multi-column section.`
- **Row width** -- `content.style.width` is the content box. A px width other than `settings.width`, or a non-px width, adds one warning naming both and leaves the section at the email width. A section has no width of its own.
- **Row border** -- `content.style` `border-top`, `border-right`, `border-bottom` and `border-left` map onto the section border with the same rules as a column border. On a single-column row the column border wins when both paint and they differ, with one warning: `Row border was dropped; the column border is kept on the section.` In a multi-column row, drawn row-border sides merge with promoted column sides when they do not overlap, without a warning. If they overlap, the row border stays and the column borders are dropped with the column-box warning.
- **Background images** -- A row's `content.style` `background-image` becomes its section's `backgroundImage`, with `background-size`, `background-position` and `background-repeat` (CSS's initial values where unset), and wraps a single-column row in a section as a color does. The `container.style` band's image becomes `wrapper.backgroundImage` with `wrapper.fullWidth: true`, including behind a painted content area. A content image stays on the section. A size that fills a side (`100%`, or a px width at least the email's) becomes `cover` and any other length or percentage `auto`; a percentage position snaps to the nearest of left, center and right (top, center and bottom); `repeat-x` and `repeat-y` become `repeat`. `report.warnings` names every value with no exact keyword.
- **Text color** -- `page.body.content.style.color` maps to `settings.textColor`, `#1a1a1a` when it is unset. Text, paragraph, list, heading, menu and table modules with no color of their own follow it.
- **Links** -- `page.body.content.computedStyle.linkColor` maps to `settings.linkColor`. `settings.linkUnderline` is `true`: BeeFree sets underlines per link, in each link's markup.
- **Font family** -- The default font family carries over to `settings.fontFamily`. The whole stack carries over, so its fallbacks survive; a stack that is exactly a built-in font's own (`Arial, sans-serif`) is stored as the bare name. A module whose `font-family` is `inherit`, `initial`, `unset` or `revert` sets no font of its own and takes `settings.fontFamily`. A heading keeps that family, plus its color and alignment (from the heading style, then the heading tag, then the module). The title block has no font size, weight, line height or letter spacing fields, so a heading's `font-size`, `font-weight`, `line-height` and `letter-spacing` are written on the text and override the level's size, the bold weight and the 1.3 line-height. The level is the nearest of h1–h4 (36, 28, 22 and 18px) to that font size — the module style, or the font-size on the heading tag when the style omits it — and a tie stays on the source level, so the line box follows the size. A chosen size more than 1px away is reported approximated (`h4 chosen for 16px (source h1); line box differs`). A percentage line-height becomes a unitless ratio. `letter-spacing` of `0` or `normal` is omitted. A `font-size` on the heading tag is kept when the style omits it.
- **Merge tags** -- HTML character references inside <code v-pre>{{ }}</code>, `{% %}` and `{# #}` are decoded on every copied string: rich text, headings, button labels, links and image addresses, alt text, HTML and the preheader. `&#39;` becomes `'`, `&quot;` a quote, `&gt;` `>`, `&amp;` `&`, and `&nbsp;` a plain space (Twig does not read a non-breaking space as whitespace). A double quote inside a token in an HTML attribute stays encoded as `&quot;`. The same references outside a token stay encoded in rich text, except a doubled `&amp;nbsp;` (and `&amp;#160;` / `&amp;#xa0;`), which is written back as the single reference. A button label and a table cell are plain text, so references there are decoded as well: the renderer escapes the label, and an encoded `&nbsp;` would show as the letters `&amp;nbsp;`. A token with no closer is left as written. A `<code data-bee-type="mergetag">` wrapper around a merge tag in text, a heading, a list or a button label is removed and the token inside is kept; any other `<code>` stays. A chip that holds only spaces becomes one plain space. A chip that holds one token drops a plain leading space, keeps a leading non-breaking space, and keeps a space after the token. A `<code>` that only highlights one token drops that same plain leading space, and the `<code>` stays.

## Known Limitations

- **Custom fonts** -- `customFonts` on the result lists every BeeFree web font that has a URL. Pass that array to the editor `fonts.customFonts` option and to `renderToMjml`, or the face falls back. A font the template uses that has no URL, other than a system stack, is named in `report.warnings`.
- **Conditional display** -- BeeFree dynamic content rules do not have a direct equivalent and are dropped during conversion.
- **Icons** -- An Icons module becomes an HTML table, edited as HTML, unless it is one icon with no text, a non-empty image and positive px file width and height ([Icons](#icons)). In a Social module, the platform is read from the icon id, then its name, alt text, title, or the link host. Xing (`xing`, including a `xing.com` host) maps to the `xing` platform. A network with no Templatical icon is kept as an image, or as a link when the icon has no image, and named in the report. The row's `text-align` becomes `align`. The gap between icons is the left and right of `computedStyle.padding` added together. `iconsDefaultWidth` picks the nearest of small (24px), medium (32px) and large (48px). An icon set in the icon file URL maps when the shape matches (`circle`, `rounded` or `square`); a black or white set sets the dark or light tone, and `circle-dark-gray` uses the dark tone. A set with no matching shape stays the solid brand icons.
- **Forms** -- BeeFree form modules have no Templatical equivalent. Each becomes an `html-fallback` HTML block, and the form's fields and submit action are not reproduced.
- **Column box on multi-column rows** -- Padding is folded into the modules. A painted background or a drawn border that cannot be promoted to the section border is dropped with one warning per row (see [Column Layout Conversion](#column-layout-conversion)). A spacer ignores `styles.padding`, so column padding folded onto a spacer does not render.
- **Mobile breakpoint** -- BeeFree stacks at `messageWidth + 20` (620px when the email is 600px). Templatical keeps MJML's 480px breakpoint. Import does not change it.

## Verifying Converted Templates

After conversion, review the output in the editor to check for:

1. Missing images (re-upload or update URLs if needed)
2. Font rendering (pass `customFonts` to the editor `fonts` config and to `renderToMjml`)
3. Column proportions (adjust layouts if the automatic mapping doesn't match)
4. Spacing and padding (fine-tune in the block settings panel)
