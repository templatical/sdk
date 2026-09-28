---
"@templatical/import-unlayer": patch
---

Unlayer imports keep divider widths, section colours and document settings

- **A divider keeps its width.** `100%` imported as a 100px line. A missing width or `100%` now imports as `"full"`, any other percentage stays a percentage such as `"50%"` (clamped to 0–100%), and a px width stays px until it spans its column less the divider's side padding, where it becomes `"full"`. Templatical centres every divider, so a partial-width divider that Unlayer aligns left or right is reported `approximated`.
- **A section takes the row's content colour.** Sections read `columnsBackgroundColor`, the colour Unlayer fills the content width with, and fall back to the row's `backgroundColor`. They read only `backgroundColor` before, which is the band outside the content width. When a row sets both to different colours, `report.warnings` names the dropped one.
- **The preheader, text colour and link style carry over.** `preheaderText`, `textColor`, `linkStyle.linkColor` and `linkStyle.linkUnderline` map to their `settings` fields. Headings and menus with no colour of their own follow the imported text colour instead of a fixed `#1a1a1a`, and a paragraph keeps a colour span that differs from it. Links are underlined when `linkStyle` does not say, as in Unlayer; every import turned the underline off before. `UnlayerTemplate` types the `linkStyle` flags as booleans.
