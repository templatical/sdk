---
"@templatical/renderer": minor
---

Add the optional locale render option to project text, overrides, hidden blocks and settings before producing MJML.

This is additive and opt-in: existing single-language templates need no migration and keep their behavior. Upgrade the renderer, validator and collaboration backend before enabling localization. Older renderers render the default, strict validators reject localization fields, and older collaboration backends reject locale operations.
