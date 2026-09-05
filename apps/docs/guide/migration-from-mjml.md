---
title: Migrating from hand-written MJML
description: Convert MJML email templates to Templatical format using @templatical/import-mjml.
---

# Migrating from hand-written MJML

This guide is for teams who've been authoring email templates in raw [MJML](https://mjml.io) (with editors like VS Code, an internal CLI, or a hand-rolled build pipeline) and want to move to Templatical's visual editor. **`@templatical/import-mjml`** converts an MJML document into Templatical's `TemplateContent` format directly — install it, run it, and use the sections below to finish off anything it can't map on its own.

## Installation

```bash
npm install @templatical/import-mjml
```

### Without a build step (CDN)

You can also load it from a CDN:

```html
<script type="module">
  import { convertMjmlTemplate } from 'https://cdn.jsdelivr.net/npm/@templatical/import-mjml/+esm';
  // ...then convert as shown in Usage below
</script>
```

## Usage

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

`convertMjmlTemplate` is synchronous and returns an `ImportResult` with:
- `content` — the converted `TemplateContent` ready for the editor
- `report` — a conversion report with the status of each source element (`converted`, `approximated`, `html-fallback`, or `skipped`)

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
// <mj-section> approximated: Column widths 40%, 60% have no exact Templatical layout; resolved to "1-2".
```

A `note` on an `approximated` entry always names the value it replaced, so diffing `report.entries` between two runs shows exactly what a migration changed.

## What's actually happening here

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
| `mj-section` (containing `mj-column`s) | `SectionBlock` with `columns` | Multi-column layouts work the same way; column widths come from MJML's `width` attribute or are equally distributed. |
| `mj-column` | Section column | A column holds a list of nested blocks. |
| `mj-group` | `SectionBlock.stackOnMobile: false` | Not a block at all — marks the section's columns to stay side by side on mobile instead of stacking. |
| `mj-text` | `TitleBlock` / `TableBlock` / `MenuBlock` / `ParagraphBlock` | Resolved structurally: a single heading root becomes `TitleBlock`, a single `<table>` becomes `TableBlock`, top-level links with no paragraph wrapper become `MenuBlock`, anything else becomes `ParagraphBlock`. |
| `mj-image` | `ImageBlock` | `src`, `alt`, `href`, `width`, padding. |
| `mj-button` | `ButtonBlock` | `href`, `background-color`, `color`, font, padding. |
| `mj-divider` | `DividerBlock` | `border-color`, `border-width`, padding. |
| `mj-spacer` | `SpacerBlock` | `height`. |
| `mj-social` (with `mj-social-element`) | `SocialIconsBlock` | Each `mj-social-element` → a `SocialIcon` entry. |
| `mj-navbar` (with `mj-navbar-link`) | `MenuBlock` | Each link → `MenuItemData`. |
| `mj-table` | `TableBlock` | Maps `<tr>`/`<td>`/`<th>` rows and cells to Templatical's table data; a leading `<th>` row sets `hasHeaderRow`. |
| `mj-raw` | `HtmlBlock` | Inner markup preserved verbatim. |
| `mj-wrapper` | `SectionBlock.wrapper` | The section's outer band, **not a section of its own**. One section inside folds into its `wrapper`; several share the same band, flagged `approximated`. |
| `mj-hero`, `mj-carousel`, `mj-accordion` | `HtmlBlock` | Converted to an HTML block with the original markup preserved. |
| `mj-head` content | Template `settings` | `mj-preview` → `preheaderText`; `mj-attributes`/`mj-font`/`mj-style` set the document's font, text color, and link color/underline. `mj-title` has no settings equivalent and is dropped with a warning. |

## Where the mapping is lossy

MJML produced by Templatical's own renderer round-trips through the importer with no approximations to layout, style, or display conditions. The one gap is block type: a `VideoBlock` and an `HtmlBlock` both render as plain MJML with no marker of their origin, so each re-imports as a different kind of block (see below). Hand-written MJML converts cleanly for every tag in the mapping table above; anything the table doesn't cover lands as an `HtmlBlock` holding the original markup. Within what the table does cover, a few conversions are approximations rather than exact matches:

- **Column geometry** — Templatical supports five column layouts (`1`, `2`, `3`, `2-1`, `1-2`). MJML allows any number of columns at any width, so a ratio outside those five resolves to the nearest layout, and a fourth or later column's content folds into the last column.
- **Social icon sizes** — `SocialIconsBlock` supports three sizes (24px, 32px, 48px). An `mj-social-element`'s `icon-size` outside those three resolves to the nearest one.
- **Heading levels** — an `<h5>` or `<h6>` inside `mj-text` clamps to heading level 4, the highest a `TitleBlock` supports.
- **Video blocks** — a `VideoBlock` renders the same way a linked `ImageBlock` does, so nothing in the MJML marks it as video. Importing that markup back produces an `ImageBlock` holding the same thumbnail and link; content survives, the block type does not.
- **HTML blocks** — for the same reason, an `HtmlBlock`'s content renders as plain `mj-text` markup with nothing marking it as HTML. Importing it back produces a `ParagraphBlock` holding the same markup.
- **Block IDs** — every imported block gets a freshly generated ID. IDs never appear in rendered MJML, so nothing that keys off one — a Cloud comment thread, for example — survives a round trip.

## Things that don't map automatically

- **`mj-include`** — the importer reads a single MJML string with no filesystem access, so an unresolved `<mj-include>` is skipped with a warning naming its `path` attribute. Inline the included content before importing.
- **Custom MJML components** — an unrecognized `mj-*` tag lands as an `HtmlBlock` holding its rendered markup automatically. Reimplement it as a [Templatical custom block](/guide/custom-blocks) if you want it editable as a native block instead.

## What to do if you hit something this guide doesn't cover

[Open a discussion](https://github.com/templatical/sdk/discussions) with a redacted snippet of your MJML and what you're trying to achieve. We use these reports to improve `@templatical/import-mjml`'s coverage.
