---
"@templatical/editor": patch
---

Palette clicks insert the block you asked for

- **A drag from the palette onto the canvas inserts one block.** A small pointer movement started a drag and then also fired the palette button's click, so a second copy landed beside the one you dropped.
- **A click that slips a few pixels on the palette inserts on the next press.** Releasing still on the same button collapsed the rail under the pointer and swallowed the following click. The rail stays open, and that next click inserts the block. A drag that ends on the canvas still collapses the rail.
