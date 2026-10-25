---
"@templatical/template-tools": minor
---

Add --locale to validate and render, and accept localized templates in the schema. Validation blocks merge-tag mismatches even at warning severity; missing/stale translations remain advisory.

This is additive and opt-in: existing single-language templates need no migration and keep their behavior. Upgrade the renderer, validator and collaboration backend before enabling localization. Older renderers render the default, strict validators reject localization fields, and older collaboration backends reject locale operations.
