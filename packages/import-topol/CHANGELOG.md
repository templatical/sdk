# @templatical/import-topol

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

- 59a17bc: The Unlayer, BeeFree and Topol importers check for a repeated warning in constant time, so a design with thousands of languages no longer slows the import quadratically. The Chamaileon importer looks up variable references in a table built once per document. The renderer escapes control characters in a block's type and id before it logs the missing-renderer warning. `templatical live` answers 400 to a request target it can't parse, where it used to exit.
- Updated dependencies [ad58b8e]
- Updated dependencies [0bdfeac]
- Updated dependencies [0511bb6]
- Updated dependencies [a2f3ed8]
  - @templatical/types@0.57.0

## 0.56.1

### Patch Changes

- 59d0859: `convertTopolTemplate()` accepts designs whose sections sit under `mj-body` and converts them like `mj-container` designs, including the container's `background-color`. When a design has neither, the empty-design warning names both tags.
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

### Minor Changes

- e784e63: `SocialPlatform` includes `xing`. Social icon blocks can use a XING icon, drawn from the same glyph as the other platforms, in the editor and in every rendered style and tone.

  BeeFree, MJML, Stripo, Unlayer, Topol and Chamaileon imports map a Xing icon onto `xing`. A BeeFree icon is recognized from its id, name, alt, title or a `xing.com` link, instead of being kept as an image.

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

- 347c2b0: Social icons take a tone, separate from their shape

  `SocialIconsBlock` gains an optional `iconTone`: `"brand"` (each platform's own color, the default and what an absent value means), `"dark"` or `"light"`. `iconStyle` stays the shape and gains `"plain"`, the glyph alone with no badge or outline. A filled shape draws the glyph white on the tone, or near-black on `"light"`; `outlined` and `plain` draw in the tone. The editor offers both as separate selects, Style and Color.

  The renderer ships a PNG set for every style and tone: 6 × 3 sets of 17 platforms, rendered at 144×144, 3× the largest icon size, instead of 192×192, and compressed losslessly with oxipng. The packed package is 360 KB, against 411 KB before (573 KB unpacked, against 545 KB). A brand-colored icon keeps its URL, `{style}/{platform}.png`; a tone lives at `{style}-{tone}/{platform}.png`. If you self-host the icons through `socialIconsBaseUrl`, copy the new folders before using a tone or `plain`. A dark `plain` or `outlined` icon carries a faint white halo, barely visible on light backgrounds, so it stays visible as an outline when a dark-mode client darkens the background but not the image.

  `@templatical/types` exports `SocialIconTone`, `SOCIAL_ICON_STYLES`, `SOCIAL_ICON_TONES`, `SOCIAL_ICON_TONE_COLORS`, `socialIconColors()`, `socialIconAssetDir()`, `socialIconGlyphScale()` and `socialIconHalo()`, the rules the editor, the renderer and the PNG build share.

  The MJML importer reads the style and tone back from a tone's folder, and the Topol importer maps its black-and-white `outlinedbw` set to `outlined` in `"dark"`.

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

- be4ac17: Imported Topol buttons no longer paint their row in their fill colour

  On a Topol `mj-button`, `background-color` is the button face. The importer also copied it into the block background, which renders as the row behind the button, so a button with a fill painted its whole row in that colour. A block's background now comes from `container-background-color`, the attribute MJML paints behind every leaf element, and the button face still comes from `background-color`. Text, image, spacer, divider and social nodes follow the same rule: a `background-color` on them, which MJML never paints, no longer becomes a block background, and a `container-background-color` they set now does. A section still takes its fill from its own `background-color`.

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

### Patch Changes

- Updated dependencies [d8e38e4]
  - @templatical/types@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [703193a]
  - @templatical/types@0.35.0

## 0.34.3

### Patch Changes

- @templatical/types@0.34.3

## 0.34.2

### Patch Changes

- @templatical/types@0.34.2

## 0.34.1

### Patch Changes

- @templatical/types@0.34.1

## 0.34.0

### Patch Changes

- @templatical/types@0.34.0

## 0.33.0

### Patch Changes

- Updated dependencies [d76c343]
  - @templatical/types@0.33.0

## 0.32.0

### Minor Changes

- c18940d: Add `@templatical/import-topol`, a converter from Topol.io design JSON to Templatical template JSON.

  `convertTopolTemplate(design)` returns `{ content, report }` with the same shape as the BeeFree, Unlayer, HTML and MJML importers. It resolves Topol's global-style cascade — the per-tag and per-selector defaults on the design root — maps every tag Topol emits, and reports what it approximated: a four-column section folded to three, a GIF block imported as an image, a social platform with no Templatical equivalent.

  Pass the design object itself, or a JSON string of it. Topol's editor hands it to you directly from its `onSave` callback; its REST APIs wrap it — under `data.definition` on the template endpoint, `json` on the predefined-templates endpoint.

### Patch Changes

- @templatical/types@0.32.0
