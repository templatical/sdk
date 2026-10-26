# @templatical/import-stripo

## 0.51.1

### Patch Changes

- @templatical/import-html@0.51.1
  - @templatical/types@0.51.1

## 0.51.0

### Patch Changes

- @templatical/import-html@0.51.0
  - @templatical/types@0.51.0

## 0.50.0

### Patch Changes

- Updated dependencies [61518b7]
- Updated dependencies [3af9072]
  - @templatical/types@0.50.0
  - @templatical/import-html@0.50.0

## 0.49.0

### Patch Changes

- Updated dependencies [588b367]
  - @templatical/types@0.49.0
  - @templatical/import-html@0.49.0

## 0.48.0

### Patch Changes

- f1c1955: Imported images come in at the width the source email shows them, and every importer decides `width: "full"` by one rule. A missing width, `100%`, or a px width that reaches the image's room (its column less its own side padding, and border where the importer reads one) is `"full"`; a narrower px width stays px; a percentage under `100%` becomes px of the room and is reported `approximated`, since a px width keeps its size on a phone.

  - **Unlayer** read `src.width`, the uploaded file's size, so every image imported at that size: a logo Unlayer shows at `maxWidth: "11%"` of a 700px body came in at 1600px, full width. It now reads `autoWidth` and `maxWidth`. `src.height`, the file's height, is no longer imported, so the image keeps its aspect ratio, and a missing width is `"full"` instead of 600px.
  - **BeeFree** read `image.width` and `image.height`, the file's size, so a 1920 × 466 hero shown across a 600px column imported as 600 × 466, stretched to more than three times its height, and a logo shown at 172.5px imported at 254px. It now reads `computedStyle` (`autowidth` is `"full"`, otherwise `computedStyle.width`), never imports the file's height, and takes the alignment from `computedStyle.class` when the image has no `text-align`.
  - **Easy Email Pro** ignored an image's `width`, so every sized image imported as full width.
  - **HTML** (and **Stripo**, which uses it) imported a missing or `100%` width as 600px, and let the `height` attribute win over a `height: auto` style, pinning a height the email doesn't show.
  - **MJML** turned a px width into `"full"` only when it equalled the column exactly; **Topol** and **Chamaileon** compared against the column without the image's padding.

- Updated dependencies [10ca348]
- Updated dependencies [f1c1955]
- Updated dependencies [d329c13]
- Updated dependencies [d6641bc]
  - @templatical/types@0.48.0
  - @templatical/import-html@0.48.0

## 0.47.0

### Minor Changes

