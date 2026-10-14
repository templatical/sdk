# @templatical/import-topol

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
