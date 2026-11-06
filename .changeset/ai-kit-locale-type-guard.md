---
"@templatical/ai-kit": minor
---

Breaking changes:

- An editing session refuses a locale layer (in `addBlock`, `setContent` or `updateBlockLocale`) that sets `type` or `customType`. A block's type and custom schema are the same in every language, and no operation changes them: to use another type, `deleteBlock` the block and `addBlock` one of the new type, then translate its fields in that block's layer.
- A locale layer's `set.children` may not contain a block type the session forbids (`custom`, `slot`, `wrapper`). A session never adds these blocks: put them in the base content you pass to `createEditingSession`, where it keeps them unchanged, or leave them out of the localized children. A layer may not carry them at all.
- A malformed locale layer is refused as an invalid locale layer: a block or settings layer that isn't an object, or one whose `set` or `text` isn't an object. Send `{ set?: {…}, text?: {…} }` objects, or omit the layer.

Content that already breaks one of these rules when the session starts fails every batch's check:

- A layer that sets `type` or `customType`, or whose `set.children` holds a forbidden block, is refused until a batch's `setContent` replaces the content without it.
- A malformed layer is refused even then, and a running session can't repair it: fix or remove the layer outside the session, then call `createEditingSession` again with the repaired content.

After each batch the session checks the base content and every language's view for forbidden blocks and changed custom schemas, so no route through the operations can bring one in.
