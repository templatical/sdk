---
"@templatical/quality": minor
---

Add contentLocale to select the linted template version and localization.untranslated, localization.stale and localization.merge-tags-differ checks. Message locale stays independent; dictionaries remain a union.

This is additive and opt-in: existing single-language templates need no migration and keep their behavior. Keep all @templatical packages on the same version: an older renderer renders the default language and an older validator rejects localization fields. A self-built collaboration backend must apply the new locale operations.
