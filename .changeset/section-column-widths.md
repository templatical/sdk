---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/quality": minor
"@templatical/import-beefree": minor
"@templatical/import-mjml": minor
"@templatical/template-tools": minor
"@templatical/ai-kit": minor
"@templatical/editor": minor
---

A section can set each column's share of the row. The section settings show one percentage field per column, and the canvas draws that split.

`SectionBlock.columnWidths` is one number per column. The numbers are scaled to 100, so `[1, 1, 2]` is 25% / 25% / 50%, and the last column absorbs the rounding so the row totals 100. It overrides the layout preset. `columns` still sets how many columns there are. A length that doesn't match, or a value that isn't a finite number above 0, is ignored: the preset's split renders, and `structure.column-widths-ignored` names the reason. The BeeFree importer and the MJML importer store a 2–4 column ratio that isn't a preset as the even layout plus these widths. Five or more columns still flatten.
