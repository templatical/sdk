---
"@templatical/types": patch
"@templatical/editor": patch
---

`safeClone` drops only a reference back to an ancestor, so an object reached by two paths is copied into both places. It dropped the second visit before, which lost data from `editor.getContent()` and undo snapshots whenever two blocks shared an object, such as two custom blocks of a type whose repeatable field has a `default`.
