---
"@templatical/import-mjml": patch
---

The MJML importer now reads back the button width, the per-corner radii, the borders and the button font that the renderer writes, so a rendered template survives a re-import with all of them.

An `mj-button`'s `width` used to be dropped, so every imported button fitted its label. `100%` now imports as `width: "full"` and a px width as that number. `ButtonBlock.width` holds no percentage, so any other percentage imports as the px it comes to in its column, less the column's side padding and the button's own, and the report entry is `approximated` with a note that the width no longer scales. A percentage above `100%` imports as `"full"`, and a width that is unreadable or comes to `0px` or less leaves the button fitting its label, both `approximated` with a note.

A `border-radius` with two to four values, such as `8px 8px 0 0`, used to import as square corners on `mj-section`, `mj-wrapper`, `mj-image` and `mj-button`. It now imports as the same corners. One that isn't in px, such as `50%` or `1em`, still imports as square corners but is now reported `approximated`.

`border` and `border-top`, `-right`, `-bottom` and `-left` on `mj-section`, `mj-image` and `mj-button` used to be dropped. They now import as the block's `border`, each side taking its own declaration over `border`. A style other than solid, dashed or dotted is drawn solid, and a side whose width isn't in px is left undrawn, both reported `approximated`. Templatical's wrapper has no border, so a border on `mj-wrapper` is dropped and reported.

An `mj-button`'s own `font-family` used to be dropped. It now imports as `fontFamily`, the first family in the stack. The document font that the renderer writes onto every element through `mj-all` is not read as the button's own.
