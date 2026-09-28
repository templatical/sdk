---
"@templatical/import-mjml": patch
---

MJML imports keep paragraph alignment, colour and size, and divider widths

- **A paragraph keeps its `mj-text` alignment, colour and size.** `<mj-text align="center" color="#4b5563" font-size="15px">` imported left-aligned in the document's colour and size, and the same values set through `mj-class` were lost too. `align` now lands as `text-align` on each `<p>`, and `color` and `font-size` on one span inside it, the shape the paragraph editor keeps through an edit. Bare list-item text gets a `<p>` first. The `<p>`'s own values win, alignment to the start edge and a 14px size add nothing, and markup with nothing to apply is left exactly as it was. `<mjml dir>` sets `settings.direction` when it differs from the direction `lang` implies, so the start edge is the imported template's own.
- **A divider keeps its width.** Every `mj-divider` imported as `"full"`, so `50%` and `200px` were both lost while reported `converted`. A missing width or `100%` still imports as `"full"`, any other percentage stays a percentage to two decimals such as `"50%"`, and a px width stays px unless it reaches the width the line can span, where it becomes `"full"`. That width is the column less the column's and the divider's own side padding, which is how `mj-divider` draws `100%`. A width clamped into 0–100% or up to 0px, an unreadable width, and a partial-width divider aligned left or right, which Templatical centres, are reported `approximated`.
