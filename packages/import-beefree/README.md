# @templatical/import-beefree

> Convert BeeFree email templates to Templatical's JSON format.

[![npm version](https://img.shields.io/npm/v/@templatical/import-beefree?label=npm&color=cb3837)](https://www.npmjs.com/package/@templatical/import-beefree)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/templatical/sdk/blob/main/LICENSE-MIT)

Migrate from [BeeFree](https://beefree.io) to [Templatical](https://github.com/templatical/sdk) without rebuilding your templates by hand. Maps BeeFree modules to Templatical block types and reports any modules that need manual conversion.

## Install

```bash
npm install @templatical/import-beefree
```

## Usage

```ts
import { convertBeeFreeTemplate } from '@templatical/import-beefree';

const beefreeJson = await fetch('/path/to/beefree-template.json').then(r => r.json());

const result = convertBeeFreeTemplate(beefreeJson);

console.log(result.content);   // → Templatical TemplateContent
console.log(result.report);    // → conversion report (per-module status, warnings, summary)

// Inspect modules that didn't convert cleanly
for (const entry of result.report.entries) {
  if (entry.status !== 'converted') {
    console.warn(
      `${entry.beeFreeModuleType} → ${entry.templaticalBlockType ?? 'n/a'} ` +
      `(${entry.status})${entry.note ? `: ${entry.note}` : ''}`,
    );
  }
}

console.log(result.report.summary);
// { total, converted, approximated, htmlFallback, skipped }
```

## What's converted

| BeeFree module | Templatical block |
|---|---|
| heading / title | `TitleBlock` |
| paragraph / text | `ParagraphBlock` |
| image | `ImageBlock` |
| button | `ButtonBlock` |
| divider | `DividerBlock` |
| spacer | `SpacerBlock` |
| social | `SocialIconsBlock` |
| menu | `MenuBlock` |
| html | `HtmlBlock` |
| video | `VideoBlock` |
| Unknown modules | Fallback to `HtmlBlock` |

Unknown or partially-supported modules are flagged in `result.report` so you can review them.

## API

- `convertBeeFreeTemplate(template)` — converts a BeeFree JSON template, returns `{ content, report }`

Types:
- `BeeFreeTemplate` — input shape (see source for full structure)
- `ImportResult` — `{ content: TemplateContent, report: ImportReport }`
- `ImportReport` — `{ entries: ImportReportEntry[], warnings: string[], summary: { total, converted, approximated, htmlFallback, skipped } }`
- `ImportReportEntry` — `{ beeFreeModuleType, templaticalBlockType, status, note? }`
- `ConversionStatus` — `'converted' | 'approximated' | 'html-fallback' | 'skipped'`

## Documentation

- [Migrating from BeeFree](https://docs.templatical.com/guide/migration-from-beefree)

Full reference at **[docs.templatical.com](https://docs.templatical.com)**.

## License

MIT
