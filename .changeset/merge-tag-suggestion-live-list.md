---
"@templatical/editor": patch
---

Merge-tag type-ahead now follows `editor.setMergeTags()` in a paragraph or title that is already open. The suggestion list was read once when the block opened for editing, so typing `{{` kept offering the previous tags — including ones you had just removed — until the block was closed and reopened.
