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

Every importer takes `defaultLocale?: string` and sets `settings.locale` from the language the source declares (`<html lang>`, `<mjml lang>`, Beefree's `language.value`, Topol's primary `langs` entry), else from `defaultLocale`, else `"en"`. Each language it drops gets a `report.warnings` entry naming the language and the reason.

- **Beefree** module `translations`, **Unlayer** `values._languages` and **Topol** `translations` become language versions: text with `sourceHash` values hashed from the imported default, other properties such as Unlayer and Topol image sources as overrides, and Beefree's and Topol's preheader per language. Subjects, titles and descriptions stay with the host and produce warnings, as do keys the importer can't map.
- **Unlayer** converts Lexical `textJson` and the `paragraph` content type to paragraph blocks instead of the HTML fallback. Unlayer JSON declares no default language: pass `defaultLocale`, or a multilingual design gets a warning that `"en"` was assumed.
- Beefree, Unlayer and Topol language codes normalize `_` to `-` and must pass `isLocaleTag`; any other code is dropped with a warning.

The mappings follow the vendors' documented JSON, checked 2026-10-28; real multilingual exports weren't available to test against. Check an imported template with `template-tools validate imported.json --locale <tag>`.
