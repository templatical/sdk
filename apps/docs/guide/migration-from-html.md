---
title: Migration from HTML
description: Convert HTML email templates to Templatical format using @templatical/import-html.
---

# Migration from HTML

The `@templatical/import-html` package converts HTML email templates into Templatical's `TemplateContent` format. It's designed for the table-based HTML that real marketing emails actually ship — output of MJML, Mailchimp/SendGrid/Campaign Monitor exports, hand-coded campaigns.

::: warning
This package is in active development. Modern (flex/grid) HTML is preserved via HTML-fallback blocks rather than re-decomposed; review your converted templates before using them in production.
:::

## Installation

```bash
npm install @templatical/import-html
```

### Without a build step (CDN)

You can also load it from a CDN:

```html
<script type="module">
  import { convertHtmlTemplate } from 'https://cdn.jsdelivr.net/npm/@templatical/import-html/+esm';
  // ...then convert as shown in Usage below
</script>
```

## Usage

```ts
import { convertHtmlTemplate } from '@templatical/import-html';

// Load the raw HTML source of an email
const res = await fetch('/path/to/email.html');
const html = await res.text();

// Convert to Templatical format
const { content, report } = convertHtmlTemplate(html);

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
- `report` — a conversion report with the status of each element (`converted`, `approximated`, `html-fallback`, or `skipped`)

## Element Mapping

HTML elements map to Templatical equivalents:

| HTML Element | Templatical Block | Status |
|---|---|---|
| `<h1>` – `<h4>` | `title` | Converted (level preserved) |
| `<h5>` – `<h6>` | `title` | Converted (clamped to level 4) |
| A heading wrapped in a `<div>`, `<center>` or `<main>` | `title` | Converted (wrapper unwrapped) |
| `<p>` / text-only `<div>` / `<span>` | `paragraph` | Converted |
| Text-only `<td>` in a layout table | `paragraph` | Converted |
| Bare text at body level or directly inside a wrapper | `paragraph` | Converted |
| `<img>` | `image` | Converted |
| `<a>` styled as button (background color, padding, border-radius, or `display: inline-block`) | `button` | Converted |
| `<a>` (text link) | folded into the surrounding `paragraph` | Converted |
| `<a>` wrapping an `<img>` | `image` with `linkUrl` | Converted |
| `<hr>` | `divider` | Converted |
| Empty `<td>` with explicit height | `spacer` | Converted |
| `<td>` whose entire content is one styled text `<a>` | `button` | Converted (cell-as-button pattern) |
| `<table>` (layout, multi-row/column) | `section` (one per `<tr>`) | Converted |
| `<table>` (data table — text-only cells) | `html` | HTML fallback |
| Unknown / custom elements | `html` | HTML fallback |

Anything that can't be mapped is preserved verbatim inside an HTML block, so no visible content is lost.

A cell mixing copy with a link becomes one `paragraph` holding both, with the `<a>` and its `href` inline. A cell whose entire content is one styled text `<a>` reads as a button.

A `<div>`, `<center>` or `<main>` that wraps a table produces no block of its own: the importer descends into it, at any nesting depth, and maps the tables it finds. A wrapper holding only text keeps its `paragraph` mapping, and a wrapper whose whole content is one heading is unwrapped so the heading is what gets mapped.

## Inline Formatting

`<br>`, `<em>`, `<strong>`, `<i>`, `<b>`, `<u>`, `<small>`, `<sub>` and `<sup>` stay inside the text they belong to. A run of them, together with the bare text around it, becomes one `paragraph` whose colour, size and alignment come from the containing cell — so `Hello<br>World` in a `<td>` imports as a single paragraph holding both words and the line break.

A text `<a>` folds into that run, keeping its `href`, so a sentence containing a link arrives as one paragraph rather than as a link torn out of its copy. An `<a>` wrapping an `<img>` becomes an `image` with `linkUrl` from a non-empty href. An `<a>` wrapping both an image and text becomes that `image` plus a sibling `paragraph` that keeps the remaining `<a>`.

::: tip
Bare text counts as content here. A cell walk that visited only element children dropped the words between two inline tags, and dropped a loose sentence sitting beside a table at body or wrapper level. Both are now kept.
:::

## Column Layout Conversion

Each `<tr>` in a layout table becomes a `SectionBlock`. The row's direct `<td>` / `<th>` children are the layout:

| Cells per row | Templatical Layout |
|---|---|
| 1 | `'1'` |
| 2 | `'2'` or `'2-1'` / `'1-2'`, by declared width |
| 3 | `'3'` |
| 4+ | merged into `'1'`, with a warning and an `approximated` report entry |

### Column ratios

A two-cell row picks between `'2'`, `'2-1'` and `'1-2'` from the widths its cells declare — a `width` attribute, a `style="width:…"`, or the share in an `mj-column-per-*` class name. The closest of those layouts wins, so `350` / `190` reads as `'2-1'` and `33.33%` / `66.66%` as `'1-2'`.

A ratio no layout expresses is imported as the equal split for that cell count and reported as `approximated`, with a note naming the widths that were measured:

```txt
Column widths 24.1% / 51.9% / 24.1% have no Templatical equivalent.
The section was imported as 3 equal columns.
```

### Wrapper rows

Table-based emails wrap their real layout in one-cell tables. A row holding a single cell whose content is nothing but tables is descended instead of becoming a section, so the column count is read off the row that declares it. The descent applies only when that cell holds no content beside its tables and the row carries no background colour and no padding — a row failing either becomes a section of its own, because the section is what carries a row's background and padding.

### Gutter rows

A row that pads its content with empty cells — `&nbsp;` either side of a centred container — is read as the single column it lays out, not as one column per cell. The signal is content: a cell holding nothing takes part in no layout.

### Sibling column containers

A single `<td>` holding one `display: inline-block` container per column is read as a column set, with the column count taken from the number of containers and the ratio from their declared widths. This is how hybrid templates and compiled MJML state their columns — MJML puts a whole section's columns into one cell as sibling `<div class="mj-column-per-*">` elements — so such a row has no cell count to read.

Every container must be laid out side by side, none may be empty, and no text of the cell's own may sit beside them. A cell failing any of those is a single column.

::: tip
`display: inline-block` is what makes a set of containers a set of columns, since a block-level `<div>` stacks instead. Requiring it keeps two stacked divs from being read as a layout the source never stated.
:::

### Nesting

Templatical sections cannot nest. Tables nested inside a `<td>` are flattened — their inner blocks are merged into the parent cell. A nested row with more than one cell loses its columns that way, and `report.entries` records it as `approximated` with a note.

## CSS Handling

`<style>` blocks are resolved onto matching elements before conversion:

- **Inline styles always win** over rules from `<style>` blocks.
- **`@media` queries are skipped** — they would always apply if flattened. Email is rendered at one viewport in the editor.
- **`@font-face`, `@keyframes`, `@supports`** are skipped.
- **Pseudo-classes (`:hover`, `::before`)** are skipped.
- **External stylesheets (`<link rel="stylesheet">`)** are not fetched.
- **`!important` markers** are dropped (no specificity conflicts to resolve).

For best fidelity, inline your styles before importing. Most production marketing emails are already inlined by their sending pipeline.

## Template Settings

Global template settings are extracted from the document:

- **Width** — outermost `<table>` `width` attribute or `style="width:…"`. Defaults to `600`.
- **Background color** — `<body>` `background-color` style. Defaults to `#ffffff`.
- **Font family** — `<body>` `font-family` style. Defaults to `Arial`.
- **Preheader text** — first `<div style="display:none">` near the top of the body, by convention.

