---
title: Migrating from Stripo
description: Convert Stripo email templates to Templatical format using @templatical/import-stripo.
---

# Migrating from Stripo

This guide is for teams who've built email templates in [Stripo](https://stripo.email) — in the hosted editor, or through a product that embeds the Stripo Plugin — and want to move to Templatical's visual editor. **`@templatical/import-stripo`** converts Stripo HTML into Templatical's `TemplateContent` format. Install it, run it, and use the sections below to finish off anything it can't map on its own.

Stripo stores two different HTML surfaces. The converter auto-detects which one you passed. There is no mode flag.

| Surface | Where it comes from | Discriminator |
|---|---|---|
| Plugin / editor storage | `getTemplateData()` → `{ html, css }` | `esd-stripe`, `esd-structure`, `esd-block-*` on elements |
| Compiled export | File → HTML, or `compileEmail({ callback })` | `es-wrapper`, `es-content-body`, `es-header-body` — no `esd-*` on elements |

A leftover `.esd-block-html` rule inside a stylesheet is not a discriminator. CSS-only leftovers convert as generic HTML.

## Installation

::: code-group

```bash [npm]
npm install @templatical/import-stripo
```

```bash [pnpm]
pnpm add @templatical/import-stripo
```

```bash [yarn]
yarn add @templatical/import-stripo
```

```bash [bun]
bun add @templatical/import-stripo
```

:::

### Without a build step (CDN)

```html
<script type="module">
  import { convertStripoTemplate } from 'https://cdn.jsdelivr.net/npm/@templatical/import-stripo/+esm';
  // ...then convert as shown in Usage below
</script>
```

## Usage {#usage}

```ts
import { convertStripoTemplate } from '@templatical/import-stripo';

// Plugin host — what you stored from getTemplateData():
const { html, css } = await window.StripoApi.getTemplateData();
const { content, report } = convertStripoTemplate(html, { css });

// Marketer File → HTML export:
const exported = await fetch('/path/to/export.html').then((r) => r.text());
const compiled = convertStripoTemplate(exported);

const editor = await init({
  container: '#editor',
  content: compiled.content,
});
```

