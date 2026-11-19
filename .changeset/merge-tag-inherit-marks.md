---
"@templatical/editor": patch
---

Merge tag chips inserted into formatted text keep that text's formatting through the toolbar, autocomplete, typing and paste, so the exported tag renders in the surrounding font size, colour and weight. Logic tag chips print no text and stay outside formatting, so a condition never splits a formatted element. Templates saved earlier keep their unstyled tags.
