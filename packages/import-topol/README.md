# @templatical/import-topol

Convert Topol.io email templates to Templatical format.

Reads a Topol design tree — the JSON a Topol project exports — into a Templatical `TemplateContent` tree. Topol's own tag vocabulary already mirrors MJML's (`mj-section`, `mj-column`, `mj-text`, `mj-button`, …), so structural tags become `SectionBlock`s and content tags map to their Templatical block equivalents directly.

## Install

```sh
npm install @templatical/import-topol
```

## Usage

```ts
import { convertTopolTemplate } from '@templatical/import-topol';

// Topol's REST API wraps the design as { id, name, html, json } — pass the
// response's "json" field, not the response itself.
const res = await fetch('https://api.topol.io/v1/designs/123').then((r) => r.json());
const { content, report } = convertTopolTemplate(res.json);

console.log(report.summary);
console.log(report.warnings);
```

`convertTopolTemplate` also accepts the design serialized as a JSON string.

Each entry in `report.entries` carries a `status`:

- `converted` — mapped to a Templatical block with no loss of fidelity.
- `approximated` — mapped to a Templatical block, but something had to be resolved or clamped (e.g. a heading level beyond h4, a column layout with no exact Templatical match, or a social icon size outside 24/32/48px).
- `html-fallback` — no Templatical block exists for this tag; the raw node is preserved as JSON inside an `HtmlBlock`.
- `skipped` — reserved for parity with the other `@templatical/import-*` packages; this converter does not currently produce it.

See [Migrating from Topol](https://docs.templatical.com/guide/migration-from-topol) for the full tag-mapping table and what does not survive the conversion.

## License

MIT
