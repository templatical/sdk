---
title: Migration from Unlayer
description: Convert Unlayer email templates to Templatical format using @templatical/import-unlayer.
---

# Migration from Unlayer

The `@templatical/import-unlayer` package converts Unlayer design JSON (the output of `editor.saveDesign(...)` from `react-email-editor` or the Unlayer hosted editor) into Templatical's `TemplateContent` format.

::: warning
This package is in active development. Some content types and advanced features may not be fully supported yet. Test your converted templates before using them in production.
:::

## Installation

::: code-group

```bash [npm]
npm install @templatical/import-unlayer
```

```bash [pnpm]
pnpm add @templatical/import-unlayer
```

```bash [yarn]
yarn add @templatical/import-unlayer
```

```bash [bun]
bun add @templatical/import-unlayer
```

:::

### Without a build step (CDN)

You can also load it from a CDN:

```html
<script type="module">
  import { convertUnlayerTemplate } from 'https://cdn.jsdelivr.net/npm/@templatical/import-unlayer/+esm';
  // ...then convert as shown in Usage below
</script>
```

## Usage {#usage}

```ts
import { convertUnlayerTemplate } from '@templatical/import-unlayer';

// Load your Unlayer design JSON (whatever editor.saveDesign returned)
const res = await fetch('/api/unlayer-templates/123');
const unlayerJson = await res.json();

// Convert to Templatical format
const { content, report } = convertUnlayerTemplate(unlayerJson);

// Use in the editor
const editor = await init({
  container: '#editor',
  content,
});

// Check the conversion report for any issues
console.log(report);
```

