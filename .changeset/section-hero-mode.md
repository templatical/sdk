---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
"@templatical/quality": minor
"@templatical/import-mjml": minor
"@templatical/import-easy-email-pro": minor
---

Sections can render as heroes

A one-column section with a background image can render as an MJML `mj-hero`: the image fills the box and the content sits on top. Set `section.hero`:

- `height: "image"` keeps the box at the image's shape at every width. It needs the image's size, which `backgroundImage` carries as optional `width` / `height`; the editor measures it when the author picks the image.
- A number is a fixed height in px, padding included.
- `verticalAlign` places the content: `"top"`, `"middle"` or `"bottom"`.

In the editor, a section's Background panel gains **Height** (Fit content, Match image, Fixed) and **Content position**, and the palette gains a **Hero** shortcut that inserts a hero-mode section with a title, a paragraph and a button. A hero has no border and always paints its image `cover`, unrepeated, so those controls hide while it applies and keep their values. `paletteBlocks` accepts `"hero"`.

With more than one column, no image, or `"image"` without the size, the section renders as a regular one, and the new `structure.hero-not-applied` warning says which. `@templatical/types` exports `resolveHero`, which the renderer, the linter and the editor share.

The MJML importer reads `mj-hero` as a hero section instead of an HTML block. Easy Email Pro's `standard-hero` keeps its image behind the content instead of stacking it as a leading image block.
