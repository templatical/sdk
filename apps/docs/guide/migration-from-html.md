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

## Usage

```ts
import { convertHtmlTemplate } from '@templatical/import-html';

// Load the raw HTML source of an email
const html = await fetch('/path/to/email.html').then((r) => r.text());

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
| `<p>` / text-only `<div>` / `<span>` | `paragraph` | Converted |
| `<img>` | `image` | Converted |
| `<a>` styled as button (background color, padding, border-radius, or `display: inline-block`) | `button` | Converted |
| `<a>` (plain inline link) | `paragraph` | Approximated (wrapped in a paragraph) |
| `<hr>` | `divider` | Converted |
| Empty `<td>` with explicit height | `spacer` | Converted |
| `<td>` containing a single styled `<a>` | `button` | Converted (cell-as-button pattern) |
| `<table>` (layout, multi-row/column) | `section` (one per `<tr>`) | Converted |
| `<table>` (data table — text-only cells) | `html` | HTML fallback |
| Unknown / custom elements | `html` | HTML fallback |

Anything that can't be mapped is preserved verbatim inside an HTML block, so no visible content is lost.

## Column Layout Conversion

Each `<tr>` in a layout table becomes a `SectionBlock`. Cell counts map directly:

| Cells per row | Templatical Layout |
|---|---|
| 1 | `'1'` |
| 2 | `'2'` |
| 3 | `'3'` |
| 4+ | flattened to `'1'` with a warning |

Templatical sections cannot nest. Tables nested inside a `<td>` are flattened — their inner blocks are merged into the parent cell.

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
- **Display conditions / merge tags** — proprietary placeholder syntax (`{{var}}`, `*|VAR|*`, `<%= var %>`) is preserved as raw text. Recreate using Templatical [merge tags](/guide/merge-tags) or [display conditions](/guide/display-conditions).
- **External resources** — `<link>`, external stylesheets, web fonts, and remote images are not fetched. Image `src` URLs are preserved as-is.
- **Outlook MSO conditional comments** — preserved as HTML inside their containing block (they're inert in non-Outlook clients anyway).
- **`<form>` / `<input>` / `<button>` form controls** — preserved as HTML-fallback. Most email clients block form submission; rebuild the call-to-action as a button linking to a hosted form.
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
