---
"@templatical/editor": patch
---

Fix: restore the ability to unset a rich-text color. The `swatch-only` color pickers (paragraph text color and highlight, plus the menu color control) now show a "Clear color" button inside the picker popover whenever a color is set, so you can reset back to the inherited color. The earlier move to the shared color picker had dropped the only unset affordance in swatch-only mode.
