---
"@templatical/template-tools": minor
---

Add `--locale` to `validate` and `render` for translated language versions, and accept `settings.locales` and `l10n` in the schema. Validation checks every language projection, refuses element ids containing `.` or `/`, reports a layer that hides a layout's slot or a block containing it, blocks merge-tag mismatches even at warning severity, and reports missing or stale translations as advisory issues. An unknown locale exits `1` with `unknown_locale`; a missing or empty `--locale` value exits `2`.

Existing templates need no migration, except that an element id containing `.` or `/` now fails validation; rename it. Keep every `@templatical/*` package on the same version.

`edit --definitions <file>` reads the custom-block definition array, captures `setDefaultLocale.customTextFields` for custom `text` and `textarea` fields, and validates the result with those definitions before writing. Promotion preserves current copies for the former default, including untranslated fields; later base edits mark those copies out of date.
