---
"@templatical/import-unlayer": minor
"@templatical/import-html": minor
"@templatical/import-stripo": minor
"@templatical/import-topol": minor
"@templatical/import-chamaileon": minor
"@templatical/import-easy-email-pro": minor
---

The Unlayer, HTML, Stripo, Topol, Chamaileon and Easy Email Pro importers carry a button's line height as `ButtonBlock.lineHeight`.

The value is a multiple of the label's font size: a percentage is that number over 100 (`150%` is `1.5`), a unitless number or an `em` length is itself, and a px length is that many pixels over the button's font size. It is rounded to two decimals. A value that comes to 1.2, `normal`, and a missing value stay unset, which renders 1.2. A value that can't be read imports at 1.2 and the button entry is `approximated` with a note naming it.

- **Unlayer:** `values.lineHeight`; Unlayer's `120%` default stays unset.
- **HTML:** the button's `line-height` style, from the `<a>` or, for a button cell, the cell and the `<a>`. A percentage or `em` line height on the cell is resolved against the cell's font size, as CSS inherits it, and `inherit` on the `<a>` takes the cell's. A bulletproof `font-size:16px; line-height:44px` anchor is `2.75`.
- **Stripo:** the inline `line-height` on `a.es-button`, else on its `es-button-border`.
- **Topol:** `mj-button` `line-height`, else the `mj-button` or `button:` default.
- **Chamaileon:** `style.lineHeight` in px over `style.fontSize`; the `25px` / `18px` default is `1.39`.
- **Easy Email Pro:** `standard-button` `line-height`. An unreadable percentage `width` is now noted.

Not a breaking change: no export, option or default is removed, renamed or changed. The importers map more of the source into fields that already exist, as #1201 did for the BeeFree and MJML importers.
