---
"@templatical/import-beefree": patch
"@templatical/import-chamaileon": patch
"@templatical/import-topol": patch
"@templatical/import-unlayer": patch
"@templatical/renderer": patch
"@templatical/template-tools": patch
---

The Unlayer, BeeFree and Topol importers check for a repeated warning in constant time, so a design with thousands of languages no longer slows the import quadratically. The Chamaileon importer looks up variable references in a table built once per document. The renderer escapes control characters in a block's type and id before it logs the missing-renderer warning. `templatical live` answers 400 to a request target it can't parse, where it used to exit.
