---
"@templatical/types": minor
---

Add the localized text and layer model, field-path and source-hash helpers, projection and coverage, locale operations, and lock locales.

This is additive and opt-in: existing single-language templates need no migration and keep their behavior. Upgrade the renderer, validator and collaboration backend before enabling localization. Older renderers render the default, strict validators reject localization fields, and older collaboration backends reject locale operations.

Discard cached default-language `renderedHtml` when projecting a custom block with any locale text or property override, retaining its stylesheet. Supply `renderCustomBlock` to render localized fields; without it the block is omitted. Versions without a custom block layer keep their cached HTML.
