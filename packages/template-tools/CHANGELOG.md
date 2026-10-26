# @templatical/template-tools

## 0.51.1

### Patch Changes

- @templatical/import-beefree@0.51.1
  - @templatical/import-chamaileon@0.51.1
  - @templatical/import-easy-email-pro@0.51.1
  - @templatical/import-html@0.51.1
  - @templatical/import-mjml@0.51.1
  - @templatical/import-stripo@0.51.1
  - @templatical/import-topol@0.51.1
  - @templatical/import-unlayer@0.51.1
  - @templatical/quality@0.51.1
  - @templatical/renderer@0.51.1
  - @templatical/types@0.51.1

## 0.51.0

### Patch Changes

- @templatical/import-beefree@0.51.0
  - @templatical/import-chamaileon@0.51.0
  - @templatical/import-easy-email-pro@0.51.0
  - @templatical/import-html@0.51.0
  - @templatical/import-mjml@0.51.0
  - @templatical/import-stripo@0.51.0
  - @templatical/import-topol@0.51.0
  - @templatical/import-unlayer@0.51.0
  - @templatical/quality@0.51.0
  - @templatical/renderer@0.51.0
  - @templatical/types@0.51.0

## 0.50.0

### Minor Changes

- 051113f: Add default-on compatibility lint for authored pass-through HTML and CSS, using a pinned caniemail snapshot, plus an explicit compiled-HTML Gmail size check. Agents and headless callers receive a concrete `suggestion` and `reference` on every issue, with affected clients and an excerpt when available. The editor shows suggestions and source links, and offers an on-demand Check size action when its render provider can compile without saving. `templatical validate --html` reports `htmlBytes` and a clipping warning.

  Breaking changes: `LintIssue.suggestion` and `.reference` are required; existing `message` text is shortened to the problem, with the action in `suggestion`. Message maps and formatter results now contain `{ message, suggestion }` objects. Compatibility is on by default, so four category keys set to `false` no longer disable all linting; set the fifth `compatibility: false` too. Custom-block client-fact IDs move from `safety.*` to `compat.*`, and `CustomBlockIssueSeverity` now includes `info`.

### Patch Changes

- Updated dependencies [61518b7]
- Updated dependencies [051113f]
- Updated dependencies [3af9072]
- Updated dependencies [2db2846]
  - @templatical/types@0.50.0
  - @templatical/quality@0.50.0
  - @templatical/import-beefree@0.50.0
  - @templatical/import-chamaileon@0.50.0
  - @templatical/import-easy-email-pro@0.50.0
  - @templatical/import-html@0.50.0
  - @templatical/import-mjml@0.50.0
  - @templatical/import-stripo@0.50.0
  - @templatical/import-topol@0.50.0
  - @templatical/import-unlayer@0.50.0
  - @templatical/renderer@0.50.0

## 0.49.0

### Minor Changes

- 588b367: `edit` speaks operations vocabulary v2

  `template-tools edit` applies the operations the editor, collaboration backends and Templatical Cloud share — `{"op": "updateBlock", "blockId": "…", "set": {…}}` and the rest — with the engine from `@templatical/types`, and a refusal names the operation, its code and the reason. The package re-exports `applyOperations`, `OperationError` and `getColumnCount`.

  Breaking changes:

  - The `{ "operation", "data" }` form is refused, with a pointer to the new one.
  - `applyOperation` and `OperationResult` are removed; use `applyOperations` and catch `OperationError`.
  - `updateBlockStyle` is gone: `updateBlock`'s `set` replaces `styles` whole, so send the block's full `styles` object with the property changed.

### Patch Changes

- Updated dependencies [588b367]
  - @templatical/types@0.49.0
  - @templatical/import-beefree@0.49.0
  - @templatical/import-chamaileon@0.49.0
  - @templatical/import-easy-email-pro@0.49.0
  - @templatical/import-html@0.49.0
  - @templatical/import-mjml@0.49.0
  - @templatical/import-stripo@0.49.0
  - @templatical/import-topol@0.49.0
  - @templatical/import-unlayer@0.49.0
  - @templatical/quality@0.49.0
  - @templatical/renderer@0.49.0

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

