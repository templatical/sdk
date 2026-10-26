---
"@templatical/core": minor
---

Route language-view edits into locale layers, emit locale operations from collaboration diffs, and coordinate locks per block and language.

This is additive and opt-in: existing single-language templates need no migration and keep their behavior. Keep all @templatical packages on the same version: an older renderer renders the default language and an older validator rejects localization fields. A self-built collaboration backend must apply the new locale operations.
