---
"@templatical/import-beefree": minor
"@templatical/import-unlayer": minor
"@templatical/import-topol": minor
"@templatical/import-stripo": minor
"@templatical/import-chamaileon": minor
"@templatical/import-easy-email-pro": minor
"@templatical/import-html": minor
"@templatical/import-mjml": minor
---

Importers keep the source's languages

- Every importer takes `defaultLocale?: string` and sets `settings.locale` from the language the source declares (`<html lang>`, `<mjml lang>`, Beefree's `language.value`, Topol's primary `langs` entry), else from `defaultLocale`, else `"en"`. Unlayer JSON declares no default language, so pass `defaultLocale`.
- Beefree module `translations`, Unlayer `values._languages` and Topol `translations` become language versions.
- Each language or key an importer drops, and each subject, title or description left to the host, gets a `report.warnings` entry.
- Unlayer converts Lexical `textJson` and `paragraph` content to paragraph blocks instead of the HTML fallback.

The mappings follow the vendors' documented JSON, checked 2026-10-28; real multilingual exports weren't available to test against. Check an import with `template-tools validate imported.json --locale <tag>`, and see the [Beefree](https://docs.templatical.com/guide/migration-from-beefree#languages), [Unlayer](https://docs.templatical.com/guide/migration-from-unlayer#languages) and [Topol](https://docs.templatical.com/guide/migration-from-topol#languages) guides.
