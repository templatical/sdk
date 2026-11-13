---
"@templatical/import-topol": patch
---

The Topol importer no longer stores a 0px button label when an `mj-button`'s `font-size` can't be read.

A `font-size` is read as a px length or a bare number and rounded to whole pixels. One it can't read, or one that rounds to 0 or below (`1.2em`, `120%`, `large`, `0`, `0.4px`, `-4px`), now imports at the factory 15px, and the button entry is `approximated` with the note `Button font-size "X" could not be read; imported at 15px.` A px `line-height` beside it is measured against those 15px, so `font-size: 1.2em` with `line-height: 30px` is `2`; before, that line height was reported as unreadable and imported at 1.2.
