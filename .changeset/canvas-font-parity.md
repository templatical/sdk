---
"@templatical/types": minor
"@templatical/renderer": patch
"@templatical/editor": patch
---

The editor canvas shows a font with the same fallbacks as the email. A title, button, menu, table or countdown in a font the browser doesn't have, or a template font such as `Helvetica Neue`, used to preview in the browser's default serif while the email fell back to `defaultFallback` (`Arial, sans-serif` unless configured). The canvas, preview mode and the block previews now apply the renderer's own rule: a single unknown font previews as `'Helvetica Neue', Arial, sans-serif`, a built-in font as its stack, and a custom font with its fallback. `@templatical/types` exports the rule as `resolveFontStack`.

A custom font whose name contains an apostrophe, such as `Ma'am Sans`, now gets a valid `font-family` that reaches its fallback. It used to be emitted as `font-family: Ma'am Sans`, which mail clients drop.
