---
title: Export Options
description: Export templates as JSON, MJML, or HTML using the built-in UI or programmatic API.
---

# Export Options

Templatical supports three output formats: JSON (the editor's native format), MJML, and HTML. You can use the built-in export UI or export programmatically.

## Built-in Export UI

When `@templatical/renderer` is installed as a dependency, the editor automatically detects it and exposes export buttons in the UI. No additional configuration is needed.

```bash
npm install @templatical/renderer
```

The renderer is loaded via dynamic `import()`, so it only adds to your bundle when present.

## Programmatic Export

The `TemplaticalEditor` instance returned by `init()` provides three export methods:

### JSON Content

Always available. Returns the raw `TemplateContent` object:

```ts
const content = editor.getContent();
// { blocks: [...], settings: { width: 600, ... } }
```

This is the format you should store in your database. It can be passed back to `init({ content })` or `editor.setContent()` to restore the template.

### MJML

Available when `@templatical/renderer` is installed:

```ts
const mjml = editor.toMjml();
```

Returns the full MJML document as a string. Useful if you want to process the MJML yourself or render it on the server.

### HTML

Available when `@templatical/renderer` is installed. Returns a Promise because MJML-to-HTML conversion is async:

```ts
const html = await editor.toHtml();
```

Returns the final HTML string ready to send as an email.

### Checking Availability

The `toMjml` and `toHtml` methods are only defined when the renderer is detected. Check before calling:

```ts
if (editor.toMjml) {
  const mjml = editor.toMjml();
}

if (editor.toHtml) {
  const html = await editor.toHtml();
}
```

## Server-Side Rendering

Use `@templatical/renderer` directly on the server (Node.js, Bun, Deno) for rendering stored templates without the editor:

```bash
npm install @templatical/renderer
```

```ts
import { renderToMjml, renderToHtml } from '@templatical/renderer';

// Load template content from your database
const content = await db.getTemplateContent(templateId);

// Render to MJML
const mjml = renderToMjml(content);

// Render to HTML
const html = await renderToHtml(content);
```

### Render Options

Both functions accept an optional `RenderOptions` object:

```ts
import { renderToMjml, renderToHtml } from '@templatical/renderer';
import type { RenderOptions } from '@templatical/renderer';

const options: RenderOptions = {
  customFonts: [
    {
      name: 'Inter',
      url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap',
      fallback: 'Helvetica, Arial, sans-serif',
    },
  ],
  defaultFallbackFont: 'Arial, sans-serif',
  allowHtmlBlocks: true,
};

const mjml = renderToMjml(content, options);
const html = await renderToHtml(content, options);
```

| Option | Type | Default | Description |
|---|---|---|---|
| `customFonts` | `CustomFont[]` | `[]` | Custom fonts to include as `<mj-font>` declarations |
| `defaultFallbackFont` | `string` | `'Arial, sans-serif'` | Fallback font stack |
| `allowHtmlBlocks` | `boolean` | `true` | Whether to render HTML blocks in the output |

## ExportResult Type

When working with both formats together, use the `ExportResult` type from `@templatical/types`:

```ts
import type { ExportResult } from '@templatical/types';

// ExportResult { html: string; mjml: string }
```

## Typical Workflow

1. Users design templates in the editor
2. Store `editor.getContent()` JSON in your database
3. At send time, render with `renderToHtml(content)` on the server
4. Optionally replace merge tags in the HTML before sending

```ts
import { renderToHtml } from '@templatical/renderer';

async function sendEmail(templateId: string, recipient: Recipient) {
  const content = await db.getTemplateContent(templateId);
  let html = await renderToHtml(content);

  // Replace merge tags
  html = html.replace('{{first_name}}', recipient.firstName);
  html = html.replace('{{company}}', recipient.company);

  await emailService.send({ to: recipient.email, html });
}
```