## Known Limitations

- **Modern HTML (flex / grid / `<div>` layouts)** — produces low-fidelity output, mostly HTML-fallback blocks. The importer is tuned for table-based email HTML.
- **Custom fonts** — `@font-face` rules are not imported. Add fonts manually via the editor's [`fonts` config option](/guide/fonts).
- **Display conditions / merge tags** — proprietary merge tag syntax (<code v-pre>{{var}}</code>, `*|VAR|*`, `<%= var %>`) is preserved as raw text. Recreate using Templatical [merge tags](/guide/merge-tags) or [display conditions](/guide/display-conditions).
- **External resources** — `<link>`, external stylesheets, web fonts, and remote images are not fetched. Image `src` URLs are preserved as-is.
- **Outlook MSO conditional comments** — preserved as HTML inside their containing block (they're inert in non-Outlook clients anyway).
- **`<form>` / `<input>` / `<button>` form controls** — preserved as HTML-fallback. Most email clients block form submission; rebuild the call-to-action as a button linking to a hosted form.
- **Rows of more than three cells** — `ColumnLayout` holds at most three columns, so a wider row is merged into one and reported. Ratios outside `'2'` / `'2-1'` / `'1-2'` / `'3'`, such as a `1-2-1` sidebar pair, have no equivalent either and import as the equal split.
- **AMP for Email** — not currently supported in Templatical.

## Verifying Converted Templates

After conversion, review the output in the editor to check for:

1. **Element classification** — review `report.entries` for entries with `status: 'approximated'` or `status: 'html-fallback'`.
2. **Image URLs** — relative paths and CID references won't resolve in the preview; replace with absolute URLs.
3. **Column proportions** — automatic mapping picks the closest standard layout; fine-tune in the section settings panel.
4. **Spacing and padding** — `padding` shorthand is parsed faithfully, but margin/spacing on bare cells may need touch-up.
5. **HTML-fallback blocks** — anything that landed in an HTML block can be edited inline or replaced with first-class blocks.

## Reading the Report

```ts
const { content, report } = convertHtmlTemplate(html);

console.log(report.summary);
// { total: 12, converted: 10, approximated: 1, htmlFallback: 1, skipped: 0 }

for (const entry of report.entries) {
  if (entry.status === 'html-fallback') {
    console.warn(
      `Element <${entry.sourceTag}> preserved as HTML:`,
      entry.note,
    );
  }
}

for (const warning of report.warnings) {
  console.warn(warning);
}
```

### Sections in the report

`report.entries` accounts for the sections alongside the leaf blocks, so the entries reconcile against `content.blocks`:

- One entry per section, with `sourceTag: 'tr'` and `templaticalBlockType: 'section'`. Its status is `converted` when every cell kept its own column, and `approximated` with a note when cells were merged or when the ratio had no equivalent.
- One entry with `sourceTag: 'body'` and a note when loose top-level content is grouped into a synthetic single-column section.
- One entry with `templaticalBlockType: null` and a note for a nested row whose columns were dropped.

A wrapper the importer descends through contributes no entry of its own: nothing is created and nothing lost. So a heading lifted out of a `<div>` is reported under its own tag, and a cell's column containers appear nowhere.

::: warning Entry counts changed
Sections and lost layouts are reported where they previously were not, so `report.summary.total` is higher for the same document, and `approximated` now covers cases that raised only a `warnings` string or went unreported. Code that asserts on exact totals needs updating; code that filters by `status` or `templaticalBlockType` does not.
:::
