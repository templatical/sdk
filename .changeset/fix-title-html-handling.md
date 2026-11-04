---
"@templatical/types": patch
"@templatical/editor": patch
"@templatical/renderer": patch
---

Title blocks now unwrap paragraphs with quoted attributes correctly in the editor and rendered email. The editor sanitizes title HTML after unwrapping to close a script-injection path in the canvas. `findOpenTagEnd` now treats a quote inside an unquoted attribute value as an ordinary character, as HTML does.
