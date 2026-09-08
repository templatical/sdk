---
"@templatical/import-html": minor
---

Preserve the text and the multi-column rows that HTML import was discarding.

Measured across four real Mailchimp templates, before and after:

| | before | after |
|---|---|---|
| HTML-fallback entries | 29 of 91 | 3 of 154 |
| sections per template | 1 | 7, 7, 6 and 34 |
| multi-cell rows kept as multi-column sections | 0 of 7 | 7 of 7 |
| buttons produced | 11, nine of them prose cells | 2 |
| body copy reaching the template | text beside inline markup dropped | all of it |

Five fixes, in the order they compound:

- **Inline formatting no longer becomes its own block, and the text around it survives.** `<br>`,
  `<em>`, `<strong>` and their siblings became standalone HTML blocks, and — because cell walking
  visited only element children — the bare text between them was dropped entirely. A cell reading
  `Hello<br>World` imported as one HTML block containing `<br>` and nothing else, with both words
  gone. Consecutive inline nodes now fold into the surrounding rich text. Those single elements were
  26 of the 29 HTML-fallback entries, `<br>` alone accounting for 24.
- **A sentence containing a link is no longer read as a button.** A cell counted as a button whenever
  it carried any padding and held a single anchor, and the conversion then kept only the anchor's
  text — discarding the rest of the cell. Nine of the eleven buttons produced from the corpus were
  prose cells swallowed this way, labelled things like "get a little fancy". A cell is now a button
  only when the anchor is its entire content.
- **Tables nested more than one container deep are reached.** The container walk descended a single
  level, so a table inside a nested `<div>` was turned into a paragraph holding raw table markup.
  This is what recovers per-section wrappers: MJML-compiled HTML nests a body wrapper around one
  `<div>` per section around each section's table, and its five sections imported as one.
- **A one-cell wrapper row is no longer mistaken for a single-column layout.** Table-based emails
  wrap their real layout in one-cell tables; each wrapper became a one-column section and the
  genuine multi-column row inside it was flattened away. A wrapper row that carries no background
  and no padding, and whose cell holds nothing but tables, is now descended, so the column count is
  read off the row that declares it. Every multi-cell row in the corpus — three two-cell rows in one
  template, two more plus a three-cell row in another, one in a third — now becomes a section with
  that many columns.
- **`report.entries` accounts for the sections it creates.** Only leaf blocks were reported, so a
  caller could not tell how many sections were produced or whether a layout was approximated.
  Sections now appear, which is why the entry total rises from 91 to 154 on the same four templates,
  with `approximated` and a note whenever a layout could not be kept — a row of more than three
  cells merged into one column, or a nested row whose columns a section cannot hold.

Columns expressed as `<div class="mj-column-per-*">` inside a single cell, which is how MJML compiles
them, still import as one column. Cell counts are what the layout is read from, and that markup
declares none.
