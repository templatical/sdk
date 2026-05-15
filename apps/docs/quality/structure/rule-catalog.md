# Structure rule catalog

The 5 rules `lintStructure` ships. Each rule lives in `packages/quality/src/structure/rules/`; severity is user-overridable per [Options](../options).

## Tree integrity

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
| `structure.duplicate-block-id` | error | — | Two or more blocks share the same `id`. Tree traversal, undo/redo, selection, and every block-by-ID operation rely on uniqueness; a duplicate corrupts them silently. Usually a sign of a broken import or a clone path that forgot to regenerate IDs. |
| `structure.nested-section` | error | — | A section block sits inside another section's column. The renderer rejects this — sections cannot nest — so the inner section silently drops out of the MJML output. Catches importer bugs and copy-paste accidents. |

## Section layout

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
| `structure.section-column-mismatch` | error | — | The section's `columns` value implies a column count that doesn't match `children.length`. `"1"` expects 1 inner array, `"2"`/`"2-1"`/`"1-2"` expect 2, `"3"` expects 3. A mismatch means either the layout key or the children array is wrong — both yield broken render output. The editor's section toolbar rebalances `children` automatically when the layout changes; this rule catches data that bypassed the toolbar (imports, manual JSON edits, stale snapshots). |

## Content presence

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
| `structure.empty-section` | warning | yes | A section has no columns, or every column is empty. Renders as a blank table row in most clients — wasted whitespace and an occasional visible padding gap. Auto-fix removes the section. |
| `structure.empty-column` | warning | — | A multi-column section has at least one column with no blocks. Renders awkwardly (uneven gaps, collapsed columns on mobile) and almost always means the author intended fewer columns. No auto-fix because the right answer (merge into a sibling vs. drop the section vs. change the `columns` layout) depends on intent. |
