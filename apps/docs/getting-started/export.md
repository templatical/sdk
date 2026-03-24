---
title: Export
description: Export Templatical templates to JSON, MJML, and HTML.
---

# Export

Templatical templates are stored as JSON. You can export them as raw JSON for persistence, as MJML for further processing, or as production-ready HTML for sending.

## JSON export

Call `getContent()` on the editor instance to get the current `TemplateContent` object. This is a plain, serializable JavaScript object.

```ts
const content = editor.getContent();

// Persist to your backend
await fetch('/api/templates/123', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(content),
});
```

The `TemplateContent` shape:

```ts
interface TemplateContent {
  blocks: Block[];
  settings: {
    width: number;
    backgroundColor: string;
    fontFamily: string;
    preheaderText?: string;
  };
}
```

JSON is the canonical format. Save it to restore templates later via `init({ content })` or `editor.setContent(content)`.

## MJML export

The editor's `toMjml()` method renders the current content to an MJML string. Requires `@templatical/renderer` as an installed dependency.

```bash
npm install @templatical/renderer
```

```ts
const mjml = editor.toMjml();
console.log(mjml);
```

`toMjml()` is synchronous and returns a string. Use this when you want to compile MJML to HTML on your own server, or pass it to a third-party MJML service.

## HTML export

The `toHtml()` method renders the current content to a complete HTML string ready for email sending. It internally calls `renderToMjml()` then compiles the MJML to HTML.

```ts
const html = await editor.toHtml();
```

`toHtml()` is asynchronous because it dynamically imports the `mjml` compiler. The returned HTML is self-contained and compatible with major email clients.

## Programmatic rendering without the editor

You do not need a running editor instance to render templates. Import `renderToMjml()` and `renderToHtml()` directly from `@templatical/renderer`. This works in both browser and Node.js environments.

```ts
import { renderToMjml, renderToHtml } from '@templatical/renderer';
import type { TemplateContent } from '@templatical/types';

// Load saved JSON content
const content: TemplateContent = await fetch('/api/templates/123').then(r => r.json());

// Render to MJML (synchronous)
const mjml = renderToMjml(content);

// Render to HTML (asynchronous)
const html = await renderToHtml(content);
```

### Render options

Both `renderToMjml()` and `renderToHtml()` accept an optional second argument:

```ts
interface RenderOptions {
  customFonts?: CustomFont[];
  defaultFallbackFont?: string;
  allowHtmlBlocks?: boolean;
}
```

| Option | Default | Description |
|---|---|---|
| `customFonts` | `[]` | Array of custom web fonts to include via `<mj-font>` declarations |
| `defaultFallbackFont` | `'Arial, sans-serif'` | Fallback font stack when a font cannot be resolved |
| `allowHtmlBlocks` | `true` | Set to `false` to strip raw HTML blocks from the output |

Example with custom fonts:

```ts
const html = await renderToHtml(content, {
  customFonts: [
    { name: 'Inter', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap' },
  ],
  allowHtmlBlocks: false,
});
```

### Node.js usage

The renderer works in Node.js for server-side email generation. Install `mjml` as a dependency in your project -- `renderToHtml()` dynamically imports it.

```bash
npm install @templatical/renderer mjml
```

```ts
// server.ts
import { renderToHtml } from '@templatical/renderer';

async function sendEmail(templateContent) {
  const html = await renderToHtml(templateContent);

  await emailService.send({
    to: 'user@example.com',
    subject: 'Your weekly report',
    html,
  });
}
```

## Download helper pattern

A common pattern is letting users download the rendered HTML as a file:

```ts
async function downloadHtml(editor) {
  const html = await editor.toHtml();
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'email-template.html';
  link.click();

  URL.revokeObjectURL(url);
}
```

## Next steps

- [Export Options](/guide/export-options) -- advanced export configuration and post-processing.
- [Blocks](/guide/blocks) -- reference for all 13 block types.
- [Renderer API (TypeScript)](/api/renderer-typescript) -- full API reference for the renderer package.
