---
"@templatical/editor": patch
"@templatical/core": patch
---

Fix the editor allowing a section to be dropped into another section's column (dragged from the sidebar palette) and then silently losing it on export. MJML cannot nest `mj-section` inside `mj-column`, so `renderToMjml()` / `editor.toMjml()` dropped the nested section and all of its content. Dragging a section into a column is now rejected up front, and the core `addBlock` / `moveBlock` APIs refuse to nest a section into a column, so the invalid state can no longer be created. (#292)
