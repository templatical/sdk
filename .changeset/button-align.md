---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
"@templatical/import-beefree": minor
"@templatical/import-unlayer": minor
"@templatical/import-html": minor
---

Add an alignment option to the button block (#536).

`ButtonBlock` gains `align: "left" | "center" | "right"`, surfaced in the button toolbar as the same sliding control image, video, social, title, menu and table already use. The renderer passes it through to `mj-button`'s native `align` attribute, and the editor canvas — which previously hardcoded centering — now mirrors it, so the preview, saved-block previews and the test-email dialog all agree with what gets sent.

**Breaking (types):** `align` is required, matching `ImageBlock` / `VideoBlock` / `SocialIconsBlock`. Code that constructs a `ButtonBlock` literal without going through `createButtonBlock()` must add the field. Nothing else changes: the factory defaults to `"center"`, and both the renderer and the editor fall back to `"center"` for templates stored before the field existed, so existing content renders byte-for-byte as it did.

Note `align` has no visible effect when `width` is `"full"` — the button spans the column either way. The control stays visible in that state rather than appearing and disappearing with the width mode, matching the image toolbar.

The three importers now carry button alignment across instead of dropping it: BeeFree and Unlayer read the button's own `text-align`, and the HTML importer reads the wrapping cell's `text-align` or its legacy `align` attribute (an anchor is sized to its content, so its own `text-align` says nothing about placement).
