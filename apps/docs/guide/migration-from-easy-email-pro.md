---
title: Migrating from Easy Email Pro
description: Convert Easy Email Pro email templates to Templatical format using @templatical/import-easy-email-pro.
---

# Migrating from Easy Email Pro

This guide is for teams who've built email templates in [Easy Email Pro](https://www.easyemail.pro) — in the hosted editor, or through a product that embeds it — and want to move to Templatical's visual editor. **`@templatical/import-easy-email-pro`** converts an Easy Email Pro persist page into Templatical's `TemplateContent` format. Install it, run it, and use the sections below to finish off anything it can't map on its own.

The input is the persist JSON — `{ subject, content }` with `content.type === "page"`, or a bare page element. It is not `EditorCore.toMJML()` and not the compiled HTML.

## Installation

```bash
npm install @templatical/import-easy-email-pro
```

### Without a build step (CDN)

You can also load it from a CDN:

```html
<script type="module">
  import { convertEasyEmailProTemplate } from 'https://cdn.jsdelivr.net/npm/@templatical/import-easy-email-pro/+esm';
  // ...then convert as shown in Usage below
</script>
```

## Usage

```ts
import { convertEasyEmailProTemplate } from '@templatical/import-easy-email-pro';

const { content, report } = convertEasyEmailProTemplate(emailTemplate);

const editor = await init({
  container: '#editor',
  content,
});

console.log(report);
```

`convertEasyEmailProTemplate` is synchronous and returns an `ImportResult` with:

- `content` — the converted `TemplateContent` ready for the editor
- `report` — a conversion report with the status of each produced block (`converted`, `approximated`, `html-fallback`, or `skipped`)

It accepts:

- the persist envelope `{ subject, content }` where `content.type === "page"`
- a bare page element `{ type: "page", children, attributes, data }`
- either shape serialized as a JSON string

Extra `html` / `mjml` / `thumbnail` / `id` keys on the envelope are ignored.

::: tip
Pass the persist page, not `EditorCore.toMJML()` output. `toMJML` is a compile path — MJML markup that belongs to [`@templatical/import-mjml`](/guide/migration-from-mjml), not this package. Compiled HTML belongs to [`@templatical/import-html`](/guide/migration-from-html). Guessing between the three would send markup through the wrong converter.

`$var(name)` is a design token, not a merge tag. Values resolve against the nearest table (widget `data.input` first, then page `data.variables[]`). Unresolved leftovers stay unset rather than being stored as recipient fields.

Open-source Easy Email is a different JSON (`type: "section"` / `"text"` without the `standard-` prefix). This package throws a dedicated error rather than mis-import it. Zalify ships `easyEmailToEasyEmailPro()` for that direction.
:::

## Report

Each `report.entries` item describes one produced block:

| Status | Meaning |
|---|---|
| `converted` | Mapped to a Templatical block with no loss of fidelity. |
| `approximated` | Mapped to the right block, with a clamp or flatten — `note` states what changed. |
| `html-fallback` | No block equivalent exists; the raw node is preserved as JSON inside an `HtmlBlock`. |
| `skipped` | Empty `logic` — there were no children to convert. |

```ts
console.log(report.summary);
// { total: 24, converted: 18, approximated: 5, htmlFallback: 0, skipped: 1 }

for (const entry of report.entries) {
  if (entry.status === 'approximated') {
    console.warn(`${entry.sourceTag} approximated:`, entry.note);
  }
}
```

A `note` on an `approximated` entry names the original value. `report.warnings` carries document-level drops that do not attach to a single entry — a non-empty `subject` or `fonts[]`, leftover `$var()` counts, and `mobileAttributes` when any node carried them.

## Document shape

Easy Email Pro stores a design as a tree of typed nodes under a `page`:

```
EmailTemplate { subject, content }
  content: page
    data: { globalAttributes, blockAttributes, categoryAttributes, fonts, preheader, variables[] }
    attributes: { width, background-color, content-background-color, link-color, … }
    children: standard-section | standard-wrapper | standard-hero | *_widget | AMP_* | custom
      standard-section.children: standard-column | standard-group
        standard-group.children: standard-column
          standard-column.children: leaf | nested structure
```

Leaves in the documented element list: `standard-paragraph`, `standard-h1`–`h4`, `standard-button`, `standard-image`, `standard-divider`, `standard-spacer`, `standard-navbar` + `standard-navbar-link`, `standard-social` + `standard-social-element`, `standard-table2`, `line-break`, `html-block-node`, `marketing-countdown`, `placeholder`. `uid` / `id` / `thumbnail` are discarded — Templatical mints its own IDs. `placeholder` is editor chrome and is skipped.

