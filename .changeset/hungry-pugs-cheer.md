---
"@templatical/core": patch
---

Fix `onChange` never firing for the first content change after the dirty flag resets (#522).

Auto-save's watcher runs synchronously inside the mutation, before the editor sets `state.isDirty = true` — and `isDirty` sits outside the watched `content` subtree, so setting it never re-triggers the watcher. The dirty check in the watcher therefore observed the pre-mutation flag and dropped the change entirely; a second edit was needed before `onChange` fired at all. Dirtiness is now decided at debounce time, where the flag is settled.

Affects both editors. In `init()` this swallowed the first edit of the session; in `initCloud()` it recurred, since `create` / `load` / `save` each reset `isDirty` — so the first edit after every save skipped its auto-snapshot.
