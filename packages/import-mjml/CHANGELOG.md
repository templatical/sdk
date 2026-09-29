# @templatical/import-mjml

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