- **Easy Email Pro** stores this persist tree, plus optional `variables[]` (design tokens) and page `data`.
- **Templatical** stores templates as a JSON tree of typed blocks (`SectionBlock`, `ParagraphBlock`, etc.) and renders that tree to MJML at export time.

`@templatical/import-easy-email-pro` walks `page.children`, flattens `standard-group` and widgets, and constructs the equivalent Templatical blocks. The mapping table below is what it implements.

## Visual rebuild

For a handful of templates, rebuilding by hand next to an Easy Email Pro preview is faster than installing a package:

1. Open the Easy Email Pro design — the editor itself, or a preview of its compiled HTML — in one window.
2. Open the Templatical editor (or [the playground](https://play.templatical.com)) side-by-side.
3. Use that preview as your visual target. Do not feed `EditorCore.toMJML()` into this converter.
4. Drag in the equivalent Templatical blocks (see the [mapping table](#easy-email-pro-node-mapping) below).
5. Copy text content directly. Re-host images via your media library.
6. Reproduce styling using Templatical's [design tokens](/guide/theming).

For a larger batch, run `@templatical/import-easy-email-pro` first and use this path only to finish off what it left `approximated`, `skipped`, or as an `html-fallback` block.

## Renderer verification

Once you have a template in Templatical — imported or rebuilt by hand:

```ts
import { renderToMjml } from '@templatical/renderer';

const mjml = await renderToMjml(content);
```

A visual comparison against Easy Email Pro's own preview catches what the report cannot. Several of the losses below — `mobileAttributes`, hero overlay, page `fonts[]` — are dropped at the site they are read, with a note when the converter has somewhere to attach one.

There is no round-trip oracle. Templatical does not render Easy Email Pro JSON, and this package does not consume `EditorCore.toMJML()`.

## Node mapping {#easy-email-pro-node-mapping}

| Easy Email Pro | Templatical block | Notes |
|---|---|---|
| `page` | Template `settings` | `width` → `settings.width`; `background-color` → `settings.backgroundColor` after `$var`; `globalAttributes["font-family"]` / `color` → `fontFamily` / `textColor`; `link-color` → `linkColor` when set; `preheader` → `settings.preheaderText` when non-empty. `content-background-color` is the default section fill, not the page background. |
| `standard-section` | `SectionBlock` | Own `background-color` → `section.styles.backgroundColor`; else the page `content-background-color`. `padding-*` → padding. Direct `standard-column` children, or the columns inside a single `standard-group`. |
| `standard-column` | Section `columns` / `children[i]` | Percent widths (`"50%"`, `"33.33%"`) match Templatical's five layouts. No report entry of its own. |
| `standard-group` | Flattened columns; `stackOnMobile: false` | A group of columns on a section is that section's column structure. Nested group-in-column flattens, `approximated`. |
| `standard-wrapper` | Inner section(s) `wrapper` | Outer `background-color` / padding → `section.wrapper`. One inner section → converted. Several inners → wrapper copied onto each, `approximated`. |
| `standard-hero` | 1-col `SectionBlock` | Children walk as h1 / paragraph / button. `background-color` onto the section; `background-url` prepends an `ImageBlock` (stacked, not overlay), `approximated`. |
| `placeholder` | Skip | Editor chrome. No entry. |
| `standard-paragraph` | `ParagraphBlock` | Content from Slate children. Stays a paragraph even at a large `font-size`. |
| `standard-h1`–`h4` | `TitleBlock` | `level` 1–4 from the type. |
| `standard-button` | `ButtonBlock` | Label from children, not `data.content`. `href` → `url`. Unset fill plus `border-enabled` is outlined — fill becomes `#ffffff` (not the factory `#333333`), `approximated`. |
| `standard-image` | `ImageBlock` | `src`, `alt`; `href` → `linkUrl`. |
| `standard-divider` | `DividerBlock` | `border-color` / `border-width` / `border-style`. |
| `standard-spacer` | `SpacerBlock` | Height from `height` px. |
| `standard-navbar` + `standard-navbar-link` | `MenuBlock` | Link text from children; `href` → `url`; `target === "_blank"` → `openInNewTab`. |
| `standard-social` + `standard-social-element` | `SocialIconsBlock` | Platform inferred from `href` hostname, then `src` path. Custom PNG `src` is dropped, `approximated`. |
| `standard-table2` / `tr` / `td` | `TableBlock` | Converted. |
| `line-break` | `<br>` | Inside the parent rich-text. No entry. |
| `html-block-node` | HTML fragment | Inside the parent rich-text. No entry. |
| `marketing-countdown` | Overlay text + `ImageBlock` of `src` | The GIF is the timer. Does not emit `type: "countdown"` (Cloud-only). `approximated`. |
| kit `common-video` | `VideoBlock` | Converted when a URL is present; otherwise `html-fallback`. |
| kit shopwindow / qr-code / countdown-v2 | `HtmlBlock` | `JSON.stringify(node)`, `html-fallback`. |
| `section_widget` / `wrapper_widget` | Children | `$var` from `data.input`; every produced entry `approximated`. |
| AMP_* | `HtmlBlock` | `JSON.stringify(node)`, `html-fallback`. |
| `logic` | Children, or skip | Empty → `skipped`. Non-empty → children convert as if the wrapper were not there; every produced entry `approximated`. The expression is not mapped onto `displayCondition`. |
| Any other `type` | `HtmlBlock` | The raw node is preserved as JSON, flagged `html-fallback`. |

`visible: "desktop"` / `"mobile"` maps onto `visibility`. Absent when the key is missing.

## Lossy conversions

- **`$var` unresolved leftovers** — `$var(name)` resolves against widget `data.input`, then page `variables[]`. A name with no value is unset (`""` / leftover `$var(…)` do not become merge tags). One document-level warning names how many values resolved and how many were left unresolved.
- **`mobileAttributes`** — a second attribute bag for the mobile viewport. Templatical has no per-viewport padding. Dropped. One document-level warning when any node carried them.
- **Hero overlay** — `standard-hero` has no block equivalent. Children walk into a 1-col section; `background-url` becomes a leading `ImageBlock`, stacked, not overlaid. Overlay-on-image is the loss; editable CTAs survive. `approximated`.
- **Outlined buttons** — `border-enabled: true` plus an unset fill has no Templatical equivalent. After `createButtonBlock`, fill is written `#ffffff` so the factory `#333333` does not turn a ghost button into a dark pill. The outline is dropped; the entry is `approximated`.
- **4+ columns** — Templatical supports five column layouts (`1`, `2`, `3`, `2-1`, `1-2`). A 4-, 5-, or 6-column section folds to `"3"`; overflow children append onto the last slot, `approximated`, original widths in the note.
- **Nested group flatten** — a `standard-group` inside a column cannot become a nested `SectionBlock`. Inner column children splice into the parent column in document order, `approximated`, note `"nested group flattened (N columns)"`. Leaves convert; geometry is the loss.
- **Custom social PNGs** — `standard-social-element` carries a custom PNG `src`. `SocialIconsBlock` has no custom src — it picks an icon from `platform` + `iconStyle`. The PNG is the loss; the entry is `approximated` when a custom `src` was present.
- **AMP** — `AMP_*` nodes have no Templatical equivalent. Preserved as JSON inside an `HtmlBlock`, `html-fallback`.
- **`logic`** — Pro `logic.condition` / `logic.iteration` compile to Liquid (or a custom engine) at `toMJML` time. They are not `displayCondition.{ before, after }`. Empty nodes `skipped`. Populated nodes convert their children and drop the branching.
- **Countdown as GIF** — `marketing-countdown` is overlay text plus an `ImageBlock` of `attributes.src`. Templatical's `countdown` block is Cloud-only and blank on OSS, so this package does not emit it. The GIF is a static image; the timer does not tick.

::: tip
Nested groups flatten because MJML forbids a section inside a column, and `addBlock` does too. Inventing a nested `SectionBlock` would fail to render. Hero children walk rather than html-fallback the whole subtree so editable CTAs survive; overlay-on-image is what Templatical cannot express. Empty logic skips rather than become one opaque `HtmlBlock`, so a populated branch of product rows stays as converted children. Countdown stays an image so an OSS renderer does not blank the block.
:::

## Unmapped fields

- **`subject`** — Templatical templates have no subject-line field. A non-empty value is named in `report.warnings`.
- **`fonts[]`** — no document-level font-file table. A non-empty array is named in `report.warnings`. Text that depended on it renders in the fallback face.
- **`headStyles`** — no document-level head-style table. A non-empty value is named in `report.warnings`.
- **`thumbnail` / `id`** — silent; they are not recipient-facing.
- **`classAttributes`** — skipped in v1. One warning when the object is non-empty.
- **`breakpoint`** — silent. Templatical mobile is 375 / MJML 480; this package does not invent a setting.

A freshly imported template commonly fails `@templatical/quality`'s accessibility rules on arrival, and the [Agent Skill](/guide/agent-skill)'s `validate.mjs` exits non-zero on it. Images exported from Easy Email Pro typically carry no `alt` text, and the importer copies that gap across — inventing a description would itself be an accessibility anti-pattern. Structural validation passes; the findings are about content. Add alt text to the imported images and the findings clear.

## Further coverage

[Open a discussion](https://github.com/templatical/sdk/discussions) with a redacted snippet of your Easy Email Pro persist JSON and what you're trying to achieve. We use these reports to improve `@templatical/import-easy-email-pro`'s coverage.
