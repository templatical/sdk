---
title: TypeScript Renderer
description: API reference for @templatical/renderer — convert template JSON to MJML and HTML.
---

# TypeScript Renderer

`@templatical/renderer` converts Templatical template JSON to MJML and HTML. Works in both browser and Node.js environments.

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

**Returns:** `string` — MJML markup

## `renderToHtml(content, options?)`

Renders a `TemplateContent` object directly to HTML. This is async because it dynamically imports the MJML compiler.

```ts
import { renderToHtml } from '@templatical/renderer';

const html = await renderToHtml(templateContent);
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `content` | `TemplateContent` | The template to render |
| `options` | `RenderOptions` | Optional rendering configuration |

**Returns:** `Promise<string>` — compiled HTML

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
| `customFonts` | `[]` | Custom font definitions for `@import` in rendered output |
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

Escapes HTML entities in a string.

### `escapeAttr(text)`

Escapes a string for use in HTML attributes.

### `convertMergeTagsToValues(html, tags, syntax)`

Replaces merge tag placeholders in HTML with their values.

### `isHiddenOnAll(visibility)`

Returns `true` if a `BlockVisibility` object has all viewports set to `false`.

### `toPaddingString(padding)`

Converts a `SpacingValue` to a CSS padding string (e.g. `"10px 20px 10px 20px"`).

### `generateSocialIconDataUri(platform, style, size)`

Generates a data URI for a social media platform icon.

## Server-Side Rendering

The renderer works in Node.js for batch rendering or server-side generation:

```ts
import { renderToHtml } from '@templatical/renderer';
import { readFileSync, writeFileSync } from 'fs';

const template = JSON.parse(readFileSync('template.json', 'utf8'));
const html = await renderToHtml(template);
writeFileSync('output.html', html);
```

See [Node.js Renderer Example](/examples/node-renderer) for a complete server-side setup.
