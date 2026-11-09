---
"@templatical/types": patch
---

A locale operation (`updateBlockLocale`, `updateSettingsLocale`) writes only to the block's or settings' own `l10n` layer for that language. A layer inherited through the object's prototype is no longer reused and changed in place; the edit gets a fresh own layer instead.
