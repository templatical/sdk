---
"@templatical/types": patch
"@templatical/editor": patch
"@templatical/core": patch
---

Fix `Converting circular structure to JSON` when exporting after a drag inside a section (#203)

Dragging a block within a section column could leave a Sortable expando back-ref (`HTMLDivElement.SortableXXX → instance → el → div`) reachable from the editor's live content. The public `getContent()` serialized with a naked `JSON.stringify`, so it threw on that cycle and broke export until the section was removed.

- `@templatical/types`: add the cycle-safe `safeClone()` helper (`WeakSet`-replacer JSON round-trip that drops self-referencing back-refs instead of throwing).
- `@templatical/editor`: `init().getContent()` and `initCloud().getContent()` now clone via `safeClone()`; the pre-ready fallback also defaults to an empty template instead of throwing when no content was supplied.
- `@templatical/core`: `history.cloneContent()` now reuses `safeClone()` (same behavior, deduplicated).
