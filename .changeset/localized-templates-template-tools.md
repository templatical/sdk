---
"@templatical/template-tools": minor
---

Language versions in the CLI, with `strings export` and `strings import`

Breaking changes:

- An element id containing `.` or `/` now fails `validate`; rename it.

Otherwise existing templates need no migration. Keep every `@templatical/*` package on the same version.

- `validate --locale <tag>` and `render --locale <tag>` check and render a language version, and the schema accepts `settings.locales` and `l10n`. An unknown locale exits `1` with `unknown_locale`.
- `strings export <template.json> --locale <tag>` exports a language's strings, the gaps by default (`--only gaps|all`, `--block <id>`), as a `strings/1` JSON file. `strings import <template.json> <strings.json>` applies the strings whose `sourceHash` and placeholders still match and reports `{ applied, rejected, skipped, file }`, with the rejection reasons `stale`, `tags_changed`, `unknown_field`, `not_translatable` and `unsafe_html`. It exits `1` when it rejects any string.
- `--definitions <file>` loads custom-block definitions for `validate`, `render`, `strings` and `edit`, `--do-not-translate <file>` protects terms during `strings`, and `import --default-locale <tag>` sets the default language for a source that declares none.
- `edit` applies the locale operations, and a refused operation names its block on stderr.

See [Strings](https://docs.templatical.com/api/template-tools#strings) and [Definitions](https://docs.templatical.com/api/template-tools#definitions).
