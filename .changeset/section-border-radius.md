---
"@templatical/types": patch
"@templatical/renderer": patch
"@templatical/editor": patch
---

Add an optional `borderRadius` (px) to section blocks. Set it from the section toolbar or via `createSectionBlock({ borderRadius })`; the renderer emits it as `border-radius` on the `mj-section`, so a section with a background color reads as a rounded card on a contrasting background. Omitted or `0` keeps square corners, so existing templates are unchanged. First step toward the framed "card on colored background" pattern. (#312)
