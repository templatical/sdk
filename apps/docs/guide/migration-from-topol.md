---
title: Migrating from Topol
description: Convert Topol.io email templates to Templatical format using @templatical/import-topol.
---

# Migrating from Topol

This guide is for teams who've built email templates in [Topol.io](https://topol.io)'s drag-and-drop editor — directly, or through a product that embeds it — and want to move to Templatical's visual editor. **`@templatical/import-topol`** converts a Topol design into Templatical's `TemplateContent` format directly — install it, run it, and use the sections below to finish off anything it can't map on its own.

## Installation

```bash
npm install @templatical/import-topol
```

### Without a build step (CDN)

You can also load it from a CDN:

```html
<script type="module">
  import { convertTopolTemplate } from 'https://cdn.jsdelivr.net/npm/@templatical/import-topol/+esm';
  // ...then convert as shown in Usage below
</script>
```

## Usage

```ts
import { convertTopolTemplate } from '@templatical/import-topol';

// Topol's REST API wraps the design as { id, name, html, json } —
// pass the response's "json" field, not the response itself.
const res = await fetch('https://api.topol.io/v1/designs/123').then((r) => r.json());

// Convert to Templatical format
const { content, report } = convertTopolTemplate(res.json);

// Use in the editor
const editor = await init({
  container: '#editor',
  content,
});

// Check the conversion report for any issues
console.log(report);
```

`convertTopolTemplate` is synchronous and returns an `ImportResult` with:
- `content` — the converted `TemplateContent` ready for the editor
- `report` — a conversion report with the status of each source node (`converted`, `approximated`, `html-fallback`, or `skipped`)

It also accepts the design serialized as a JSON string, for callers that store or transmit it that way.

::: tip
Pass the design object itself, not Topol's whole API response — the response wraps it as `{ id, name, html, json }`, so use `.json`. Passing the response object by mistake, as an object or as a JSON string, is recognised: the converter sees its `json` key and names `.json` in the error. A root with a different shape altogether — not an object, unparseable JSON, or an object with neither a recognised `tagName` nor a `json` key — still throws, naming what it expected instead. The design is unwrapped explicitly rather than detected automatically, because guessing which field holds the design risks importing the envelope's `html` string — output that belongs to `@templatical/import-html`, not this package.
:::

## Reading the report

Each `report.entries` item describes one source node:

| Status | Meaning |
|---|---|
| `converted` | Every attribute with a Templatical home was carried across. |
| `approximated` | Mapped to the right block, but a value was coerced to fit a closed range — `note` states what was coerced. |
| `html-fallback` | No block equivalent exists; the raw node is preserved as JSON inside an `HtmlBlock`. |
| `skipped` | Reserved for parity with the other `@templatical/import-*` packages — this converter does not currently produce it. |

```ts
console.log(report.summary);
// { total: 161, converted: 152, approximated: 9, htmlFallback: 0, skipped: 0 }

for (const entry of report.entries) {
  if (entry.status === 'approximated') {
    console.warn(`<${entry.sourceTag}> approximated:`, entry.note);
  }
}
// <mj-social> approximated: Icon size 35px is not one of 24/32/48px; resolved to "medium".
```

A `note` on an `approximated` entry always names the value it replaced, so diffing `report.entries` between two runs shows exactly what a migration changed. `report.warnings` carries the handful of document-level drops that don't attach to a single entry — a dropped document line-height, for instance, covered under "Things that don't map automatically" below.

## What's actually happening here

Topol's own JSON tree already speaks in MJML-shaped tags — `mj-section`, `mj-column`, `mj-text`, `mj-button`, and so on — even though Topol is not MJML itself. Its root node is `mj-global-style`, not MJML's `<mjml>`/`<mj-body>` pair, and a few tags pack information differently: a single `mj-social` node carries every icon as `<platform>-href` attributes, rather than nesting child `mj-social-element`s the way hand-written MJML does. Rich content sits in a `content` field beside each node's `attributes`, not inside it.

