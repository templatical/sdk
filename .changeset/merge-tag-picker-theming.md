---
"@templatical/editor": patch
---

Fix theming of the built-in merge tag picker modal. The panel carries the `tpl` token class, which re-declares every design token with light-mode defaults, so without re-establishing the theme locally the picker ignored dark mode and the consumer `theme` config overrides. The panel now sets `data-tpl-theme` and applies the resolved theme styles — matching the pattern used by the other OSS panels (rich-text toolbar, link dialog) — so its surfaces, text, borders, and primary-accent highlight follow the editor theme correctly.
