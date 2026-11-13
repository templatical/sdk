---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
"@templatical/import-beefree": minor
"@templatical/import-mjml": minor
"@templatical/template-tools": minor
"@templatical/ai-kit": minor
---

A button can take a percentage of its column.

`ButtonBlock.width` accepts a percentage such as `"40%"`. The renderer writes that string on `mj-button` as `width="40%"` and adds the `tpl-button-full` class, so the link fills the button. In the editor, Custom width has a px | % control. The BeeFree importer and the MJML importer store a percentage between 0 and 100 as that string; `100%` stays `"full"`. `parsePercentWidth` reads a stored percentage, and `roundHundredths` rounds a share to two decimals.
