# @templatical/import-unlayer

> Convert Unlayer email templates to Templatical's JSON format.

[![npm version](https://img.shields.io/npm/v/@templatical/import-unlayer?label=npm&color=cb3837)](https://www.npmjs.com/package/@templatical/import-unlayer)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/templatical/sdk/blob/main/LICENSE-MIT)

Migrate from [Unlayer](https://unlayer.com) (the `react-email-editor` design JSON) to [Templatical](https://github.com/templatical/sdk) without rebuilding your templates by hand. Maps Unlayer content types to Templatical block types and reports anything that needs manual review.

## Install

```bash
npm install @templatical/import-unlayer
```

## Usage

```ts
import { convertUnlayerTemplate } from '@templatical/import-unlayer';

// Whatever your Unlayer editor returned from `editor.saveDesign(...)`.
const unlayerJson = await fetch('/path/to/unlayer-design.json').then(r => r.json());

const result = convertUnlayerTemplate(unlayerJson);

console.log(result.content);   // → Templatical TemplateContent
console.log(result.report);    // → conversion report (per-content status, warnings, summary)

// Inspect content that didn't convert cleanly
for (const entry of result.report.entries) {
  if (entry.status !== 'converted') {
    console.warn(
      `${entry.unlayerContentType} → ${entry.templaticalBlockType ?? 'n/a'} ` +
      `(${entry.status})${entry.note ? `: ${entry.note}` : ''}`,
    );
  }
}

console.log(result.report.summary);
// { total, converted, approximated, htmlFallback, skipped }
```

## What's converted

| Unlayer content | Templatical block |
|---|---|
| text | `ParagraphBlock` |
| heading | `TitleBlock` |
| image | `ImageBlock` |
| button | `ButtonBlock` |
| divider | `DividerBlock` |
| html | `HtmlBlock` |
| menu | `MenuBlock` |
| social | `SocialIconsBlock` |
| video | `VideoBlock` |
| timer | `HtmlBlock` (fallback) |
| form | skipped |
| Unknown content | Fallback to `HtmlBlock` |

Unknown or partially-supported content types are flagged in `result.report` so you can review them.

## API

- `convertUnlayerTemplate(template)` — converts an Unlayer design JSON, returns `{ content, report }`

Types:
- `UnlayerTemplate` — input shape (see source for full structure)
- `ImportResult` — `{ content: TemplateContent, report: ImportReport }`
- `ImportReport` — `{ entries: ImportReportEntry[], warnings: string[], summary: { total, converted, approximated, htmlFallback, skipped } }`
- `ImportReportEntry` — `{ unlayerContentType, templaticalBlockType, status, note? }`
- `ConversionStatus` — `'converted' | 'approximated' | 'html-fallback' | 'skipped'`

## Documentation

- [Migrating from Unlayer](https://docs.templatical.com/guide/migration-from-unlayer)

Full reference at **[docs.templatical.com](https://docs.templatical.com)**.

## License

MIT
