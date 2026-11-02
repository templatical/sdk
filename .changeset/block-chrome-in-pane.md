---
"@templatical/editor": patch
---

The block action bar and comment-count pill stay inside the canvas pane

The canvas pane scrolls, so the action bar to the right of a selected block was clipped under the properties panel whenever the pane had less room beside the block than the bar's width plus 8px. With a 600px template, Delete was cut off below an editor width of about 1230px with `savedBlocks` configured, since its bookmark button makes the bar 30px wider, and below about 1170px without it. Opening the comments or AI panel narrows the pane by another 360px (#1052).

The bar now measures the pane. It stays 8px right of the block while it fits; otherwise it moves inside the block's right edge, below the corner badges, and stays within the pane. On a block too short for that, it stays vertically centred, to the left of the badges.

The comment-count pill follows the same rule. It stays 4px past the block's top-right corner while it fits, and otherwise joins the corner badge row, inward of the lint badge. It is now a child of `.tpl-block-badges`. Beside a short block, the action bar starts below the pill instead of covering it.
