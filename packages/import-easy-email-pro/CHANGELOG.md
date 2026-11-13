# @templatical/import-easy-email-pro

## 0.60.0

### Minor Changes

- aa415e0: The Unlayer, HTML, Stripo, Topol, Chamaileon and Easy Email Pro importers carry a button's line height as `ButtonBlock.lineHeight`.

  The value is a multiple of the label's font size: a percentage is that number over 100 (`150%` is `1.5`), a unitless number or an `em` length is itself, and a px length is that many pixels over the button's font size. It is rounded to two decimals. A value that comes to 1.2, `normal`, and a missing value stay unset, which renders 1.2. A value that can't be read imports at 1.2 and the button entry is `approximated` with a note naming it.

  - **Unlayer:** `values.lineHeight`; Unlayer's `120%` default stays unset.
  - **HTML:** the button's `line-height` style, from the `<a>` or, for a button cell, the cell and the `<a>`. A percentage or `em` line height on the cell is resolved against the cell's font size, as CSS inherits it, and `inherit` on the `<a>` takes the cell's. A bulletproof `font-size:16px; line-height:44px` anchor is `2.75`.
  - **Stripo:** the inline `line-height` on `a.es-button`, else on its `es-button-border`.
  - **Topol:** `mj-button` `line-height`, else the `mj-button` or `button:` default.
  - **Chamaileon:** `style.lineHeight` in px over `style.fontSize`; the `25px` / `18px` default is `1.39`.
  - **Easy Email Pro:** `standard-button` `line-height`. An unreadable percentage `width` is now noted.

  Not a breaking change: no export, option or default is removed, renamed or changed. The importers map more of the source into fields that already exist, as #1201 did for the BeeFree and MJML importers.

- aa415e0: The Unlayer, HTML, Stripo, Topol, Chamaileon and Easy Email Pro importers keep a row's column ratio, and the Unlayer and Easy Email Pro importers keep a percentage button width.

  A two- to four-column ratio that matches no layout preset becomes the even layout of that count plus `SectionBlock.columnWidths`, instead of the nearest preset. A ratio that matches a preset stays that preset with no `columnWidths`.

  - **Unlayer:** `cells` are relative weights. `[7, 3]` is `"2"` with `[70, 30]`, and `[6, 2, 2, 2]` keeps `[50, 16.67, 16.67, 16.66]` instead of becoming four equal columns with a warning. A button with `size.autoWidth: false` keeps `size.width`: `"40%"` stays `"40%"` and `"100%"` is `"full"`. Such a button used to fit its label.
  - **HTML:** declared cell widths snap to a preset within 2 percentage points, down from 6. Any other ratio keeps its shares as `columnWidths`, and the section entry is `converted` instead of `approximated`.
  - **Stripo:** unequal px column widths become a preset (`200px` / `400px` is `"1-2"`) or `columnWidths` (`180px` / `420px` is `"2"` with `[30, 70]`), `converted`. They used to become equal columns, `approximated`.
  - **Topol and Easy Email Pro:** MJML's column rules apply. A column with no `width` takes the parent width divided by the column count, not the space the stated widths leave, and a px width is a share of the section's inner box. Widths within 2 percentage points of a preset keep it, `converted`. Widths that fit no preset are scaled to 100; when they differ from 100% by more than 0.5 percentage points the section is `approximated` (`30%` / `40%`), and otherwise it stays `converted` (`40%` / `60.25%`). Easy Email Pro's `standard-button` keeps a percentage `width` such as `"40%"`, which used to be dropped.
  - **Chamaileon:** a column's share is its px width over the row's total, not over `bodyWidth`, so content padding and spacers no longer make an even row `approximated`. An unset column width counts as Chamaileon's default `300px`.

  Not a breaking change: no export, option or default is removed, renamed or changed. The importers map more of the source into fields that already exist, as #1201 did for the BeeFree and MJML importers.

