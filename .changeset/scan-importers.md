---
"@templatical/types": patch
"@templatical/import-mjml": patch
"@templatical/import-html": patch
"@templatical/import-topol": patch
"@templatical/import-chamaileon": patch
"@templatical/import-easy-email-pro": patch
"@templatical/import-beefree": patch
---

cloneBlock serializes a block tree once and remints IDs throughout the copy.
MJML table inference imports only rows owned by the outer table and keeps nested table markup inside its cell.
HTML layout table classification stops at the first content tag or cell with an element child.
Topol unsupported nodes are preserved as compact JSON.
Topol social imports each platform and URL pair once and notes how many repeats it dropped.
Chamaileon report notes quote at most 80 characters of document expressions and values, adding an ellipsis when truncated.
Easy Email Pro report notes quote at most 80 characters of document attribute values, adding an ellipsis when truncated.
Easy Email Pro expands one attribute to at most 65,536 characters; a `$var()` reference that would exceed that stays verbatim and counts as unresolved.
BeeFree keeps a text or social-icon `font-weight` only when it is `normal`, `bold`, `bolder`, `lighter`, a CSS-wide keyword or a number from 1 to 1000, and drops a text `font-family` stack over 256 characters with an approximated note.
