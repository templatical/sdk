---
"@templatical/ai-kit": minor
---

Breaking changes:

- Editing sessions refuse a locale layer (in `addBlock`, `setContent` or `updateBlockLocale`) that sets a block's `type` or changes its `customType`, including when `setDefaultLocale` promotes the layer and `removeLocale` removes the old default in the same batch. A block's type and custom schema are the same in every language: to use another type, `deleteBlock` the block and `addBlock` one of the new type, then translate its fields in that block's layer.
- A locale layer's `set.children` may keep a `custom`, `slot`, or `wrapper` block only when the base content already has a block with the same `id` and `type`, and a `custom` block also keeps its `customType`; it cannot introduce one.
- A block in a locale layer's `set.children` keeps the type of the block with the same `id` in the content; a German child can't turn a base paragraph into a title. For a title in one language only, put a title with an `id` the base content doesn't use in that locale's `set.children`.
- A malformed locale layer is refused as invalid: a block or settings layer that isn't an object, or one whose `set` or `text` isn't an object. Send `{ set?: {…}, text?: {…} }` objects, or omit the layer.
- When the content already holds a layer breaking these rules, a batch that leaves that layer in place is refused, even if it doesn't touch that block. Delete the block that holds the layer, or replace the affected content with `setContent`. A malformed layer is refused even then, and a running session can't repair it: fix or remove the layer outside the session, then call `createEditingSession` again with the repaired content.

These rules apply to locale layers only. `setContent` can still change an existing block's base type under the same `id`, for example from paragraph to title.
