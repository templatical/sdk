---
"@templatical/editor": patch
---

The `swatch-only` color pickers (paragraph text color and highlight, plus the menu color control) now carry a manual hex field with an inline × clear inside the picker popover — the same control as the sidebar color pickers. You can type or paste an exact hex (applied on Enter/blur) and clear back to the inherited color with the ×. This restores the unset affordance that the move to the shared color picker had dropped, and adds precise hex entry that swatch-only mode previously lacked.

The color picker also normalizes colors to hex for display and for seeding the wheel, so editing an already-applied color shows `#rrggbb` (not the browser's `rgb(...)` read-back) and the wheel opens on the correct color.
