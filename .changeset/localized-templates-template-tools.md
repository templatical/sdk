---
"@templatical/template-tools": minor
---

Add `--locale` to `validate` and `render` for translated language versions, and accept `settings.locales` and `l10n` in the schema. Validation checks every language projection, blocks merge-tag mismatches even at warning severity, and reports missing or stale translations as advisory issues. Use `validateTemplate(content, definitions)` through the library for custom text translations.

Additive and opt-in: existing templates need no migration. Keep every `@templatical/*` package on the same version.
