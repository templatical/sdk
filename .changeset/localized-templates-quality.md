---
"@templatical/quality": minor
---

Add contentLocale to select the linted template version and localization.untranslated, localization.stale and localization.merge-tags-differ checks. Message locale stays independent; dictionaries remain a union.

This is additive and opt-in: existing single-language templates need no migration and keep their behavior. Upgrade the renderer, validator and collaboration backend before enabling localization. Older renderers render the default, strict validators reject localization fields, and older collaboration backends reject locale operations.