- **Topol** stores a design as this tree of tag-shaped nodes, plus a root-level `attributes` object holding per-tag and per-selector style defaults — the same role MJML's `<mj-attributes>` plays, flattened onto the root instead of nested under `<mj-head>`.
- **Templatical** stores templates as a JSON tree of typed blocks (`SectionBlock`, `ParagraphBlock`, etc.) and renders that tree to MJML at export time.

`@templatical/import-topol` walks the Topol tree, resolves each node's own attributes against the root's per-tag and per-selector defaults, and constructs the equivalent Templatical block. The tag-mapping table below is what it implements.

## Path 1 — Rebuild visually using your Topol export as a reference

For a handful of templates, rebuilding by hand next to your Topol export is often faster than installing a package:

1. Open your Topol design — the editor itself, or the JSON export — in one window.
2. Open the Templatical editor (or [the playground](https://play.templatical.com)) side-by-side.
3. Use Topol's own preview, or the `html` field from its API response, as your visual target.
4. Drag in the equivalent Templatical blocks (see the [mapping table](#topol-tag-mapping) below).
5. Copy text content directly. Re-host images via your media library.
6. Reproduce styling using Templatical's [design tokens](/guide/theming) instead of Topol's attribute defaults.

Most Topol templates port in 10–20 minutes once you've done one or two. For a larger batch, run `@templatical/import-topol` first and use this path only to finish off what it left `approximated` or as an `html-fallback` block.

## Path 2 — Use Templatical's renderer to verify your work

Once you have a template in Templatical — imported or rebuilt by hand:

```ts
import { renderToMjml } from '@templatical/renderer';

const mjml = await renderToMjml(content);
// Compile with your own MJML library and compare the result against
// Topol's own `html` field, from the same API response that carries `json`.
```

A visual comparison catches what the report can't. Several of the losses below — the section background image most visibly — are never read by the importer at all, so nothing in `report.entries` points at them.

## Topol tag mapping {#topol-tag-mapping}

| Topol tag | Templatical block | Notes |
|---|---|---|
| `mj-section` (with `mj-column` children) | `SectionBlock` with `columns` | Column widths come from each column's `width` percentage, or are distributed equally; a shape outside Templatical's five layouts resolves to the nearest one. |
| `mj-column` | Section column | Holds a list of nested blocks. |
| `mj-text` | `TitleBlock` or `ParagraphBlock` | A single heading wrapping the whole content becomes a `TitleBlock`; anything else becomes a `ParagraphBlock`. |
| `mj-button` | `ButtonBlock` | `href`, `background-color`, `color`, font, and `padding` as the block's outer spacing — its `margin` does not survive. |
| `mj-image` | `ImageBlock` | `src`, `alt`, `href`, `width`, padding. |
| `mj-gif` | `ImageBlock` | Same fields as `mj-image` — Templatical has no dedicated GIF block. |
| `mj-divider` | `DividerBlock` | `border-color`, `border-width`, `border-style`, padding. |
| `mj-spacer` | `SpacerBlock` | `height`. |
| `mj-social` | `SocialIconsBlock` | Each platform named in the node's `display` list with a matching `<platform>-href` becomes a `SocialIcon`. Topol packs every icon onto this one node's attributes, rather than nesting `mj-social-element` children the way hand-written MJML does. |
| Root `attributes` (plus `mj-container`'s `background-color`) | Template `settings` | A bare `:color` / `a:color` sets the document's text/link colour; per-selector defaults (`h1:font-family` and similar) seed a heading's font when the heading sets none itself. A node's own attribute always wins over these. |
| Anything else | `HtmlBlock` | No Templatical block exists for the tag; the raw node is preserved as JSON, flagged `html-fallback`. |

## Where the mapping is lossy

Every leaf tag in the mapping table above converts — Topol's own editor doesn't emit anything this importer treats as `html-fallback` in practice. Within that, a few conversions are approximations rather than exact matches, each recorded as an `approximated` entry with a `note` in `report.entries`:

- **Column geometry** — Templatical supports five column layouts (`1`, `2`, `3`, `2-1`, `1-2`). Topol allows any column count at any width, so a shape outside those five — most often four equal columns — resolves to the nearest layout, and any column past the third folds its content into the last one.
- **GIFs** — `mj-gif` imports as an `ImageBlock`, the same block `mj-image` produces. Templatical has no dedicated GIF block.
- **Heading levels** — `TitleBlock` supports levels 1 through 4. An `mj-text` wrapping a sole `<h5>` or `<h6>` clamps to level 4.
- **The `google` platform** — `SocialPlatform` has no `google` member, so a `google-href` maps to `website` instead. This is the common case, not an edge case: Topol's own social widget still writes `google-href` for Google+, a network retired years ago.
- **Social icon sizes** — `SocialIconsBlock` supports three sizes (24px, 32px, 48px). An `icon-size` outside those three resolves to the nearest one — and Topol's own default is 35px, so this is the common case for social blocks, not the exception.
- **Block IDs** — every imported block gets a freshly generated ID. IDs never appear anywhere in a Topol design, so nothing that keys off one — a Cloud comment thread, for example — survives an import.

## Things that don't map automatically

- **Section background images** — `SectionWrapper` carries only `backgroundColor`, `padding`, and `borderRadius`; Templatical has no background-image field on any block, and the renderer emits no `background-url`. A Topol section's `background-url` is never read, so a hero section keeps its background colour and loses its photo — and because the attribute is untouched, nothing in `report.entries` points at it. `full-width` and `layout` on the same `mj-section`, and `vertical-align` on `mj-column`, go the same way.
- **A button's margin** — `ButtonBlock`'s `styles.padding` is its only outer-spacing field. Topol writes both `padding` and `margin` on every `mj-button`; `padding` fills that field, and `margin` is dropped rather than folded in, which would double the vertical space. The button's inner label padding (`buttonPadding`) keeps Templatical's default too, since Topol has no separate attribute for it.
- **Imported webfonts** — Templatical has no webfont-import concept. The design root's top-level `fonts` array lists the webfonts imported into the Topol project (one design measures `["\"Cabin\", sans-serif"]`; another carries two entries), and the array is dropped — text that depended on it renders in its fallback face, with no warning at runtime. This is a different field from `attributes.fonts`, a comma-separated fallback stack on the same root that the importer does read, feeding the template's default `fontFamily` when nothing more specific sets one.
- **Per-icon social details** — `SocialIcon` carries only `id`, `platform`, and `url`. A `mj-social` icon's per-platform `alt` text, `*-icon-color`, and `text-mode` have nowhere to go. The `alt` text is worth checking after import — it's the same accessibility gap as the images below, on a different block.
- **Document line-height** — Templatical has no document-level line-height setting. Topol's root-level default is dropped, and the importer pushes a note into `report.warnings` naming the value — the one loss on this list that surfaces at runtime.
- **Unrecognized tags** — a Topol node the importer doesn't handle explicitly becomes an `HtmlBlock` holding the raw node as JSON, not markup, since Topol nodes aren't markup. Every leaf tag Topol's own editor produces is handled explicitly, so this is a safety net for hand-edited or third-party JSON more than something a normal export triggers. Reimplement the tag as a [Templatical custom block](/guide/custom-blocks) for a native, editable equivalent.

::: tip
A freshly imported template commonly fails `@templatical/quality`'s accessibility rules on arrival, and the [Agent Skill](/guide/agent-skill)'s `validate.mjs` exits non-zero on it. Images exported from Topol typically carry no `alt` text, and the importer copies that gap across faithfully — inventing a description would itself be an accessibility anti-pattern. Structural validation passes; the findings are about content. Add alt text to the imported images and the findings clear.
:::

## What to do if you hit something this guide doesn't cover

[Open a discussion](https://github.com/templatical/sdk/discussions) with a redacted snippet of your Topol design and what you're trying to achieve. We use these reports to improve `@templatical/import-topol`'s coverage.