- Updated dependencies [10ca348]
- Updated dependencies [f1c1955]
- Updated dependencies [f1c1955]
- Updated dependencies [d329c13]
- Updated dependencies [d6641bc]
- Updated dependencies [636b863]
  - @templatical/types@0.48.0
  - @templatical/import-unlayer@0.48.0
  - @templatical/import-beefree@0.48.0
  - @templatical/renderer@0.48.0
  - @templatical/import-mjml@0.48.0
  - @templatical/import-easy-email-pro@0.48.0
  - @templatical/import-html@0.48.0
  - @templatical/import-stripo@0.48.0
  - @templatical/import-topol@0.48.0
  - @templatical/import-chamaileon@0.48.0
  - @templatical/quality@0.48.0

## 0.47.0

### Minor Changes

- f8018d8: Add `templatical custom-block validate|render|fetch` and `live --custom-block [--host]` for authoring custom block definitions. `validate` checks the definition against a generated `custom-block-schema.json`, cross-checks the Liquid template against its fields, lints the rendered HTML for email-client safety, and proves it renders through MJML. `checkCustomBlock` also takes the object a definition module exports, `dataSource` included, so the same check can run in your own tests. Accessibility warnings cover vague link text, links with no name, layout tables without `role="presentation"` and low contrast between inline colours. The live preview shows the block in its edge-case states, and with `--fetch` adds one filled from the real endpoint. That request, and the editor's Fetch button, run a preview-only `dataSourcePreview` recipe; the bridge makes those requests from Node, reading credentials from environment variables, so they never reach the page.

  The live bridge now answers only requests whose `Host` header is `localhost`, `127.0.0.1` or `[::1]` on its own port, in both modes, so a tunnel or proxy that rewrites the hostname gets a 403. A write carrying another site's `Origin` also gets a 403, and a `POST` must be `application/json`, so a web page open in the same browser can't post notes or content to it. In template mode, `live reload` now exits 1 and pushes nothing when the working file is missing or isn't valid JSON.

