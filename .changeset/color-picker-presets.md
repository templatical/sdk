---
"@templatical/types": minor
"@templatical/editor": minor
---

Add a `colors` editor option for a preset color-picker palette.

`colors.presets` renders a clickable grid inside every color picker popover (block toolbars, template settings, rich text, custom-block color fields); clicking a preset applies it and the preset matching the current value is marked selected. Presets must be `#rgb` / `#rrggbb` hex — invalid entries are skipped with a console warning. The grid is an ARIA radio group: arrow keys rove focus between chips (roving tabindex) and Enter/Space activate.

`colors.allowCustom: false` (with presets) hides the wheel and hex input so authors can only pick from the palette — a white-label / brand-kit constraint. In this locked mode the palette leads with a "no colour" chip that restores the unset (inherit) state, and the editor warns when any `blockDefaults` / `templateDefaults` colour falls outside the palette. It is ignored with a warning when no presets are configured. Non-breaking — pickers render exactly as before when `colors` is unset.
