# @templatical/import-mjml

## 0.46.0

### Patch Changes

- f24888a: Imported templates keep their font fallbacks. Every importer used to cut a `font-family` stack down to its first family, so `Montserrat, Trebuchet MS, sans-serif` became `Montserrat`, and a mail client without Montserrat fell back to its own default (Times New Roman in Outlook on Windows). This included paragraph text, which the importers style with an inline span. The whole stack is now kept, with double-quoted names re-quoted in single quotes. A stack that is exactly a built-in font's own, such as `Arial, sans-serif`, is still stored as the bare name, since the renderer expands it back the same way. Easy Email Pro's page font used to be kept as written, so a value such as `inherit` became the template font; a value a browser would ignore now falls back to the default font.

  The renderer now adds `defaultFallbackFont` after a single font it doesn't know, such as `Helvetica Neue` or `Inter` without a matching custom font, in the template font and in title, button, menu and table blocks: `'Helvetica Neue', Arial, sans-serif` instead of a bare `Helvetica Neue`. A full stack is emitted as written, and built-in and custom fonts are unchanged.

  `@templatical/types` exports the font-stack helpers the renderer, editor and importers now share: `parseFontFamilies`, `normalizeFontStack`, `canonicalFontStack`, `firstFontFamily`, `quoteFontFamily`, `formatFontFamilies`, `isGenericFontFamily` and `BUILT_IN_FONT_STACKS`. The editor's font selects use them, so a quoted family containing a comma is labelled by its full name, and an invalid value such as `inherit, Arial` shows as no font.

- 58c7694: The MJML importer now reads back the button width, the per-corner radii, the borders and the button font that the renderer writes, so a rendered template survives a re-import with all of them.

  An `mj-button`'s `width` used to be dropped, so every imported button fitted its label. `100%` now imports as `width: "full"` and a px width as that number. `ButtonBlock.width` holds no percentage, so any other percentage imports as the px it comes to in its column, less the column's side padding and the button's own, and the report entry is `approximated` with a note that the width no longer scales. A percentage above `100%` imports as `"full"`, and a width that is unreadable or comes to `0px` or less leaves the button fitting its label, both `approximated` with a note.

  A `border-radius` with two to four values, such as `8px 8px 0 0`, used to import as square corners on `mj-section`, `mj-wrapper`, `mj-image` and `mj-button`. It now imports as the same corners. One that isn't in px, such as `50%` or `1em`, still imports as square corners but is now reported `approximated`.

  `border` and `border-top`, `-right`, `-bottom` and `-left` on `mj-section`, `mj-image` and `mj-button` used to be dropped. They now import as the block's `border`, each side taking its own declaration over `border`. A style other than solid, dashed or dotted is drawn solid, and a side whose width isn't in px is left undrawn, both reported `approximated`. Templatical's wrapper has no border, so a border on `mj-wrapper` is dropped and reported.

  An `mj-button`'s own `font-family` used to be dropped. It now imports as `fontFamily`. The document font that the renderer writes onto every element through `mj-all` is not read as the button's own.

- Updated dependencies [9d97f4d]
- Updated dependencies [c395ecf]
- Updated dependencies [f24888a]
  - @templatical/types@0.46.0

## 0.45.0

### Patch Changes

- 40c00b5: A full-width button is now clickable across its whole fill in the compiled email, not only on its label. MJML gives a button's `<a>` a width only for a px `width`, so for `width: "full"` it widened the button's table and left the `<a>` at `display:inline-block`, the size of its label. A full-width button's `mj-button` now carries the class `tpl-button-full`, and every template's `<mj-style inline="inline">` block ends with `.tpl-button-full a { display: block !important; }`: `mjml` inlines it onto the link, and MRML's default build keeps it as a `<style>` rule. That one line is new in every template's MJML. With `mjml`, juice drops the rule when nothing matches, so the compiled HTML of a template without a full-width button is unchanged. Outlook on Windows ignores `display:block`, so there the link stays the size of its label, as it does for every MJML button. `BUTTON_FULL_WIDTH_CSS_CLASS` is exported for `blockRenderers` overrides of the button. The MJML importer treats `tpl-button-full` as the renderer's own class, so importing a rendered template doesn't report it as dropped consumer CSS. Fixes #868.
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

