---
"@templatical/types": minor
"@templatical/editor": minor
"@templatical/import-beefree": minor
"@templatical/import-unlayer": minor
"@templatical/import-html": minor
---

Remove `margin` from `BlockStyles`.

`margin` was a canvas-only style: it surfaced in the block settings panel and applied to the editor wrapper, but the renderer never read it, so it was dropped from the exported email — a WYSIWYG mismatch. Email spacing is expressed via `padding` (the renderer honors it on every block), so `margin` added a second, unreliable spacing control with no email output.

- `BlockStyles.margin` is removed from the type and from `createDefaultStyles()`.
- The Margin inputs are removed from the block settings panel, and the editor canvas no longer applies a wrapper margin.
- The BeeFree, Unlayer, and HTML importers no longer emit a `margin` field on converted blocks.

Use `padding` for block spacing. Persisted templates that still carry a `margin` key load fine — the extra field is ignored.
