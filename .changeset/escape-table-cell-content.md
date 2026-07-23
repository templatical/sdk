---
"@templatical/renderer": patch
"@templatical/import-beefree": patch
---

Escape table cell content when rendering, and strip HTML from imported BeeFree table cells.

`@templatical/renderer` now HTML-escapes table cell content in `renderCell`, matching the menu and button renderers and the editor, which treats cells as a plain-text field. Previously a cell like `<b>x</b>` was emitted raw — it showed as literal characters in the editor but rendered as bold HTML in the sent email, and arbitrary user HTML was injected into the output. Merge tags are still resolved before escaping, so `{{tag}}` placeholders survive intact.

`@templatical/import-beefree` now reduces HTML inside imported table cells to plain text (via the same `stripTagsPlain` used for button labels), since Templatical table cells are plain text. When a strip actually removes markup — for example a cell link, whose URL is lost — the module is reported as `approximated` with a warning, so the lossy conversion surfaces in the import report instead of happening silently. Plain-text tables are unaffected and still report as `converted`.
