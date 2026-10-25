---
"@templatical/editor": minor
---

Add the Languages switcher, missing/stale/override markers and field resets, localization config and locale API, locale-selecting exports, and the initCloud() warning for unsupported localization.

This is additive and opt-in: existing single-language templates need no migration and keep their behavior. Upgrade the renderer, validator and collaboration backend before enabling localization. Older renderers render the default, strict validators reject localization fields, and older collaboration backends reject locale operations.
