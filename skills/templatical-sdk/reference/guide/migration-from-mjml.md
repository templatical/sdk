---
title: Migrating from hand-written MJML
description: How to move existing MJML email templates into Templatical's visual editor — mapping table, rebuild approach, and what's coming next.
---

# Migrating from hand-written MJML

This guide is for teams who've been authoring email templates in raw [MJML](https://mjml.io) (with editors like VS Code, an internal CLI, or a hand-rolled build pipeline) and want to move to Templatical's visual editor.

::: tip Automated importer in development
We're building an automated **`@templatical/import-mjml`** package that parses an MJML document and produces a Templatical `TemplateContent` tree. It's actively in development. Until it ships, this page documents the manual path.

MJML → Templatical is harder to fully automate than BeeFree → Templatical, because MJML is a strict superset of what Templatical's JSON tree expresses (you can write valid MJML that has no Templatical block equivalent). The importer will cover the common patterns and fall back to `HtmlBlock` for anything outside the mapping.
:::

## What's actually happening here

This is a slightly counter-intuitive migration. Templatical's renderer produces *MJML output* — so on the surface, MJML and Templatical look identical. But:

- **MJML** is a markup language. You write XML-like tags (`<mj-section>`, `<mj-column>`, `<mj-text>`) and the MJML compiler turns them into table-based HTML.
- **Templatical** stores templates as a JSON tree of typed blocks (`SectionBlock`, `ParagraphBlock`, etc.) and renders that tree to MJML at export time.

To bring an MJML template into Templatical, you need to **parse the MJML** and **construct an equivalent JSON tree**. There's no built-in tool for that yet — see "automated importer in development" above.

## Path 1 — Rebuild visually using your MJML as a reference (recommended)

If you have **fewer than 20 MJML templates**, this is by far the fastest path:

1. Open your MJML source in your editor of choice.
2. Open the Templatical editor (or [the playground](https://play.templatical.com)) side-by-side.
3. Compile your MJML to HTML once and preview it — that's your visual target.
4. Drag in the equivalent Templatical blocks (see the [mapping table](#mjml-tag-mapping) below).
5. Copy text content directly. Re-host images via your media library.
6. Reproduce styling using Templatical's [design tokens](/guide/theming) instead of inline `mj-attributes`.

Most MJML templates port in 10–20 minutes once you've done one or two.

## Path 2 — Use Templatical's renderer to verify your work

Once you've rebuilt a template visually:

```ts
import { renderToMjml } from '@templatical/renderer';

const mjml = await renderToMjml(content);
// Compare this MJML against your original MJML source.
```

Run a diff between the original and Templatical-generated MJML to spot structural differences. This is a useful sanity check before bulk-migrating.

## Path 3 — Write a one-off conversion script

If you have hundreds of MJML templates and want to attempt automated conversion before the official importer ships, the practical approach is to use a small XML/HTML parser (`htmlparser2`, `node-html-parser`) and walk the MJML tree, calling Templatical's [block factories](/api/types) for each tag.

Here's the rough shape:

```ts
import { parse } from 'node-html-parser';
import {
  createSectionBlock,
  createTitleBlock,
  createParagraphBlock,
  createImageBlock,
  createButtonBlock,
} from '@templatical/types';
import type { TemplateContent, Block } from '@templatical/types';

function mjmlToTemplate(mjml: string): TemplateContent {
  const root = parse(mjml);
  const body = root.querySelector('mj-body');

  const blocks: Block[] = (body?.childNodes ?? [])
    .map((node) => convertNode(node))
    .filter((b): b is Block => b !== null);

  return {
    blocks,
    settings: {
      width: parseInt(body?.getAttribute('width') ?? '600'),
      backgroundColor: body?.getAttribute('background-color') ?? '#ffffff',
    },
  };
}

function convertNode(node: any): Block | null {
  switch (node.tagName?.toLowerCase()) {
    case 'mj-section':
      return convertSection(node);
    case 'mj-text':
      return convertText(node);
    // …more cases — see the mapping table below
    default:
      return null; // or fall back to HtmlBlock
  }
}
```

::: warning
A handwritten parser will miss edge cases — nested `mj-wrapper`, custom components, conditional tags, includes (`mj-include`), and attribute inheritance via `mj-attributes`. Run any conversion on a small sample first and compare visually before bulk-converting.
:::

## MJML tag mapping {#mjml-tag-mapping}

| MJML tag | Templatical block | Notes |
|---|---|---|
| `mj-section` (containing `mj-column`s) | `SectionBlock` with `columns` | Multi-column layouts work the same way; column widths come from MJML's `width` attribute or are equally distributed. |
| `mj-column` | Section column | A column holds a list of nested blocks. |
| `mj-text` | `ParagraphBlock` (or `TitleBlock` if it's a heading) | Use heading-level inline styles to decide between Title and Paragraph. |
| `mj-image` | `ImageBlock` | `src`, `alt`, `href`, `width`, padding. |
| `mj-button` | `ButtonBlock` | `href`, `background-color`, `color`, font, padding. |
| `mj-divider` | `DividerBlock` | `border-color`, `border-width`, padding. |
| `mj-spacer` | `SpacerBlock` | `height`. |
| `mj-social` (with `mj-social-element`) | `SocialIconsBlock` | Each `mj-social-element` → a `SocialIcon` entry. |
| `mj-navbar` (with `mj-navbar-link`) | `MenuBlock` | Each link → `MenuItemData`. |
| `mj-table` | `TableBlock` | Map `<tr>` and `<td>` rows/cells to Templatical's table data. |
| `mj-raw` | `HtmlBlock` | Pass-through HTML. |
| `mj-wrapper` | `SectionBlock` (often) | A wrapper without columns becomes a section with one column. |
| `mj-hero`, `mj-carousel`, `mj-accordion` | `HtmlBlock` (fallback) | Templatical doesn't have direct equivalents yet — convert the rendered HTML to a raw HTML block, or wait for the importer. |
| `mj-head` content | Template `settings` | `mj-title`, `mj-preview`, `mj-attributes`, `mj-font`, `mj-style` map to `TemplateSettings.preheaderText`, custom fonts, and theme overrides. |

## Things that don't map automatically

- **`mj-attributes` defaults** — MJML lets you set defaults for any tag globally. Translate these into Templatical's [block defaults](/guide/defaults) and [theme overrides](/guide/theming) instead.
- **`mj-include`** — MJML's include directive has no direct equivalent. Inline the included content during conversion.
- **Custom MJML components** — if you've registered custom MJML components, you'll need to either (a) implement them as [Templatical custom blocks](/guide/custom-blocks), or (b) fall back to `HtmlBlock` with the rendered HTML.
- **Conditional MSO tags inside `mj-raw`** — preserve them by including the original markup in an `HtmlBlock`.

## What to do if you hit something this guide doesn't cover

[Open a discussion](https://github.com/templatical/sdk/discussions) with a redacted snippet of your MJML and what you're trying to achieve. We're using these reports to prioritize which MJML patterns the automated importer covers first.
