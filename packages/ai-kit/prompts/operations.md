---
title: Operations
description: The operation vocabulary the editor, the CLI, collaboration backends and Templatical Cloud share.
---

# Operations

An operation is one change to a template: add, move, delete or update a block, update the settings, or replace the whole content. The same six operations travel everywhere a template changes outside a single editor:

- **[Collaboration](/backend/collaboration)** — an editor with `init({ collaboration })` sends every edit to your backend as a batch of operations, and applies other people's batches.
- **The CLI** — `template-tools edit` applies them to a template file.
- **Templatical Cloud** — stores every batch with its revision, and AI agents connected to its MCP server edit with the same vocabulary through `edit_template`.

`applyOperations` from `@templatical/types` (MIT) applies them. Templatical Cloud's server runs an engine with the same rules, and a shared set of test cases keeps the two identical.

## The six operations

```json
{"op": "addBlock",       "block": {"id": "b2", "type": "paragraph", "content": "<p>Hi</p>", "styles": {"padding": {"top": 0, "right": 0, "bottom": 0, "left": 0}}}, "parent": null, "after": "b1"}
{"op": "moveBlock",      "blockId": "b2", "parent": {"sectionId": "s1", "column": 0}, "after": null}
{"op": "deleteBlock",    "blockId": "b2"}
{"op": "updateBlock",    "blockId": "b1", "set": {"content": "<p>Hello</p>"}, "unset": ["visibility"]}
{"op": "updateSettings", "set": {"width": 640}, "unset": ["preheaderText"]}
{"op": "setContent",     "content": {"blocks": [], "settings": {"width": 600, "backgroundColor": "#ffffff", "textColor": "#1a1a1a", "linkUnderline": true, "fontFamily": "Arial", "locale": "en"}}}
```

Engine acceptance of an operation does not replace schema validation: run `template-tools validate` on the resulting template.

A batch is a list of operations. It applies in order, each operation seeing the ones before it, and all or nothing: when one is refused, none of the batch applies.

### Positions

Positions name a sibling, never an index, so an operation means the same thing after someone else's change lands first.

- `parent` is `null` for the top level, or `{"sectionId": "…", "column": 0}` for a column of a section. `column` is a 0-based index into the section's `children`.
- `after` is the id of the block to land after, or `null` to land first. For `moveBlock`, the siblings are those of the target container with the moved block taken out.
- `parent` and `after` are required on `addBlock` and `moveBlock`, even when they are `null`.

### Sections and columns

- A section sits only at the top level. Adding or moving a section into a column is refused, and so is a new section with a section among its children.
- `deleteBlock` on a section deletes its blocks with it.
- `updateBlock` replaces each key in `set` whole, a `styles` object included, and removes the keys in `unset`. `id`, `type` and `children` can't be set or unset, and neither can a section's `columns` be unset.
- `set: {"columns": …}` on a section resizes its `children` to the layout's column count: `"1"` has one column, `"3"` has three, and every other layout (`"2"`, `"2-1"`, `"1-2"`) has two. Growing appends empty columns. Shrinking drops trailing columns only when they are empty, so move their blocks out first.
- A new block needs a non-empty string `id` and a string `type`, and every id in it, a new section's children included, must be new to the template.

### Preconditions

Any operation but `addBlock` and `setContent` can carry `expect`, which must hold before it applies. A mismatch refuses the operation with `precondition_failed`. Undo uses this, so an undo that someone else's edit has overtaken is refused instead of overwriting it.

- `updateBlock` and `updateSettings`: `expect` maps keys to their expected current values. `null` matches a `null` value or an absent key.
- `moveBlock`: `expect.parent` and `expect.after` are the block's current position. A key left out counts as `null`.
- `deleteBlock`: `expect.block` is the whole current block, children included, compared exactly.
- Values compare as JSON: object key order is ignored, arrays compare in order, and numbers by value, so `1` equals `1.0`. `set`, `unset` and `expect` given as `null` count as absent.

### Locks

A backend passes the locks it holds and the acting session: `applyOperations(content, ops, { locks, session })`, with `locks` as `[{ blockId, sessionId }]`.

- `updateBlock`, `moveBlock` and `deleteBlock` on a block another session holds are refused with `lock_held`. Moving or deleting a section also checks every block inside it.
- `setContent` is refused with `locked_by_others` while any other session holds a lock.
- With `session` set to `null` (a server-side change), every lock belongs to someone else.

## Errors

A refused batch throws an `OperationError` with `code` and `opIndex`, the 0-based index of the refused operation.

| Code | When | Templatical Cloud answers |
|---|---|---|
| `block_exists` | A new block's id, or an id inside it, is already in the template | 409 |
| `block_missing` | The block, or the parent section, isn't there | 409 |
| `anchor_missing` | The `after` block isn't in the target container | 409 |
| `precondition_failed` | `expect` doesn't hold | 409 |
| `lock_held` | Another session holds the block | 409 |
| `locked_by_others` | Another session holds a lock, for `setContent` | 409 |
| `invalid_operation` | The operation is malformed or can never apply | 422 |

### Which error wins

When one operation breaks several rules, the first failing check decides:

1. Its shape (`invalid_operation`): a malformed operation, a missing required key, a new section with a parent, `id`/`type`/`children` in `set` or `unset`, a section's `columns` in `unset`.
2. The blocks it names (`block_missing`, `block_exists`).
3. Locks (`lock_held`, `locked_by_others`).
4. Preconditions (`precondition_failed`).
5. Placement (`invalid_operation`): a section into a column, a block after itself.
6. The target container: `block_missing` for a missing parent section; `invalid_operation` for a parent that isn't a section or a column out of range.
7. The anchor (`anchor_missing`).
8. The change itself (`invalid_operation`): a layout that would drop columns that still hold blocks.

## Applying operations

```ts
import {
  applyOperations,
  OperationError,
  type Operation,
} from '@templatical/types';

const ops: Operation[] = [
  { op: 'updateBlock', blockId: 'b1', set: { content: '<p>Hello</p>' } },
];

try {
  const next = applyOperations(template.content, ops, {
    locks: [{ blockId: 'b4', sessionId: 'f7c1…' }],
    session: requestSessionId,
  });
  // store `next`
} catch (error) {
  if (error instanceof OperationError) {
    // error.code, error.opIndex
  }
  throw error;
}
```

`applyOperations` returns a new document and never changes the one you pass. `applyOperationsInPlace` changes it directly, for a copy you can throw away. `getColumnCount(layout)` is the layout rule above.

## In the CLI

```bash
npx -y @templatical/template-tools edit emails/welcome.json \
  --op '{"op":"updateBlock","blockId":"button_1","set":{"backgroundColor":"#1d4ed8"}}'
```

`--ops <file>` takes a JSON array for a batch. See [Template Tools](/api/template-tools).
