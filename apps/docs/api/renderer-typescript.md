---
title: Renderer
description: API reference for @templatical/renderer — convert template JSON to MJML.
---

# Renderer

`@templatical/renderer` converts Templatical template JSON to MJML. Works in both browser and Node.js environments.

The renderer produces MJML only. To compile MJML to HTML for email sending, use any MJML library ([mjml](https://www.npmjs.com/package/mjml) for Node.js, [spatie/mjml-php](https://github.com/spatie/mjml-php) for PHP, etc.).

::: code-group

```bash [npm]
npm install @templatical/renderer
```

```bash [pnpm]
pnpm add @templatical/renderer
```

```bash [yarn]
yarn add @templatical/renderer
```

```bash [bun]
bun add @templatical/renderer
```

:::

## `renderToMjml(content, options?)`

Renders a `TemplateContent` object to an MJML string. Returns a `Promise<string>` — async so custom blocks (which may require async work to resolve) can be rendered in line.

```ts
import { renderToMjml } from '@templatical/renderer';

const mjml = await renderToMjml(templateContent);
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `content` | `TemplateContent` | The template to render |
| `options` | `RenderOptions` | Optional rendering configuration |

**Returns:** `Promise<string>` -- MJML markup

## RenderOptions

```ts
interface RenderOptions {
  locale?: string;
  layout?: TemplateContent;
  customFonts?: CustomFont[];
  defaultFallbackFont?: string;
  allowHtmlBlocks?: boolean;      // default: true
  customBlocks?: CustomBlockDefinition[];
  renderCustomBlock?: (block: CustomBlock) => Promise<string>;
  blockRenderers?: BlockRendererMap;
  getCustomBlockStylesheet?: (customType: string) => string | undefined | null;
  socialIconsBaseUrl?: string;
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `locale` | `settings.locale` | Selects the template version; an unknown version rejects with `unknown_locale`. |
| `layout` | -- | Embedder-owned shell with exactly one slot. May carry its own `settings.locales`, block `l10n` and `settings.l10n`, including wrapper children. It is projected for the requested language with `missing: "default"` before composition; a language the layout lacks uses its default. See [Layout](/guide/layout). |
| `customFonts` | `[]` | Custom font definitions for `<mj-font>` declarations in rendered output |
| `defaultFallbackFont` | `'Arial, sans-serif'` | Fallback stack added after a custom font without its own `fallback`, or after any single family that isn't a built-in. A full stack is emitted as written. |
| `allowHtmlBlocks` | `true` | Set to `false` to strip HTML blocks from output |
| `customBlocks` | -- | `CustomBlockDefinition[]` for headless rendering. The last definition per type wins; unknown types use saved `renderedHtml` and `renderedStylesheet`. Requires optional `liquidjs` peer `^10.30.0` when custom blocks are present. See the [Custom blocks guide](/guide/custom-blocks). |
| `renderCustomBlock` | -- | Resolves custom blocks to HTML. Called once per custom block. The editor passes this through `editor.toMjml()`. Mutually exclusive with `customBlocks`. When neither option is passed, every custom block uses `renderedHtml` (if present). |
| `blockRenderers` | `{}` | Per-type renderer overrides keyed by `block.type`. A countdown GIF backend uses this. An override owns the hidden-on-all-viewports check. |
| `getCustomBlockStylesheet` | -- | `(customType) => string \| undefined \| null`. Called once per unique `customType`. Mutually exclusive with `customBlocks`. A listed definition decides its type's stylesheet, including emitting none; unknown types use saved `renderedStylesheet`. A passed resolver decides every type and ignores saved copies. |
| `socialIconsBaseUrl` | version-pinned jsDelivr URL | Base URL (no trailing slash) for the social icon PNG assets. Resolved per icon to `${baseUrl}/${dir}/${platform}.png`, where `dir` is the style, plus `-${tone}` for a `dark` or `light` `iconTone`. See [Social icons](#social-icons) below. |

`locale?: string` selects a template language version; omission renders `settings.locale`, the default. Unknown versions reject with `SdkError` code `unknown_locale`. Projection removes hidden blocks, applies text and overrides, and sets MJML `lang` and `dir`. See [Localized templates](/guide/localized-templates#rendering-a-language).

### Custom blocks

Headless callers pass the same definitions they register with the editor:

```ts
import { renderToMjml } from '@templatical/renderer';
import type { CustomBlockDefinition, TemplateContent } from '@templatical/types';

export async function renderTemplate(content: TemplateContent, definitions: CustomBlockDefinition[]) {
  return renderToMjml(content, { customBlocks: definitions });
}
```

For a lower-level resolver, use the shared Liquid factory:

```ts
import * as liquidjs from 'liquidjs';
import { createCustomBlockLiquid } from '@templatical/types';
const liquid = createCustomBlockLiquid(liquidjs);
```

The option's fallback, exact conflicts and missing-peer error, and the factory's fixed options are in the [Custom blocks guide](/guide/custom-blocks). <code v-pre>{{ body | raw }}</code> keeps HTML from an intentional HTML field. Always quote attribute values and validate URL schemes from untrusted sources. Only the editor canvas sanitizes the rendered block; email output keeps the template's HTML.

### Social icons

Social icon blocks are emitted as `<img src="…/{dir}/{platform}.png">`. `dir` is the icon style for brand colors (`circle`) and `{style}-{tone}` for an `iconTone` of `dark` or `light` (`circle-dark`). The default `socialIconsBaseUrl` points at the version-pinned jsDelivr mirror of `@templatical/renderer`, which ships pre-rasterized PNGs (every `SocialPlatform` × 6 styles × 3 tones) alongside the package:

```
https://cdn.jsdelivr.net/npm/@templatical/renderer@<version>/assets/social/{dir}/{platform}.png
```

**Why PNGs.** Outlook desktop (Word rendering engine) does not support SVG and rejects base64 data URIs in `<img src>`. Hosted PNGs are the only format that renders across every mainstream email client.

**Why version-pinned.** Email is archival — recipients open messages months or years after they're sent. The version pin freezes the icon visuals at render time so a future redesign or regression in the package doesn't retroactively break already-delivered emails. It also avoids a per-image 302 redirect and unlocks long-lived immutable cache headers.

**Self-hosting.** Override `socialIconsBaseUrl` to serve the assets from your own CDN — useful for air-gapped environments, brand-specific theming, or removing the jsDelivr dependency:

```ts
const mjml = await renderToMjml(content, {
  socialIconsBaseUrl: 'https://cdn.example.com/email-assets/social',
});
```

The exact filenames the renderer expects are `{dir}/{platform}.png`, where `dir` is a `style` of `solid | outlined | rounded | square | circle | plain`, followed by `-dark` or `-light` for those colors (a brand-colored icon has no suffix), and `platform` is one of `facebook | twitter | instagram | linkedin | youtube | tiktok | pinterest | email | whatsapp | telegram | discord | snapchat | reddit | github | dribbble | behance | website`. The shipped 144×144 PNGs are a reasonable starting point if you want to mirror them.

The package also exports `DEFAULT_SOCIAL_ICONS_BASE_URL` if you want to compose URLs against the same default:

```ts
import { DEFAULT_SOCIAL_ICONS_BASE_URL } from '@templatical/renderer';
```

## Utilities

The renderer also exports utility functions:

```ts
import {
  escapeHtml,
  escapeAttr,
  convertMergeTagsToValues,
  isHiddenOnAll,
  toPaddingString,
  renderBlock,
  getCssClassAttr,
  getCssClasses,
  getWidthPercentages,
  getWidthPixels,
  fluidOnMobileAttr,
  DEFAULT_SOCIAL_ICONS_BASE_URL,
  RenderContext,
} from '@templatical/renderer';
```

### `escapeHtml(text)`

Escapes HTML entities (`<`, `>`, `&`, `"`, `'`) in a string. Use when inserting user content into HTML:

```ts
escapeHtml('<script>alert("xss")</script>');
// '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
```

### `escapeAttr(text)`

Escapes a string for safe use in HTML attribute values:

```ts
const alt = escapeAttr('Photo of "sunrise" at O\'Hare');
// 'Photo of &quot;sunrise&quot; at O&#x27;Hare'
```

### `convertMergeTagsToValues(html)`

Converts merge tag HTML spans (used internally by the editor's rich text system) back into their plain text syntax. The editor stores merge tags as `<span data-merge-tag="...">` elements; this function strips the spans and leaves the raw merge tag syntax:

```ts
import { convertMergeTagsToValues } from '@templatical/renderer';

// Input: editor's internal HTML format
const editorHtml = '<span data-merge-tag="{{ first_name }}">First Name</span>';

const cleaned = convertMergeTagsToValues(editorHtml);
// Output: '{{ first_name }}'
```

::: tip
You typically don't need to call this directly -- the renderer calls it internally when processing title and paragraph blocks. It's exported for advanced use cases where you're working with editor HTML outside the normal rendering pipeline.
:::

### `isHiddenOnAll(block)`

Returns `true` if a block's `visibility` has all viewports set to `false`. Useful for skipping blocks that shouldn't render at all:

```ts
if (isHiddenOnAll(block)) {
  // Skip this block entirely
}
```

### `toPaddingString(padding)`

Converts a `SpacingValue` to a CSS padding string:

```ts
toPaddingString({ top: 10, right: 20, bottom: 10, left: 20 });
// '10px 20px 10px 20px'
```

### `renderBlock(block, context)`

Renders a single block to its MJML representation. Used internally by `renderToMjml()` but exported for advanced use cases where you need to render individual blocks.

### `RenderContext`

The context object passed to block renderers. Contains render options, font configuration and two widths:

| Field | Value |
|---|---|
| `containerWidth` | The column's share of the body width, ignoring the padding and borders around it. A `'full'` image or video is emitted at this width, and MJML caps it at its real box. |
| `contentWidth` | The whole pixels MJML gives the column's content: the body width less the side padding and border of the wrapper band and the section, then the column's percentage, floored. Width-aware decisions read this one. |

In a [hero section](/guide/sections-and-columns#hero), the content has no column: `containerWidth` is the hero's box (the body width less the bands around it) and `contentWidth` is that box less the hero's side padding. A hero draws no border, so none is subtracted.

`withContainerWidth(width, contentWidth = width)` returns a copy for a narrower container.

### `fluidOnMobileAttr(block, context)` {#fluid-on-mobile-attr}

Returns `' fluid-on-mobile="true"'` for an image that fills its column on desktop, and `''` otherwise. An image fills its column when its `width` is `'full'`, or a pixel width at or above `context.contentWidth` less the block's side padding and border. See [Width on phones](/guide/images#width-on-phones).

The built-in image and video renderers use it. A `blockRenderers` override that emits its own `mj-image` calls it too; without the attribute, the image keeps its desktop width on a phone:

```ts
blockRenderers: {
  image: (block, ctx) => {
    const image = block as ImageBlock;
    const width = image.width === 'full' ? ctx.containerWidth : image.width;
    return `<mj-image src="${escapeAttr(image.src)}" width="${width}px"${fluidOnMobileAttr(image, ctx)} />`;
  },
},
```

### `getCssClassAttr(block)` / `getCssClasses(block)`

Generate CSS class attributes from a block's visibility settings. Used internally for responsive hiding.

### `getWidthPercentages(layout)` / `getWidthPixels(layout, containerWidth)`

Calculate column widths for a given `ColumnLayout`. Returns an array of percentage or pixel values per column.

### `DEFAULT_SOCIAL_ICONS_BASE_URL`

The default value of `RenderOptions.socialIconsBaseUrl` — the version-pinned jsDelivr URL pointing at this package's bundled social icon PNGs. See [Social icons](#social-icons).

## Compiling MJML to HTML

After rendering to MJML, compile to HTML using any MJML library:

```ts
import { renderToMjml } from '@templatical/renderer';
import mjml2html from 'mjml';

const mjml = await renderToMjml(templateContent);
const { html } = mjml2html(mjml);

// html is ready to send via your email service
```

See [How Rendering Works](/getting-started/how-rendering-works) for more on the rendering pipeline.
