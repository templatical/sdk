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

Renders a `TemplateContent` object to an MJML string.

```ts
import { renderToMjml } from '@templatical/renderer';

const mjml = renderToMjml(templateContent);
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `content` | `TemplateContent` | The template to render |
| `options` | `RenderOptions` | Optional rendering configuration |

**Returns:** `string` -- MJML markup

## RenderOptions

```ts
interface RenderOptions {
  customFonts?: CustomFont[];
  defaultFallbackFont?: string;
  allowHtmlBlocks?: boolean;      // default: true
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `customFonts` | `[]` | Custom font definitions for `<mj-font>` declarations in rendered output |
| `defaultFallbackFont` | `'Arial, sans-serif'` | Fallback font stack |
| `allowHtmlBlocks` | `true` | Set to `false` to strip HTML blocks from output |

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
You typically don't need to call this directly -- the renderer calls it internally when processing text blocks. It's exported for advanced use cases where you're working with editor HTML outside the normal rendering pipeline.
:::

### `isHiddenOnAll(visibility)`

Returns `true` if a `BlockVisibility` object has all viewports set to `false`. Useful for skipping blocks that shouldn't render at all:

```ts
if (isHiddenOnAll(block.visibility)) {
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

Generates a data URI for a social media platform icon. Used internally by the renderer for social icon blocks:

```ts
const uri = generateSocialIconDataUri('twitter', 'circle', 'medium');
// 'data:image/svg+xml,...'
```

## Compiling MJML to HTML

After rendering to MJML, compile to HTML using any MJML library:

```ts
import { renderToMjml } from '@templatical/renderer';
import mjml2html from 'mjml';

const mjml = renderToMjml(templateContent);
const { html } = mjml2html(mjml);

// html is ready to send via your email service
```

See [Node.js Renderer Example](/examples/node-renderer) for a complete server-side setup.
