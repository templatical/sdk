---
"@templatical/editor": patch
---

A top-level block dragged into a section column that already holds blocks now lands where it's dropped. It used to land at the top of the column whatever the drop position, because the column's drop index was counted with a selector only the canvas's own items match. Drops into an empty column, between columns and sections, out to the canvas and within the canvas are unchanged.
