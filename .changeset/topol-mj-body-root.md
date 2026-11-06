---
"@templatical/import-topol": patch
---

`convertTopolTemplate()` accepts designs whose sections sit under `mj-body` and converts them like `mj-container` designs, including the container's `background-color`. When a design has neither, the empty-design warning names both tags.
