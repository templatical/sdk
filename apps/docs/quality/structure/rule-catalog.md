---
description: All 7 lintStructure rules — duplicate block IDs, nested sections, section-column mismatches, empty sections or columns, and background images Outlook can't layer — with severities and fixes.
---

# Structure rule catalog

The 7 rules `lintStructure` ships. Each rule lives in `packages/quality/src/structure/rules/`; severity is user-overridable per [Options](../options).

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

## Email client compatibility

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
| `structure.wrapper-color-over-background-image` | warning | — | A section has a background image, and its wrapper (its own `wrapper`, or the layout band it sits in when the linted tree includes the layout) has a background color. Outlook for Windows paints the wrapper color over the section's image, so the image disappears there. Every other client layers them correctly. Remove the wrapper color, or move the image to the wrapper. |
| `structure.nested-background-image` | warning | — | A section and its wrapper both have a background image. Outlook for Windows can't nest the two VML fills MJML generates for them, and the layout breaks. Keep the image on one of them. |
