---
"@templatical/types": patch
"@templatical/renderer": patch
"@templatical/editor": patch
"@templatical/import-beefree": patch
---

The canvas draws a button at the same height as the export (#1144). The renderer now writes `line-height="120%"` explicitly; compiled HTML is unchanged.
