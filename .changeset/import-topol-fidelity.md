---
"@templatical/import-topol": patch
---

Imported Topol buttons no longer paint their row in their fill colour

On a Topol `mj-button`, `background-color` is the button face. The importer also copied it into the block background, which renders as the row behind the button, so a button with a fill painted its whole row in that colour. A block's background now comes from `container-background-color`, the attribute MJML paints behind every leaf element, and the button face still comes from `background-color`. Text, image, spacer, divider and social nodes follow the same rule: a `background-color` on them, which MJML never paints, no longer becomes a block background, and a `container-background-color` they set now does. A section still takes its fill from its own `background-color`.