- 2797f5e: Sections and wrapper bands take a background image

  There was no way to put an image behind content — a hero banner or a textured band needed an HTML block, and HTML blocks render inside `mj-text`, where a background can't reach the section.

  `SectionBlock`, `SectionWrapper` and the layout `WrapperBlock` gain an optional `backgroundImage: BackgroundImage` — `{ url, size, position: { x, y }, repeat }`, with `size` one of `"cover"`, `"contain"` or `"auto"` and `position` a 9-point grid. It renders as MJML's `background-url`, `background-size`, `background-position` and `background-repeat` on the `mj-section` / `mj-wrapper`, which includes MJML's VML fallback for Outlook on Windows. The element's `backgroundColor` stays its fallback colour. Templates without an image render exactly as before.

  The editor's Background panel gets an image control for sections, and the section wrapper settings get one for the band: a URL (merge tags, the media browser and drag-and-drop upload all work, as for image blocks), then Fill / Fit / Original, a position grid and a repeat toggle. The canvas paints the image through `resolveImageUrl` like image blocks do, and the dark-mode preview leaves it un-inverted, as it does images.

  `createBackgroundImage()`, `resolveBackgroundImage()` and `encodeCssUrl()` are exported from `@templatical/types`, so the canvas and the renderer resolve images identically. `encodeCssUrl` percent-encodes the characters that could end a quoted CSS `url()`, because MJML pastes the URL verbatim into inline CSS.

  `lintStructure` gains two warnings for Outlook on Windows: `structure.wrapper-color-over-background-image` (a wrapper colour paints over the section's image there) and `structure.nested-background-image` (an image on both the wrapper and its section breaks the layout there).

  Outlook on Windows tiles an image at its original size (`auto`) from the top center, whatever the position and repeat settings.

### Patch Changes

- Updated dependencies [fb6c024]
- Updated dependencies [51d5cfd]
- Updated dependencies [f8018d8]
- Updated dependencies [2797f5e]
- Updated dependencies [7afcadf]
- Updated dependencies [4d0870d]
  - @templatical/types@0.47.0
  - @templatical/renderer@0.47.0
  - @templatical/import-mjml@0.47.0
  - @templatical/import-topol@0.47.0
  - @templatical/import-easy-email-pro@0.47.0
  - @templatical/import-unlayer@0.47.0
  - @templatical/import-beefree@0.47.0
  - @templatical/import-chamaileon@0.47.0
  - @templatical/import-html@0.47.0
  - @templatical/import-stripo@0.47.0
  - @templatical/quality@0.47.0

## 0.46.0

### Patch Changes

- c395ecf: The `SectionWrapper` description in `schema.json` no longer calls the wrapper a full-width band

  The wrapper renders as an `mj-wrapper` without MJML's `full-width` attribute, so its band is as wide as the email body (`settings.width`), not the recipient's viewport. The description in the published schema now says so.

- Updated dependencies [9d97f4d]
- Updated dependencies [c395ecf]
- Updated dependencies [f24888a]
- Updated dependencies [58c7694]
- Updated dependencies [1045b2c]
- Updated dependencies [192c8ab]
  - @templatical/types@0.46.0
  - @templatical/renderer@0.46.0
  - @templatical/import-html@0.46.0
  - @templatical/import-stripo@0.46.0
  - @templatical/import-mjml@0.46.0
  - @templatical/import-topol@0.46.0
  - @templatical/import-beefree@0.46.0
  - @templatical/import-unlayer@0.46.0
  - @templatical/import-chamaileon@0.46.0
  - @templatical/import-easy-email-pro@0.46.0
  - @templatical/quality@0.46.0

## 0.45.0

### Patch Changes

- Updated dependencies [40c00b5]
- Updated dependencies [347c2b0]
  - @templatical/renderer@0.45.0
  - @templatical/import-mjml@0.45.0
  - @templatical/types@0.45.0
  - @templatical/import-topol@0.45.0
  - @templatical/import-html@0.45.0
  - @templatical/import-beefree@0.45.0
  - @templatical/import-chamaileon@0.45.0
  - @templatical/import-easy-email-pro@0.45.0
  - @templatical/import-stripo@0.45.0
  - @templatical/import-unlayer@0.45.0
  - @templatical/quality@0.45.0

## 0.44.3

### Patch Changes

- @templatical/import-beefree@0.44.3
  - @templatical/import-chamaileon@0.44.3
  - @templatical/import-easy-email-pro@0.44.3
  - @templatical/import-html@0.44.3
  - @templatical/import-mjml@0.44.3
  - @templatical/import-stripo@0.44.3
  - @templatical/import-topol@0.44.3
  - @templatical/import-unlayer@0.44.3
  - @templatical/quality@0.44.3
  - @templatical/renderer@0.44.3
  - @templatical/types@0.44.3

## 0.44.2

### Patch Changes

- Updated dependencies [efbe495]
  - @templatical/renderer@0.44.2
  - @templatical/import-html@0.44.2
  - @templatical/import-mjml@0.44.2
  - @templatical/import-beefree@0.44.2
  - @templatical/import-chamaileon@0.44.2
  - @templatical/import-easy-email-pro@0.44.2
  - @templatical/import-stripo@0.44.2
  - @templatical/import-topol@0.44.2
  - @templatical/import-unlayer@0.44.2
  - @templatical/quality@0.44.2
  - @templatical/types@0.44.2

## 0.44.1

### Patch Changes

- @templatical/import-beefree@0.44.1
  - @templatical/import-chamaileon@0.44.1
  - @templatical/import-easy-email-pro@0.44.1
  - @templatical/import-html@0.44.1
  - @templatical/import-mjml@0.44.1
  - @templatical/import-stripo@0.44.1
  - @templatical/import-topol@0.44.1
  - @templatical/import-unlayer@0.44.1
  - @templatical/quality@0.44.1
  - @templatical/renderer@0.44.1
  - @templatical/types@0.44.1

## 0.44.0

### Patch Changes

- Updated dependencies [841cb38]
  - @templatical/types@0.44.0
  - @templatical/import-beefree@0.44.0
  - @templatical/import-chamaileon@0.44.0
  - @templatical/import-easy-email-pro@0.44.0
  - @templatical/import-html@0.44.0
  - @templatical/import-mjml@0.44.0
  - @templatical/import-stripo@0.44.0
  - @templatical/import-topol@0.44.0
  - @templatical/import-unlayer@0.44.0
  - @templatical/quality@0.44.0
  - @templatical/renderer@0.44.0

## 0.43.3

### Patch Changes

- @templatical/import-beefree@0.43.3
  - @templatical/import-chamaileon@0.43.3
  - @templatical/import-easy-email-pro@0.43.3
  - @templatical/import-html@0.43.3
  - @templatical/import-mjml@0.43.3
  - @templatical/import-stripo@0.43.3
  - @templatical/import-topol@0.43.3
  - @templatical/import-unlayer@0.43.3
  - @templatical/quality@0.43.3
  - @templatical/renderer@0.43.3
  - @templatical/types@0.43.3

## 0.43.2

### Patch Changes

- @templatical/import-beefree@0.43.2
  - @templatical/import-chamaileon@0.43.2
  - @templatical/import-easy-email-pro@0.43.2
  - @templatical/import-html@0.43.2
  - @templatical/import-mjml@0.43.2
  - @templatical/import-stripo@0.43.2
  - @templatical/import-topol@0.43.2
  - @templatical/import-unlayer@0.43.2
  - @templatical/quality@0.43.2
  - @templatical/renderer@0.43.2
  - @templatical/types@0.43.2

## 0.43.1

### Patch Changes

- @templatical/import-beefree@0.43.1
  - @templatical/import-chamaileon@0.43.1
  - @templatical/import-easy-email-pro@0.43.1
  - @templatical/import-html@0.43.1
  - @templatical/import-mjml@0.43.1
  - @templatical/import-stripo@0.43.1
  - @templatical/import-topol@0.43.1
  - @templatical/import-unlayer@0.43.1
  - @templatical/quality@0.43.1
  - @templatical/renderer@0.43.1
  - @templatical/types@0.43.1

## 0.43.0

### Patch Changes

- be4ac17: Dividers can be a percentage of their column

  `DividerBlock.width` takes `"full"`, a pixel number, or a percentage from `"0%"` to `"100%"` (the new `DividerPercentWidth` type). The renderer writes a percentage straight into `mj-divider`, which MJML renders as a share of the column, so the line shrinks with the column on a phone where a pixel width would overflow. The canvas draws it the same way, and `templatical validate` accepts it. A custom `blockRenderers.divider` must handle the percentage string.

- Updated dependencies [be4ac17]
- Updated dependencies [be4ac17]
- Updated dependencies [be4ac17]
- Updated dependencies [be4ac17]
- Updated dependencies [be4ac17]
- Updated dependencies [be4ac17]
- Updated dependencies [be4ac17]
- Updated dependencies [be4ac17]
  - @templatical/types@0.43.0
  - @templatical/renderer@0.43.0
  - @templatical/import-beefree@0.43.0
  - @templatical/import-easy-email-pro@0.43.0
  - @templatical/import-html@0.43.0
  - @templatical/import-mjml@0.43.0
  - @templatical/import-stripo@0.43.0
  - @templatical/import-topol@0.43.0
  - @templatical/import-unlayer@0.43.0
  - @templatical/import-chamaileon@0.43.0
  - @templatical/quality@0.43.0

## 0.42.1

### Patch Changes

- 46d066e: Live notes survive a plain `live reload`. `live reload --consume-annotations` clears them after the working file was read. A note can name the block that contains its target, and the queue can be edited or deleted one note at a time.
- @templatical/import-beefree@0.42.1
  - @templatical/import-chamaileon@0.42.1
  - @templatical/import-easy-email-pro@0.42.1
  - @templatical/import-html@0.42.1
  - @templatical/import-mjml@0.42.1
  - @templatical/import-stripo@0.42.1
  - @templatical/import-topol@0.42.1
  - @templatical/import-unlayer@0.42.1
  - @templatical/quality@0.42.1
  - @templatical/renderer@0.42.1
  - @templatical/types@0.42.1

## 0.42.0

### Minor Changes

- cb82f7e: Sections, images and buttons take a border, and corners can be rounded one at a time

  There was no way to draw a border around a block — an outlined card section, a framed product shot, or an outline ("ghost") button all needed an HTML block.

  `SectionBlock`, `ImageBlock` and `ButtonBlock` gain an optional `border: BorderValue`. Like `SpacingValue`, it is described per side — `{ top, right, bottom, left }`, each a `{ width, style, color }` with `style` one of `"solid"`, `"dashed"` or `"dotted"`. A side with width `0` is not drawn, so a top rule, an underline or a thick accent on one side are all expressible. It renders as MJML's native `border` attribute when all four sides match, and as `border-top` / `-right` / `-bottom` / `-left` otherwise, on `mj-section`, `mj-image` and `mj-button`. Leave it out for no border, which is what every existing template already renders.

  `borderRadius` on sections, section wrappers, images and buttons now also accepts a radius per corner — `{ topLeft, topRight, bottomRight, bottomLeft }` — rendered as the four-value `border-radius` shorthand (e.g. rounded top corners on a card that sits flush on the one below). A plain number still works and renders exactly as before.

  **Type change:** `borderRadius` widens from `number` to `BorderRadiusValue` (`number | CornerRadius`). Code that only writes a number is unaffected; code that reads `borderRadius` and does arithmetic on it needs to handle the per-corner form (or use `toBorderRadiusCss()`).

  The editor's section, image and button settings get a border control and a radius control, both working like the spacing control: linked, one set of values edits every side (or corner); unlinked, each side's width, style and color (or each corner's radius) is edited separately. Entering a width starts a solid black border; a width of `0` removes it.

  `toBorderCss()`, `toBorderDeclarations()`, `toBorderRadiusCss()` and `uniformBorder()` are exported from `@templatical/types`, so the editor canvas and the renderer draw borders and radii identically.

  For an outline button, set `backgroundColor` to the keyword `"transparent"` and set `textColor` too.

  Other block types (text, menu, social, video) have no native MJML border and are not covered. Outlook on Windows ignores `border-radius` (including the per-corner form) and often paints dashed or dotted borders solid; image borders sit on the `<img>`, which Outlook often drops, while section and button borders sit on the `<td>`.

### Patch Changes

- Updated dependencies [5758c24]
- Updated dependencies [cb82f7e]
  - @templatical/renderer@0.42.0
  - @templatical/types@0.42.0
  - @templatical/import-html@0.42.0
  - @templatical/import-mjml@0.42.0
  - @templatical/import-beefree@0.42.0
  - @templatical/import-chamaileon@0.42.0
  - @templatical/import-easy-email-pro@0.42.0
  - @templatical/import-stripo@0.42.0
  - @templatical/import-topol@0.42.0
  - @templatical/import-unlayer@0.42.0
  - @templatical/quality@0.42.0

## 0.41.0

### Patch Changes

- @templatical/import-beefree@0.41.0
  - @templatical/import-chamaileon@0.41.0
  - @templatical/import-easy-email-pro@0.41.0
  - @templatical/import-html@0.41.0
  - @templatical/import-mjml@0.41.0
  - @templatical/import-stripo@0.41.0
  - @templatical/import-topol@0.41.0
  - @templatical/import-unlayer@0.41.0
  - @templatical/quality@0.41.0
  - @templatical/renderer@0.41.0
  - @templatical/types@0.41.0

## 0.40.0

### Patch Changes

- Updated dependencies [b7ff7d9]
  - @templatical/types@0.40.0
  - @templatical/renderer@0.40.0
  - @templatical/quality@0.40.0
  - @templatical/import-beefree@0.40.0
  - @templatical/import-chamaileon@0.40.0
  - @templatical/import-easy-email-pro@0.40.0
  - @templatical/import-html@0.40.0
  - @templatical/import-mjml@0.40.0
  - @templatical/import-stripo@0.40.0
  - @templatical/import-topol@0.40.0
  - @templatical/import-unlayer@0.40.0

## 0.39.4

### Patch Changes

- @templatical/import-beefree@0.39.4
  - @templatical/import-chamaileon@0.39.4
  - @templatical/import-easy-email-pro@0.39.4
  - @templatical/import-html@0.39.4
  - @templatical/import-mjml@0.39.4
  - @templatical/import-stripo@0.39.4
  - @templatical/import-topol@0.39.4
  - @templatical/import-unlayer@0.39.4
  - @templatical/quality@0.39.4
  - @templatical/renderer@0.39.4
  - @templatical/types@0.39.4

## 0.39.3

### Patch Changes

- @templatical/import-beefree@0.39.3
  - @templatical/import-chamaileon@0.39.3
  - @templatical/import-easy-email-pro@0.39.3
  - @templatical/import-html@0.39.3
  - @templatical/import-mjml@0.39.3
  - @templatical/import-stripo@0.39.3
  - @templatical/import-topol@0.39.3
  - @templatical/import-unlayer@0.39.3
  - @templatical/quality@0.39.3
  - @templatical/renderer@0.39.3
  - @templatical/types@0.39.3

## 0.39.2

### Patch Changes

- @templatical/import-beefree@0.39.2
  - @templatical/import-chamaileon@0.39.2
  - @templatical/import-easy-email-pro@0.39.2
  - @templatical/import-html@0.39.2
  - @templatical/import-mjml@0.39.2
  - @templatical/import-stripo@0.39.2
  - @templatical/import-topol@0.39.2
  - @templatical/import-unlayer@0.39.2
  - @templatical/quality@0.39.2
  - @templatical/renderer@0.39.2
  - @templatical/types@0.39.2

## 0.39.1

### Patch Changes

- @templatical/import-beefree@0.39.1
  - @templatical/import-chamaileon@0.39.1
  - @templatical/import-easy-email-pro@0.39.1
  - @templatical/import-html@0.39.1
  - @templatical/import-mjml@0.39.1
  - @templatical/import-stripo@0.39.1
  - @templatical/import-topol@0.39.1
  - @templatical/import-unlayer@0.39.1
  - @templatical/quality@0.39.1
  - @templatical/renderer@0.39.1
  - @templatical/types@0.39.1

## 0.39.0

### Patch Changes

- Updated dependencies [a2b4cde]
  - @templatical/types@0.39.0
  - @templatical/import-beefree@0.39.0
  - @templatical/import-chamaileon@0.39.0
  - @templatical/import-easy-email-pro@0.39.0
  - @templatical/import-html@0.39.0
  - @templatical/import-mjml@0.39.0
  - @templatical/import-stripo@0.39.0
  - @templatical/import-topol@0.39.0
  - @templatical/import-unlayer@0.39.0
  - @templatical/quality@0.39.0
  - @templatical/renderer@0.39.0

## 0.38.0

### Minor Changes

- 67cd83d: First release. `@templatical/template-tools` is the CLI and library behind the
  Templatical Agent Skill: `validate`, `render`, `edit`, `import`, `live`,
  `schema` and `list`, each with `--json` output and a documented exit contract
  (`0` success, `1` invalid template, `2` misuse, `3` an optional package is
  missing and the message names the install command).

  Nothing is installed into your project. `render --format html` and `import` ask
  for one optional package when you use them, resolved from your working
  directory so `npx` and a local install agree. `import --list-formats --json`
  reports which converters are resolvable rather than assuming a fixed list.

  It is also a library: `validateTemplate`, `runQualityLint`, `applyOperation`,
  `getColumnCount` and the generated block schema from the package root, plus the
  local live-preview bridge behind the `./live` subpath and the raw schema at
  `./schema.json` — the two pieces needed to generate templates with your own
  model and validate the result. Documented at
  https://docs.templatical.com/api/template-tools.

  The Agent Skill it powers ships as one skill with a thin router: an entry point
  under 4 KB that loads exactly one of 22 playbooks per request, replacing two
  skills totalling 50 KB that loaded everything up front. Its SDK reference is
  fetched from docs.templatical.com rather than packed in, so an answer is never
  older than the site, and the block schema travels with the skill because it is
  contract rather than documentation.

### Patch Changes

- Updated dependencies [67cd83d]
  - @templatical/types@0.38.0
  - @templatical/import-beefree@0.38.0
  - @templatical/import-chamaileon@0.38.0
  - @templatical/import-easy-email-pro@0.38.0
  - @templatical/import-html@0.38.0
  - @templatical/import-mjml@0.38.0
  - @templatical/import-stripo@0.38.0
  - @templatical/import-topol@0.38.0
  - @templatical/import-unlayer@0.38.0
  - @templatical/quality@0.38.0
  - @templatical/renderer@0.38.0
