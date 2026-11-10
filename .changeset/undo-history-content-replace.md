---
"@templatical/core": patch
"@templatical/editor": patch
---

Fix undo history after replacing an editor document. Undo after loading another template could write the previous template's content into it on save, and undo after `setContent()` could restore part of the old document. Loading a template, creating one with new content, or calling the public `setContent()` now clears undo and redo; creating a template from the current content keeps history. In collaborative editing, reloading the same template no longer sends the loaded document as an edit or drops presence and locks, and creating a template from the current content keeps undo and redo available in the new template.
