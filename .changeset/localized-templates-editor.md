---
"@templatical/editor": minor
---

Add the Languages switcher, missing/stale/override markers and field resets, localization config and locale API, locale-selecting exports, and the initCloud() warning for unsupported localization.

This is additive and opt-in: existing single-language templates need no migration and keep their behavior. Keep all @templatical packages on the same version: an older renderer renders the default language and an older validator rejects localization fields. A self-built collaboration backend must apply the new locale operations.
