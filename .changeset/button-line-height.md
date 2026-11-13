---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
"@templatical/import-beefree": minor
"@templatical/import-mjml": minor
"@templatical/template-tools": minor
"@templatical/ai-kit": minor
---

A button label can set its line height, and a wrapped label keeps it on every line.

`ButtonBlock.lineHeight` is the label's line height as a multiple of its font size. Omit it and the button renders at `BUTTON_LINE_HEIGHT` (1.2), as a stored button does today. `buttonLineHeight(block)` is that value, or 1.2 when the stored number is not finite and above 0. The renderer writes it on `mj-button` as a percentage (`2` is `line-height="200%"`), and the canvas uses the same number, so each wrapped line gets it. The toolbar's Line height control offers the same stops as a paragraph; choosing 1.2 clears the field.

The BeeFree importer and the MJML importer read `line-height` into `lineHeight`: a percentage is that number over 100, a unitless number is itself, and a px length is that many pixels divided by the font size, rounded to two decimals. A value that rounds to 1.2, or that is missing, unreadable or not above 0, leaves the field unset. BeeFree no longer imitates a taller line box by adding padding; `buttonPadding` is the source padding as read.