[Open in playground](https://play.templatical.com/scenes/import-unlayer)

Each `report.entries` item is one source module:

| Status | Meaning |
|---|---|
| `converted` | Mapped to a Templatical block with no loss of fidelity. |
| `approximated` | Mapped, with a clamp or flatten — `note` states what changed. |
| `html-fallback` | No block equivalent; original markup is an `HtmlBlock`. |
| `skipped` | No output (forms, and anything the converter refuses). |

The design JSON Unlayer's hosted editor and `editor.saveDesign()` emit is the input. A compiled HTML export is a different envelope — use [`@templatical/import-html`](/guide/migration-from-html).

The function returns an `ImportResult` with:
- `content` — the converted `TemplateContent` ready for the editor
- `report` — a conversion report with the status of each content node (`converted`, `approximated`, `html-fallback`, or `skipped`)

## Languages {#languages}

`values._languages[locale]` supplies overrides. Text and `textJson` become paragraph `content`; heading `text`, button `text`, image `altText`, and menu item text become hashed text entries. Image `src.url` becomes `set.src`; row `backgroundImage.url` becomes the section's `set.backgroundImage`. Menu items map by position only when item counts match; otherwise the menu translation is dropped with a warning. Translated menu item links are not mapped; warnings name each discarded key and language once. A localized background image inherits the default image’s unspecified settings; an explicitly empty translated URL stores `set.backgroundImage = null`, removing the image in that language only.

Modern text uses Lexical `textJson` before legacy `text`; the `paragraph` content type is supported. Successfully read Lexical block markup is kept without an extra paragraph wrapper. Unreadable Lexical state falls back to `values.text`. A translation uses only its own `textJson` or legacy `text`: if neither is readable, no text entry is stored, coverage remains missing, and the report warns. The JSON has no default language or per-language direction: pass the host's default as `defaultLocale`. Without it, a multilingual design assumes `"en"` and warns. Device `_override.<device>._languages` translations are dropped with warnings. Unknown translation keys and HTML-fallback targets also warn.

The mappings follow [Unlayer's documented overrides](https://docs.unlayer.com/builder/templates/multi-language), checked 2026-10-28. Fixtures are built from that documentation, not real multilingual exports.

Codes normalize `_` to `-` and must pass `isLocaleTag`. Unsupported tags are dropped with a warning naming the language. Text entries carry `{ value, sourceHash }`, hashed from the imported default. Enable `init({ localization: { locales } })` with the imported languages to show the Languages menu. Check the result with `template-tools validate imported.json --locale <tag>` and inspect `report.warnings`.

## Options {#options}

`convertUnlayerTemplate` accepts a second argument of type `ConvertUnlayerOptions`. `defaultLocale?: string` supplies `settings.locale` when the source declares no default language; the fallback is `"en"`. A declared default wins. Locale codes normalize `_` to `-`.

This JSON format supplies no default language to the importer. Pass the language configured by the host as `defaultLocale`.

```ts
export interface ConvertUnlayerOptions {
  defaultLocale?: string;
}
```

## Block Mapping

Unlayer content types map to Templatical equivalents:

| Unlayer Content | Templatical Block | Status |
|---|---|---|
| Text | `paragraph` | Converted |
| Heading | `title` | Converted |
| Image | `image` | Converted (approximated when a `maxWidth` under 100% becomes px; see [Image width](#image-width)) |
| Button | `button` | Converted |
| Divider | `divider` | Converted (approximated when a partial-width divider is aligned left or right) |
| Spacer | `spacer` | Converted |
| Html | `html` | Converted |
| Menu | `menu` | Approximated (styles may differ) |
| Social | `social` | Converted |
| Video | `video` | Converted |
| Timer | `html` | HTML fallback (rebuild manually) |
| Form | — | Skipped |

Unknown content types are converted to HTML blocks as a fallback.

### Image width {#image-width}

| Unlayer image | `ImageBlock.width` | Status |
|---|---|---|
| `autoWidth` (the default), `src.width` narrower than the image's room | the px number | Converted |
| `autoWidth`, `src.width` as wide as the room or wider, or missing | `"full"` | Converted |
| `autoWidth: false`, `maxWidth` `100%` or missing | `"full"` | Converted |
| `autoWidth: false`, `maxWidth` under `100%`, such as `75%` | that share of the room in px | Approximated |
| `autoWidth: false`, unreadable `maxWidth` | `"full"` | Approximated |

`src.width` and `src.height` are the uploaded file's size. The image's room is its column's width less its left and right `containerPadding`. `src.height` is not imported, so the image keeps the file's aspect ratio at the width it is shown at.

::: tip
A px width keeps its size on a phone, where a percentage shrinks with the column, so a `maxWidth` under `100%` is approximated.
:::

### Divider width

| Unlayer `width` | `DividerBlock.width` | Status |
|---|---|---|
| missing, or `100%` | `"full"` | Converted |
| a percentage under `100%`, such as `50%` | the same percentage to two decimals, `"50%"` | Converted |
| below `0%` or above `100%` | clamped to `"0%"` or `"full"` | Approximated |
| px, narrower than the line's span | the px number | Converted |
| px, as wide as that span or wider | `"full"` | Converted |
| any other value | `"full"` | Approximated |

A px width is compared with the line's span: its column's width less the divider's left and right `containerPadding`. The column's width is its share of `settings.width` under the section's column layout, and `settings.width` is a px `contentWidth`, else `600`.

::: tip
`mj-divider` draws `100%` across that span, so a px width that reaches it renders the same as `"full"`. `"full"` also narrows with the column on a phone.
:::

Templatical centres every divider. A partial-width divider that Unlayer aligns left or right (`textAlign`) is approximated, and its `note` names the alignment.

## Column Layout Conversion

Unlayer organizes content into rows with columns whose widths come from a `cells` weight array. These map to Templatical's `SectionBlock` with the appropriate `ColumnLayout`:

| Unlayer cells | Templatical Layout |
|---|---|
| `[1]` (single column) | `'1'` |
| `[1, 1]` (equal halves) | `'2'` |
| `[1, 1, 1]` (equal thirds) | `'3'` |
| `[1, 2]` | `'1-2'` |
| `[2, 1]` | `'2-1'` |
| 4+ cells | flattened to single column with a warning |

Cell ratios that don't match a standard layout are mapped to the closest available one.

### Section background

| Unlayer row values | `section.styles.backgroundColor` |
|---|---|
| `columnsBackgroundColor` set | `columnsBackgroundColor` |
| only `backgroundColor` set | `backgroundColor` |

When a row sets both to different colours, the section takes `columnsBackgroundColor` and `report.warnings` names the dropped `backgroundColor`.

::: tip
`columnsBackgroundColor` fills the content width, the area a section paints. `backgroundColor` fills the band outside it, and a Templatical section has no full-width band.
:::

### Section background image {#background-images}

A row's `backgroundImage` becomes the section's `backgroundImage`:

| `backgroundImage.fullWidth` | Result |
|---|---|
| `false` (the content area) | The section's image, exactly. |
| `true`, `columnsBackgroundColor` unset | The section's image, painted at the content width, and `report.warnings` says so. |
| `true`, `columnsBackgroundColor` set | Dropped, since in Unlayer the content colour covers it inside the content width, and `report.warnings` names it. |

`size` `cover` and `contain` carry over, and `custom` is the image at its own size (`auto`). The nine `position` keywords map to the matching grid point. A `custom` position's `customPosition` percentage snaps to the nearest of left, center and right (top, center and bottom), and a length to the left or top edge. `repeat-x` and `repeat-y` become `repeat`. Older designs' `cover` and `center` flags are read when `size` and `position` are absent: `cover` maps to `cover` (`false` to `auto`), and `center` to center top (`false` to left top). Each value with no exact keyword adds a line to `report.warnings`.

## Template Settings

Global template settings are converted where possible:

- **Width** — Unlayer `body.values.contentWidth` maps to `settings.width`
- **Background color** — `body.values.backgroundColor` maps to `settings.backgroundColor`
- **Background image** — `body.values.backgroundImage` has no Templatical equivalent, since the email body takes a colour only. It's dropped, and `report.warnings` names it.
- **Text color** — `body.values.textColor` maps to `settings.textColor`. Headings, menus and paragraphs with no colour of their own inherit it.
- **Links** — `body.values.linkStyle.linkColor` maps to `settings.linkColor`, and `linkStyle.linkUnderline` to `settings.linkUnderline`. When `linkStyle` sets no `linkUnderline`, links are underlined, as in Unlayer.
- **Preheader** — `body.values.preheaderText` maps to `settings.preheaderText`, omitted when empty
- **Font family** — `body.values.fontFamily.value` carries over to `settings.fontFamily`. The whole stack carries over, so its fallbacks survive; a stack that is exactly a built-in font's own (`Arial, sans-serif`) is stored as the bare name.

## Known Limitations

- **Custom fonts** — Unlayer custom font declarations are not automatically imported. Add them manually via the `fonts` config option.
- **Display conditions / dynamic content** — Unlayer's conditional content syntax has no direct equivalent and is dropped during conversion. Use Templatical's [display conditions](/guide/display-conditions) to recreate them.
- **Custom modules / paid-tier blocks** — Unlayer custom blocks are converted to placeholder HTML blocks. Recreate them as a [custom block](/guide/custom-blocks) if reusable.
- **Forms** — Unlayer form blocks are skipped. Most email clients block form submission for security reasons; rebuild the call-to-action as a button linking to a hosted form.
- **Timers / countdowns** — Imported as a placeholder HTML block. Do not emit `type: "countdown"`: that block needs Cloud's server-side GIF and the OSS renderer cannot produce it. Recreate as a static title or paragraph (the date, or "X days to go"), or keep the HTML placeholder.
- **Link hover styles and per-block link styles** — `linkStyle.linkHoverColor` and `linkHoverUnderline` have no Templatical field and are dropped. A text block's own `linkStyle` is not read, so its links take the document's link settings.
- **AMP for Email** — not currently supported in Templatical.

## Verifying Converted Templates

After conversion, review the output in the editor to check for:

1. Missing images (re-upload or update URLs if needed)
2. Font rendering (add custom fonts to the editor config)
3. Column proportions (adjust layouts if the automatic mapping doesn't match)
4. Spacing and padding (fine-tune in the block settings panel)
