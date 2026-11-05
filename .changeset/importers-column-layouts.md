---
"@templatical/import-beefree": minor
"@templatical/import-unlayer": minor
"@templatical/import-html": minor
"@templatical/import-mjml": minor
"@templatical/import-topol": minor
"@templatical/import-stripo": minor
"@templatical/import-chamaileon": minor
"@templatical/import-easy-email-pro": minor
---

Importers map source rows onto the four new section layouts. Four equal columns become `"4"`, 25/75 becomes `"1-3"`, 75/25 becomes `"3-1"`, and 25/50/25 becomes `"1-2-1"`. A ratio that is not exact snaps to the nearest of the nine layouts and keeps that importer's existing note. Stripo rows keep the equal layout for their column count. Unequal px widths, on a plugin frame or a compiled column, are reported approximated, and a column with no readable width is named in that note when the readable widths differ. Rows with more than four columns still flatten or fold into the last column, and the warning says Templatical supports up to four columns.
