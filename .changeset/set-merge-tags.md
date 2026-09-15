---
"@templatical/editor": minor
---

Add `editor.setMergeTags(tags)` for replacing merge tags after `init()`

The configured tag list could only be set at `init()`. Consumers whose tags are minted on demand — a picker that creates a field the moment an author chooses one — had no supported way to register the new tag, and a tag renamed after mount never repainted.

`setMergeTags(tags)` replaces the list at runtime. Everything that renders a tag reads the same source, so the canvas, the sidebar fields and the built-in picker repaint together. Available on both `init()` and `initCloud()`.

Two affordances that were captured once at setup and could go stale are now reactive: the **Insert merge tag** control appears when the list goes from empty to populated, and so does type-ahead filtering.

One limitation, stated rather than worked around: whether type-ahead autocomplete is *registered* is decided when a block opens for editing. Going from no tags to some enables it for the next block opened, not for one already being edited. Registering it unconditionally would show the suggestion popup to consumers who configured no tags at all.

Mutating the array passed to `init()` remains unsupported — it never repainted anything already on screen, and `setMergeTags` is the supported replacement.
