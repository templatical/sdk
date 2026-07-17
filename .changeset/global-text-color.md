---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
---

Add a document-level default text color with a full per-block cascade

`TemplateSettings` gains a required `textColor` (default `#1a1a1a`, customizable via `templateDefaults`). Every text block — Title, Paragraph, Menu, Table — inherits it unless it sets its own color, so a document text color now flows through the whole template. To enable that, the per-block `color` on Title, Menu and Table is now optional: unset means "inherit the document color", and new blocks default to unset. An explicit per-block color (or an inline text-color mark) still overrides, and links inherit via `color: inherit`.

It's exposed as a color picker in the editor's Appearance settings (next to Background color) and reflected live on the canvas; each text block's own color picker gains an unset/inherit state.

**Breaking (types):** `TemplateSettings.textColor` is now required — add it when hand-constructing settings (including content passed to `init()`), or use `createDefaultTemplateContent()` / `init({ templateDefaults: { textColor } })`, which supply it. `TitleBlock`, `MenuBlock`, and `TableBlock` now have an optional `color` (`string | undefined`) — handle the unset case if you read it (unset means the block inherits the document color).

Runtime stays backward-compatible: content lacking `textColor` still renders (falling back to the previous default), and existing templates with explicit block colors are byte-for-byte unchanged. Only newly created content shifts — paragraph body text resolves to `#1a1a1a` instead of MJML's default `#000000`, a negligible and more consistent shade. (#355)
