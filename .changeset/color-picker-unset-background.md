---
"@templatical/editor": patch
---

Fix block/section background color incorrectly showing `#ffffff` when no color is set. An unset color now reads as "Not set" (a slashed swatch) instead of a fake white, and picking a color equal to the default — e.g. white on a transparent background — now persists and renders correctly instead of being silently dropped. A clear (×) button resets a color back to unset. (#282)
