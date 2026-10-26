---
"@templatical/renderer": minor
---

Add the optional locale render option to project text, overrides, hidden blocks and settings before producing MJML.

This is additive and opt-in: existing single-language templates need no migration and keep their behavior. Keep all @templatical packages on the same version: an older renderer renders the default language and an older validator rejects localization fields. A self-built collaboration backend must apply the new locale operations.
