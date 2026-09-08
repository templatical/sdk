---
"@templatical/import-html": minor
---

Recover the copy and the column layouts that HTML import was discarding.

Measured across 24 real-world templates from seven open-source template libraries, before and after:

| | before | after |
|---|---|---|
| sections | 42 | 155 |
| multi-column sections | 2 | 39 |
| empty columns inside a multi-column section | 4 | 0 |
| source words absent from the imported template | 557 of 2012 | 0 |
| entries kept as HTML fallback | 152 of 370 | 88 of 662 |

Run against a template whose layouts are known — built from the block factories, rendered with
`@templatical/renderer`, compiled by `mjml`, then imported back — the conversion now recovers all
five of `1`, `2`, `3`, `2-1` and `1-2`, and puts every block in the slot its source section
declared. That template previously imported as a single one-column section holding five blocks, with
all ten of its headings left as raw `<h3>` markup inside paragraphs. The report called that
`5 of 5 converted` and raised no warning, which is the reason several of these were worth finding.

## Copy that was being discarded

- **Inline formatting no longer becomes its own block, and the text around it survives.** `<br>`,
  `<em>`, `<strong>` and their siblings became standalone HTML blocks, and because the cell walk
  visited only element children, the bare text between them was dropped. A cell reading
  `Hello<br>World <strong>bold</strong> tail` imported as two HTML blocks, one holding `<br>` and one
  holding `<strong>bold</strong>`, with `Hello`, `World` and `tail` gone. Consecutive inline nodes now
  fold into the surrounding rich text, so that cell becomes one paragraph carrying all of it.
- **A sentence containing a link is no longer read as a button.** A cell counted as a button whenever
  it carried padding and held a single anchor, and the conversion kept only the anchor's text,
  discarding the rest of the cell. Across four Mailchimp templates, nine of the eleven buttons
  produced were prose cells swallowed this way — labelled things like "get a little fancy"; those
  templates now produce two buttons, both of them real. A cell is a button when the anchor is its
  entire content.
- **A plain anchor keeps its `href`.** The paragraph was built from the anchor's inner HTML, so the
  `<a>` element never reached the block and the link was gone. The anchor now stays inside the
  paragraph its sentence became, target and all.
- **Bare text at body level and directly inside a layout container is kept.** Only element children
  were visited, so a loose sentence beside a table was not seen at all.
- **A text-only cell reads as text.** It became an HTML block wrapping an orphan `<td>` — markup that
  is invalid once exported, since a cell cannot stand outside a table.

## Structure that was being lost

- **Tables nested more than one container deep are reached.** The container walk descended a single
  level, so a table inside a nested `<div>` was turned into a paragraph holding raw table markup.
  This is what recovers per-section wrappers: compiled MJML nests a body wrapper around one `<div>`
  per section around each section's table.
- **A one-cell wrapper row is descended instead of becoming a section.** Table-based emails wrap
  their real layout in one-cell tables; each wrapper became a one-column section and the genuine
  multi-column row inside it was flattened away. A wrapper row that carries no background and no
  padding, and whose cell holds nothing but tables, is now descended, so the column count is read off
  the row that declares it.
- **Gutter rows are no longer read as columns.** A row placing an `&nbsp;` cell either side of the
  content, a common centring idiom, became a three-column section whose outer two columns were empty
  and whose middle column held everything. A false positive, worse than the single column a naive
  reading gives.
- **Column ratios are recovered from declared widths.** `2-1` and `1-2` were unreachable: the layout
  came from counting cells, so every two-cell row imported as an even `2`. Widths now choose between
  the layouts of that cell count, snapped to the nearest, and a ratio the model cannot express is
  reported as `approximated` with a note naming the widths.
- **A cell of sibling column `<div>`s reads as a column set.** This is how hybrid and MJML-compiled
  emails state columns, and it is the one column shape with no cell count to read — a single `<td>`
  holding one inline-block `<div>` per column. Such a row imported as a single column holding every
  column's blocks in order.
- **A heading wrapped in a container is typed as a heading.** The container was mapped instead, so
  the heading arrived as a paragraph carrying raw `<h2>` markup rather than as a `title` with a level.

## Report changes you can observe

- **Sections now appear in `report.entries`**, with `sourceTag: 'tr'`, or `'body'` for the synthetic
  section that holds loose top-level content. Only leaf blocks were reported before, so a caller
  could not reconcile the entries against `content.blocks`. Entry totals rise accordingly.
- **A lost layout is now an entry, not only a warning.** A nested row whose columns a section cannot
  hold, and a row of more cells than any layout has, each add an `approximated` entry with a note.
  Previously a flattened row produced a `warnings` string at best, and a nested row's loss was
  reported nowhere.
- **New `approximated` notes name a column ratio the model cannot express**, giving the measured
  widths and the layout used instead.
- **A text anchor no longer produces an entry of its own.** It folds into the paragraph its sentence
  became, reported `converted` under the cell's tag. The `approximated` entry noted `Inline anchor
  wrapped in a paragraph block.` now describes only an anchor whose content is not text — a linked
  image, which still becomes a paragraph of its own.
- **A wrapped heading's `sourceTag` is the heading's own tag** rather than the container's.