- 51d5cfd: Importers bring section and wrapper background images across

  Importers used to drop a section's background image, mostly without a word in the report, so a hero banner arrived as a plain colour. Each one now maps it onto the `backgroundImage` field sections and wrapper bands already have.

  - **MJML, Topol, Easy Email Pro:** `background-url` with its size, position and repeat, on `mj-section` / `standard-section`, and on `mj-wrapper` / `standard-wrapper` / page header and footer bands as `wrapper.backgroundImage`.
  - **Unlayer:** a row's `backgroundImage`; the body's is dropped with a warning.
  - **BeeFree:** a row's `content.style` image; the `container.style` band's image while the content area is unpainted.
  - **Chamaileon:** a fullwidth's `contentBackgroundImage`, a lone box's image, and the band's while the content area is unpainted; the body's is dropped with a warning.
  - **HTML:** `background-image`, the `background` shorthand and the `background` attribute on tables and cells, nearest first; a page image is dropped with a warning. A `background` shorthand's colour is now read too, so `background: #222 url(…)` keeps its `#222`.
  - **Stripo:** structure, body, container and stripe images, nearest first. "A background image was not imported." is gone, because the image now maps or is reported specifically. An `es-wrapper` page image is dropped with a warning.

  An attribute the source leaves out takes the source's own default, so an image paints where it did. A size, position or repeat with no exact keyword maps to the nearest one, with a note: the entry is `approximated`, or, for Unlayer and BeeFree rows, which have no entry, a line in `report.warnings`. Column images move up to the section when the row has one column or every column shares the image, and are otherwise dropped with a note naming the columns. A full-width band image goes to the section only when the content area doesn't cover it. Stripo and Chamaileon drop a band colour that would paint over the section's image in Outlook desktop. An image painted behind several sections is copied onto each, and the report notes it.

  Heroes (`mj-hero`, Easy Email Pro's `standard-hero`) keep their current mapping.

### Patch Changes

- Updated dependencies [fb6c024]
- Updated dependencies [51d5cfd]
- Updated dependencies [f8018d8]
- Updated dependencies [2797f5e]
- Updated dependencies [7afcadf]
- Updated dependencies [4d0870d]
  - @templatical/types@0.47.0
  - @templatical/import-html@0.47.0

## 0.46.0

### Patch Changes

- f24888a: Imported templates keep their font fallbacks. Every importer used to cut a `font-family` stack down to its first family, so `Montserrat, Trebuchet MS, sans-serif` became `Montserrat`, and a mail client without Montserrat fell back to its own default (Times New Roman in Outlook on Windows). This included paragraph text, which the importers style with an inline span. The whole stack is now kept, with double-quoted names re-quoted in single quotes. A stack that is exactly a built-in font's own, such as `Arial, sans-serif`, is still stored as the bare name, since the renderer expands it back the same way. Easy Email Pro's page font used to be kept as written, so a value such as `inherit` became the template font; a value a browser would ignore now falls back to the default font.

  The renderer now adds `defaultFallbackFont` after a single font it doesn't know, such as `Helvetica Neue` or `Inter` without a matching custom font, in the template font and in title, button, menu and table blocks: `'Helvetica Neue', Arial, sans-serif` instead of a bare `Helvetica Neue`. A full stack is emitted as written, and built-in and custom fonts are unchanged.

  `@templatical/types` exports the font-stack helpers the renderer, editor and importers now share: `parseFontFamilies`, `normalizeFontStack`, `canonicalFontStack`, `firstFontFamily`, `quoteFontFamily`, `formatFontFamilies`, `isGenericFontFamily` and `BUILT_IN_FONT_STACKS`. The editor's font selects use them, so a quoted family containing a comma is labelled by its full name, and an invalid value such as `inherit, Arial` shows as no font.

- Updated dependencies [9d97f4d]
- Updated dependencies [c395ecf]
- Updated dependencies [f24888a]
  - @templatical/types@0.46.0
  - @templatical/import-html@0.46.0

## 0.45.0

### Patch Changes

- Updated dependencies [347c2b0]
  - @templatical/types@0.45.0
  - @templatical/import-html@0.45.0

## 0.44.3

### Patch Changes

- @templatical/import-html@0.44.3
  - @templatical/types@0.44.3

## 0.44.2

### Patch Changes

- @templatical/import-html@0.44.2
  - @templatical/types@0.44.2

## 0.44.1

### Patch Changes

- @templatical/import-html@0.44.1
  - @templatical/types@0.44.1

## 0.44.0

### Patch Changes

- Updated dependencies [841cb38]
  - @templatical/types@0.44.0
  - @templatical/import-html@0.44.0

## 0.43.3

### Patch Changes

- @templatical/import-html@0.43.3
  - @templatical/types@0.43.3

## 0.43.2

### Patch Changes

- @templatical/import-html@0.43.2
  - @templatical/types@0.43.2

## 0.43.1

### Patch Changes

- @templatical/import-html@0.43.1
  - @templatical/types@0.43.1

## 0.43.0

### Patch Changes

- be4ac17: Stripo import keeps one section per row, divider widths, page and band colours, structure padding and plugin CSS

  - **Each structure row is its own section.** Compiled HTML made one section per stripe, so a heading and a two-column row in the same cell landed in one section and copy between the columns was dropped or appended. Each direct row is now a section, in document order. Content before the columns stays before them, content after stays after them, and content that sat between them becomes a one-column section after the columns. An empty row is skipped. A padded cell split across those sections keeps the top padding on the first, the bottom on the last and the sides on each, and that split is `approximated`. Four or more floated columns in one row still fold into three.
  - **A line-drawing spacer is a divider.** `es-spacer` and `esd-block-spacer` imported as a spacer whenever they carried a height, so a `border-bottom` line became empty space. A visible `border-bottom` or `border-top` is now a divider: style, colour, thickness and width. No width, `auto` or `100%` spans the column; another percentage stays a percentage, rounded to two decimals and clamped to 0–100; a px width stays px until it fills the column's room. `double`, `groove`, `ridge`, `inset` and `outset` import as `solid`. A partial-width line aligned left or right is centred. Both are `approximated`. A spacer with no border stays a spacer.
  - **Page, band and body colours land on the surface that paints them.** `settings.backgroundColor` stayed `#ffffff`, so a Launchpad page of `#F3F4F6` imported white. The first painted `es-wrapper` or `es-wrapper-color` is now the page colour. An `es-*-body` fill is the section background. A transparent body leaves the stripe colour on the section. A stripe colour that differs from both the page and the body becomes `section.wrapper.backgroundColor`, and that section is `approximated`. A background image is reported and dropped; the colour still applies.
  - **Structure padding is the section's padding.** Sections kept the factory padding of 20 on every side. The structure cell's padding is now the section's, and the default is 0. Plugin HTML reads `es-p*` (`es-p20`, then `es-p10t` / `r` / `b` / `l`), and an inline padding overrides the sides it states.
  - **Plugin CSS reaches the blocks.** `options.css` was injected for detection and never reached the HTML walk, so a `p { color }` rule left the paragraph uncoloured. The same CSS is now applied inside each cell, with a `</style` breakout still neutralized. The report lists the blocks that remain in the content: a `<tr>` section the HTML walk invents is omitted, and Stripo's own section entries stay.

- Updated dependencies [be4ac17]
- Updated dependencies [be4ac17]
  - @templatical/types@0.43.0
  - @templatical/import-html@0.43.0

## 0.42.1

### Patch Changes

- @templatical/import-html@0.42.1
  - @templatical/types@0.42.1

## 0.42.0

### Patch Changes

- Updated dependencies [5758c24]
- Updated dependencies [cb82f7e]
  - @templatical/types@0.42.0
  - @templatical/import-html@0.42.0

## 0.41.0

### Patch Changes

- @templatical/import-html@0.41.0
  - @templatical/types@0.41.0

## 0.40.0

### Patch Changes

- Updated dependencies [b7ff7d9]
  - @templatical/types@0.40.0
  - @templatical/import-html@0.40.0

## 0.39.4

### Patch Changes

- @templatical/import-html@0.39.4
  - @templatical/types@0.39.4

## 0.39.3

### Patch Changes

- @templatical/import-html@0.39.3
  - @templatical/types@0.39.3

## 0.39.2

### Patch Changes

- @templatical/import-html@0.39.2
  - @templatical/types@0.39.2

## 0.39.1

### Patch Changes

- @templatical/import-html@0.39.1
  - @templatical/types@0.39.1

## 0.39.0

### Patch Changes

- Updated dependencies [a2b4cde]
  - @templatical/types@0.39.0
  - @templatical/import-html@0.39.0

## 0.38.0

### Patch Changes

- Updated dependencies [67cd83d]
  - @templatical/types@0.38.0
  - @templatical/import-html@0.38.0

## 0.37.0

### Patch Changes

- @templatical/import-html@0.37.0
  - @templatical/types@0.37.0

## 0.36.0

### Minor Changes

- 7b745b1: Add `@templatical/import-stripo`, a converter from Stripo plugin HTML (`getTemplateData`) and compiled File→HTML exports to Templatical template JSON. Auto-detects the surface from class attributes; pass `{ css }` for the plugin stylesheet.

### Patch Changes

- Updated dependencies [d8e38e4]
  - @templatical/types@0.36.0
  - @templatical/import-html@0.36.0
