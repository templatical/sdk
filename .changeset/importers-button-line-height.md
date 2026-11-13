---
"@templatical/import-unlayer": minor
"@templatical/import-html": minor
"@templatical/import-stripo": minor
"@templatical/import-topol": minor
"@templatical/import-chamaileon": minor
"@templatical/import-easy-email-pro": minor
---

The Unlayer, HTML, Stripo, Topol, Chamaileon and Easy Email Pro importers carry a button's line height as `ButtonBlock.lineHeight`.

The value is a multiple of the label's font size: a percentage is that number over 100 (`150%` is `1.5`), a unitless number or an `em` length is itself, and a px length is that many pixels over the button's font size. It is rounded to two decimals. A value that comes to 1.2, `normal`, and a missing value stay unset, which renders 1.2. Any other value imports at 1.2 and the button entry is `approximated` with a note naming it.

- **Unlayer:** `values.lineHeight`; Unlayer's `120%` default stays unset.
- **HTML:** the button's `line-height` style, from the `<a>` or, for a button cell, the cell and the `<a>`. A bulletproof `font-size:16px; line-height:44px` anchor is `2.75`.
- **Stripo:** the inline `line-height` on `a.es-button`, else on its `es-button-border`.
- **Topol:** `mj-button` `line-height`, else the `mj-button` or `button:` default.
- **Chamaileon:** `style.lineHeight` in px over `style.fontSize`; the `25px` / `18px` default is `1.39`.
- **Easy Email Pro:** `standard-button` `line-height`.

Stripo and Easy Email Pro don't import a button's font size, so a px line height there is measured against the 15px label the block keeps.
