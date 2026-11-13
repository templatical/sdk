---
"@templatical/import-stripo": minor
"@templatical/import-easy-email-pro": minor
---

The Stripo and Easy Email Pro importers carry a button's font size as `ButtonBlock.fontSize`, so an imported button no longer renders at the factory 15px.

- **Stripo:** the inline `font-size` on `a.es-button`, else on its `es-button-border`.
- **Easy Email Pro:** `standard-button` `font-size`, through the attribute cascade (the button, then `blockAttributes`, `categoryAttributes` and `globalAttributes`).

A px length or a bare number is read and rounded to whole pixels. A missing value leaves the factory 15px. Any other value, or one that rounds to 0 or below, also imports at 15px, and the button entry is `approximated` with the note `Button font-size "X" could not be read; imported at 15px.`

A px line height is now measured against the imported font size, as in the other importers, so `font-size: 18px` with `line-height: 27px` is `1.5`. A percentage, `em` or unitless line height beside the button's own font size keeps its ratio, so `font-size: 30px` with `line-height: 200%` is `2`.

Not a breaking change: no export, option or default is removed, renamed or changed.
