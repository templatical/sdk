---
"@templatical/core": minor
---

Route language-view edits into locale layers, emit locale operations from collaboration diffs, and coordinate locks per block and language.

This is additive and opt-in: existing single-language templates need no migration and keep their behavior. Upgrade the renderer, validator and collaboration backend before enabling localization. Older renderers render the default, strict validators reject localization fields, and older collaboration backends reject locale operations.
