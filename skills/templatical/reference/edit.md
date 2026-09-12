# Editing with operations

**Before:** [cli.md](cli.md)
**Consult:** [rules.md](rules.md) before adding a block
**After:** validation runs inside `edit` itself, so a rejected operation writes
nothing — see [validate.md](validate.md) for reading the failure
**Then:** `live reload` if [live.md](live.md) is running

Prefer this over re-emitting the document for any scoped change. An operation
composes with a hand-edit; a whole-document write discards it.

For a **scoped change** to a template that's already valid — recolor a button,
swap a headline, delete a block, reorder two sections — apply an operation
instead of regenerating and rewriting the whole document:

```
npx -y @templatical/template-tools@0.36.0 edit .templatical/<name>.json --op '{"operation":"updateBlock","data":{"blockId":"button_1","updates":{"backgroundColor":"#1d4ed8"}}}' --json
```

`edit` applies the operation, validates the result, and writes the file — all
in one step, and nothing is written if the result isn't structurally valid.
The vocabulary: `addBlock`, `updateBlock`, `updateBlockStyle`,
`deleteBlock`, `moveBlock`, `updateSettings`, and `setContent` (a full
replacement — the operation-shaped equivalent of a rewrite, not a scoped
change). **Use `updateBlockStyle` for a block's `styles`** — it merges, so
setting one property doesn't drop `padding`; `updateBlock`'s `updates`
replaces whichever top-level keys you pass, `styles` included, so passing
`styles` there clobbers the rest of it. Batch several operations with `--ops
<file>` (a JSON array of the same objects) instead of one `--op` per call —
the batch is all-or-nothing.

**Prefer an operation over a whole-document rewrite whenever the change is
scoped.** It matters most once [live mode](live.md) is running: a
whole-document write discards whatever the user just hand-edited in the
browser, even for a one-word change, while an operation composes on top of
it — which is also what keeps the live-update loop's divergence check from
firing on edits that were never actually in conflict. Reach for a full
rewrite only for a genuine rebuild — a new layout, a different brief,
starting over.
