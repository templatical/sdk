# @templatical/import-stripo

Convert Stripo email templates to Templatical format.

Reads either surface Stripo produces:

- **Plugin / editor storage** — `{ html, css }` from `getTemplateData()` (`esd-*` class attributes).
- **Compiled export** — File → HTML (`es-wrapper` / `es-left` / `es-button`, no `esd-*` on elements).

The converter auto-detects which one you passed. There is no mode flag.

## Install

```sh
npm install @templatical/import-stripo
```

## Usage

```ts
import { convertStripoTemplate } from "@templatical/import-stripo";

// Plugin host (what you stored from getTemplateData):
const { content, report } = convertStripoTemplate(html, { css });

// Marketer File → HTML export:
const exported = convertStripoTemplate(fileHtml);
```

See [Migrating from Stripo](https://docs.templatical.com/guide/migration-from-stripo).

## License

MIT
