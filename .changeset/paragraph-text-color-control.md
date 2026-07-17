---
"@templatical/editor": patch
---

Fix the paragraph text-color control so it reflects the color actually in use

The rich-text toolbar's text-color swatch used a native `<input type="color">`, which can't represent "unset" — so for text with no inline color it always painted a hard-coded `#000000`. That both looked like an explicit choice and didn't even match the real inherited color (the document `textColor`, default `#1a1a1a`). The swatch now shows the effective color the selection renders in (an explicit inline mark if present, otherwise the inherited document `textColor`), and a reset control appears only when an explicit inline color is set, clearing it back to inherited. (#373)
