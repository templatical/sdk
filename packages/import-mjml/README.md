# @templatical/import-mjml

Convert MJML email templates to Templatical format.

Parses `<mjml>` source — hand-written or exported from another tool — into a Templatical `TemplateContent` tree. Structural tags (`mj-section`, `mj-column`, `mj-wrapper`) become `SectionBlock`s and content tags (`mj-text`, `mj-image`, `mj-button`, etc.) map to their Templatical block equivalents. Tags with no Templatical equivalent are preserved verbatim as `HtmlBlock` fallbacks.

## Install

```sh
npm install @templatical/import-mjml
```

## Usage

```ts
import { convertMjmlTemplate } from '@templatical/import-mjml';

const mjml = await fetch('/path/to/template.mjml').then((r) => r.text());
const { content, report } = convertMjmlTemplate(mjml);

console.log(report.summary);
console.log(report.warnings);
```

Each entry in `report.entries` carries a `status`:

- `converted` — mapped to a Templatical block with no loss of fidelity.
- `approximated` — mapped to a Templatical block, but something had to be resolved or clamped (e.g. a heading level beyond h4, a column-width split with no exact Templatical layout, or a multi-section `mj-wrapper`).
- `html-fallback` — no Templatical block exists for this tag; the original MJML markup is preserved inside an `HtmlBlock`.
- `skipped` — produced no block at all (e.g. an `<mj-include>`, which the importer can't resolve without filesystem access).

See [Migrating from hand-written MJML](https://docs.templatical.com/guide/migration-from-mjml) for the full tag-mapping table.

## License

MIT
