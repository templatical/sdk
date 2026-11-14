---
title: Migrating from MJML
description: Convert MJML email templates to Templatical format using @templatical/import-mjml.
---

# Migrating from MJML

This guide is for teams who've been authoring email templates in raw [MJML](https://mjml.io) (with editors like VS Code, an internal CLI, or a hand-rolled build pipeline) and want to move to Templatical's visual editor. **`@templatical/import-mjml`** converts an MJML document into Templatical's `TemplateContent` format directly — install it, run it, and use the sections below to finish off anything it can't map on its own.

## Installation

::: code-group

```bash [npm]
npm install @templatical/import-mjml
```

```bash [pnpm]
pnpm add @templatical/import-mjml
```

```bash [yarn]
yarn add @templatical/import-mjml
```

```bash [bun]
bun add @templatical/import-mjml
```

:::

### Without a build step (CDN)

You can also load it from a CDN:

```html
<script type="module">
  import { convertMjmlTemplate } from 'https://cdn.jsdelivr.net/npm/@templatical/import-mjml/+esm';
  // ...then convert as shown in Usage below
</script>
```

## Usage {#usage}

```ts
import { convertMjmlTemplate } from '@templatical/import-mjml';

// Load the raw MJML source of an email
const res = await fetch('/path/to/email.mjml');
const mjml = await res.text();

// Convert to Templatical format
const { content, report } = convertMjmlTemplate(mjml);

// Use in the editor
const editor = await init({
  container: '#editor',
  content,
});

// Check the conversion report for any issues
console.log(report);
```