- be4ac17: MJML imports keep paragraph alignment, colour and size, and divider widths

  - **A paragraph keeps its `mj-text` alignment, colour and size.** `<mj-text align="center" color="#4b5563" font-size="15px">` imported left-aligned in the document's colour and size, and the same values set through `mj-class` were lost too. `align` now lands as `text-align` on each `<p>`, and `color` and `font-size` on one span inside it, the shape the paragraph editor keeps through an edit. Bare list-item text gets a `<p>` first. The `<p>`'s own values win, alignment to the start edge and a 14px size add nothing, and markup with nothing to apply is left exactly as it was. `<mjml dir>` sets `settings.direction` when it differs from the direction `lang` implies, so the start edge is the imported template's own.
  - **A divider keeps its width.** Every `mj-divider` imported as `"full"`, so `50%` and `200px` were both lost while reported `converted`. A missing width or `100%` still imports as `"full"`, any other percentage stays a percentage to two decimals such as `"50%"`, and a px width stays px unless it reaches the width the line can span, where it becomes `"full"`. That width is the column less the column's and the divider's own side padding, which is how `mj-divider` draws `100%`. A width clamped into 0–100% or up to 0px, an unreadable width, and a partial-width divider aligned left or right, which Templatical centres, are reported `approximated`.

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

- b7944ff: Recognise social platforms from icon-pack filenames and `alt`.

  An `mj-social-element` whose `src` was `facebook-round-outlined.png` (or
  `youtube-round-outlined.png`) imported as platform `"website"`, because
  `normalizePlatform` only accepted a bare slug or a `-noshare` variant. Pack
  suffixes (`-round`, `-outlined`, and the same tokens MJML uses for `-noshare`)
  are now stripped until a known platform remains. When `name` and `src` still
  do not match, `alt` is tried. `SocialIcon` is still `{ platform, url }` — `alt`
  is a name signal, not a stored field.

- @templatical/types@0.34.3

## 0.34.2

### Patch Changes

- 7582f8e: Keep prose around inline links as a paragraph.

  An `mj-text` of copy plus a trailing `<a>` imported as a `menu` labelled from
  the links, and the surrounding words were discarded. `looksLikeMenu` walked
  element children only, so text-node siblings never vetoed. It now refuses when
  a non-whitespace text node sits next to the anchors, and the block imports as
  a `paragraph` that keeps both the prose and the `<a>`. Whitespace-only text
  nodes (newlines between `<a>`/`<span>`) still do not veto, so a span-separated
  menu stays a menu. Anchors separated by a text-node `|` become a paragraph —
  same veto, not a second rule.

  The dropped footer and body words now survive: `receive`, `message`,
  `unsubscribe`, `smilesdavis`, and the Dropbox copy (`important`, `available`,
  `exclusively`, `accidentally`, `targeted`, `ransomware`).

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

### Patch Changes

- @templatical/types@0.32.0

## 0.31.0

### Minor Changes

- 3ed4888: Add `@templatical/import-mjml`, a converter from MJML documents to
  Templatical template JSON — alongside the existing BeeFree, Unlayer and HTML
  importers.

  `convertMjmlTemplate(mjml)` returns `{ content, report }`, the same shape as
  the other three importers. It resolves MJML's `mj-attributes` / `mj-class` /
  `mj-all` attribute cascade before mapping tags, and recovers block visibility
  and display conditions from the markup `@templatical/renderer` emits for
  them. Tags with no Templatical equivalent — `mj-hero`, `mj-carousel`,
  `mj-accordion`, and any custom component — fall back to HTML blocks holding
  the original markup.

  MJML produced by `@templatical/renderer` converts back with no
  approximations, which a round-trip test asserts over a fixture covering
  every round-trippable block type.

### Patch Changes

- @templatical/types@0.31.0
