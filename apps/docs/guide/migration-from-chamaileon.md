---
title: Migrating from Chamaileon
description: Convert Chamaileon email templates to Templatical format using @templatical/import-chamaileon.
---

# Migrating from Chamaileon

This guide is for teams who've built email templates in [Chamaileon](https://chamaileon.io) — in the hosted editor, or through a product that embeds the SDK — and want to move to Templatical's visual editor. **`@templatical/import-chamaileon`** converts a Chamaileon persist document into Templatical's `TemplateContent` format. Install it, run it, and use the sections below to finish off anything it can't map on its own.

The input is `editorInstance.methods.getDocument()`, not `getEmailHtml()` / the HTML generator.

## Installation

```bash
npm install @templatical/import-chamaileon
```

### Without a build step (CDN)

You can also load it from a CDN:

```html
<script type="module">
  import { convertChamaileonTemplate } from 'https://cdn.jsdelivr.net/npm/@templatical/import-chamaileon/+esm';
  // ...then convert as shown in Usage below
</script>
```

## Usage

```ts
import { convertChamaileonTemplate } from '@templatical/import-chamaileon';

const document = await editorInstance.methods.getDocument();

const { content, report } = convertChamaileonTemplate(document);

const editor = await init({
  container: '#editor',
  content,
});

console.log(report);
```

`convertChamaileonTemplate` is synchronous and returns an `ImportResult` with:

- `content` — the converted `TemplateContent` ready for the editor
- `report` — a conversion report with the status of each produced block (`converted`, `approximated`, `html-fallback`, or `skipped`)

It also accepts the document serialized as a JSON string, for callers that store or transmit it that way.

::: tip
Pass the persist document from `getDocument()`. That object is `{ body, variables?, components?, title?, previewText?, subjectLine?, fontFiles? }` with `body.type === "body"`. The HTML generator (`getEmailHtml()`) is a different surface — compiled table markup that belongs to [`@templatical/import-html`](/guide/migration-from-html), not this package. Guessing between the two would send markup through the wrong converter.

Email JSON 2.0 through 4.1 is accepted after a key normalizer. Kebab-case styles (`background-color`) and camelCase (`backgroundColor`) are the same property, two versions. Inline `{ reference, default }` colour objects resolve to `default`, or to the matching `variables[]` entry when `default` is missing. The `reference` name is a design token, not a recipient field, so it is not stored as a merge tag.
:::

## Report

Each `report.entries` item describes one produced block:

| Status | Meaning |
|---|---|
| `converted` | Mapped to a Templatical block with no loss of fidelity. |
| `approximated` | Mapped to the right block, with a clamp or flatten — `note` states what changed. |
| `html-fallback` | No block equivalent exists; the raw node is preserved as JSON inside an `HtmlBlock`. |
| `skipped` | An empty loop or conditional — there were no children to convert. |

```ts
console.log(report.summary);
// { total: 24, converted: 18, approximated: 5, htmlFallback: 0, skipped: 1 }

for (const entry of report.entries) {
  if (entry.status === 'approximated') {
    console.warn(`${entry.sourceTag} approximated:`, entry.note);
  }
}
```

A `note` on an `approximated` entry names the original value. `report.warnings` carries document-level drops that do not attach to a single entry — a non-empty `subjectLine` or `fontFiles`, and a count of colour variables resolved to their defaults.

## Document shape

Chamaileon stores a design as a tree of typed nodes under `body`:

```
document
  body (type "body")
    children: fullwidth | block-level-loop | block-level-conditional
      fullwidth.children: box | multicolumn | leaf
        box.children: box | multicolumn | leaf
        multicolumn.children: column only
          column.children: box | multicolumn | leaf
```

Leaves in the documented element list: `text`, `typed-text`, `button`, `image`, `dynamic-image`, `divider`, `social`, `video`, `code`. `eid` is discarded — Templatical mints its own IDs. `placeholder` is editor chrome and is skipped. `customData` is ignored.

