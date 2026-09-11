# @templatical/import-easy-email-pro

Convert Easy Email Pro email templates to Templatical format.

Reads an Easy Email Pro persist document — the `{ subject, content }` envelope
the editor saves, or a bare `type: "page"` element — into a Templatical
`TemplateContent` tree. The input is that persist JSON, not `EditorCore.toMJML()`
and not the compiled HTML. Open-source Easy Email (`type: "section"` / `"text"`
without the `standard-` prefix) is a different format; this package throws
rather than mis-import it.

## Install

```sh
npm install @templatical/import-easy-email-pro
```

## Usage

```ts
import { convertEasyEmailProTemplate } from "@templatical/import-easy-email-pro";

const { content, report } = convertEasyEmailProTemplate(emailTemplate);

console.log(report.summary);
console.log(report.warnings);
```

`emailTemplate` is `{ subject, content }` with `content.type === "page"`, or
the page element itself. `convertEasyEmailProTemplate` also accepts either
shape serialized as a JSON string. Extra `html` / `mjml` keys on the envelope
are ignored.

Each entry in `report.entries` carries a `status`:

- `converted` — mapped to a Templatical block with no loss of fidelity.
- `approximated` — mapped to a Templatical block, but something had to be
  resolved or clamped (e.g. a 4+ column row folded to three, an outlined
  button, a hero overlay stacked as a leading image, a countdown GIF, a
  widget whose children converted without its chrome, logic whose children
  converted without their expression).
- `html-fallback` — no Templatical block exists for this `type`; the raw node
  is preserved as JSON inside an `HtmlBlock`.
- `skipped` — empty `logic`; there were no children to convert.

See [Migrating from Easy Email Pro](https://docs.templatical.com/guide/migration-from-easy-email-pro)
for the full node-mapping table and what does not survive the conversion.

## License

MIT
