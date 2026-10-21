---
"@templatical/template-tools": minor
---

`edit` speaks operations vocabulary v2

`template-tools edit` applies the operations the editor, collaboration backends and Templatical Cloud share — `{"op": "updateBlock", "blockId": "…", "set": {…}}` and the rest — with the engine from `@templatical/types`, and a refusal names the operation, its code and the reason. The package re-exports `applyOperations`, `OperationError` and `getColumnCount`.

Breaking changes:

- The `{ "operation", "data" }` form is refused, with a pointer to the new one.
- `applyOperation` and `OperationResult` are removed; use `applyOperations` and catch `OperationError`.
- `updateBlockStyle` is gone: `updateBlock`'s `set` replaces `styles` whole, so send the block's full `styles` object with the property changed.
