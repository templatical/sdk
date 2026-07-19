---
"@templatical/editor": patch
---

Rich-text toolbar (text color + highlight) now uses the SDK's shared color picker — the same hex-wheel `ColorPicker` used everywhere else in the editor — instead of the native OS color input. The controls are unset-aware (an inherited-color selection shows the "not set" swatch, with the wheel seeded on the color the text actually renders in) and sized to match the toolbar. Adds `size` (`"sm" | "md"`) and `ariaLabel` props to the internal `ColorPicker`.