[Open in playground](https://play.templatical.com/scenes/import-mjml)

`convertMjmlTemplate` is synchronous and returns an `ImportResult` with:
- `content` — the converted `TemplateContent` ready for the editor
- `report` — a conversion report with the status of each source element (`converted`, `approximated`, `html-fallback`, or `skipped`)

## Options {#options}

`convertMjmlTemplate` accepts a second argument of type `ConvertMjmlOptions`. `defaultLocale?: string` supplies `settings.locale` when the source declares no default language; the fallback is `"en"`. A declared default wins. Locale codes normalize `_` to `-`. A declared default or `defaultLocale` that still isn't a language tag, such as a templated <code v-pre>{{lang}}</code>, is ignored with a `report.warnings` entry naming it, and the next valid value or `"en"` applies.

The source declares its default with `<mjml lang>`.

```ts
export interface ConvertMjmlOptions {
  defaultLocale?: string;
}
```

## Reading the report

Each `report.entries` item describes one source element:

| Status | Meaning |
|---|---|
| `converted` | Every attribute with a Templatical home was carried across. |
| `approximated` | Mapped to the right block, but a value was coerced to fit a closed range — `note` states the original value. |
| `html-fallback` | No block equivalent exists; the original markup is preserved in an `HtmlBlock`. |
| `skipped` | Nothing was produced (`templaticalBlockType: null`). |

```ts
console.log(report.summary);
// { total: 24, converted: 21, approximated: 2, htmlFallback: 1, skipped: 0 }

for (const entry of report.entries) {
  if (entry.status === 'approximated') {
    console.warn(`<${entry.sourceTag}> approximated:`, entry.note);
  }
}
// <mj-section> approximated: Column widths 20%, 20%, 20%, 20%, 20% have no exact Templatical layout; resolved to "4". Templatical supports up to four columns.
```

A `note` on an `approximated` entry always names the value it replaced, so diffing `report.entries` between two runs shows exactly what a migration changed.

## Conversion model

This is a slightly counter-intuitive migration. Templatical's renderer produces *MJML output* — so on the surface, MJML and Templatical look identical. But:

- **MJML** is a markup language. You write XML-like tags (`<mj-section>`, `<mj-column>`, `<mj-text>`) and the MJML compiler turns them into table-based HTML.
- **Templatical** stores templates as a JSON tree of typed blocks (`SectionBlock`, `ParagraphBlock`, etc.) and renders that tree to MJML at export time.

To bring an MJML template into Templatical, you parse the MJML and construct an equivalent JSON tree — including resolving MJML's own attribute-inheritance rules (`mj-all`, per-tag defaults, `mj-class`) before mapping each element. `@templatical/import-mjml` does exactly that; the mapping table below is what it implements.

## Path 1 — Rebuild visually using your MJML as a reference

For a handful of templates, rebuilding by hand next to your MJML source is often faster than installing a package:

1. Open your MJML source in your editor of choice.
2. Open the Templatical editor (or [the playground](https://play.templatical.com)) side-by-side.
3. Compile your MJML to HTML once and preview it — that's your visual target.
4. Drag in the equivalent Templatical blocks (see the [mapping table](#mjml-tag-mapping) below).
5. Copy text content directly. Re-host images via your media library.
6. Reproduce styling using Templatical's [design tokens](/guide/theming) instead of inline `mj-attributes`.

Most MJML templates port in 10–20 minutes once you've done one or two. For a larger batch, run `@templatical/import-mjml` first and use this path only to finish off anything it left as an HTML-fallback block.

## Path 2 — Use Templatical's renderer to verify your work

Once you have a template in Templatical — imported or rebuilt by hand:

```ts
import { renderToMjml } from '@templatical/renderer';

const mjml = await renderToMjml(content);
// Compare this MJML against your original MJML source.
```

Run a diff between the original and Templatical-generated MJML to spot structural differences. This is a useful sanity check before bulk-migrating.

## MJML tag mapping {#mjml-tag-mapping}

| MJML tag | Templatical block | Notes |
|---|---|---|
| `mj-section` (containing `mj-column`s) | `SectionBlock` with `columns` | A width within 2 percentage points of a preset keeps that preset. Any other ratio of two to four columns is scaled to 100: shares that equal a preset keep that preset, and any others set `columnWidths` on the even layout of that count. Five or more columns fold into `"4"`. Widths come from MJML's `width` attribute. A column with no width is the parent width divided by the column count, and a px width is a share of the section's inner box. When every width is absent the columns are equal. `border-radius` and `border` too (see [Borders and corners](#borders-and-corners)). `background-url` with its size, position and repeat becomes `backgroundImage` (see [Background images](#background-images)). |
| `mj-column` | Section column | A column holds a list of nested blocks. |
| `mj-group` | `SectionBlock.stackOnMobile: false` | Not a block at all — marks the section's columns to stay side by side on mobile instead of stacking. |
| `mj-text` | `TitleBlock` / `TableBlock` / `MenuBlock` / `ParagraphBlock` | Resolved structurally: a single heading root becomes `TitleBlock`, a single `<table>` becomes `TableBlock`, span-separated top-level anchors with no paragraph wrapper and no non-whitespace text-node siblings become `MenuBlock`, a sentence of copy plus a trailing `<a>` becomes `ParagraphBlock`, anything else becomes `ParagraphBlock`. A paragraph's `align`, `color` and `font-size` go into its markup: `text-align` on each `<p>`, color and size on one `<span>` inside it (`ParagraphBlock` has no field for them). Alignment to the start edge (`left`, or `right` in an RTL template) and a 14px size are left out. |
| `mj-image` | `ImageBlock` | `src`, `alt`, `href`, `width` (see [Image width](#image-width)), padding, `border-radius`, `border` (see [Borders and corners](#borders-and-corners)). `fluid-on-mobile` holds on an image that fills its column; on a narrower one it is `approximated`, since the image [keeps its width on phones](/guide/images#width-on-phones). |
| `mj-button` | `ButtonBlock` | `href`, `background-color`, `color`, `font-size`, `font-family`, padding, `width` (see [Button width](#button-width)), `line-height` (see [Button line height](#button-line-height)), `border-radius`, `border` (see [Borders and corners](#borders-and-corners)). |
| `mj-divider` | `DividerBlock` | `border-color`, `border-width`, `width` (see [Divider width](#divider-width)), padding. |
| `mj-spacer` | `SpacerBlock` | `height`. |
| `mj-social` (with `mj-social-element`) | `SocialIconsBlock` | Each `mj-social-element` → a `SocialIcon` entry. Platform comes from `name`, the `src` filename (pack suffixes such as `-round-outlined` stripped), or, only when there is no `src`, `alt`. An unrecognised icon with an image, including one whose `alt` names a network, becomes a custom icon (its own image, link and alt) in the same social block. A custom icon Templatical rendered carries `css-class="tpl-social-custom"` and stays custom even when its file is named after a network. Without an image it becomes a `website` icon and is reported approximated. |
| `mj-navbar` (with `mj-navbar-link`) | `MenuBlock` | Each link → `MenuItemData`. |
| `mj-table` | `TableBlock` | Maps `<tr>`/`<td>`/`<th>` rows and cells to Templatical's table data; a leading `<th>` row sets `hasHeaderRow`. |
| `mj-raw` | `HtmlBlock` | Inner markup preserved verbatim. |
| `mj-wrapper` | `SectionBlock.wrapper` | The section's outer band, **not a section of its own**. One section inside folds into its `wrapper`; several share the same band, flagged `approximated`. `background-color`, `background-url` (with its size, position and repeat), `padding` and `border-radius` carry over; a `border` is dropped and reported. `full-width="full-width"` sets `wrapper.fullWidth`, so the band runs to the window edge. |
| `mj-hero` | `SectionBlock` with `hero` | A one-column hero section. `fluid-height` → `height: "image"`, with `background-width` / `background-height` as the image's `naturalWidth` / `naturalHeight`; `fixed-height` → that `height`; a `fixed-height` hero as tall as its image drawn across the hero's box, which is how Templatical exports **Match image**, comes back as `height: "image"`. A `fluid-height` hero without `background-width` / `background-height` still imports as `height: "image"`, with a note: until its image has a size it renders as a regular section, and the `structure.hero-not-applied` warning gives the size as the reason. A `fixed-height` hero without a `height` (MJML's default) is a regular section with the background image. `background-position` carries over; `inner-padding` and `inner-background-color` are dropped and reported. Inside an `mj-wrapper`, the hero takes the wrapper's band. |
| `mj-carousel`, `mj-accordion` | `HtmlBlock` | Converted to an HTML block with the original markup preserved. |
| `mjml` | Template `settings` | `lang` → `locale`; `dir` → `direction`, kept only when it differs from the direction the language implies. |
| `mj-head` content | Template `settings` | `mj-preview` → `preheaderText`; `mj-attributes`/`mj-font`/`mj-style` set the document's font, text color, and link color/underline. `mj-title` has no settings equivalent and is dropped with a warning. |

### Image width {#image-width}

A px `width` becomes `"full"` once it reaches the image's room: its column less its own side padding and border, which is where MJML caps it. A narrower px width stays px, and an image with no `width` is `"full"`.

### Divider width

| `mj-divider` `width` | `DividerBlock.width` | Status |
|---|---|---|
| missing, or `100%` | `"full"` | `converted` |
| a percentage under `100%`, such as `50%` | the same percentage to two decimals, `"50%"` | `converted` |
| below `0%` or above `100%` | clamped to `"0%"` or `"full"` | `approximated` |
| px, narrower than the line can span | the px number | `converted` |
| px, as wide as the line can span or wider | `"full"` | `converted` |
| px, below `0` | clamped to `0` | `approximated` |
| any other value | `"full"` | `approximated` |

The line can span its column less the column's side padding and the divider's own, which is how `mj-divider` draws `100%`. A column's width is its share of `mj-body`'s `width`: the preset, or `columnWidths` when the section sets them.

Templatical centres every divider. A partial-width divider that MJML aligns left or right (`align`) is `approximated`, and its `note` names the alignment.

### Button width

| `mj-button` `width` | `ButtonBlock.width` | Status |
|---|---|---|
| missing | none, so the button fits its label | `converted` |
| `100%` | `"full"` | `converted` |
| px, above `0` | the px number | `converted` |
| a percentage above 0 and below `100%`, such as `40%` | that percentage, rounded to two decimals with trailing zeros dropped | `converted` |
| above `100%` | `"full"` | `approximated` |
| a percentage of `0%` or below | none, so the button fits its label | `approximated` |
| px of `0` or below | none, so the button fits its label | `approximated` |
| any other value | none, so the button fits its label | `approximated` |

A percentage above 0 and below 100 is stored as that percentage. MJML renders it against the column's content box, the column less the button's side padding, so the button shrinks with its column on a phone. A percentage of `100%` or more is `"full"`; one above `100%` carries a note that it was clamped. A percentage of `0%` or below, and a px width of `0` or below, leaves the button fitting its label, with a note. A px width above `0` stays px, because the renderer writes `"full"` as `100%`.

### Button line height

`line-height` becomes `lineHeight`, a multiple of the font size, and it applies to every line of a wrapped label. A percentage is that number over 100 (`200%` is `2`), a unitless number is itself, a px length is that many pixels divided by the font size (`28px` at 14px is `2`; with no `font-size`, by the button's 15px), and an `em` length is the number itself (`2em` is `2`), rounded to two decimals. A value that equals 1.2, including `120%` and `1.2em`, or a missing value, leaves `lineHeight` unset and the button stays converted, so a button the renderer wrote at `120%` imports as it renders today. Any other explicit value that cannot be read (`2rem`, `normal`, `calc(...)`, a non-positive number) leaves `lineHeight` unset and adds the note `Button line-height "<value>" could not be read; imported at 1.2.`, so the entry is approximated.

### Borders and corners

`mj-section`, `mj-image` and `mj-button` keep their `border-radius` and border; `mj-wrapper` keeps its `border-radius`.

| `border-radius` | Corner radius | Status |
|---|---|---|
| one to four px values, such as `8px` or `8px 8px 0 0` | the same corners, one number when all four match | `converted` |
| any other value, such as `50%`, `1em` or `8px / 4px` | square corners | `approximated` |

| `border` or `border-<side>` | That side | Status |
|---|---|---|
| a px width, `solid`, `dashed` or `dotted`, and a colour | the same | `converted` |
| style `none` or `hidden`, no style, or a `0` width | not drawn | `converted` |
| style `double`, `groove`, `ridge`, `inset` or `outset` | drawn `solid` | `approximated` |
| a width that is not px, such as `2em` or `thin`, or no width | not drawn | `approximated` |

A side's own `border-<side>` wins over `border`, as it does in MJML. A missing colour imports as unset, which draws in the inherited text colour (`currentColor`) as it did in MJML, and so does a colour the importer can't read. Templatical's wrapper has no border, so a `border` on `mj-wrapper` is dropped and its entry's `note` names it.

### Background images {#background-images}

`background-url` on an `mj-section` becomes the section's `backgroundImage`, and on an `mj-wrapper` the band's `wrapper.backgroundImage`. `background-size`, `background-position` (and `-x` / `-y`) and `background-repeat` come along, and an attribute the element leaves out takes MJML's own default (`auto`, `top center`, `repeat`), so the image paints where it did. An `mj-section` with `full-width="full-width"` and its own background moves that background onto `section.wrapper` with `fullWidth: true` and leaves the section background unset. A wrapper that already paints keeps its paint, and the section keeps its background. A full-width section inside a wrapper that is not itself full width keeps its background on the section.

A value with no exact Templatical keyword maps to the nearest one, and the entry is `approximated` with a note:

- **Size** — a size that fills a side (`100%`, `100% auto`, `auto 100%`, or a px width at least the section's) becomes `cover`; any other length or percentage becomes `auto`.
- **Position** — a percentage snaps to the nearest of left, center and right (top, center and bottom); a length is an offset from the left or top edge and maps there.
- **Repeat** — `repeat-x`, `repeat-y`, `round` and `space` become `repeat`.

`mj-column` has no `background-url` in MJML, so there is no column image to import. An `mj-hero`'s image becomes the `backgroundImage` of the section it imports as, always `cover` and unrepeated, as mj-hero paints it: a hero section, or a regular one for a hero as tall as its content.

## Where the mapping is lossy

MJML produced by Templatical's own renderer round-trips through the importer with no approximations to layout, style, or display conditions. The one gap is block type: a `VideoBlock` and an `HtmlBlock` both render as plain MJML with no marker of their origin, so each re-imports as a different kind of block (see below). Hand-written MJML converts cleanly for every tag in the mapping table above; anything the table doesn't cover lands as an `HtmlBlock` holding the original markup. Within what the table does cover, a few conversions are approximations rather than exact matches:

- **Column geometry** — Templatical supports these column layouts (`1`, `2`, `3`, `4`, `2-1`, `1-2`, `3-1`, `1-3`, `1-2-1`). A width list within 2 percentage points of a preset keeps that preset. A column with no `width` takes the parent width divided by the column count, as `mj-column` does, not the space the stated widths leave; when every width is absent the even preset stays exact. A px width is a share of the section's inner box, the container less the section's horizontal padding and drawn side borders. In a 600px container with 50px of side padding, `100px` beside `80%` is 100px beside 400px, so the shares are 20 / 80. Two, three or four columns that fit none are scaled to 100. Scaled shares that equal a preset keep that preset with no `columnWidths`; any others keep the even layout of that count and `columnWidths`. The match is exact when the widths already total 100 within 0.5 percentage points. When they do not, scaling changes the source layout, so the section is `approximated` and the note names the source widths. `30%` beside an absent width is 30 / 50, scaled, and `approximated`. `30%` / `40%` is `approximated`. `45%` / `45%` is `"2"` and `30%` / `60%` is `"1-2"`, both `approximated`. `30%` / `70%` is exact. `25%` / `25%` / `50%` is `columns: "3"` and `columnWidths: [25, 25, 50]`. `33.33%` / `66.67%` stays `"1-2"`. `49%` / `51%` stays `"2"`. A fifth or later column's content folds into the fourth column. The note names the four-column limit only on that overflow: `Column widths 20%, 20%, 20%, 20%, 20% have no exact Templatical layout; resolved to "4". Templatical supports up to four columns.`
- **Social icon sizes** — `SocialIconsBlock` supports three sizes (24px, 32px, 48px). An `mj-social-element`'s `icon-size` outside those three resolves to the nearest one.
- **Heading levels** — an `<h5>` or `<h6>` inside `mj-text` clamps to heading level 4, the highest a `TitleBlock` supports.
- **Divider width and alignment** — an `mj-divider` `width` outside 0–100% or below 0px is clamped into range, an unreadable one becomes `"full"`, and a partial-width divider aligned left or right is centred. See [Divider width](#divider-width).
- **Button width** — an `mj-button` `width` above `100%` becomes `"full"`, and one that is unreadable or `0` or below leaves the button fitting its label. See [Button width](#button-width).
- **Borders and corners** — a `border-radius` that isn't in px imports as square corners, a border style other than solid, dashed or dotted is drawn solid, a border side with no px width is left undrawn, and a border on `mj-wrapper` is dropped. See [Borders and corners](#borders-and-corners).
- **Background images** — a `background-size`, `background-position` or `background-repeat` with no exact Templatical keyword maps to the nearest one. See [Background images](#background-images).
- **Video blocks** — a `VideoBlock` renders the same way a linked `ImageBlock` does, so nothing in the MJML marks it as video. Importing that markup back produces an `ImageBlock` holding the same thumbnail and link; content survives, the block type does not.
- **HTML blocks** — for the same reason, an `HtmlBlock`'s content renders as plain `mj-text` markup with nothing marking it as HTML. Importing it back produces a `ParagraphBlock` holding the same markup.
- **Block IDs** — every imported block gets a freshly generated ID. IDs never appear in rendered MJML, so nothing that keys off one — a Cloud comment thread, for example — survives a round trip.

## Things that don't map automatically

- **`mj-include`** — the importer reads a single MJML string with no filesystem access, so an unresolved `<mj-include>` is skipped with a warning naming its `path` attribute. Inline the included content before importing.
- **Custom MJML components** — an unrecognized `mj-*` tag lands as an `HtmlBlock` holding its rendered markup automatically. Reimplement it as a [Templatical custom block](/guide/custom-blocks) if you want it editable as a native block instead.

## Further help

[Open a discussion](https://github.com/templatical/sdk/discussions) with a redacted snippet of your MJML and what you're trying to achieve. We use these reports to improve `@templatical/import-mjml`'s coverage.
