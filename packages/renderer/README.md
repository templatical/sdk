# @templatical/renderer

> JSON → MJML renderer for Templatical email templates. Runs in the browser or on Node.

[![npm version](https://img.shields.io/npm/v/@templatical/renderer?label=npm&color=cb3837)](https://www.npmjs.com/package/@templatical/renderer)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/templatical/sdk/blob/main/LICENSE-MIT)

Converts Templatical's JSON template format into MJML, which you then compile to HTML using any [MJML library](https://mjml.io). Pure functions, zero runtime dependencies aside from `@templatical/types`.

Use this on your backend to render templates server-side before sending email — or in the browser to preview before save.

## Install

```bash
npm install @templatical/renderer mjml
```

## Usage

### Browser or Node — JSON → MJML

```ts
import { renderToMjml } from '@templatical/renderer';
import type { TemplateContent } from '@templatical/types';

const content: TemplateContent = JSON.parse(stored);
const mjml = await renderToMjml(content);
```

`renderToMjml` is async — it returns `Promise<string>`. Custom blocks may need async work to resolve, so the call always returns a promise even when content has none.

### Node — MJML → HTML for sending

```ts
import { renderToMjml } from '@templatical/renderer';
import mjml2html from 'mjml';

const mjml = await renderToMjml(content);
const { html } = mjml2html(mjml);

// Send via Postmark, Resend, SES, Mailgun, anything
await mailer.send({ to, subject, html });
```

### With custom fonts

```ts
const mjml = await renderToMjml(content, {
  customFonts: [
    { name: 'Geist', url: 'https://fonts.googleapis.com/...' },
  ],
  defaultFallbackFont: 'Arial, sans-serif',
  allowHtmlBlocks: true,
});
```

### With custom blocks

Editor consumers use `editor.toMjml()`. Headless callers pass the registered definitions as `customBlocks`. Install the optional `liquidjs` peer (`^10.30.0`) in the server project:

```ts
import { renderToMjml } from '@templatical/renderer';
import type { CustomBlockDefinition, TemplateContent } from '@templatical/types';

export async function renderTemplate(content: TemplateContent, definitions: CustomBlockDefinition[]) {
  return renderToMjml(content, { customBlocks: definitions });
}
```

The [Custom blocks guide](https://docs.templatical.com/guide/custom-blocks) covers the option's fallback, conflicts and missing-peer error. For a lower-level resolver, use `createCustomBlockLiquid(liquidjs)` from `@templatical/types`. Use `{{ body | raw }}` for a field intended to hold HTML. Always quote attribute values and validate URL schemes from untrusted sources. The editor canvas also sanitizes each rendered block; email output keeps the template's HTML.

Without a matching definition or callback, the renderer falls back to `renderedHtml` (if any) and otherwise omits the block.

## API

- `renderToMjml(content, options?): Promise<string>` — render `TemplateContent` to an MJML string. Pair with the [`mjml`](https://www.npmjs.com/package/mjml) package to compile to final HTML.

Options:
- `customFonts` — `CustomFont[]` declarations rendered into `<mj-attributes>`
- `defaultFallbackFont` — fallback when a block doesn't specify a font
- `allowHtmlBlocks` — pass `false` to strip HTML blocks before render (e.g. for untrusted content)
- `customBlocks` — `CustomBlockDefinition[]` — render saved blocks from definitions
- `renderCustomBlock` — `(block: CustomBlock) => Promise<string>` — resolves custom blocks to HTML

## Documentation

- [How rendering works](https://docs.templatical.com/getting-started/how-rendering-works)
- [Renderer API](https://docs.templatical.com/api/renderer-typescript)

Full reference at **[docs.templatical.com](https://docs.templatical.com)**.

## License

MIT
