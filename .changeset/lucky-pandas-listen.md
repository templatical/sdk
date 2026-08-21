---
"@templatical/editor": patch
---

Clicking a block in the sidebar palette now inserts it directly below the selected block, and scrolls it into view

Previously a palette click always appended to the end of the template. On anything longer than a screen the new block landed below the fold and the canvas never moved, so the click read as though it had failed (#568).

Insertion now follows the selection, the same rule `duplicateBlock` already used:

- A top-level selection gets the new block immediately after it.
- A selection nested in a section column gets it in that same column, right after it.
- Adding a **section** while a nested block is selected places it beside the parent section at the top level — MJML forbids `mj-section` inside `mj-column`, so the column would have rejected it outright.
- No selection, an unresolvable selection, or a section locked by a collaborator still appends at the end.

Separately, the inserted block is now scrolled into view (`block: "nearest"`, so an already-visible block doesn't jump, and instantly under `prefers-reduced-motion`). This covers the append-at-the-end case too, where the position is correct but the canvas still needs to follow. The Issues panel's **Jump to block** button gained the same scroll — it selected the block without moving the canvas, so on a long template it also appeared to do nothing.

Click-to-insert is unchanged as an affordance; it remains the only keyboard-reachable way to add a block (Enter/Space on a focused palette entry), which is why it was not replaced with a drag-only flow.
