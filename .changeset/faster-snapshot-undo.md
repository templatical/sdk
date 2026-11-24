---
"@templatical/core": patch
"@templatical/editor": patch
---

Undo and redo are faster on large templates. A restore that changes a few blocks now updates them in place, so unchanged blocks keep their identity and are not re-rendered. A restore that changes more than eight blocks still replaces the content in one step.

`onChange` and autosave now receive the restored content once undo or redo settles. Before, the pause during undo/redo dropped that change. `useAutoSave` now reports a change made while paused after `resume()`, through the usual debounce, `enabled` and dirty checks. Undo settling while a version preview is open no longer resumes autosave, so the previewed version is not saved.
