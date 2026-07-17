---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
---

Add document-level link color and underline controls

`TemplateSettings` gains an optional `linkColor` and a required `linkUnderline` (default `true`). The renderer emits them as a single global `a { color; text-decoration }` rule. `linkColor` cascades to every link — rich-text and menu alike; unset keeps `color: inherit` (links follow the surrounding text color). `linkUnderline` underlines body (rich-text) links; buttons and menu items carry their own inline `text-decoration` and are unaffected. An inline per-link/per-item color (a Menu item's `color`, `MenuBlock.linkColor`) still overrides the color.

Both are exposed in the editor's Appearance settings — a link-color picker and an underline toggle next to the text color — and reflected live on the canvas, fixing the previous preview/export mismatch (the canvas hardcoded a blue underlined link that never shipped).

Newly created content (via `createDefaultTemplateContent()` / `init()` defaults) now underlines body links by default — the common, more accessible email default. Set `linkUnderline: false` for no underline.

**Breaking (types):** `TemplateSettings.linkUnderline` is now required — add it when hand-constructing settings, or use `createDefaultTemplateContent()` / `init({ templateDefaults })`, which supply it. `linkColor` is optional; omit it to keep links inheriting the text color.

Runtime stays backward-compatible for stored content: content lacking `linkUnderline` still renders without an underline (the renderer treats an absent value as off), so already-saved templates are unchanged. (#352)