- 5fbcf4e: The Stripo and Easy Email Pro importers carry a button's font size as `ButtonBlock.fontSize`, so an imported button no longer renders at the factory 15px.

  - **Stripo:** the inline `font-size` on `a.es-button`, else on its `es-button-border`.
  - **Easy Email Pro:** `standard-button` `font-size`, through the attribute cascade (the button, then `blockAttributes`, `categoryAttributes` and `globalAttributes`).

  A px length or a bare number is read and rounded to whole pixels. A missing value leaves the factory 15px. Any other value, or one that rounds to 0 or below, also imports at 15px, and the button entry is `approximated` with the note `Button font-size "X" could not be read; imported at 15px.`

  A px line height is now measured against the imported font size, as in the other importers, so `font-size: 18px` with `line-height: 27px` is `1.5`. A percentage, `em` or unitless line height beside the button's own font size keeps its ratio, so `font-size: 30px` with `line-height: 200%` is `2`.

  Not a breaking change: no export, option or default is removed, renamed or changed.

### Patch Changes

- aa415e0: The Unlayer, Topol, Chamaileon and Stripo importers measure a column's room against the section's inner box. Unlayer, Topol and Chamaileon used the whole email width; Stripo took the column's share of the body width and then removed the padding from the edge columns. The room is the width an image, divider or video is compared with before it becomes `"full"`. It is now the column's share of the inner box, which is the width less the section's side padding: Unlayer row `padding`, Topol `mj-section` padding, Chamaileon fullwidth content padding, Stripo structure padding. In a 600px Topol section with 50px side padding, a lone column's room is 500px, so a 500px image is `"full"` and a 499px one stays px.

  In Topol and Easy Email Pro, a section whose side padding leaves no inner box drops its px column widths. That section is now `approximated` with a note naming the widths. It was reported `converted`.

  Not a breaking change: no export, option or default is removed, renamed or changed. The importers measure the source's columns the way the renderer draws them, and report a lossy row as lossy.

- Updated dependencies [6f5fbb7]
- Updated dependencies [6f5fbb7]
- Updated dependencies [6f5fbb7]
  - @templatical/types@0.60.0

## 0.59.2

### Patch Changes

- Updated dependencies [0a6f8eb]
  - @templatical/types@0.59.2

## 0.59.1

### Patch Changes

- Updated dependencies [f1ef192]
  - @templatical/types@0.59.1

## 0.59.0

### Patch Changes

- Updated dependencies [4c545b1]
  - @templatical/types@0.59.0

## 0.58.0

### Patch Changes

- @templatical/types@0.58.0

## 0.57.2

### Patch Changes

- Updated dependencies [27eb4be]
  - @templatical/types@0.57.2

## 0.57.1

### Patch Changes

- 36bc74f: cloneBlock serializes a block tree once and remints IDs throughout the copy.
  MJML table inference imports only rows owned by the outer table and keeps nested table markup inside its cell.
  HTML layout table classification stops at the first content tag or cell with an element child.
  Topol unsupported nodes are preserved as compact JSON.
  Topol social imports each platform and URL pair once and notes how many repeats it dropped.
  Chamaileon report notes quote at most 80 characters of document expressions and values, adding an ellipsis when truncated.
  Easy Email Pro report notes quote at most 80 characters of document attribute values, adding an ellipsis when truncated.
  Easy Email Pro makes a `$var()` replacement only while the attribute stays within 65,536 characters; a reference that would exceed that stays verbatim and counts as unresolved, and literal text is never cut.
  BeeFree keeps a text or social-icon `font-weight` only when it is `normal`, `bold`, `bolder`, `lighter`, a CSS-wide keyword or a number from 1 to 1000, and drops a text `font-family` stack over 256 characters with an approximated note.
- Updated dependencies [36bc74f]
- Updated dependencies [c05e2a8]
  - @templatical/types@0.57.1

## 0.57.0

### Patch Changes

