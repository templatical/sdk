---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
---

Add document-level link color and underline controls

`TemplateSettings` gains an optional `linkColor` and a required `linkUnderline` (default `false`). The renderer emits them as a single global `a { color; text-decoration }` rule, so they cascade to every link — rich-text and menu alike. An unset `linkColor` keeps `color: inherit` (links follow the surrounding text color, as before); a set color applies document-wide. An inline per-link/per-item color (a Menu item's `color`, `MenuBlock.linkColor`) still overrides.

Both are exposed in the editor's Appearance settings — a link-color picker and an underline toggle next to the text color — and reflected live on the canvas, fixing the previous preview/export mismatch (the canvas hardcoded a blue underlined link that never shipped).

**Breaking (types):** `TemplateSettings.linkUnderline` is now required — add it (`linkUnderline: false` preserves current rendering) when hand-constructing settings, or use `createDefaultTemplateContent()` / `init({ templateDefaults })`, which supply it. `linkColor` is optional; omit it to keep links inheriting the text color.

Runtime stays backward-compatible: content lacking `linkColor`/`linkUnderline` renders exactly as before (links inherit the text color, no underline). (#352)
