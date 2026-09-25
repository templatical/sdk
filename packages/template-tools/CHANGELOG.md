# @templatical/template-tools

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