- 418a249: `link.localhost-or-staging` matches `links.nonProductionHosts` globs in linear time, so a very long URL host no longer stalls the linter, and compatibility rules group CSS declarations and clients without copying arrays. The Easy Email Pro importer decodes HTML entities by looking at most six characters ahead of each `&`.
- Updated dependencies [ad58b8e]
- Updated dependencies [0bdfeac]
- Updated dependencies [0511bb6]
- Updated dependencies [a2f3ed8]
  - @templatical/types@0.57.0

## 0.56.1

### Patch Changes

- @templatical/types@0.56.1

## 0.56.0

### Minor Changes

- 2466654: Breaking changes:

  - Imported sections can now have `columns: "4"`, `"1-3"`, `"3-1"` or `"1-2-1"`. A four-cell row from HTML, Unlayer or Stripo that used to flatten into one column now keeps four columns. Callers that read `section.columns` or count `children` must handle these values and four child arrays.
  - The over-limit warning now says Templatical supports up to four columns, and folding importers fold rows of five or more columns onto `"4"` instead of `"3"`. Callers that match the old warning text or expect three columns after a fold must update.

  Importers map source rows onto the four new section layouts. Four equal columns become `"4"`, 25/75 becomes `"1-3"`, 75/25 becomes `"3-1"`, and 25/50/25 becomes `"1-2-1"`. A ratio that is not exact snaps to the nearest of the nine layouts and keeps that importer's existing note. Stripo rows keep the equal layout for their column count. Unequal px widths, on a plugin frame or a compiled column, are reported approximated, and a column with no readable width is named in that note when the readable widths differ. Rows with more than four columns still flatten or fold into the last column, and the warning says Templatical supports up to four columns.

- f9de817: Breaking changes:

  - An imported full-width section whose only background is the source band now carries that colour and image on `section.wrapper` (`backgroundColor`, `backgroundImage`, with `fullWidth: true`) instead of `section.styles.backgroundColor` and `section.backgroundImage`. Code that reads an imported section's background must also read `section.wrapper`.
  - When an imported section keeps its own background image, the Chamaileon, Stripo, HTML and Unlayer importers no longer apply the source band colour, because Outlook desktop paints a wrapper colour over that image. There is no replacement colour. Chamaileon, Stripo and HTML report the section `approximated` with a note; Unlayer names the dropped colour in `report.warnings`. The BeeFree importer keeps a distinct container colour on the wrapper, and Topol, MJML and Easy Email Pro move the colour together with the image.

  Importers map a source full-width background band onto `section.wrapper` with `fullWidth: true`, so the colour and image run to the window edge and the content stays at the email width.

  BeeFree row container backgrounds, Unlayer row backgrounds (`backgroundImage.fullWidth` not `false`), Chamaileon `fullwidth` bands, Topol and MJML and Easy Email Pro `full-width="full-width"`, Stripo stripes around an inner body, and an HTML 100% table wrapped around a fixed-width table all set that flag. A full-width section whose only background is the band moves that background onto the wrapper and leaves the section background unset. Content-area backgrounds stay on the section. When the section keeps its own background image, the band colour is left off the wrapper and the import notes it, because Outlook desktop paints a wrapper colour over that image; the band image still goes on the wrapper. A Stripo stripe with no inner body keeps its colour on the section.

### Patch Changes

- Updated dependencies [5744da5]
- Updated dependencies [f9de817]
- Updated dependencies [2466654]
- Updated dependencies [be84dd0]
  - @templatical/types@0.56.0

## 0.55.0

### Patch Changes

- Updated dependencies [200ab00]
- Updated dependencies [9151730]
- Updated dependencies [e784e63]
  - @templatical/types@0.55.0

## 0.54.2

### Patch Changes

- Updated dependencies [a72fbd8]
  - @templatical/types@0.54.2

## 0.54.1

### Patch Changes

- @templatical/types@0.54.1

## 0.54.0

