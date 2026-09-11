# @templatical/import-chamaileon

Convert Chamaileon email templates to Templatical format.

Reads a Chamaileon persist document — the JSON `editorInstance.methods.getDocument()` returns — into a Templatical `TemplateContent` tree. Email JSON 2.0 through 4.1 is accepted after a key normalizer (kebab-case and camelCase styles, `{ reference, default }` colour variables). The input is that document, not `getEmailHtml()` / the HTML generator.

## Install

```sh
npm install @templatical/import-chamaileon
```

## Usage

```ts
import { convertChamaileonTemplate } from "@templatical/import-chamaileon";

const document = await editorInstance.methods.getDocument();
const { content, report } = convertChamaileonTemplate(document);

console.log(report.summary);
console.log(report.warnings);
```

`convertChamaileonTemplate` also accepts the document serialized as a JSON string.

Each entry in `report.entries` carries a `status`:

- `converted` — mapped to a Templatical block with no loss of fidelity.
- `approximated` — mapped to a Templatical block, but something had to be resolved or clamped (e.g. a nested multicolumn flattened, a 4+ column row folded to three, an outlined button, a loop whose children converted without their expression).
- `html-fallback` — no Templatical block exists for this `type`; the raw node is preserved as JSON inside an `HtmlBlock`.
- `skipped` — an empty loop or conditional; there were no children to convert.

See [Migrating from Chamaileon](https://docs.templatical.com/guide/migration-from-chamaileon) for the full node-mapping table and what does not survive the conversion.

## License

MIT
