---
"@templatical/import-html": patch
---

HTML import keeps divider widths, section backgrounds, cell padding, paragraph alignment and link underlines

- **Dividers keep their width.** Every `<hr>` imported as a 100px line. An `<hr>` with no width, `auto` or `100%` now spans the column, any other percentage stays a share of the column (rounded to two decimals, clamped to 0–100%), and a px width stays px unless it reaches the room the line has in its column, measured from `settings.width`, the column's share and the padding around the line. A clamped or unreadable width, and a partial-width divider aligned left or right, are reported as `approximated`.
- **Sections keep their background colour.** Only a `<tr>` style was read, so a `bgcolor` attribute and the fill of a cell or a table were dropped, including the section colours of HTML compiled from Templatical's own MJML. A section now takes the nearest fill: the `<tr>`, then the row's cells when they share one, then the tables around it, including those of the wrapper rows the importer descends through. A row whose cells render on different fills is reported as `approximated`, and a button cell's `bgcolor` colours its button rather than the section.
- **Cell padding reaches every block in the cell.** Only bare text took a cell's padding, so a padded cell holding a heading, an image, a divider or a button imported them flush against its edges. The padding is now added to the blocks the cell holds: the sides to every block, the top to the first and the bottom to the last. A table's `cellpadding` is honoured, nested cells and wrappers add up, and a spacer at a cell's edge takes that side's padding as height.
- **A paragraph keeps its own alignment.** A wrapper's `text-align` overrode the `text-align` of a `<p>` inside it. The paragraph's own alignment now wins.
- **Links are underlined unless the source says otherwise.** `settings.linkUnderline` was always `false`. It is now `true`, the browser default, unless a `<style>` rule for every link, `a { text-decoration: … }`, sets it.
