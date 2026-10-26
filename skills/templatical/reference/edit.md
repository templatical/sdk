# Editing with operations

**Before:** [cli.md](cli.md)
**Consult:** [rules.md](rules.md) before adding a block · [blocks.md](blocks.md)
for field-level shape · [brand.md](brand.md) when restyling
**After:** validation runs inside `edit` itself, so a refused operation writes
nothing — see [validate.md](validate.md) for reading the failure
**Then:** `live reload` if [live.md](live.md) is running

Prefer this over re-emitting the document for any scoped change. An operation
composes with a hand-edit; a whole-document write discards it. A shell around
the email (view-in-browser, imprint, a card) is not an edit of the template —
[rules.md](rules.md) says what to hand back instead.

For a **scoped change** to a template that's already valid — recolor a button,
swap a headline, delete a block, reorder two sections — apply an operation
instead of regenerating and rewriting the whole document:

```
npx -y @templatical/template-tools@0.51.1 edit .templatical/<name>.json --op '{"op":"updateBlock","blockId":"button_1","set":{"backgroundColor":"#1d4ed8"}}' --json
```

`edit` applies the operation, validates the result, and writes the file — all
in one step, and nothing is written if the result isn't structurally valid.
The vocabulary is the one the editor, collaboration backends and Templatical
Cloud share:

| Operation | Shape |
|---|---|
| `addBlock` | `{"op":"addBlock","block":{…},"parent":null,"after":"<sibling id>"}` |
| `moveBlock` | `{"op":"moveBlock","blockId":"…","parent":null,"after":null}` |
| `deleteBlock` | `{"op":"deleteBlock","blockId":"…"}` (a section goes with its blocks) |
| `updateBlock` | `{"op":"updateBlock","blockId":"…","set":{…},"unset":["…"]}` |
| `updateSettings` | `{"op":"updateSettings","set":{…},"unset":["…"]}` |
| `setContent` | `{"op":"setContent","content":{…}}` — a full replacement, not a scoped change |

An agent connected to a template through Templatical Cloud's hosted MCP server
edits with this same vocabulary through the server's `edit_template` tool, so
the shapes and rules here hold there too.

Positions name a sibling, never an index: `parent` is `null` for the top level
or `{"sectionId":"…","column":0}` for a section column, and `after` is the id
of the block to land after, or `null` for first. A section sits only at the
top level. **`set` replaces each named key whole, `styles` included**: to
change one style property, read the block's `styles` from the file and send
the whole object with that property changed, or `padding` and the rest are
dropped. `id`, `type` and `children` can't be set; a section's layout changes
with `"set":{"columns":"1"}`, which only drops columns that are already empty,
so move their blocks out first. Batch several operations with `--ops <file>` (a
JSON array of the same objects) instead of one `--op` per call — the batch
applies in order and all or nothing, and a refusal names the operation and why
(`Operation 2 (updateBlock) was refused: block_missing — …`).

**Prefer an operation over a whole-document rewrite whenever the change is
scoped.** It matters most once [live mode](live.md) is running: a
whole-document write discards whatever the user just hand-edited in the
browser, even for a one-word change, while an operation composes on top of
it — which is also what keeps the live-update loop's divergence check from
firing on edits that were never actually in conflict. Reach for a full
rewrite only for a genuine rebuild — a new layout, a different brief,
starting over.
