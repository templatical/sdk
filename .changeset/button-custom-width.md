---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
---

Add a `width` option to button blocks: buttons can be set to a fixed pixel width or stretched to full width (`'full'`), independently of their label, instead of always shrinking to fit their content. Omitting `width` keeps the previous content-sized behavior, so existing templates are unaffected (#260).
