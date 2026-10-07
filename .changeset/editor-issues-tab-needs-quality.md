---
"@templatical/editor": patch
---

The Issues tab goes away when `@templatical/quality` isn't installed: the editor removes it once the package's import fails, and switches to the Content tab if Issues was open. Without the package the tab used to stay and open onto an empty panel.
