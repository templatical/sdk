---
"@templatical/import-mjml": patch
---

The MJML importer now reads an `mj-button`'s `width`, which it used to drop, so every imported button fitted its label. `100%` imports as `width: "full"` and a px width as that number, which is how the renderer writes them, so a rendered template's full-width and fixed-width buttons survive a re-import. `ButtonBlock.width` holds no percentage, so any other percentage imports as the px it comes to in its column, less the column's side padding and the button's own, and the report entry is `approximated` with a note that the width no longer scales. A percentage above `100%` imports as `"full"`, and a width that is unreadable or comes to `0px` or less leaves the button fitting its label, both `approximated` with a note.
