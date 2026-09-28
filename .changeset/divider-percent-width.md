---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": patch
"@templatical/template-tools": patch
---

Dividers can be a percentage of their column

`DividerBlock.width` takes `"full"`, a pixel number, or a percentage from `"0%"` to `"100%"` (the new `DividerPercentWidth` type). The renderer writes a percentage straight into `mj-divider`, which MJML renders as a share of the column, so the line shrinks with the column on a phone where a pixel width would overflow. The canvas draws it the same way, and `templatical validate` accepts it. A custom `blockRenderers.divider` must handle the percentage string.
