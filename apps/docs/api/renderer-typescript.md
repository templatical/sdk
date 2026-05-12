---
title: Renderer
description: API reference for @templatical/renderer — convert template JSON to MJML.
---

# Renderer

`@templatical/renderer` converts Templatical template JSON to MJML. Works in both browser and Node.js environments.

The renderer produces MJML only. To compile MJML to HTML for email sending, use any MJML library ([mjml](https://www.npmjs.com/package/mjml) for Node.js, [spatie/mjml-php](https://github.com/spatie/mjml-php) for PHP, etc.).

```bash
npm install @templatical/renderer
```

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
  customFonts?: CustomFont[];
  defaultFallbackFont?: string;
  allowHtmlBlocks?: boolean;      // default: true
  renderCustomBlock?: (block: CustomBlock) => Promise<string>;
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `customFonts` | `[]` | Custom font definitions for `<mj-font>` declarations in rendered output |
| `defaultFallbackFont` | `'Arial, sans-serif'` | Fallback font stack |
| `allowHtmlBlocks` | `true` | Set to `false` to strip HTML blocks from output |
| `renderCustomBlock` | -- | Resolves custom blocks to HTML. Called once per custom block. Editor consumers pass `editor.renderCustomBlock`; headless consumers wire their own resolver. If omitted, custom blocks fall back to the block's `renderedHtml` field (if present) and otherwise are omitted. |

### Custom blocks

When the content tree contains custom blocks, the renderer asks the supplied `renderCustomBlock` callback to convert each one to HTML. From the editor:

```ts
const mjml = await renderToMjml(editor.getContent(), {
  renderCustomBlock: editor.renderCustomBlock,
});
```

Headless / Node.js consumers (no editor mounted) can provide their own resolver — for example, running the same Liquid template against the block's `fieldValues`:

```ts
import { Liquid } from 'liquidjs';

const engine = new Liquid();
const definitionsByType = new Map(/* your CustomBlockDefinition list, keyed by type */);

const mjml = await renderToMjml(content, {
  async renderCustomBlock(block) {
    const definition = definitionsByType.get(block.customType);
    if (!definition) return '';
    return engine.parseAndRender(definition.template, block.fieldValues);
  },
});
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
  generateSocialIconDataUri,
  renderBlock,
  getCssClassAttr,
  getCssClasses,
  getWidthPercentages,
  getWidthPixels,
  SOCIAL_ICONS,
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

### `generateSocialIconDataUri(platform, style, size)`

Generates a base64-encoded SVG data URI for a social media platform icon. Used internally by the renderer for social icon blocks:

```ts
const uri = generateSocialIconDataUri('twitter', 'circle', 32);
// 'data:image/svg+xml,...'
```

### `renderBlock(block, context)`

Renders a single block to its MJML representation. Used internally by `renderToMjml()` but exported for advanced use cases where you need to render individual blocks.

### `RenderContext`

The context object passed to block renderers. Contains render options and font configuration.

### `getCssClassAttr(block)` / `getCssClasses(block)`

Generate CSS class attributes from a block's visibility settings. Used internally for responsive hiding.

### `getWidthPercentages(layout)` / `getWidthPixels(layout, containerWidth)`

Calculate column widths for a given `ColumnLayout`. Returns an array of percentage or pixel values per column.

### `SOCIAL_ICONS`

A map of all built-in social platform SVG icon data, keyed by platform and style.

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