[Open in playground](https://play.templatical.com/scenes/import-stripo)

`convertStripoTemplate` is synchronous and returns an `ImportResult` with:

- `content` — the converted `TemplateContent` ready for the editor
- `report` — a conversion report with the status of each source element (`converted`, `approximated`, `html-fallback`, or `skipped`)

Pass `options.css` with plugin storage (`getTemplateData().css`). Those rules apply to each cell the HTML importer converts. A compiled File → HTML export already inlines the same rules.

Unrecognized HTML (no Stripo class attributes) is converted through `@templatical/import-html` and the report carries a warning naming that fallback.

## Reading the report

Each `report.entries` item describes one source element:

| Status | Meaning |
|---|---|
| `converted` | Mapped to a Templatical block with no loss of fidelity. |
| `approximated` | Mapped to a Templatical block, with a clamp or flatten — `note` states what changed. |
| `html-fallback` | No block equivalent; the original markup is preserved in an `HtmlBlock`. |
| `skipped` | Reserved for parity with the other `@templatical/import-*` packages; this converter does not currently produce it. |

The report lists the blocks that remain in `content`, including each section Stripo emits. A `<tr>` section the HTML importer invents while walking a cell is omitted. Warnings from that walk remain.

```ts
console.log(report.summary);
// { total: 18, converted: 16, approximated: 1, htmlFallback: 1, skipped: 0 }

for (const entry of report.entries) {
  if (entry.status === 'approximated') {
    console.warn(`<${entry.sourceTag}> approximated:`, entry.note);
  }
}
```

## Path 1 — Rebuild visually using your Stripo export as a reference

For a handful of templates, rebuilding by hand next to a compiled preview is often faster than installing a package:

1. Export File → HTML from Stripo and open it in a browser — that's your visual target.
2. Open the Templatical editor (or [the playground](https://play.templatical.com)) side-by-side.
3. Drag in the equivalent Templatical blocks (see the mapping tables below).
4. Copy text content directly. Re-host images via your media library.

Most Stripo templates port in 10–20 minutes once you've done one or two. For a larger batch, run `@templatical/import-stripo` first and use this path only to finish off what it left `approximated` or as an `html-fallback` block.

## Plugin HTML mapping {#plugin-mapping}

Plugin storage is a table tree labelled with `esd-*` classes. Each `esd-structure` becomes a `SectionBlock`; its `esd-container-frame` children are the columns.

| Stripo marker | Templatical block | Notes |
|---|---|---|
| `esd-structure` with 1–3 `esd-container-frame`s | `SectionBlock` (`columns` `"1"` / `"2"` / `"3"`) | Frames are the columns. Padding comes from `es-p*` on the structure (default 0); an inline `padding` overrides the sides it states. |
| `esd-structure` with 4+ frames | `SectionBlock` `columns: "1"` | Flattened; `approximated`. |
| `esd-block-text` | `title` / `paragraph` | Generic HTML mapping of the inner markup. |
| `esd-block-image` | `image` | Generic HTML mapping of the inner `<img>`. |
| `esd-block-button` | `button` | `href`, text, `target="_blank"` → `openInNewTab`. Inline `background` / `color` / `border-radius` when present. |
| `esd-block-menu` (2+ item cells) | `menu` | One `MenuItemData` per item cell. |
| `esd-block-menu` (1 item cell) | `paragraph` (or the inner mapping) | A stacked step, not a nav — Password-reset rows stay copy. |
| `esd-block-social` | `social` | Platform from `title` / `src` / `alt`; unknown names become `website`. |
| `esd-block-spacer` | `spacer` or `divider` | A visible `border-bottom` or `border-top` on the spacer or its inner cell becomes a divider (style, colour, thickness, and the width rule below). Otherwise a spacer: height from `style`, the `height` attribute, or vertical padding. |
| `esd-block-html` | `html` | Inner markup preserved. |

## Compiled HTML mapping {#compiled-mapping}

Compiled export drops `esd-*` from elements and keeps `es-*` leftovers. Each direct row of a stripe becomes its own section, in document order. Columns are the floated `es-left` / `es-right` tables inside that row.

| Stripo marker | Templatical block | Notes |
|---|---|---|
| `es-header` / `es-content` / `es-footer` | one or more `SectionBlock`s | One section per direct row of the stripe's `es-*-body`. A stripe with no `es-*-body` uses its own rows. An empty row is skipped. |
| Content beside the columns in the same cell | one-column `SectionBlock` | Leading content stays before the column section and trailing content after it. Content that sat between the columns is placed after the column section (`approximated`). Splitting one padded cell into more than one section is `approximated`; the top padding stays on the first section, the bottom on the last, and the sides on each. |
| 1–3 `es-left` / `es-right` in one row | `columns` `"1"` / `"2"` / `"3"` | Floated tables in that row, including tables nested in a wrapper. Columns nested inside another `es-left` / `es-right` stay inside it. |
| 4+ floated tables in one row | `columns: "3"` | Extra columns merge into the third slot; `approximated`. |
| `a.es-button` | `button` | Inline `background` / `color` / `border-radius`, including from the wrapping `es-button-border`. Widgets stay in document order with the copy around them. |
| `table.es-menu` (2+ item cells) | `menu` | |
| `table.es-menu` (1 item cell) | inner mapping | A stacked step, same rule as the plugin path. |
| `table.es-social` | `social` | Same platform mapping as the plugin path. |
| `es-spacer` with a visible border | `divider` | Style, colour and thickness from `border-bottom` or `border-top`. Width follows the rule below. |
| `es-spacer` with no border | `spacer` | Height from `style`, the `height` attribute, or vertical padding. |

`settings.backgroundColor` is the first painted `es-wrapper` or `es-wrapper-color` (`#ffffff` when neither is set). An `es-*-body` fill is the section's background. A transparent body leaves the stripe fill on the section. A stripe fill that differs from both the page and the body becomes `section.wrapper.backgroundColor`, and that section is `approximated`. A `background-image` is reported and dropped; the colour still applies.

The structure cell's padding is the section's padding. The default is 0. On plugin HTML, `es-p20` sets every side and `es-p10t` / `es-p10r` / `es-p10b` / `es-p10l` override one side; an inline padding overrides the sides it states. Those classes are read on the structure element.

A divider's width uses the column it sits in. No width, `auto` or `100%` spans that column. Another percentage stays a percentage, rounded to two decimals and clamped to 0–100. A px width stays px until it fills the column's room (the column's share of the body width, less the section padding on the edge that column owns, and the divider's own side padding). `double`, `groove`, `ridge`, `inset` and `outset` import as `solid`. A partial-width line aligned left or right is centred, and that entry is `approximated`. A partial line with no alignment is treated as left.

Everything else in a row goes through `@templatical/import-html` (headings, paragraphs, images, `<hr>` dividers).

## Where the mapping is lossy

- **Column geometry** — Templatical supports five column layouts (`1`, `2`, `3`, `2-1`, `1-2`). Plugin HTML with 4+ frames flattens to one column. Compiled HTML with 4+ floated tables in one row keeps three slots and folds the rest into the last. Content between those columns becomes its own one-column section after them, and a padded cell split across the resulting sections is `approximated`.
- **Social icon `alt`** — platforms are inferred; the original `alt` string is not stored on `SocialIcon`.
- **Block IDs** — every imported block gets a freshly generated ID.
- **AMP / timers / modules** — no Templatical equivalent; inner markup lands as `html` or is skipped with a warning.
- **Plugin CSS** — pass `options.css` with plugin storage. Rules that live only in that stylesheet are applied to the converted blocks. Compiled exports already inline them.

## Things that don't map automatically

- **A round-trip back into Stripo** — the output is Templatical JSON, not Stripo editor HTML.
- **Generic HTML that was never a Stripo document** — use [`@templatical/import-html`](/guide/migration-from-html) directly. Passing it here still converts, with a warning.

## Further help

[Open a discussion](https://github.com/templatical/sdk/discussions) with a redacted snippet of your Stripo HTML and what you're trying to achieve. We use these reports to improve `@templatical/import-stripo`'s coverage.
