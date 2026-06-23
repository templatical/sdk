---
"@templatical/editor": patch
---

Fix the editor clipping its own content on short viewports. The block-types palette is now a scroll region, and the editor's `min-height` floor was lowered so it fills short containers instead of overflowing them — restoring access to the bottom of the palette, the footer, and the config panel's lower controls (#231).
