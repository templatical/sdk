# @templatical/template-tools

## 0.57.2

### Patch Changes

- Updated dependencies [27eb4be]
  - @templatical/types@0.57.2
  - @templatical/import-beefree@0.57.2
  - @templatical/import-chamaileon@0.57.2
  - @templatical/import-easy-email-pro@0.57.2
  - @templatical/import-html@0.57.2
  - @templatical/import-mjml@0.57.2
  - @templatical/import-stripo@0.57.2
  - @templatical/import-topol@0.57.2
  - @templatical/import-unlayer@0.57.2
  - @templatical/quality@0.57.2
  - @templatical/renderer@0.57.2

## 0.57.1

### Patch Changes

- c05e2a8: Custom-block Liquid renders now have budgets: `createCustomBlockLiquid` sets `memoryLimit` to `CUSTOM_BLOCK_LIQUID_MEMORY_LIMIT` (`1e7`) and `renderLimit` to `CUSTOM_BLOCK_LIQUID_RENDER_LIMIT` (2000 ms), both exported from `@templatical/types`, so a template such as a loop over `(1..1000000000)` fails with a Liquid limit error in the editor, `renderToMjml` and `custom-block validate` instead of exhausting memory. Data-source preview recipes render with the same limits.

  `template-tools custom-block validate` rejects a repeatable `minItems` or `maxItems` above 100 (`field.items-limit`), and specimen lists never hold more than 100 items. A `dataSourcePreview` response larger than 1 MiB of decoded data is cancelled and the fetch fails.

  `templatical live reload` and `live stop` act only after the server on the pidfile's port answers `GET /identity` with this directory and the pidfile's pid, and `live stop` exits it with `POST /shutdown` and sends no signal: when that request fails, it exits 2 naming the pid and keeps the pidfile. A live server started by an earlier version has no `/identity`, so the new `live reload` and `live stop` refuse its pidfile: stop that server with Ctrl-C (or the earlier version's `live stop`) before upgrading, then run `live` again. A pidfile with a non-positive pid or an out-of-range port is ignored, and `live` refuses to start over a pidfile whose process is running but doesn't answer as this workspace's server, naming the pidfile to delete if that process isn't a live server. A live preview page that stops reading receives only the latest pending update, and `openBrowser` opens only `http:` and `https:` URLs, through `rundll32.exe` on Windows rather than `cmd`.

- Updated dependencies [fb2afae]
- Updated dependencies [81da2d1]
- Updated dependencies [36bc74f]
- Updated dependencies [c05e2a8]
  - @templatical/import-beefree@0.57.1
  - @templatical/types@0.57.1
  - @templatical/import-mjml@0.57.1
  - @templatical/import-html@0.57.1
  - @templatical/import-topol@0.57.1
  - @templatical/import-chamaileon@0.57.1
  - @templatical/import-easy-email-pro@0.57.1
  - @templatical/renderer@0.57.1
  - @templatical/import-stripo@0.57.1
  - @templatical/import-unlayer@0.57.1
  - @templatical/quality@0.57.1

## 0.57.0

### Minor Changes

- a2f3ed8: Breaking changes:

  - `addBlock` no longer accepts a wrapper with a `{ sectionId, column }` parent. Add wrappers at the top level with `parent: null`.
  - `moveBlock` no longer accepts a wrapper with a `{ sectionId, column }` parent. Move wrappers to the top level with `parent: null`.
  - A malformed `moveBlock.expect.parent` is refused as `invalid_operation` at the shape check instead of failing as `precondition_failed`. Send `null`, `{ sectionId, column }` or `{ wrapperId }`.
  - `addBlock`, `moveBlock` and `updateBlock` refuse a section with `section.wrapper` inside a layout wrapper. Keep the section at the top level or remove its own wrapper before placing it inside one. `validateLayout` rejects the same nesting.

  Operations can address wrapper children with `{ wrapperId }` while existing section-column addresses keep their wire shape. The engine, inverses, collaboration diffs, AI feedback and CLI apply wrapper-child edits with placement, lock and hidden-slot checks.

### Patch Changes

- 59a17bc: The Unlayer, BeeFree and Topol importers check for a repeated warning in constant time, so a design with thousands of languages no longer slows the import quadratically. The Chamaileon importer looks up variable references in a table built once per document. The renderer escapes control characters in a block's type and id before it logs the missing-renderer warning. `templatical live` answers 400 to a request target it can't parse, where it used to exit.
- Updated dependencies [ad58b8e]
- Updated dependencies [0bdfeac]
- Updated dependencies [59a17bc]
- Updated dependencies [418a249]
- Updated dependencies [0511bb6]
- Updated dependencies [a2f3ed8]
  - @templatical/types@0.57.0
  - @templatical/renderer@0.57.0
  - @templatical/import-beefree@0.57.0
  - @templatical/import-chamaileon@0.57.0
  - @templatical/import-topol@0.57.0
  - @templatical/import-unlayer@0.57.0
  - @templatical/quality@0.57.0
  - @templatical/import-easy-email-pro@0.57.0
  - @templatical/import-html@0.57.0
  - @templatical/import-mjml@0.57.0
  - @templatical/import-stripo@0.57.0

## 0.56.1

### Patch Changes

- Updated dependencies [59d0859]
  - @templatical/import-topol@0.56.1
  - @templatical/import-beefree@0.56.1
  - @templatical/import-chamaileon@0.56.1
  - @templatical/import-easy-email-pro@0.56.1
  - @templatical/import-html@0.56.1
  - @templatical/import-mjml@0.56.1
  - @templatical/import-stripo@0.56.1
  - @templatical/import-unlayer@0.56.1
  - @templatical/quality@0.56.1
  - @templatical/renderer@0.56.1
  - @templatical/types@0.56.1

## 0.56.0

### Minor Changes

- 5744da5: `displayConditions.onRequest` lets a host open its own condition builder. The callback receives a copy of the block and, when one is set, the current condition including opaque `data`. `null` cancels. `conditions` is optional. With `onRequest` set, `conditions` and `allowCustom` are ignored. `DisplayCondition.data` round-trips through the template.
- f9de817: A section wrapper or a layout wrapper can span the recipient's window. Set `fullWidth: true` on `section.wrapper` or on a layout `wrapper` block and the renderer emits MJML's `full-width="full-width"` on that `mj-wrapper`: the band's background color and background image run edge to edge, and the section or the wrapper's children stay at `settings.width`. Omit `fullWidth`, or set it `false`, and the band stays the email width, exactly as before. A corner radius is not rendered while full width is on; the stored radius remains and comes back when full width is off.

  In the editor, **Full-width background** in a section's Background panel sets this. With no wrapper yet, turning it on moves the section's own background color and image onto a new wrapper and clears them on the section. While the switch is on, that panel's color and image edit the band, and **Content background** sets the section fill. Turning it off clears the flag; a wrapper that holds only that band is removed and its color and image return to the section, unless the section already has a content fill, which keeps the wrapper so neither color is discarded. The Wrapper panel shows the same switch and the same band color and image. A layout wrapper block has the same switch on its Background panel. On the canvas, and in preview, the band reaches the edges of the pane while the content stays at the email width.

  This is the band people migrating from Topol have been asking for (sdk#1105). Importers set `fullWidth` when the source states that band.

- 2466654: Breaking changes:

  - `ColumnLayout` gains `"4"`, `"1-3"`, `"3-1"` and `"1-2-1"`. Code that switches over every layout value, or validates `section.columns` against the previous five, must handle these four values. There is no replacement value: a section may now have four columns.

  Section columns accept four more layouts: `"4"` (four equal columns, 25% each), `"1-3"` (25/75), `"3-1"` (75/25), and `"1-2-1"` (25/50/25). A four-column section stacks to one column on mobile, the same as the two- and three-column layouts. `stackOnMobile: false` keeps any of these layouts side by side.

### Patch Changes

- Updated dependencies [5744da5]
- Updated dependencies [f9de817]
- Updated dependencies [2466654]
- Updated dependencies [f9de817]
- Updated dependencies [2466654]
- Updated dependencies [be84dd0]
  - @templatical/types@0.56.0
  - @templatical/renderer@0.56.0
  - @templatical/import-beefree@0.56.0
  - @templatical/import-unlayer@0.56.0
  - @templatical/import-html@0.56.0
  - @templatical/import-mjml@0.56.0
  - @templatical/import-topol@0.56.0
  - @templatical/import-stripo@0.56.0
  - @templatical/import-chamaileon@0.56.0
  - @templatical/import-easy-email-pro@0.56.0
  - @templatical/quality@0.56.0

## 0.55.0

### Minor Changes

- 200ab00: Two optional block fields. Leaving either out renders exactly as before.

  - **Button `fontWeight`:** `"regular"` (400), `"medium"` (500) or `"bold"` (700), rendered as `mj-button font-weight`. Without it the label stays bold. The editor's button settings offer Regular, Medium and Bold (choosing Bold clears the field), with labels in all eight locales.
  - **Image `fluidOnMobile`:** `true` always emits MJML `fluid-on-mobile="true"` and `false` never does. Without it an image still goes full width on a phone only when it fills its column on desktop; video thumbnails are unchanged. The editor's image settings offer Automatic, Always and Never, with labels in all eight locales.

  The JSON schema, the `template-tools` validator and the agent skill's block guide include both fields.

- e784e63: `SocialPlatform` includes `xing`. Social icon blocks can use a XING icon, drawn from the same glyph as the other platforms, in the editor and in every rendered style and tone.

  BeeFree, MJML, Stripo, Unlayer, Topol and Chamaileon imports map a Xing icon onto `xing`. A BeeFree icon is recognized from its id, name, alt, title or a `xing.com` link, instead of being kept as an image.

### Patch Changes

- Updated dependencies [200ab00]
- Updated dependencies [e784e63]
- Updated dependencies [ed7d96f]
- Updated dependencies [200ab00]
- Updated dependencies [9151730]
- Updated dependencies [6cc3685]
- Updated dependencies [e784e63]
  - @templatical/import-beefree@0.55.0
  - @templatical/import-stripo@0.55.0
  - @templatical/types@0.55.0
  - @templatical/renderer@0.55.0
  - @templatical/quality@0.55.0
  - @templatical/import-mjml@0.55.0
  - @templatical/import-html@0.55.0
  - @templatical/import-unlayer@0.55.0
  - @templatical/import-topol@0.55.0
  - @templatical/import-chamaileon@0.55.0
  - @templatical/import-easy-email-pro@0.55.0

## 0.54.2

### Patch Changes

- Updated dependencies [90aebe1]
- Updated dependencies [a72fbd8]
  - @templatical/renderer@0.54.2
  - @templatical/types@0.54.2
  - @templatical/import-html@0.54.2
  - @templatical/import-mjml@0.54.2
  - @templatical/import-beefree@0.54.2
  - @templatical/import-chamaileon@0.54.2
  - @templatical/import-easy-email-pro@0.54.2
  - @templatical/import-stripo@0.54.2
  - @templatical/import-topol@0.54.2
  - @templatical/import-unlayer@0.54.2
  - @templatical/quality@0.54.2

## 0.54.1

### Patch Changes

- @templatical/import-beefree@0.54.1
  - @templatical/import-chamaileon@0.54.1
  - @templatical/import-easy-email-pro@0.54.1
  - @templatical/import-html@0.54.1
  - @templatical/import-mjml@0.54.1
  - @templatical/import-stripo@0.54.1
  - @templatical/import-topol@0.54.1
  - @templatical/import-unlayer@0.54.1
  - @templatical/quality@0.54.1
  - @templatical/renderer@0.54.1
  - @templatical/types@0.54.1

## 0.54.0

### Patch Changes

- Updated dependencies [6c932cd]
- Updated dependencies [1463c5f]
- Updated dependencies [60710c1]
  - @templatical/import-beefree@0.54.0
  - @templatical/import-unlayer@0.54.0
  - @templatical/import-html@0.54.0
  - @templatical/renderer@0.54.0
  - @templatical/import-stripo@0.54.0
  - @templatical/import-mjml@0.54.0
  - @templatical/import-chamaileon@0.54.0
  - @templatical/import-easy-email-pro@0.54.0
  - @templatical/import-topol@0.54.0
  - @templatical/quality@0.54.0
  - @templatical/types@0.54.0

## 0.53.0

### Minor Changes

- cef9348: Language versions in the CLI, with `strings export` and `strings import`

  Breaking changes:

  - An element id containing `.` or `/` now fails `validate`; rename it.

  Otherwise existing templates need no migration. Keep every `@templatical/*` package on the same version.

  - `validate --locale <tag>` and `render --locale <tag>` check and render a language version, and the schema accepts `settings.locales` and `l10n`. An unknown locale exits `1` with `unknown_locale`.
  - `strings export <template.json> --locale <tag>` exports a language's strings, the gaps by default (`--only gaps|all`, `--block <id>`), as a `strings/1` JSON file. `strings import <template.json> <strings.json>` applies the strings whose `sourceHash` and placeholders still match and reports `{ applied, rejected, skipped, file }`, with the rejection reasons `stale`, `tags_changed`, `unknown_field`, `not_translatable` and `unsafe_html`. It exits `1` when it rejects any string.
  - `--definitions <file>` loads custom-block definitions for `validate`, `render`, `strings` and `edit`, `--do-not-translate <file>` protects terms during `strings`, and `import --default-locale <tag>` sets the default language for a source that declares none.
  - `edit` applies the locale operations, and a refused operation names its block on stderr.

  See [Strings](https://docs.templatical.com/api/template-tools#strings) and [Definitions](https://docs.templatical.com/api/template-tools#definitions).

### Patch Changes

- Updated dependencies [cef9348]
- Updated dependencies [cef9348]
- Updated dependencies [cef9348]
- Updated dependencies [cef9348]
  - @templatical/import-beefree@0.53.0
  - @templatical/import-unlayer@0.53.0
  - @templatical/import-topol@0.53.0
  - @templatical/import-stripo@0.53.0
  - @templatical/import-chamaileon@0.53.0
  - @templatical/import-easy-email-pro@0.53.0
  - @templatical/import-html@0.53.0
  - @templatical/import-mjml@0.53.0
  - @templatical/quality@0.53.0
  - @templatical/renderer@0.53.0
  - @templatical/types@0.53.0

## 0.52.1

### Patch Changes

- 2da7d6a: Custom-block `{% cycle %}` output is HTML-escaped once with liquidjs 10.30.1

  liquidjs 10.30.1 applies `outputEscape` to `{% echo %}` and `{% cycle %}` itself. `createCustomBlockLiquid` also registered its own escaping `cycle` tag, so with 10.30.1 every `{% cycle %}` value in a custom-block template was escaped twice (`<b>` rendered as `&amp;lt;b&amp;gt;`) by `renderToMjml(content, { customBlocks })` and by `templatical custom-block`. Their `^10.30.0` range admits 10.30.1, so fresh installs already resolved it. The editor bundles its own liquidjs and was not affected.

  `createCustomBlockLiquid` now registers no tags of its own and relies on liquidjs's `outputEscape` for `{{ }}`, `{% echo %}`, `{% liquid %}` echo and `{% cycle %}`.

  - The optional `liquidjs` peer range of `@templatical/types` and `@templatical/renderer` is now `^10.30.1`. With 10.30.0, `{% echo %}` and `{% cycle %}` print their values unescaped, so upgrade `liquidjs` to `^10.30.1` in the project that renders custom blocks.
  - A final `| raw` on a cycle candidate (`{% cycle body | raw, other %}`) opts that value out of escaping.
  - Falsy cycle candidates print as stock liquidjs prints them: `{% cycle 0, 1 %}` renders `0`, then `1`.
  - `CustomBlockLiquidModule` requires only `Liquid`; passing the whole `liquidjs` module works as before.

- Updated dependencies [2da7d6a]
  - @templatical/types@0.52.1
  - @templatical/renderer@0.52.1
  - @templatical/import-beefree@0.52.1
  - @templatical/import-chamaileon@0.52.1
  - @templatical/import-easy-email-pro@0.52.1
  - @templatical/import-html@0.52.1
  - @templatical/import-mjml@0.52.1
  - @templatical/import-stripo@0.52.1
  - @templatical/import-topol@0.52.1
  - @templatical/import-unlayer@0.52.1
  - @templatical/quality@0.52.1

## 0.52.0

### Minor Changes

- 9881028: Custom block fields are HTML-escaped in templates

  `{{ }}`, `{% echo %}`, `{% liquid %}` echo and `{% cycle %}` output in a custom block's template is now HTML-escaped: `&`, `<`, `>`, `"` and `'` become `&amp;`, `&lt;`, `&gt;`, `&#34;` and `&#39;`. To keep HTML from a field, write `{{ field | raw }}`. Remove explicit `| escape` from ordinary output; print captured output with `{{ name | raw }}`; and use `{{ field | escape | newline_to_br | raw }}` for HTML-producing filters. The editor canvas also sanitizes each rendered custom block. `@templatical/types` now exports `createCustomBlockLiquid(liquidjs)` so headless resolvers use the editor's engine. Recipe URLs percent-encode field values and JSON bodies remain unescaped; use `{{ key | json }}` to quote a JSON value.

  `@templatical/renderer` now accepts `customBlocks: CustomBlockDefinition[]` so headless callers render saved blocks with definitions directly. `@templatical/template-tools` uses this option for specimen MJML rendering.

### Patch Changes

- Updated dependencies [9881028]
- Updated dependencies [72d142d]
  - @templatical/renderer@0.52.0
  - @templatical/types@0.52.0
  - @templatical/quality@0.52.0
  - @templatical/import-html@0.52.0
  - @templatical/import-mjml@0.52.0
  - @templatical/import-beefree@0.52.0
  - @templatical/import-chamaileon@0.52.0
  - @templatical/import-easy-email-pro@0.52.0
  - @templatical/import-stripo@0.52.0
  - @templatical/import-topol@0.52.0
  - @templatical/import-unlayer@0.52.0

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
