---
"@templatical/editor": patch
---

The font pickers show the font in use when it isn't one of the listed fonts. A title, button, menu, table or countdown whose `fontFamily` is a full stack, such as `Helvetica Neue, Helvetica, Arial, sans-serif` from imported content, matched no option, so the select showed blank. The block's own font is now listed first, labelled by its first family, or in full when that family is already in the list, so `Arial, sans-serif` doesn't show as a second "Arial". The paragraph toolbar's font select does the same for the selected text, which showed "Default font" for an imported stack.