- **Chamaileon** stores this persist tree, plus optional `variables[]` (design tokens) and `fontFiles`.
- **Templatical** stores templates as a JSON tree of typed blocks (`SectionBlock`, `ParagraphBlock`, etc.) and renders that tree to MJML at export time.

`@templatical/import-chamaileon` walks `body.children`, flattens `box` and nested `multicolumn`, and constructs the equivalent Templatical blocks. The mapping table below is what it implements.

## Visual rebuild

For a handful of templates, rebuilding by hand next to a Chamaileon preview is often faster than installing a package:

1. Open the Chamaileon design — the editor itself, or a preview of `getEmailHtml()` — in one window.
2. Open the Templatical editor (or [the playground](https://play.templatical.com)) side-by-side.
3. Use that preview as your visual target. Do not feed `getEmailHtml()` into this converter.
4. Drag in the equivalent Templatical blocks (see the [mapping table](#chamaileon-node-mapping) below).
5. Copy text content directly. Re-host images via your media library.
6. Reproduce styling using Templatical's [design tokens](/guide/theming).

Most Chamaileon templates port in 10–20 minutes once you've done one or two. For a larger batch, run `@templatical/import-chamaileon` first and use this path only to finish off what it left `approximated`, `skipped`, or as an `html-fallback` block.

## Renderer verification

Once you have a template in Templatical — imported or rebuilt by hand:

```ts
import { renderToMjml } from '@templatical/renderer';

const mjml = await renderToMjml(content);
```

A visual comparison against Chamaileon's own preview catches what the report cannot. Several of the losses below — `hoverBackgroundColor`, per-side borders on leaves — are dropped at the site they are read, with a note when the converter has somewhere to attach one.

There is no round-trip oracle. Templatical does not render Chamaileon JSON, and this package does not consume `getEmailHtml()`.

## Node mapping {#chamaileon-node-mapping}

| Chamaileon | Templatical block | Notes |
|---|---|---|
| `body` | Template `settings` | `bodyWidth` → `settings.width`; `backgroundColor` → `settings.backgroundColor`; `previewText` → `settings.preheaderText` when non-empty. |
| `fullwidth` | `SectionBlock` | Outer `backgroundColor` → `wrapper.backgroundColor`; `contentBackgroundColor` → `section.styles.backgroundColor`; `contentPadding*` → padding. A fullwidth with no `multicolumn` is `columns: "1"`. |
| `box` | Flattened into the parent | Transparent boxes vanish with no entry. A painted box that is the sole child of a fullwidth whose content fill is unset copies that paint onto the section. A painted box among siblings flattens, `approximated`. |
| `multicolumn` + `column` | Section `columns` / `children[i]` | Pixel widths convert to percent-of-`bodyWidth` and match Templatical's five layouts. Nested `multicolumn` cannot become a nested `SectionBlock` — inner columns flatten into the parent column, `approximated`. |
| `text` | `TitleBlock` or `ParagraphBlock` | Inferred from `attrs.text` HTML: a sole heading wrapping the whole content becomes a title; anything else becomes a paragraph. |
| `typed-text` | `TitleBlock` or `ParagraphBlock` | `style.subType === "title"` → title; `"list"` → paragraph, `approximated`; otherwise paragraph. |
| `button` | `ButtonBlock` | `href` → `url`; label stripped of tags. An unset fill is an outlined button — fill becomes `#ffffff` (not the factory `#333333`) and the entry is `approximated`. |
| `image` | `ImageBlock` | `src` from `attrs` then `style`; `altText` → `alt`. |
| `dynamic-image` | `ImageBlock` | `approximated`; the note names the source type. |
| `divider` | `DividerBlock` | 2.0 `attrs.lineStyle` and 4.1 `style.width` / `type` / `color` (line thickness, not block width). |
| `social` | `SocialIconsBlock` | `elements[]` is the source of truth. Unknown platform names become `website`. Icon size snaps to 24 / 32 / 48 px. |
| `video` | `VideoBlock` | `link` → `url`; `src` → `thumbnailUrl`. A missing thumbnail stays the factory empty string. |
| `code` | `HtmlBlock` | From `attrs.html` / `attrs.code` / `attrs.content` (first set). |
| `block-level-loop`, `block-level-conditional`, `branch`, `loop`, `conditional` | Children, or skip | Empty → `skipped`. Non-empty → children convert as if the wrapper were not there; every produced entry is `approximated`. The expression is not mapped onto `displayCondition`. |
| Any other `type` | `HtmlBlock` | The raw node is preserved as JSON, flagged `html-fallback`. |

`hideOnMobile` / `hideOnDesktop` map onto `visibility`. Absent when both flags are false.

## Lossy conversions

- **Nested `multicolumn`** — a row inside a column cannot become a nested `SectionBlock`. Inner column children splice into the parent column in document order, `approximated`, note `"nested multicolumn flattened (N columns)"`. Leaves convert; geometry is the loss.
- **4+ columns** — Templatical supports five column layouts (`1`, `2`, `3`, `2-1`, `1-2`). A 4-, 5-, or 6-column `multicolumn` folds to `"3"`; overflow children append onto the last slot, `approximated`, original widths in the note.
- **Outlined buttons** — `background-color` unset plus a coloured border has no Templatical equivalent. After `createButtonBlock`, fill is written `#ffffff` so the factory `#333333` does not turn a ghost button into a dark pill. The outline is dropped; the entry is `approximated`.
- **Loops and conditionals** — Chamaileon `attrs.expression` is not Liquid and is not MJML display-condition syntax. Empty nodes `skipped`. Populated nodes convert their children and drop the branching; stuffing the expression into `displayCondition` would lie about the dialect.
- **Box paint among siblings** — a nested box with a real fill, padding, or radius that is not the sole child of an otherwise unpainted fullwidth flattens. The paint is dropped, `approximated`. A new top-level section would split the row; a nested section is illegal in a column.
- **Variable references** — `{ reference, default }` resolves to a concrete colour. The reference name does not survive as a merge tag.
- **Social icon sizes and unknown platforms** — size snaps to small / medium / large; an unknown `type` becomes `website`.
- **Heading levels** — `TitleBlock` supports levels 1 through 4. A sole `<h5>` or `<h6>` clamps to 4.
- **Block IDs** — every imported block gets a freshly generated ID. Chamaileon `eid` is discarded.

::: tip
Nested columns and painted boxes flatten because MJML forbids a section inside a column, and `addBlock` does too. Inventing a nested `SectionBlock` would fail to render; inventing extra top-level sections would split a row that was one band. Leaves convert either way. Empty loops skip rather than become one opaque `HtmlBlock`, so a populated loop of product rows stays as converted children.
:::

## Unmapped fields

- **`subjectLine`** — Templatical templates have no subject-line field. A non-empty value is named in `report.warnings`.
- **`fontFiles`** — no document-level font-file table. A non-empty object is named in `report.warnings`. Text that depended on it renders in the fallback face.
- **`title`** (the document name) — silent; it is not recipient-facing.
- **`hoverBackgroundColor`** — no hover fill on `ButtonBlock`.
- **Per-side borders on leaves** — dropped at the site they are read.
- **`fullWidthOnMobile` as a mobile-only flag** — not expressed on Templatical blocks.
- **`components[]`** — 4.x style-preset library. Out of v1; own style on the node still applies.
- **`lock` / `marker`** — editor chrome; ignored.
- **`placeholder`** — block-library chrome on `fullwidth`; skipped.

A freshly imported template commonly fails `@templatical/quality`'s accessibility rules on arrival, and the [Agent Skill](/guide/agent-skill)'s `validate.mjs` exits non-zero on it. Images exported from Chamaileon typically carry no `alt` text, and the importer copies that gap across — inventing a description would itself be an accessibility anti-pattern. Structural validation passes; the findings are about content. Add alt text to the imported images and the findings clear.

## Further coverage

[Open a discussion](https://github.com/templatical/sdk/discussions) with a redacted snippet of your Chamaileon `getDocument()` JSON and what you're trying to achieve. We use these reports to improve `@templatical/import-chamaileon`'s coverage.
