---
"@templatical/template-tools": minor
---

Add --locale to validate and render, and accept localized templates in the schema. Validation blocks merge-tag mismatches even at warning severity; missing/stale translations remain advisory.

This is additive and opt-in: existing single-language templates need no migration and keep their behavior. Keep all @templatical packages on the same version: an older renderer renders the default language and an older validator rejects localization fields. A self-built collaboration backend must apply the new locale operations.
