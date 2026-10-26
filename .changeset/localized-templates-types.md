---
"@templatical/types": minor
---

Add the localized text and layer model, field-path and source-hash helpers, projection and coverage, locale operations, and lock locales.

This is additive and opt-in: existing single-language templates need no migration and keep their behavior. Keep all @templatical packages on the same version: an older renderer renders the default language and an older validator rejects localization fields. A self-built collaboration backend must apply the new locale operations.

Discard cached default-language `renderedHtml` when projecting a custom block with any locale text or property override, retaining its stylesheet. Supply `renderCustomBlock` to render localized fields; without it the block is omitted. Versions without a custom block layer keep their cached HTML.
