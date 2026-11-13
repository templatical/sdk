---
"@templatical/import-unlayer": minor
"@templatical/import-html": minor
"@templatical/import-stripo": minor
"@templatical/import-topol": minor
"@templatical/import-chamaileon": minor
"@templatical/import-easy-email-pro": minor
---

The Unlayer, HTML, Stripo, Topol, Chamaileon and Easy Email Pro importers keep a row's column ratio, and the Unlayer and Easy Email Pro importers keep a percentage button width.

A two- to four-column ratio that matches no layout preset becomes the even layout of that count plus `SectionBlock.columnWidths`, instead of the nearest preset. A ratio that matches a preset stays that preset with no `columnWidths`.

- **Unlayer:** `cells` are relative weights. `[7, 3]` is `"2"` with `[70, 30]`, and `[6, 2, 2, 2]` keeps `[50, 16.67, 16.67, 16.66]` instead of becoming four equal columns with a warning. A button with `size.autoWidth: false` keeps `size.width`: `"40%"` stays `"40%"` and `"100%"` is `"full"`. Such a button used to fit its label.
- **HTML:** declared cell widths snap to a preset within 2 percentage points, down from 6. Any other ratio keeps its shares as `columnWidths`, and the section entry is `converted` instead of `approximated`.
- **Stripo:** unequal px column widths become a preset (`200px` / `400px` is `"1-2"`) or `columnWidths` (`180px` / `420px` is `"2"` with `[30, 70]`), `converted`. They used to become equal columns, `approximated`.
- **Topol and Easy Email Pro:** MJML's column rules apply. A column with no `width` takes the parent width divided by the column count, not the space the stated widths leave, and a px width is a share of the section's inner box. Widths within 2 percentage points of a preset keep it, `converted`. Widths that fit no preset are scaled to 100; when they differ from 100% by more than 0.5 percentage points the section is `approximated` (`30%` / `40%`), and otherwise it stays `converted` (`40%` / `60.25%`). Easy Email Pro's `standard-button` keeps a percentage `width` such as `"40%"`, which used to be dropped.
- **Chamaileon:** a column's share is its px width over the row's total, not over `bodyWidth`, so content padding and spacers no longer make an even row `approximated`. An unset column width counts as Chamaileon's default `300px`.

Not a breaking change: no export, option or default is removed, renamed or changed. The importers map more of the source into fields that already exist, as #1201 did for the BeeFree and MJML importers.
