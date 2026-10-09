# @templatical/import-stripo

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
