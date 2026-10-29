---
"@templatical/template-tools": minor
---

Add `--locale` to `validate` and `render` for translated language versions, and accept `settings.locales` and `l10n` in the schema. Validation checks every language projection, refuses element ids containing `.` or `/`, blocks merge-tag mismatches even at warning severity, and reports missing or stale translations as advisory issues. An unknown locale exits `1` with `unknown_locale`; a missing or empty `--locale` value exits `2`.

Existing templates need no migration, except that an element id containing `.` or `/` now fails validation; rename it. Keep every `@templatical/*` package on the same version.
