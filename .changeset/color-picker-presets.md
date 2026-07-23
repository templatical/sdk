---
"@templatical/types": minor
"@templatical/editor": minor
---

Add a `colors` editor option for a preset color-picker palette.

`colors.presets` renders a clickable grid inside every color picker popover (block toolbars, template settings, rich text, custom-block color fields); clicking a preset applies it and the preset matching the current value is marked selected. `colors.allowCustom: false` (with presets) hides the wheel and hex input so authors can only pick from the palette — a white-label / brand-kit constraint. It is ignored with a warning when no presets are configured. Non-breaking — pickers render exactly as before when `colors` is unset.
