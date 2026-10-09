---
"@templatical/editor": minor
"@templatical/types": patch
---

Add `editor.insertBlock(block)` for inserting a block from outside the editor

A host app with its own library of ready-made content could drag into the canvas through the `blocks` Sortable group, but had no way to make a click insert. The only route was splicing the block into `getContent()` and writing the whole document back with `setContent()`, re-implementing the palette's placement rules without access to the selection.

`insertBlock(block)` places the block where a palette click would: below the selected block, inside its column when the selection is in a section, beside the parent section when a section is inserted from inside a column, and at the end when nothing usable is selected. The new block is selected and scrolled into view, so repeated calls stack in order. The palette and the method share one implementation, so they cannot place a block differently.

The editor inserts a copy with fresh ids and converts bare merge tags the way `setContent()` does. It returns the copy's id, or `null` before mount, in preview mode, or when the block cannot be placed. A slot or wrapper block throws, as it does in `setContent()`. Available on both `init()` and `initCloud()`.

`cloneBlock()` now gives table rows and cells, menu items and social icons new ids too, as duplicating a block in the editor already did. Duplicate, saved blocks and `insertBlock()` all copy through it.