### Patch Changes

- @templatical/types@0.54.0

## 0.53.0

### Minor Changes

- cef9348: Importers keep the source's languages

  - Every importer takes `defaultLocale?: string` and sets `settings.locale` from the language the source declares (`<html lang>`, `<mjml lang>`, Beefree's `language.value`, Topol's primary `langs` entry), else from `defaultLocale`, else `"en"`. Unlayer JSON declares no default language, so pass `defaultLocale`.
  - Beefree module `translations`, Unlayer `values._languages` and Topol `translations` become language versions.
  - Each language or key an importer drops, and each subject, title or description left to the host, gets a `report.warnings` entry.
  - Unlayer converts Lexical `textJson` and `paragraph` content to paragraph blocks instead of the HTML fallback.

  The mappings follow the vendors' documented JSON, checked 2026-10-28; real multilingual exports weren't available to test against. Check an import with `template-tools validate imported.json --locale <tag>`, and see the [Beefree](https://docs.templatical.com/guide/migration-from-beefree#languages), [Unlayer](https://docs.templatical.com/guide/migration-from-unlayer#languages) and [Topol](https://docs.templatical.com/guide/migration-from-topol#languages) guides.

### Patch Changes

- Updated dependencies [cef9348]
  - @templatical/types@0.53.0

## 0.52.1

### Patch Changes

- Updated dependencies [2da7d6a]
  - @templatical/types@0.52.1

## 0.52.0

### Patch Changes

- Updated dependencies [9881028]
- Updated dependencies [72d142d]
  - @templatical/types@0.52.0

## 0.51.1

### Patch Changes

- @templatical/types@0.51.1

## 0.51.0

### Patch Changes

- @templatical/types@0.51.0

## 0.50.0

### Patch Changes

- Updated dependencies [61518b7]
- Updated dependencies [3af9072]
  - @templatical/types@0.50.0

## 0.49.0

### Patch Changes

- Updated dependencies [588b367]
  - @templatical/types@0.49.0

## 0.48.0

### Minor Changes

- d329c13: Sections can render as heroes

  A one-column section with a background image can render as an MJML `mj-hero`: the image fills the box and the content sits on top. Set `section.hero`:

  - `height: "image"` makes the box as tall as the image drawn across its desktop width; a phone keeps that height and crops the image's sides. It needs the image file's size, which `backgroundImage` carries as optional `naturalWidth` / `naturalHeight`, as an image block does. A media pick that knows the size stores it with the URL; otherwise the editor measures the image when the author sets it.
  - A number is a fixed height in px, padding included.
  - Either way the email carries a fixed height, which classic Outlook on Windows keeps; it ignores MJML's fluid height and would show only the top of the image.
  - `verticalAlign` places the content: `"top"`, `"middle"` or `"bottom"`.

  In the editor, a section's Background panel gains **Height** (Fit content, Match image, Fixed) and **Content position**, and the palette gains a **Hero** shortcut that inserts a hero-mode section with a title, a paragraph and a button. A hero has no border and always paints its image `cover`, unrepeated, so those controls hide while it applies and keep their values. `paletteBlocks` accepts `"hero"`.

  With more than one column, no image, or `"image"` without the size, the section renders as a regular one, and the new `structure.hero-not-applied` warning says which. `@templatical/types` exports `resolveHero`, which the renderer, the linter and the editor share. The template JSON schema in `@templatical/template-tools` gains `section.hero` and the background image's size.

  The MJML importer reads `mj-hero` as a hero section instead of an HTML block, and reads Templatical's own exported **Match image** heroes back as `height: "image"`. Easy Email Pro's `standard-hero` keeps its image behind the content instead of stacking it as a leading image block.

### Patch Changes

- f1c1955: Imported images come in at the width the source email shows them, and every importer decides `width: "full"` by one rule. A missing width, `100%`, or a px width that reaches the image's room (its column less its own side padding, and border where the importer reads one) is `"full"`; a narrower px width stays px; a percentage under `100%` becomes px of the room and is reported `approximated`, since a px width keeps its size on a phone.

  - **Unlayer** read `src.width`, the uploaded file's size, so every image imported at that size: a logo Unlayer shows at `maxWidth: "11%"` of a 700px body came in at 1600px, full width. It now reads `autoWidth` and `maxWidth`. `src.height`, the file's height, is no longer imported, so the image keeps its aspect ratio, and a missing width is `"full"` instead of 600px.
  - **BeeFree** read `image.width` and `image.height`, the file's size, so a 1920 × 466 hero shown across a 600px column imported as 600 × 466, stretched to more than three times its height, and a logo shown at 172.5px imported at 254px. It now reads `computedStyle` (`autowidth` is `"full"`, otherwise `computedStyle.width`), never imports the file's height, and takes the alignment from `computedStyle.class` when the image has no `text-align`.
  - **Easy Email Pro** ignored an image's `width`, so every sized image imported as full width.
  - **HTML** (and **Stripo**, which uses it) imported a missing or `100%` width as 600px, and let the `height` attribute win over a `height: auto` style, pinning a height the email doesn't show.
  - **MJML** turned a px width into `"full"` only when it equalled the column exactly; **Topol** and **Chamaileon** compared against the column without the image's padding.

- Updated dependencies [10ca348]
- Updated dependencies [d329c13]
- Updated dependencies [d6641bc]
  - @templatical/types@0.48.0

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
- Updated dependencies [f8018d8]
- Updated dependencies [2797f5e]
- Updated dependencies [7afcadf]
- Updated dependencies [4d0870d]
  - @templatical/types@0.47.0

## 0.46.0

### Patch Changes

- f24888a: Imported templates keep their font fallbacks. Every importer used to cut a `font-family` stack down to its first family, so `Montserrat, Trebuchet MS, sans-serif` became `Montserrat`, and a mail client without Montserrat fell back to its own default (Times New Roman in Outlook on Windows). This included paragraph text, which the importers style with an inline span. The whole stack is now kept, with double-quoted names re-quoted in single quotes. A stack that is exactly a built-in font's own, such as `Arial, sans-serif`, is still stored as the bare name, since the renderer expands it back the same way. Easy Email Pro's page font used to be kept as written, so a value such as `inherit` became the template font; a value a browser would ignore now falls back to the default font.

  The renderer now adds `defaultFallbackFont` after a single font it doesn't know, such as `Helvetica Neue` or `Inter` without a matching custom font, in the template font and in title, button, menu and table blocks: `'Helvetica Neue', Arial, sans-serif` instead of a bare `Helvetica Neue`. A full stack is emitted as written, and built-in and custom fonts are unchanged.

  `@templatical/types` exports the font-stack helpers the renderer, editor and importers now share: `parseFontFamilies`, `normalizeFontStack`, `canonicalFontStack`, `firstFontFamily`, `quoteFontFamily`, `formatFontFamilies`, `isGenericFontFamily` and `BUILT_IN_FONT_STACKS`. The editor's font selects use them, so a quoted family containing a comma is labelled by its full name, and an invalid value such as `inherit, Arial` shows as no font.

- Updated dependencies [9d97f4d]
- Updated dependencies [c395ecf]
- Updated dependencies [f24888a]
  - @templatical/types@0.46.0

## 0.45.0

### Patch Changes

- Updated dependencies [347c2b0]
  - @templatical/types@0.45.0

## 0.44.3

### Patch Changes

- @templatical/types@0.44.3

## 0.44.2

### Patch Changes

- @templatical/types@0.44.2

## 0.44.1

### Patch Changes

- @templatical/types@0.44.1

## 0.44.0

### Patch Changes

- Updated dependencies [841cb38]
  - @templatical/types@0.44.0

## 0.43.3

### Patch Changes

- @templatical/types@0.43.3

## 0.43.2

### Patch Changes

- @templatical/types@0.43.2

## 0.43.1

### Patch Changes

- @templatical/types@0.43.1

## 0.43.0

### Patch Changes

- be4ac17: Easy Email Pro imports keep text, merge tags, tables, raw HTML, headers and footers

  - **`standard-text` imports as a paragraph.** It is Easy Email Pro's default text block, and it imported as an HTML block holding the node's JSON, so recipients saw JSON. It now maps the same way as `standard-paragraph`, with `blockAttributes["standard-text"]` and the `TEXT` category in its attribute cascade.
  - **Inline `html-node` elements keep their text.** A `<span>`, `<em>`, `<strong>` or `<br>` inside rich text was dropped along with its words. It now serialises as its tag with its string attributes, escaped; void tags such as `br` and `img` self-close. An `html-node` sitting directly in a column is still an `html-fallback`.
  - **Merge tags survive.** "Hello {mergetag}, here is your order" imported as "Hello , here is your order". A `mergetag` now becomes the token Easy Email Pro renders, such as `{{ customer.name }}`, with the marks of its text, and the editor turns it into a merge tag.
  - **`standard-table2` tables import.** Their rows are `standard-table2-tr` and their cells `standard-table2-td`; only a `tr` / `td` shape was read, so a real table produced no block and no report entry. Both shapes are read now.
  - **`raw` imports as an HTML block of its `data.content`,** reported `converted`. It was an HTML block holding the node's JSON.
  - **`page-header` and `page-footer` convert their content.** Their `data.content` walks the way page children do, in order, and the band's background and padding land on the resulting sections as `section.wrapper`, as a `standard-wrapper`'s do. The whole band was one HTML block holding its JSON. An empty band is reported `skipped`.
  - **A divider keeps its width.** A missing width or `100%` imports as `"full"`, any other percentage stays a percentage such as `"50%"` (clamped to 0–100%), and a px width stays px unless it fills its column's content width less the divider's own padding, where it becomes `"full"`. Every divider imported full-width before.

- Updated dependencies [be4ac17]
  - @templatical/types@0.43.0

## 0.42.1

### Patch Changes

- @templatical/types@0.42.1

## 0.42.0

### Patch Changes

- Updated dependencies [5758c24]
- Updated dependencies [cb82f7e]
  - @templatical/types@0.42.0

## 0.41.0

### Patch Changes

- @templatical/types@0.41.0

## 0.40.0

### Patch Changes

- Updated dependencies [b7ff7d9]
  - @templatical/types@0.40.0

## 0.39.4

### Patch Changes

- @templatical/types@0.39.4

## 0.39.3

### Patch Changes

- @templatical/types@0.39.3

## 0.39.2

### Patch Changes

- @templatical/types@0.39.2

## 0.39.1

### Patch Changes

- @templatical/types@0.39.1

## 0.39.0

### Patch Changes

- Updated dependencies [a2b4cde]
  - @templatical/types@0.39.0

## 0.38.0

### Patch Changes

- Updated dependencies [67cd83d]
  - @templatical/types@0.38.0

## 0.37.0

### Patch Changes

- @templatical/types@0.37.0

## 0.36.0

### Minor Changes

- d9ba851: Add `@templatical/import-easy-email-pro`, a converter from Easy Email Pro persist JSON to Templatical template JSON.

  `convertEasyEmailProTemplate(doc)` returns `{ content, report }` with the same shape as the other `@templatical/import-*` packages. It accepts the `{ subject, content }` envelope or a bare `type: "page"` element, resolves `$var()` design tokens, maps `standard-section` / `standard-column` / leaves, and reports what it approximated: 4+ columns folded to three, outlined buttons, hero overlays, countdown GIFs, widgets, and logic whose children converted without their expressions.

### Patch Changes

- Updated dependencies [d8e38e4]
  - @templatical/types@0.36.0
