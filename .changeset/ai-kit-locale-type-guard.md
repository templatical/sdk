---
"@templatical/ai-kit": minor
---

Breaking changes:

- An editing session refuses a locale layer (in `addBlock`, `setContent` or `updateBlockLocale`) that sets `type` or `customType`. A block's type and custom schema are the same in every language, and no operation changes them: to use another type, `deleteBlock` the block and `addBlock` one of the new type, then translate its fields in that block's layer.
- A locale layer's `set.children` may not contain a block type the session forbids (`custom`, `slot`, `wrapper`). Add those blocks to the base content instead, or leave them out of the localized children.
- A malformed locale layer is refused as an invalid locale layer: a block or settings layer that isn't an object, or one whose `set` or `text` isn't an object. Send `{ set?: {…}, text?: {…} }` objects, or omit the layer.

After each batch the session checks the base content and every language's view for forbidden blocks and changed custom schemas, so no route through the operations can bring one in.
