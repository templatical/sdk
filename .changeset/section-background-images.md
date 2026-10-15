---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
"@templatical/quality": minor
"@templatical/template-tools": minor
---

Sections and wrapper bands take a background image

There was no way to put an image behind content — a hero banner or a textured band needed an HTML block, and HTML blocks render inside `mj-text`, where a background can't reach the section.

`SectionBlock`, `SectionWrapper` and the layout `WrapperBlock` gain an optional `backgroundImage: BackgroundImage` — `{ url, size, position: { x, y }, repeat }`, with `size` one of `"cover"`, `"contain"` or `"auto"` and `position` a 9-point grid. It renders as MJML's `background-url`, `background-size`, `background-position` and `background-repeat` on the `mj-section` / `mj-wrapper`, which includes MJML's VML fallback for Outlook on Windows. The element's `backgroundColor` stays its fallback colour. Templates without an image render exactly as before.

The editor's Background panel gets an image control for sections, and the section wrapper settings get one for the band: a URL (merge tags, the media browser and drag-and-drop upload all work, as for image blocks), then Fill / Fit / Original, a position grid and a repeat toggle. The canvas paints the image through `resolveImageUrl` like image blocks do.

`createBackgroundImage()`, `resolveBackgroundImage()` and `encodeCssUrl()` are exported from `@templatical/types`, so the canvas and the renderer resolve images identically. `encodeCssUrl` percent-encodes the characters that could end a quoted CSS `url()`, because MJML pastes the URL verbatim into inline CSS.

`lintStructure` gains two warnings for Outlook on Windows: `structure.wrapper-color-over-background-image` (a wrapper colour paints over the section's image there) and `structure.nested-background-image` (an image on both the wrapper and its section breaks the layout there).

Outlook on Windows tiles an image at its original size (`auto`) from the top center, whatever the position and repeat settings. Importers don't read background images yet.
