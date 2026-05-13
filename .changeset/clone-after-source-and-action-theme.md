---
"@templatical/core": patch
"@templatical/editor": patch
---

Block clone now inserts directly after the source block (in the same section column when applicable) instead of appending to the end of the canvas. Action bar now follows the editor's UI theme — appears dark in editor dark mode instead of being forced light by the canvas-wrapper override. Canvas dark-mode preview refactored: filter moved from `.tpl-canvas-wrapper` onto a sibling bg layer + per-block `.tpl-block-content` wrapper, so block chrome (action bar, indicators) is never inside the filter region — no more counter-filter flicker when toggling dark preview. Adds `findBlockLocation(blockId)` to `useEditor` (and the cloud variant) and an optional `findBlockLocation` option on `useBlockActions` to power the new "insert clone after source" behavior.
