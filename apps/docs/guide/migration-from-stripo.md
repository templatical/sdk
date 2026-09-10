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

```bash
npm install @templatical/import-stripo
```

### Without a build step (CDN)

```html
<script type="module">
  import { convertStripoTemplate } from 'https://cdn.jsdelivr.net/npm/@templatical/import-stripo/+esm';
  // ...then convert as shown in Usage below
</script>
```

## Usage

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

`convertStripoTemplate` is synchronous and returns an `ImportResult` with:

- `content` — the converted `TemplateContent` ready for the editor
- `report` — a conversion report with the status of each source element (`converted`, `approximated`, `html-fallback`, or `skipped`)

Pass `options.css` when converting plugin storage. It is ignored on compiled exports (those already inline their styles).

Unrecognized HTML (no Stripo class attributes) is converted through `@templatical/import-html` and the report carries a warning naming that fallback.

## Reading the report

Each `report.entries` item describes one source element:

| Status | Meaning |
|---|---|
| `converted` | Mapped to a Templatical block with no loss of fidelity. |
| `approximated` | Mapped to a Templatical block, with a clamp or flatten — `note` states what changed. |
| `html-fallback` | No block equivalent; the original markup is preserved in an `HtmlBlock`. |
| `skipped` | Reserved for parity with the other `@templatical/import-*` packages; this converter does not currently produce it. |

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
| `esd-structure` with 1–3 `esd-container-frame`s | `SectionBlock` (`columns` `"1"` / `"2"` / `"3"`) | Frames are the columns. |
| `esd-structure` with 4+ frames | `SectionBlock` `columns: "1"` | Flattened; `approximated`. |
| `esd-block-text` | `title` / `paragraph` | Generic HTML mapping of the inner markup. |
| `esd-block-image` | `image` | Generic HTML mapping of the inner `<img>`. |
| `esd-block-button` | `button` | `href`, text, `target="_blank"` → `openInNewTab`. Inline `background` / `color` / `border-radius` when present. |
| `esd-block-menu` (2+ item cells) | `menu` | One `MenuItemData` per item cell. |
| `esd-block-menu` (1 item cell) | `paragraph` (or the inner mapping) | A stacked step, not a nav — Password-reset rows stay copy. |
| `esd-block-social` | `social` | Platform from `title` / `src` / `alt`; unknown names become `website`. |
| `esd-block-spacer` | `spacer` | Height from `style` or the `height` attribute. |
| `esd-block-html` | `html` | Inner markup preserved. |

## Compiled HTML mapping {#compiled-mapping}

Compiled export drops `esd-*` from elements and keeps `es-*` leftovers. Stripes (`es-header` / `es-content` / `es-footer`) become sections. Columns are sibling floated tables (`es-left` / `es-right`), not cell counts.

| Stripo marker | Templatical block | Notes |
|---|---|---|
| `es-header` / `es-content` / `es-footer` | `SectionBlock` | One section per top-level stripe. Fill comes from the inner `es-*-body` `background-color` (style wins over `bgcolor`). |
| 1–3 `es-left` / `es-right` siblings | `columns` `"1"` / `"2"` / `"3"` | Floated tables, not `<td>` count. |
| 4+ floated siblings | `columns: "3"` | Extra columns merge into the third slot; `approximated`. |
| `a.es-button` | `button` | Inline `background` / `color` / `border-radius`, including from the wrapping `es-button-border`. |
| `table.es-menu` (2+ item cells) | `menu` | |
| `table.es-menu` (1 item cell) | inner mapping, not `menu` | Same stacked-step rule as the plugin path. |
| `table.es-social` | `social` | Same platform mapping as the plugin path. |
| `es-spacer` | `spacer` | |

Everything else in a stripe goes through `@templatical/import-html` (headings, paragraphs, images, dividers).

## Where the mapping is lossy

- **Column geometry** — Templatical supports five column layouts (`1`, `2`, `3`, `2-1`, `1-2`). Plugin HTML with 4+ frames flattens to one column. Compiled HTML with 4+ floated tables keeps three slots and folds the rest into the last.
- **Social icon `alt`** — platforms are inferred; the original `alt` string is not stored on `SocialIcon`.
- **Block IDs** — every imported block gets a freshly generated ID.
- **AMP / timers / modules** — no Templatical equivalent; inner markup lands as `html` or is skipped with a warning.
- **Inline CSS vs. plugin CSS** — compiled exports already inline. Plugin CSS must be passed as `options.css` or styles that lived only in that stylesheet are missing from the conversion.

## Things that don't map automatically

- **A round-trip back into Stripo** — the output is Templatical JSON, not Stripo editor HTML.
- **Generic HTML that was never a Stripo document** — use [`@templatical/import-html`](/guide/migration-from-html) directly. Passing it here still converts, with a warning.

## What to do if you hit something this guide doesn't cover

[Open a discussion](https://github.com/templatical/sdk/discussions) with a redacted snippet of your Stripo HTML and what you're trying to achieve. We use these reports to improve `@templatical/import-stripo`'s coverage.
