# @templatical/editor

## 0.15.0

### Minor Changes

- 7afeacb: Add type-ahead merge tag autocomplete to input and textarea fields

  Typing the syntax opener (e.g. `{{`) in any merge-tag-enabled input or textarea — button/image/video/menu links, image alt text, template settings, and custom-block text fields — now surfaces the same autocomplete popup as the rich-text editor. The popup, filtering, keyboard navigation (Arrow / Enter / Tab / Escape), and caret positioning are shared with the TipTap path, so behavior is identical across both surfaces. Controlled by the existing `mergeTags.autocomplete` flag (default on; auto-disabled when `tags` is empty or a custom syntax is used).

  `@templatical/types` gains `getSyntaxClosingChar()` alongside `getSyntaxTriggerChar()`.

### Patch Changes

- a48118b: Fix: show merge tag labels in Button, Menu, Video and Image block canvas display

  Merge-tag-enabled fields rendered directly on the canvas now show a tag's human-readable `label` (e.g. "Shipping Method") instead of the raw `{{shipping_method}}` token, matching the rich-text editor: button labels, menu item labels, and the Video URL / Image src placeholders shown when those fields are merge tags. Resolved tags carry a subtle dotted underline (in the current text color) so a dynamic value stays distinguishable from user-typed text on any background. Display-only — the raw token is unchanged in the stored value and MJML output. (#348)
  - @templatical/media-library@0.15.0
  - @templatical/quality@0.15.0
  - @templatical/renderer@0.15.0

## 0.14.0

### Minor Changes

- 12100c8: Add standalone logic tags — a control-flow feature separate from merge tags. Configure `logicTags.tags` (standalone tokens like `{% else %}`) and `logicTags.pairs` (open/close constructs like `{% if %}` … `{% endif %}`), or supply `logicTags.onRequest` to plug in your own picker (mirrors `mergeTags.onRequest`; precedence: onRequest → built-in picker). A dedicated "Insert logic" affordance appears in rich-text blocks **and** in merge-tag-enabled plain fields (button text, URLs, alt text). Standalone tags insert at the cursor; pairs wrap the current selection (or drop with the caret between them). The built-in picker is a single searchable list grouped by `group` — each group holds both its standalone tags and its open/close pairs, with keyword badges (one per tag, two per pair). Typed and pasted logic tags are still highlighted automatically, independent of this config. New exported types: `LogicTagsConfig`, `LogicTag`, `LogicPair`.
- 718d781: Add an optional outer frame to section blocks (`section.wrapper`) — a full-width band with its own background, padding, and corner radius that frames the section, rendered as an `mj-wrapper` around the section's `mj-section`. This makes the common "white card on a colored band" layout possible without nesting sections (which MJML forbids). Enable it from the section toolbar's Wrapper panel, or set `createSectionBlock({ wrapper: { backgroundColor, padding, borderRadius } })`; omit it and existing templates are unchanged. (#312)

### Patch Changes

- a476576: Fix the editor allowing a section to be dropped into another section's column (dragged from the sidebar palette) and then silently losing it on export. MJML cannot nest `mj-section` inside `mj-column`, so `renderToMjml()` / `editor.toMjml()` dropped the nested section and all of its content. Dragging a section into a column is now rejected up front, and the core `addBlock` / `moveBlock` APIs refuse to nest a section into a column, so the invalid state can no longer be created. (#292)
- 710c9be: Add an optional `borderRadius` (px) to section blocks. Set it from the section toolbar or via `createSectionBlock({ borderRadius })`; the renderer emits it as `border-radius` on the `mj-section`, so a section with a background color reads as a rounded card on a contrasting background. Omitted or `0` keeps square corners, so existing templates are unchanged. First step toward the framed "card on colored background" pattern. (#312)
- Updated dependencies [710c9be]
- Updated dependencies [718d781]
  - @templatical/renderer@0.14.0
  - @templatical/media-library@0.14.0
  - @templatical/quality@0.14.0

## 0.13.0

### Minor Changes

- 7ad4adc: Add drag-and-drop image upload (#229). Drag an image file from your computer onto an image block (empty or filled to replace), the sidebar image field, or a custom block's image field to set it — the editor forwards the dropped `File` to your `onRequestMedia` handler via the new optional `MediaRequestContext.files`, exactly like the Browse Media path (upload it and return the URL). In Cloud editors the dropped file is uploaded to your media library automatically. A file dropped anywhere else on the editor is ignored instead of navigating the browser away.

### Patch Changes

- Updated dependencies [7ad4adc]
  - @templatical/media-library@0.13.0
  - @templatical/renderer@0.13.0
  - @templatical/quality@0.13.0

## 0.12.1

### Patch Changes

- 643d05e: Fix block/section background color incorrectly showing `#ffffff` when no color is set. An unset color now reads as "Not set" (a slashed swatch) instead of a fake white, and picking a color equal to the default — e.g. white on a transparent background — now persists and renders correctly instead of being silently dropped. A clear (×) button resets a color back to unset. (#282)
  - @templatical/renderer@0.12.1
  - @templatical/quality@0.12.1
  - @templatical/media-library@0.12.1

## 0.12.0

### Minor Changes

- 7b76e46: Add a `width` option to button blocks: buttons can be set to a fixed pixel width or stretched to full width (`'full'`), independently of their label, instead of always shrinking to fit their content. Omitting `width` keeps the previous content-sized behavior, so existing templates are unaffected (#260).
- c865348: Allow entering a custom image width. The image width control now has a "Custom" option alongside the existing presets (Full width / 300 / 400 / 500) that reveals a pixel input, so images can be sized to any width instead of only the nearest preset (#259).
- a209073: Add website option to social icons

### Patch Changes

- 16d2c46: Fix the button settings panel laying out the Background and Text Color pickers side by side in a two-column grid too narrow to hold each picker's swatch + hex input, clipping the hex field. The two color fields now stack vertically (full width), matching the rest of the panel.
- 67f44fb: Centralize social-icon glyph data (SVG path + brand color) into a single `SOCIAL_ICON_GLYPHS` map in `@templatical/types`, shared by the editor's inline-SVG renderer and the renderer's PNG rasterizer (which previously each kept their own copy). Adding a platform to the `SocialPlatform` union is now a compile error until its glyph exists, so the editor and renderer can no longer drift out of sync. Social platform dropdown labels now resolve through i18n (`social.platforms`) instead of a hardcoded English name.
- 9a1912f: Prevent palette block from disappearing during drag and drop
- Updated dependencies [7b76e46]
- Updated dependencies [67f44fb]
  - @templatical/renderer@0.12.0
  - @templatical/media-library@0.12.0
  - @templatical/quality@0.12.0

## 0.11.1

### Patch Changes

- 130f8f7: Add a `smallScreenNotice` option (default `true`): on viewports narrower than ~768px the editor now shows a "use a larger screen" notice instead of a cramped, unusable drag-and-drop layout. The palette, canvas, and properties panel can't lay out on a phone and touch dragging is impractical, so this is the honest fallback. Opt out with `smallScreenNotice: false` to render the editor at any width if you handle small screens yourself. Applies to both the OSS and cloud editors (#235).
  - @templatical/renderer@0.11.1
  - @templatical/quality@0.11.1
  - @templatical/media-library@0.11.1

## 0.11.0

### Minor Changes

- c038853: Add a `paletteBlocks` config option to reorder and filter the block palette (#232)

  `init({ paletteBlocks: [...] })` now accepts an allowlist that controls which block types appear in the sidebar palette and in what order. Only the listed types are shown, in the given order — unlisted built-ins (e.g. `video`, `table`) are hidden. Reference built-ins by their bare type (`"image"`) and custom blocks by their `custom:`-prefixed type (`"custom:qrcode"`), so the two can be interleaved freely. Unknown entries (a typo, an unregistered custom block) are logged with a warning and skipped. Filtering the palette never affects rendering — existing content that uses a hidden block type still renders correctly. Omit `paletteBlocks` for the full default palette.

### Patch Changes

- d24805f: Fix the global email background being hidden in the editor when a section has its own background. The background now renders in the gutters around the centered content, matching how it appears when the email is sent (#230).
- 70586b3: Fix the editor clipping its own content on short viewports. The block-types palette is now a scroll region, and the editor's `min-height` floor was lowered so it fills short containers instead of overflowing them — restoring access to the bottom of the palette, the footer, and the config panel's lower controls (#231).
  - @templatical/renderer@0.11.0
  - @templatical/quality@0.11.0
  - @templatical/media-library@0.11.0

## 0.10.4

### Patch Changes

- 8fb5df9: Fix the inline "Browse media" button not inserting an image when the image is nested inside a section (#219)

  `SectionBlock` rendered each nested child block with only a `@fetch-data` listener, whereas `Canvas` (top-level blocks) also forwards `@update`. `ImageBlock` signals a media pick by emitting `update` and holds no editor reference of its own, so an image _inside a section_ emitted into the void and the picked media never landed. The content-sidebar path was unaffected because it updates the selected block by id, independent of nesting. `SectionBlock` now forwards the child's `@update` to `editor.updateBlock`, matching `Canvas`.
  - @templatical/renderer@0.10.4
  - @templatical/quality@0.10.4
  - @templatical/media-library@0.10.4

## 0.10.3

### Patch Changes

- e5908e8: Make the editor and standalone media library independent of the host page's `html { font-size }` (#209).

  The UI's length scale (spacing, font sizes, border radii) is now anchored to a new `--tpl-user-base-size` token that defaults to a fixed `16px`, instead of `rem`. A `rem` always resolves against the document root — even inside the editor's shadow root — so a consumer design system that set e.g. `html { font-size: 8px }` previously shrank the entire editor. It no longer does.

  Consumers on a normal 16px root see identical sizing. To scale the whole UI, set `--tpl-user-base-size` on the editor container (or any ancestor): a px value to enlarge/compact (`18px`, `14px`), or a `rem` value such as `2rem` to deliberately track a custom root font-size. Email content on the canvas is unaffected — it uses the pixel sizes stored on each block.

- Updated dependencies [e5908e8]
  - @templatical/media-library@0.10.3
  - @templatical/renderer@0.10.3
  - @templatical/quality@0.10.3

## 0.10.2

### Patch Changes

- 5676cb3: Fix `Converting circular structure to JSON` when exporting after a drag inside a section (#203)

  Dragging a block within a section column could leave a Sortable expando back-ref (`HTMLDivElement.SortableXXX → instance → el → div`) reachable from the editor's live content. The public `getContent()` serialized with a naked `JSON.stringify`, so it threw on that cycle and broke export until the section was removed.

  - `@templatical/types`: add the cycle-safe `safeClone()` helper (`WeakSet`-replacer JSON round-trip that drops self-referencing back-refs instead of throwing).
  - `@templatical/editor`: `init().getContent()` and `initCloud().getContent()` now clone via `safeClone()`; the pre-ready fallback also defaults to an empty template instead of throwing when no content was supplied.
  - `@templatical/core`: `history.cloneContent()` now reuses `safeClone()` (same behavior, deduplicated).
  - @templatical/media-library@0.10.2
  - @templatical/quality@0.10.2
  - @templatical/renderer@0.10.2

## 0.10.1

### Patch Changes

- c7eb7ae: Fix a batch of correctness and data-loss bugs found during an audit

  Each fix ships with a regression test that fails without the change.
  - **`@templatical/editor` — rich-text URL sanitizer XSS bypass.** `isSafeUrl`
    only `.trim()`-ed the value before scheme matching, so payloads with embedded
    tab/newline/CR or leading control characters (e.g. `java\tscript:…`,
    `\x01javascript:…`) matched no scheme and were treated as safe, yet re-formed a
    live `javascript:` URL once rendered. The value is now normalized the way the
    WHATWG URL parser does (strip ASCII tab/LF/CR anywhere, strip leading
    C0-control/space) before the scheme check.
  - **`@templatical/core` (cloud) — `moveBlock` data loss.** The cloud editor
    spliced a block out of its parent before resolving the destination, so an
    invalid/stale `targetSectionId`, a non-section target, or an out-of-range
    `columnIndex` (all reachable via remote MCP/collaboration `move_block`
    payloads) dropped the block irrecoverably. It now resolves and validates the
    target before mutating the source, mirroring the OSS editor.
  - **`@templatical/core` (cloud) — collaboration broadcast positioning.** The
    `addBlock` broadcast wrapper dropped the 4th `index` argument, so duplicating a
    block or inserting a saved module at a position appended it to the end and
    desynced collaborators. The wrapper now forwards `index` and includes it in the
    broadcast payload.
  - **`@templatical/editor` — table cell edits clobbered in shadow DOM.** The
    `v-cell-content` guard compared `el.ownerDocument.activeElement`, which returns
    the shadow host (never the inner `<td>`) in the default shadow-DOM mount, so a
    concurrent external `update_block` overwrote in-progress keystrokes. It now
    resolves the focused element via `el.getRootNode().activeElement`.
  - **`@templatical/renderer` — display conditions dropped on nested blocks.**
    Blocks inside a section column never received their `{% if %}`/`{% endif %}`
    display-condition guards, so conditional content in a multi-column layout
    rendered unconditionally for every recipient. Display-condition wrapping is now
    applied to nested blocks too.
  - **`@templatical/editor` — snapshot restore failure left wrong content.** When a
    snapshot restore failed, the editor was left showing the previewed snapshot as
    the live document with the banner gone and the backup discarded. The content is
    now rolled back to the pre-preview state on failure, and the restore is no
    longer an unhandled promise rejection.
  - **`@templatical/media-library` — crop resize aspect-ratio distortion.**
    `resizeCanvas` injected a spurious factor when `maxWidth` was set but only
    `maxHeight` clamped, squishing the image horizontally and disagreeing with the
    on-screen preview. It now scales width by `maxHeight / targetHeight`.
  - **`@templatical/import-html` — wrapper-div content reordering.** Loose content
    appearing before a table inside a wrapping `<div>`/`<center>`/`<main>` was
    emitted after the table-derived sections, reordering the document. Pending loose
    content is now flushed before each nested table.
  - **`@templatical/import-html` — paragraph alignment dropped.** A container's
    `text-align` was lost when the inner `<p>` carried a non-style attribute
    (`class`/`id`/`dir`/…). Alignment is now applied with an attribute-tolerant
    matcher that merges into any existing `style`.
  - **`@templatical/import-beefree` — single-column row background dropped.** A
    single-column row's background color was discarded because only multi-column
    rows were wrapped in a section. Single-column rows with a non-transparent
    background are now wrapped in a one-column section carrying the background.

- 5a98533: Close meaningful test-coverage gaps and fix a BeeFree import bug
  - `@templatical/import-beefree`: stop emitting a redundant `font-weight: 400` span (now matches `@templatical/import-unlayer`).
  - `@templatical/editor`: export the merge-tag suggestion `render` factory so the popup lifecycle is unit-testable (behavior unchanged).
  - Added regression tests across editor, import, and media-library packages, and started measuring Vue SFCs in coverage.

- Updated dependencies [c7eb7ae]
- Updated dependencies [2ed1b80]
  - @templatical/renderer@0.10.1
  - @templatical/media-library@0.10.1
  - @templatical/quality@0.10.1

## 0.10.0

### Minor Changes

- ac9eab8: Add `CustomBlockDefinition.stylesheet` — definition-level CSS that emits once into `<mj-head><mj-style>` in the rendered MJML and is mirrored in the editor canvas.

  Custom blocks render as raw HTML inside an `mj-text` cell, which means MJML's automatic responsive behavior (column stacking, fluid images) only applies to the _outer_ layout — not to the internals of a custom block. Previously a developer had no clean place to put per-definition media queries, hover states, or block-specific font declarations; ad-hoc `<style>` blocks inside the `template` ended up in the email body rather than `<mj-head>`, with no dedupe across instances.

  The new `stylesheet?: string` field on `CustomBlockDefinition` solves this:
  - The renderer collects every definition's `stylesheet` from the content tree, dedupes by `customType` _and_ by trimmed content, and emits each unique stylesheet once as an additional `<mj-style>` block alongside the built-in visibility media queries.
  - The editor canvas mirrors the same CSS via a reactive `<style>` element rendered inside the editor root — in shadow-DOM mode it scopes to the shadow root; in light-DOM mode it shares the global stylesheet surface already established by `dist/style.css`.
  - The renderer adds an optional `getCustomBlockStylesheet?: (customType: string) => string | undefined | null` resolver to `RenderOptions`. The editor wires this from its block registry automatically; headless callers provide their own resolver from whatever definitions map they manage.
  - `TemplaticalEditor` (the OSS init return) gains `getCustomBlockStylesheet(customType)` for parity with `renderCustomBlock`.

  Class names in `stylesheet` are **not** scoped by the SDK — namespace them per definition (e.g. `.tplc-<type>-<element>`) to avoid collisions. Email-client caveats apply (Outlook desktop ignores `@media` queries, matching every other media-query-based feature in the SDK such as block visibility).

  Fully backward compatible: existing definitions and renderer callers that omit the new field/option produce the same MJML and editor behavior as before.

  Addresses #155 (raised as the follow-up to #146).

- 5d961a3: Remove the unimplemented `BaseBlock.customCss` per-block CSS surface.

  `BaseBlock.customCss?: string` was a typed field with a "Custom CSS" textarea in the block settings panel, but no renderer ever read it — the field was dead data (same shape as the `styles.responsive` removal in #154). The editor textarea, the type field, and the three locale strings (`customCss` / `css` / `cssPlaceholder`) plus the docs section are removed.

  Per-block free-form CSS is the wrong shape for an email editor: it targets end-users (who typically aren't email-CSS fluent), it doesn't dedupe across instances, and there is no reliable rendering surface for it that survives email-client variance. Custom-block-scoped CSS belongs at the definition level (developer-authored, deduped, emitted to `<mj-head><mj-style>…</mj-style></mj-head>`) — tracked separately in #155.

  **Migration:** saved templates carrying a `customCss` string keep parsing — the extra key is ignored at runtime. No data migration is required; nothing read the field before this change, so no rendered output changes.

- 4309923: Collapse the responsive model to Desktop + Mobile, dropping the `tablet` tier.

  `ViewportSize` is now `"desktop" | "mobile"` and `BlockVisibility` drops its `tablet` field. The editor's viewport toggle no longer offers a Tablet preview, and the renderer emits a single 480px breakpoint (`tpl-hide-mobile` ≤480px, `tpl-hide-desktop` ≥481px) instead of three bands. A "tablet" breakpoint isn't a meaningful concept for email (bodies are ~600px wide; a tablet viewport renders at full desktop width), and the useful responsive split is binary — mobile vs. not-mobile, matching MJML's model.

  **Migration:** saved templates carrying `visibility.tablet` keep parsing — the extra key is ignored at runtime. A block previously hidden only on tablet (`tablet: false` with `desktop`/`mobile` true) will now show on 481–768px devices, because there's no longer a `tpl-hide-tablet` class. No data migration is required; re-saving a block normalizes its visibility object to the new shape.

- af913bb: Remove `margin` from `BlockStyles`.

  `margin` was a canvas-only style: it surfaced in the block settings panel and applied to the editor wrapper, but the renderer never read it, so it was dropped from the exported email — a WYSIWYG mismatch. Email spacing is expressed via `padding` (the renderer honors it on every block), so `margin` added a second, unreliable spacing control with no email output.
  - `BlockStyles.margin` is removed from the type and from `createDefaultStyles()`.
  - The Margin inputs are removed from the block settings panel, and the editor canvas no longer applies a wrapper margin.
  - The BeeFree, Unlayer, and HTML importers no longer emit a `margin` field on converted blocks.

  Use `padding` for block spacing. Persisted templates that still carry a `margin` key load fine — the extra field is ignored.

- 72e1e58: Remove the unimplemented `BlockStyles.responsive` / `ResponsiveStyles` surface and make preview mode honor block visibility.

  `styles.responsive` (tablet/mobile padding overrides) was typed and documented but read by neither the renderer nor the editor preview, so the values were dead data (#146). The `ResponsiveStyles` type, the `responsive` field on `BlockStyles`, and their docs are removed. Per-breakpoint padding is intentionally not implemented: email clients vary in media-query support (Outlook desktop ignores them entirely) and MJML already stacks columns and scales fluidly on mobile. Use `visibility` for per-viewport show/hide.

  The editor preview now actually hides blocks that are set hidden on the current viewport (previously they were only dimmed with a badge), so the preview matches the exported MJML.

### Patch Changes

- f51fc5b: Add a single `lintTemplate(content, options?)` entry point that runs every linter — accessibility, structure, and links — and returns the merged issue list. Prefer it over calling `lintAccessibility` / `lintStructure` / `lintLinks` individually: new linter categories are picked up automatically by every consumer that funnels through it.

  The editor's live linter (`useTemplateLint`) now calls `lintTemplate` internally; behavior is unchanged. The individual linter exports remain available.

- Updated dependencies [2d9779b]
- Updated dependencies [ac9eab8]
- Updated dependencies [4309923]
- Updated dependencies [f51fc5b]
  - @templatical/renderer@0.10.0
  - @templatical/quality@0.10.0
  - @templatical/media-library@0.10.0

## 0.9.1

### Patch Changes

- 3c908d7: Fix theming of the built-in merge tag picker modal. The panel carries the `tpl` token class, which re-declares every design token with light-mode defaults, so without re-establishing the theme locally the picker ignored dark mode and the consumer `theme` config overrides. The panel now sets `data-tpl-theme` and applies the resolved theme styles — matching the pattern used by the other OSS panels (rich-text toolbar, link dialog) — so its surfaces, text, borders, and primary-accent highlight follow the editor theme correctly.
  - @templatical/renderer@0.9.1
  - @templatical/quality@0.9.1
  - @templatical/media-library@0.9.1

## 0.9.0

### Minor Changes

- 4dfe37e: Add a built-in merge tag picker modal. When `mergeTags.tags` is configured without `mergeTags.onRequest`, clicking "Insert merge tag" now opens a searchable, keyboard-navigable picker that lists every tag. The picker supports optional grouping (via a new `group` field on `MergeTag`) and per-tag helper text (via a new `description` field). `onRequest` continues to take precedence when set.

### Patch Changes

- @templatical/media-library@0.9.0
- @templatical/quality@0.9.0
- @templatical/renderer@0.9.0

## 0.8.5

### Patch Changes

- 674571b: Harden HTML/regex hot paths against polynomial-ReDoS and incomplete-sanitization classes flagged by GitHub code scanning. All changes preserve existing public APIs.
  - `@templatical/types`: rewrite `resolveHtmlMergeTagLabels` / `resolveHtmlLogicMergeTagLabels` from a `<span[^>]*…[^>]*>` regex to a single-pass linear scanner. Adversarial inputs that used to take O(n²) now complete in O(n).
  - `@templatical/renderer`: same linear-scanner rewrite for `convertMergeTagsToValues`. Paragraph stripper changed `[^>]*` → `[^<>]*` so it fails fast on `<p<p<p…`-style inputs.
  - `@templatical/quality`: linear-time HTML-comment stripper in `hasNestedAnchors`. An unterminated `<!--` now drops the rest of the input rather than leaving the literal `<!--` behind (closes the incomplete-sanitization gap). The `link.javascript-protocol` rule now also flags `data:` and `vbscript:` URLs — both can encode executable script and were previously only flagged as the lower-severity `link.unsupported-protocol`. Rule ID unchanged; message gained a `{protocol}` placeholder. Severity overrides set against `link.javascript-protocol` continue to apply.
  - `@templatical/import-unlayer` / `@templatical/import-beefree`: replace `<p[^>]*>([\s\S]*?)</p>` paragraph-wrap regex with a linear scanner. Button-label sanitizer now drops unterminated `<script` fragments instead of leaving them in the imported JSON. `parsePxValue` collapses two whitespace quantifiers around an optional `px` so trailing whitespace can't trigger backtracking.
  - CI: every job in `.github/workflows/ci.yml` now runs under a least-privilege `permissions: contents: read` token. Closes the missing-workflow-permissions alerts.
  - Playground Cloudflare Worker: `generateId` switched from `bytes[i] % 62` (biased — indices 0..7 were ~25% more likely than 8..61) to rejection sampling for a uniform distribution over the alphabet.

  Regression coverage added: 13 new tests assert linear-time behavior on 10k–50k-char adversarial inputs (bounded at 500ms), plus correctness tests for the new dangerous-protocol coverage, nested-span rewriting, and button-label sanitization edge cases.

- Updated dependencies [674571b]
  - @templatical/renderer@0.8.5
  - @templatical/quality@0.8.5
  - @templatical/media-library@0.8.5

## 0.8.4

### Patch Changes

- bfa416d: Fix input fields overflowing their container in the template settings panel and other sidebars (issue #115).

  Root cause: Tailwind preflight is disabled (intentional — see CLAUDE.md), so `box-sizing: border-box` was never applied to form elements. The hand-rolled `.tpl` reset block reset `font-family` and button chrome but not `box-sizing`. With `tpl:w-full` (`width: 100%`) plus a horizontal padding utility like `tpl:px-3.5` (28px total), inputs resolved to `content-box` and extended their padding beyond the parent — most visible in the 320px right sidebar.

  Fix: add `box-sizing: border-box` to the form-element reset in `packages/editor/src/styles/index.css`. Affects every `<input>`, `<select>`, `<textarea>`, and `<button>` under `.tpl`. Also resolves the social-toolbar slider/number-input misalignment reported in the same issue.

  Regression locked by `packages/editor/tests/formResetStyles.test.ts`.
  - @templatical/renderer@0.8.4
  - @templatical/quality@0.8.4
  - @templatical/media-library@0.8.4

## 0.8.3

### Patch Changes

- 5c56c19: Fix center alignment in Video and Image blocks (issue #111). When a fixed pixel width was set and alignment was set to "center", the editor preview rendered the block flush-left instead of centered.

  Root cause: the alignment styles mixed the CSS `margin` shorthand with the `marginLeft` longhand in the same Vue style object. Vue patched `margin: "0 auto"` first (expanding to all four longhands including `margin-left: auto`), then patched `marginLeft: undefined` which cleared `margin-left` back to `0`. Result: `margin-right: auto` only, which is left-alignment with extra space on the right.

  Fix: use only longhand `marginLeft` / `marginRight` properties — no shorthand. MJML export was unaffected (the renderer emits `align="center"` on `<mj-image>` directly); only the editor preview was broken.
  - @templatical/renderer@0.8.3
  - @templatical/quality@0.8.3
  - @templatical/media-library@0.8.3

## 0.8.2

### Patch Changes

- Updated dependencies [d835948]
  - @templatical/quality@0.8.2
  - @templatical/renderer@0.8.2
  - @templatical/media-library@0.8.2

## 0.8.1

### Patch Changes

- 75bfd29: Reshape `LintOptions` around per-tool config namespaces. Each linter's severity overrides and tool-specific knobs now live under its own key, and each linter can be disabled individually.

  **`@templatical/quality`**
  - `LintOptions.rules` and `LintOptions.thresholds` moved into their owning linter namespace: `accessibility.rules`, `accessibility.thresholds`, `structure.rules`, `links.rules`. `LintOptions.links` keeps `nonProductionHosts` but now also accepts `links.rules`.
  - Each tool key (`accessibility`, `structure`, `links`) accepts `false` to disable that linter entirely without enumerating its rules — e.g. `lintLinks(content, { links: false })` returns `[]`.
  - New `isLintFullyDisabled(options)` helper returns `true` when no linter would run — either `disabled: true` or all three tool keys set to `false`. The editor uses this gate to skip lazy-loading the package, hide the Issues sidebar tab, and suppress canvas badges. Headless consumers can use it to short-circuit before any linter call.
  - New exported option types: `AccessibilityLintOptions`, `StructureLintOptions`, `LinksLintOptions`, `RuleOverrides`. The old `LintLinksOptions` type is removed (replaced by `LinksLintOptions`).
  - Severity override keys still use the full prefixed rule ID (`a11y.*`, `structure.*`, `link.*`) — the same ID emitted on `LintIssue.ruleId`, so values copied from an issue paste straight into config.

  ```diff
  - lintAccessibility(content, {
  -   rules: { "a11y.img-missing-alt": "warning" },
  -   thresholds: { minFontSize: 16 },
  - });
  + lintAccessibility(content, {
  +   accessibility: {
  +     rules: { "a11y.img-missing-alt": "warning" },
  +     thresholds: { minFontSize: 16 },
  +   },
  + });

  - lintLinks(content, {
  -   rules: { "link.localhost-or-staging": "error" },
  -   links: { nonProductionHosts: ["*.preview.*"] },
  - });
  + lintLinks(content, {
  +   links: {
  +     rules: { "link.localhost-or-staging": "error" },
  +     nonProductionHosts: ["*.preview.*"],
  +   },
  + });
  ```

  **`@templatical/editor`**
  - `init({ lint })` and `initCloud({ lint })` consume the new shape verbatim. When every per-tool key is set to `false` the editor behaves as if `lint.disabled === true`: no chunk download for `@templatical/quality`, no Issues sidebar tab, no inline canvas badges.
  - `useTemplateLint` re-exports the new `isLintFullyDisabled` helper.

- Updated dependencies [75bfd29]
  - @templatical/quality@0.8.1
  - @templatical/renderer@0.8.1
  - @templatical/media-library@0.8.1

## 0.8.0

### Minor Changes

- 6705a64: Add `lintStructure` + `lintLinks` and reshape the quality package around a shared linting surface.

  **`@templatical/quality`**
  - New `lintStructure(content, options?)` linter — 5 rules: `structure.duplicate-block-id`, `structure.section-column-mismatch`, `structure.nested-section`, `structure.empty-section` (auto-fix removes the section), `structure.empty-column`.
  - New `lintLinks(content, options?)` linter — 5 rules covering URL hygiene across every URL-bearing field in the template (anchors in rich text + `button.url`, `image.linkUrl`, `video.url`, `menu.items[].url`, `social.icons[].url`):
    - `link.javascript-protocol` (error) — flags `javascript:` hrefs that the render-time sanitizer would silently strip.
    - `link.unsupported-protocol` (warning) — flags explicit schemes outside `http`, `https`, `mailto`, `tel`, `sms`.
    - `link.malformed-mailto` (warning) — sanity-checks `mailto:` recipient + domain shape.
    - `link.malformed-tel` (warning) — rejects letters in `tel:` URIs.
    - `link.localhost-or-staging` (warning) — flags URL hosts matching `options.links.nonProductionHosts` (default catches `localhost`, `127.0.0.1`, `0.0.0.0`, `*.local`, `*.staging.*`, `*.dev.*`).
  - New `walkUrls(content) → UrlOccurrence[]` helper for headless callers building URL-scoped rules.
  - `LintOptions` gains `links?: { nonProductionHosts?: string[] }` for `link.localhost-or-staging` configuration. `DEFAULT_NON_PRODUCTION_HOSTS` is exported as the baseline.
  - Rule IDs are now namespaced. Every accessibility rule is prefixed with `a11y.` (e.g. `img-missing-alt` → `a11y.img-missing-alt`); structure rules use `structure.`; link rules use `link.`. Severity overrides and message-map keys must use the prefixed form.
  - Type names renamed for cross-linter reuse: `A11yIssue` → `LintIssue`, `A11yOptions` → `LintOptions`, `A11yPatch` → `LintPatch`, `A11yPatchContext` → `LintPatchContext` (now also exposes `removeBlock`), `A11yThresholds` → `LintThresholds`, `DEFAULT_THRESHOLDS` → `DEFAULT_A11Y_THRESHOLDS`. The `RULES` export is now `ACCESSIBILITY_RULES`; new `STRUCTURE_RULES` and `LINK_RULES` exports sit alongside it.
  - New exports: `lintStructure`, `STRUCTURE_RULES`, `formatStructureMessage`, `getStructureMessages`, `SUPPORTED_STRUCTURE_MESSAGE_LOCALES`, `StructureMessageMap`, `StructureRuleMessageId`, `lintLinks`, `LINK_RULES`, `walkUrls`, `UrlOccurrence`, `UrlSource`, `formatLinkMessage`, `getLinkMessages`, `SUPPORTED_LINK_MESSAGE_LOCALES`, `LinkMessageMap`, `LinkRuleMessageId`, `LintLinksOptions`, `ResolvedLinksOptions`, `DEFAULT_NON_PRODUCTION_HOSTS`.

  **`@templatical/editor`**
  - `init({ accessibility })` is renamed to `init({ lint })` — the same option object now drives every linter exported by `@templatical/quality` (accessibility + structure + links).
  - Sidebar tab renamed from "Accessibility" to "Issues" and now shows all three linter families. The composable is `useTemplateLint` (was `useAccessibilityLint`); the inject key is `TEMPLATE_LINT_KEY`; the components are `IssuesPanel.vue` and `BlockIssueBadge.vue`.
  - Section toolbar now rebalances `children` when the columns layout changes (1↔2↔3 / 1-2 / 2-1) — grows pad with empty columns, shrinks merge trailing columns into the last kept column so blocks are never silently dropped. Eliminates the `structure.section-column-mismatch` error that previously fired on every layout change.
  - Editor button reset (`.tpl button { background: none }`) now wrapped in `:where()` so its specificity drops to (0,0,1) and per-button utility classes (e.g. `tpl:bg-[var(--tpl-primary)]`) win. Fixes the Fix-button-renders-transparent bug introduced by the canvas reset; affects every primary-bg button in the editor.

### Patch Changes

- Updated dependencies [6705a64]
  - @templatical/quality@0.8.0
  - @templatical/renderer@0.8.0
  - @templatical/media-library@0.8.0

## 0.7.3

### Patch Changes

- 507c5be: Batch of bug fixes hardening editor correctness and security:
  - **Link dialog rejects dangerous URL schemes.** `javascript:`, `data:`, `vbscript:`, `file:` (plus case-bypasses like `JaVaScRiPt:` and whitespace-padded variants) are now dropped at link-insert time. Safe schemes (`http`, `https`, `mailto`, `tel`, `ftp`, `ftps`, `sms`, `xmpp`, `cid`) and `#` anchors still pass through.
  - **`v-html` content sanitized before render.** `ParagraphBlock` and `TitleBlock` now scrub `<script>`/`<style>`/`<iframe>`/`on*` event handlers and unsafe `href` / `src` schemes from `block.content` before binding it to `v-html`. Closes the XSS path where a malicious or compromised template JSON could execute code on canvas load. TipTap-authored content (the common case) is unaffected.
  - **Block duplication regenerates nested IDs.** Cloning a `table`, `social`, or `menu` block previously reused identical `rows[].id` / `cells[].id` / `icons[].id` / `items[].id` from the source, violating the unique-id invariant.
  - **Removing a section clears descendant selection.** Previously, deleting an ancestor with a child selected left `selectedBlockId` dangling on the now-orphan id. The full subtree is walked on remove and selection is cleared if any descendant id matches.
  - **`addBlock` / `moveBlock` validate `columnIndex` against the section layout.** Passing `columnIndex: 5` on a `"2"`-layout section no longer creates phantom columns persisted into JSON; out-of-range indices are rejected and `moveBlock` leaves the source intact.
  - **Media-picker callers guard against post-unmount writes.** `ImageBlock`, `ImageToolbar`, `VideoToolbar`, and the custom-block `ImageField` now check an alive flag after `await onRequestMedia()`. Closing the editor mid-pick no longer triggers zombie `emit("update")` / pulse-ref writes on a torn-down component.
  - **Keyboard shortcuts scoped to the active editor when two are mounted.** Each `useEditorCore` instance previously installed its own `document` keydown listener, so a single `Cmd+Z` fired both editors' undo handlers. The new `activeEditorTracker` routes shortcuts to the editor the user most recently interacted with (single-editor pages keep the original always-active behavior).
  - **`MergeTagSuggestion` cancels its pending `requestAnimationFrame` on exit.** The reposition-after-paint frame previously ran after the popup tore down, pinning the Vue app and DOM nodes for one frame.
  - **`useMergeTagField.insertMergeTag` no longer emits after the host component unmounts.** A scope-dispose flag now gates the post-`await requestMergeTag()` writes (emit + `isEditing` + `nextTick`).
  - **`useFonts.loadCustomFonts` no longer flips `isLoaded` after dispose.** The post-`Promise.allSettled` write is gated by the same scope-dispose flag.
  - @templatical/media-library@0.7.3
  - @templatical/renderer@0.7.3
  - @templatical/quality@0.7.3

## 0.7.2

### Patch Changes

- 5d1b0c5: Block clone now inserts directly after the source block (in the same section column when applicable) instead of appending to the end of the canvas. Action bar now follows the editor's UI theme — appears dark in editor dark mode instead of being forced light by the canvas-wrapper override. Canvas dark-mode preview refactored: filter moved from `.tpl-canvas-wrapper` onto a sibling bg layer + per-block `.tpl-block-content` wrapper, so block chrome (action bar, indicators) is never inside the filter region — no more counter-filter flicker when toggling dark preview. Fixes drag-inside-section in Chrome: all three `<VueDraggable>` instances (sidebar, canvas, section) now use `force-fallback` to bypass Chrome's silent failure to initiate native drag from a nested HTML5 Sortable AND to ensure consistent cross-list drag-over coordination (Sortable only binds native `dragover` in HTML5 mode, so mixing modes breaks cross-list drops). Fixes a `cyclic object value` error that broke clone/move after a within-section drag — `history.cloneContent` is now cycle-safe (drops back-refs instead of throwing) and `SectionBlock.setColumnBlocks` deep-clones each emitted block to strip any Sortable expando the drag handler might attach. Adds `findBlockLocation(blockId)` to `useEditor` (and the cloud variant) and an optional `findBlockLocation` option on `useBlockActions` to power the new "insert clone after source" behavior.
  - @templatical/media-library@0.7.2
  - @templatical/renderer@0.7.2
  - @templatical/quality@0.7.2

## 0.7.1

### Patch Changes

- 254a204: Render social icons as hosted PNGs instead of inline SVG data URIs so they display in Outlook desktop (the Word rendering engine has no SVG support and rejects base64 in `<img src>`). PNGs are shipped with the npm package and served via the version-pinned unpkg URL by default; override via the new `RenderOptions.socialIconsBaseUrl` to self-host. Replace the Style segmented control in the social icons sidebar with a native dropdown so the 5-option list no longer overflows the sidebar.
- Updated dependencies [254a204]
  - @templatical/renderer@0.7.1
  - @templatical/quality@0.7.1
  - @templatical/media-library@0.7.1

## 0.7.0

### Minor Changes

- 2832f5d: Mount the editor inside a Shadow DOM by default. `init({ container })` now resolve `shadowDom: true` when the option is omitted — host page stylesheets no longer cascade into editor elements (`p`, `h1`, `a`, `input`, etc.) via tag selectors, closing [issue #70](https://github.com/templatical/sdk/issues/70).

  **Behavior changes consumers may notice:**
  - External `document.querySelector("#editor .tpl-…")` queries no longer reach editor internals because the editor's DOM lives inside `container.shadowRoot`. Walk the shadow root explicitly (`container.shadowRoot.querySelector(...)`) or opt out with `shadowDom: false`.
  - Host stylesheets that intentionally styled editor elements via element selectors stop applying. The supported theming protocol is now the `--tpl-user-*` CSS custom property namespace — set `--tpl-user-primary`, `--tpl-user-radius-md`, etc. on the editor container (or any ancestor) and the override inherits across the shadow boundary. The existing `theme` config option still takes precedence and works unchanged.
  - Browser minimums in default mode bump to Firefox 101+ and Safari 16.4+ (required by the `adoptedStyleSheets` API). Chrome / Edge 80+ is unchanged. Pass `shadowDom: false` to keep the previous light-DOM mount with broader browser support.

  The `shadowDom: false` escape hatch remains supported.

### Patch Changes

- @templatical/renderer@0.7.0
- @templatical/quality@0.7.0
- @templatical/media-library@0.7.0

## 0.6.7

### Patch Changes

- 2afaea1: Simplify locale resolution in `@templatical/editor` and `@templatical/media-library` and align behavior between the two. Both packages now share the same canonicalization step (trim, treat `_` as `-`, lowercase) so locales like `pt_BR` are accepted alongside `pt-BR`. The editor's exact-then-base fallback logic is deduplicated behind a single helper used by `resolveLocale`, `isLocaleSupported`, and `isCloudLocaleSupported`. `@templatical/editor` now re-exports `getSupportedLocales`, `getSupportedCloudLocales`, `isLocaleSupported`, `isCloudLocaleSupported`, and `getBaseLocale` from its public entry point so consumers can drive their own locale pickers without reaching into the i18n subpath. No behavior change for any existing locale input; this is purely cleanup and a small API surface addition.
- Updated dependencies [2afaea1]
  - @templatical/media-library@0.6.7
  - @templatical/renderer@0.6.7
  - @templatical/quality@0.6.7

## 0.6.6

### Patch Changes

- 4bdf972: Fix Title block rendering as `<p>` inside the editor canvas. The exported MJML/HTML already used the correct `<h${level}>` tag, but the canvas wrapped TipTap's stored content in a plain `<div>` and left the outer `<p>` from the editor's paragraph node in place, so the editor preview diverged from the final email and consumer CSS rules targeting `p` could unintentionally style titles in the canvas. The non-editing branch of `TitleBlock` now renders `h1`–`h4` matching `block.level` and strips the single outer `<p>` wrapper using the same rule the renderer applies. No data migration is needed — existing templates already carry `level` and render correctly on reload. Consumers that previously overrode title styling via `.tpl-text-content p` selectors in the canvas should switch to heading selectors (`h1`–`h4`) to match the exported output.
  - @templatical/renderer@0.6.6
  - @templatical/quality@0.6.6
  - @templatical/media-library@0.6.6

## 0.6.5

### Patch Changes

- 9274721: Replace `vuedraggable` with `vue-draggable-plus`. The previous draggable library shipped a UMD-only bundle whose `define.amd` wrapper got inlined into our published editor chunks, causing `error TP1200 unsupported AMD define() dependency element form` for any Next.js 15+ consumer using Turbopack (the default). The new library ships proper ESM, so the published bundle no longer contains UMD/AMD wrappers and Turbopack builds succeed. No public API change.
  - @templatical/renderer@0.6.5
  - @templatical/quality@0.6.5
  - @templatical/media-library@0.6.5

## 0.6.4

### Patch Changes

- 3845ea9: Fix Webpack 5 production build failure on `@templatical/media-library` (issue #63). The dynamic `import()` for the cloud media browser was missing the `try/catch` wrapper that the other three optional peers (`pusher-js`, `@templatical/quality`, `@templatical/renderer`) already had. Without it, Webpack escalates "Module not found" from a warning to an error and breaks the consumer's production build. Wraps the import so OSS consumers (no cloud, no media-library installed) can build cleanly. Adds a regression test that builds the editor as a real Webpack 5 consumer would (`pnpm run test:webpack-consumer`, wired into CI). Vite, esbuild, and Rolldown were unaffected.
  - @templatical/renderer@0.6.4
  - @templatical/quality@0.6.4
  - @templatical/media-library@0.6.4

## 0.6.3

### Patch Changes

- ef598bd: Fix missing video block configuration panel. Selecting a video block in the canvas previously showed only the common spacing/background/display settings — there was no way to set the video URL, custom thumbnail, alt text, width, alignment, or open-in-new-tab from the sidebar. Adds a `VideoToolbar` matching the parity of `ImageToolbar`, including merge-tag-aware URL/thumbnail inputs and a media browser button when an `onRequestMedia` handler is configured.
  - @templatical/renderer@0.6.3
  - @templatical/quality@0.6.3
  - @templatical/media-library@0.6.3

## 0.6.2

### Patch Changes

- de4b0a3: Polish and general bug fixes
- Updated dependencies [de4b0a3]
  - @templatical/renderer@0.6.2
  - @templatical/media-library@0.6.2
  - @templatical/quality@0.6.2

## 0.6.1

### Patch Changes

- Updated dependencies [b79c7cd]
  - @templatical/quality@0.6.1
  - @templatical/renderer@0.6.1
  - @templatical/media-library@0.6.1

## 0.6.0

### Minor Changes

- 55002de: Introduce `@templatical/quality` — an MIT-licensed accessibility linter for Templatical email templates — and wire it into the editor.

  **New package: `@templatical/quality`**
  - `lintAccessibility(content, options?)` — synchronous, pure, no DOM. Walks the JSON `TemplateContent` tree and runs every enabled rule, returning `A11yIssue[]` with `severity`, `message`, `blockId`, and an optional `fix` patch.
  - 19 deterministic rules across images, headings, links, text, buttons, and structure (missing alt, filename-style alt, low contrast, vague CTAs, heading-skip, multiple H1, target=\_blank without rel=noopener, all-caps, undersized touch targets, missing preheader, …). Three rules ship one-click auto-fixes.
  - Public utilities: `walkBlocks`, `getContrastRatio` (WCAG sRGB), `parseHex`, `isOpaqueHex`, `extractAnchors`, `extractText`, `getDictionary`, `formatMessage`, `getMessages`. Plus `Rule`, `RuleHit`, `RuleMeta`, `A11yIssue`, `A11yOptions`, etc.
  - Per-rule severity overrides (`'error' | 'warning' | 'info' | 'off'`) and configurable thresholds (`altMaxLength`, `minFontSize`, `allCapsMinLength`, `minTouchTargetPx`).
  - Locale-aware: rule messages and vague-text dictionaries auto-discover via `import.meta.glob` (drop a `messages/<lang>.ts` or `dictionaries/<lang>.ts` and it's bundled). The dictionary is a cross-locale union — a German-locale email with an English "Click here" button still flags. Ships `en` + `de` today.

  **Type changes (`@templatical/types`)**
  - `TemplateSettings.locale` (optional, defaults to `'en'`) — drives rendered `<mjml lang="…">`.
  - `ImageBlock.decorative` (optional boolean) — when true, the renderer forces `alt=""` and adds `role="presentation"`.
  - `PlanConfig.accessibility.blockOnError` (cloud) — server-side policy hook.

  **Renderer changes (`@templatical/renderer`)**
  - Emits `<mjml lang="…">` from `settings.locale`.
  - Honors `ImageBlock.decorative` (empty alt + role="presentation").

  **Editor integration (`@templatical/editor`)**
  - New `accessibility` option on `init()` / `initCloud()` — full `A11yOptions` shape. Optional peer; the dynamic import is gated and tree-shakeable, so the linter chunk never downloads when not used.
  - New `useAccessibilityLint` composable — debounced 500ms re-lint on content changes, applies auto-fixes through the editor's existing `updateBlock` / `updateSettings` (history-tracked, undoable per fix).
  - New right-sidebar "Accessibility" tab (lazy-loaded). Errors / Warnings / Info groups with localized messages, "Jump to block" and "Fix" buttons, count badge.
  - New inline canvas badge inside `BlockWrapper` — `CircleAlert` for errors, `TriangleAlert` for warnings.
  - New "Decorative image" toggle on `ImageToolbar` bound to `block.decorative`.
  - Editor mode forces the linter `locale` to match `init({ locale })` — `accessibility.locale` is overwritten on the way through. Headless callers keep full control.
  - Cloud save-gate: when `planConfig.accessibility.blockOnError === true` and the linter reports any errors, the save flow surfaces a confirmation modal. Both the toolbar Save button and the `Cmd/Ctrl+S` keyboard shortcut route through the gate.
  - New i18n keys (`accessibility.*` in `en` / `de` OSS chunks; `saveGate.*` in cloud chunks).
  - CDN bundle ships `@templatical/quality` and `@templatical/renderer` as separate code-split chunks, so CDN consumers don't install the optional peer manually.

### Patch Changes

- Updated dependencies [55002de]
  - @templatical/quality@0.1.0
  - @templatical/renderer@1.0.0
  - @templatical/media-library@1.0.0

## 0.5.1

### Patch Changes

- 6a17329: Fix several merge-tag UX bugs:
  - **Insert button no longer renders without an `onRequest` callback.** When only static `mergeTags.tags` were configured, the "Insert merge tag" button still showed in the rich-text toolbar, `MergeTagInput`, and `MergeTagTextarea`, but clicking it silently no-oped (`requestMergeTag` returns null without `onRequestMergeTag`). Static-tags users discover tags via the autocomplete typing trigger; the button now only appears when `onRequest` is wired up. Renamed the underlying flag from `isEnabled` → `canRequestMergeTag` for clarity.
  - **Autocomplete popup positioning no longer breaks on consumer pages with transformed ancestors.** The popup used to mount inside `[data-tpl-theme]` (the editor wrapper) and rely on `position: fixed` resolving against the viewport. Any `transform` on a consumer-page ancestor (route transitions, reveal animations) makes that ancestor the containing block for fixed descendants — the popup landed off-screen instead of pinning to the caret. Popup now mounts to `document.body` and snapshots `--tpl-*` design tokens + typography from the editor's theme root inline so styling carries over without inheriting `.tpl` base rules.
  - **Popup rounded corners restored.** `MergeTagSuggestionList` was referencing the undefined `--tpl-radius-md` token; switched to `--tpl-radius`.

  Cleanup: leftover "placeholder" copy in editor and playground i18n strings (and corresponding docs in `apps/docs`) is updated to "merge tag" where it referred to the merge-tag concept rather than HTML input placeholder text.
  - @templatical/renderer@0.5.1
  - @templatical/media-library@0.5.1

## 0.5.0

### Patch Changes

- @templatical/renderer@1.0.0
- @templatical/media-library@1.0.0

## 0.4.0

### Minor Changes

- f5a94ab: Add new `@templatical/import-unlayer` package that converts Unlayer design JSON (the output of `editor.saveDesign(...)`) into Templatical's `TemplateContent` shape. Mirrors `@templatical/import-beefree`: maps `text`, `heading`, `image`, `button`, `divider`, `html`, `menu`, `social`, `video`; reports `timer` as html-fallback and `form` as skipped; flattens 4+ column rows; surfaces a per-content conversion report. MIT-licensed.

  The Unlayer migration guide (`/guide/migration-from-unlayer` and `/de/guide/migration-from-unlayer`) is rewritten around the importer. The playground replaces the BeeFree-only chooser button with a single "Import existing template" modal that exposes BeeFree and Unlayer as tabs. README, license FAQ, security policy, and contributing guide reflect the new package; cloud headless API reference adds the matching `templates/import/from-unlayer` route row.

### Patch Changes

- Updated dependencies [f5a94ab]
  - @templatical/renderer@1.0.0
  - @templatical/media-library@1.0.0

## 0.3.2

### Patch Changes

- b29848a: Fix a batch of bugs uncovered by a targeted audit:
  - **`@templatical/editor` `useFocusTrap`**: the focus-restore `requestAnimationFrame` is now cancelled when the trap deactivates before the frame fires, so it no longer touches stale DOM. A second activation (e.g. container ref swapped while still active) now tears down the previous keydown listener before binding a new one, preventing duplicate listeners.
  - **`@templatical/editor` `useMergeTagField.insertMergeTag`**: a rejection from `requestMergeTag()` no longer leaves `insertingMergeTag` stuck at `true` and locking out `stopEditing()`. The flag is now reset in a `finally`.
  - **`@templatical/editor` bundle-stats Vite plugin**: a failure inside the stats-generation `closeBundle` hook (missing dist file, unexpected layout) no longer crashes the editor build. The plugin warns and skips instead.
  - **`@templatical/editor` `useRichTextLinkDialog`**: `mailto:`, `tel:`, `ftp:`, and `#anchor` URLs are no longer mangled by an unconditional `https://` prefix. Only bare hostnames/paths get the scheme prepended.
  - **`@templatical/editor` `useKeyboardReorder`**: pressing Escape after a lifted block was moved across containers (e.g. concurrent drag) now correctly restores it. The cancel logic compares the full original location, not just the index.
  - **`@templatical/editor` `formatRelativeTime`**: an invalid date string now returns `null` instead of `"NaN days ago"`.
  - **`@templatical/editor` `SlidingPillSelect`**: the sliding pill is now hidden when `modelValue` matches no option, instead of silently parking on the first one and producing an `aria-checked` mismatch.
  - **`@templatical/editor` `useCloudMediaLibrary.handleRequestMedia`**: a second call while the built-in media library is open no longer leaves the first call's promise hanging forever. The pending promise is now resolved with `null` before opening a new picker.
  - **`@templatical/renderer` table & menu colors**: `borderColor`, `headerBackgroundColor`, `separatorColor`, and menu `item.color` are now run through a CSS-value escaper that strips `;`, `{`, `}`, and newlines. Tampered or AI-generated color values can no longer break out of the inline `style="color: …"` attribute to inject extra properties (e.g. `background: url(…)` for open-tracking).
  - **`@templatical/renderer` title block**: title content stored as TipTap's `<p>...</p>` no longer produces invalid `<h2><p>...</p></h2>` markup. A single outer `<p>` wrapper is stripped before the `<h${level}>` tag is emitted.
  - **`@templatical/renderer` columns**: the three-column layout widths now sum to exactly 100% (the last column rounds to 33.34% instead of 33.33%, eliminating a 0.01% gap that some clients distributed unpredictably).
  - **`@templatical/renderer` image/video/button/menu links**: `target="_blank"` links now also emit `rel="noopener"`, closing a `window.opener` leak when emails are opened in webmail clients.
  - **`@templatical/renderer` custom block background**: `CustomBlock.styles.backgroundColor` now reaches the compiled HTML — the renderer was emitting `<mj-text>` without `container-background-color`, so MJML silently dropped the bg (same class as #26).
  - **`@templatical/renderer` image with empty `src`**: the renderer no longer emits `<mj-image src="">` (which compiles to a broken-image `<img src="">`). Empty-src images are now skipped, mirroring the `video` block's existing behavior.
  - **`@templatical/renderer` title heading levels**: out-of-range `level` values no longer interpolate `font-size="undefinedpx"` and break MJML compilation. Both `font-size` and the heading tag are clamped to a defined entry.
  - **`@templatical/renderer` nested sections**: a `SectionBlock` placed inside a column (via tampered JSON or programmatic API) is now filtered out instead of emitting `<mj-section>` inside `<mj-column>`, which mjml@5 rejects with a hard error.
  - **`@templatical/renderer` button**: `backgroundColor` and `textColor` are now `escapeAttr`'d like every other user-supplied attribute. A `"` in either value can no longer break the surrounding MJML attribute.
  - **`@templatical/renderer` button with empty `url`**: an empty button URL no longer compiles to a clickable `<a href="">` (which navigates to the current page on click). The `href` attribute is omitted entirely when the URL is empty.
  - **`@templatical/renderer` spacer**: spacers now occupy exactly `height` pixels in the exported HTML, matching the editor canvas. `block.styles.padding` no longer inflates a 30px spacer to 50px.
  - **`@templatical/renderer` empty paragraph**: a paragraph with no content (or only `<p></p>` / whitespace) now renders to an empty string instead of a styled `<td>` cell that silently consumes vertical and horizontal whitespace.
  - **`@templatical/renderer` paragraph default font-size**: paragraphs without an explicit font-size now render at 14px to match the editor canvas (Tailwind `text-sm`), not mjml@5's intrinsic 13px default. Per-section TipTap inline `style="font-size: …"` overrides still apply.

- Updated dependencies [b29848a]
  - @templatical/renderer@0.3.2
  - @templatical/media-library@0.3.2

## 0.3.1

### Patch Changes

- 6f343f8: Emit `dist/bundle-stats.json` during the editor build with gzipped totals for the initial static bundle and the lazy chunks. Powers the bundle-size pill on templatical.com — the marketing site fetches the file from unpkg at its own build time so the published number reflects what real consumers see (Vite/webpack/Rollup preserve dynamic-import boundaries) instead of a bundler-server-side overcount.

  File contract:

  ```json
  {
    "version": "x.y.z",
    "initialGzipBytes": 211686,
    "initialRawBytes": 717015,
    "initialFileCount": 30,
    "lazyGzipBytes": 250763,
    "lazyRawBytes": 876728,
    "lazyFileCount": 43,
    "generatedAt": "2026-05-02T12:48:23.883Z"
  }
  ```

  Implemented as a small Vite `closeBundle` plugin in `packages/editor/vite.config.ts` — walks the static-import graph from `templatical-editor.js`, gzips each chunk individually, and treats every other `.js` in `dist/` as lazy. `dist/cdn/` (the separate script-tag distribution) is excluded.
  - @templatical/renderer@0.3.1
  - @templatical/media-library@0.3.1

## 0.3.0

### Minor Changes

- d65bb0f: Merge tag autocomplete in rich text editors. Typing the syntax opener (e.g. `{{` for Liquid/Handlebars, `*|` for Mailchimp, `%%=` for AMPscript) inside a paragraph or title block surfaces a popup of matching merge tags. Selecting an item (mouse click, `Enter`, or `Tab`) inserts the tag as a styled node — same form as the toolbar picker.

  **`@templatical/types`**
  - New `getSyntaxTriggerChar(syntax)` helper that maps a `SyntaxPreset` to its trigger string (`"{{"`, `"*|"`, `"%%="`) or `null` for custom regex syntaxes.
  - `MergeTagsConfig` gains optional `autocomplete?: boolean` (default `true`). Set to `false` to disable the popup while keeping the toolbar picker available.

  **`@templatical/editor`**
  - New `MergeTagSuggestion` TipTap extension built on `@tiptap/suggestion`. Filters tags case-insensitively against `label` and `value`, capped at 10 results.
  - New `MergeTagSuggestionList.vue` popup component — keyboard navigable (`↑`/`↓`/`Enter`/`Tab`/`Esc`), ARIA combobox-compliant (`role="combobox"` + `aria-haspopup`/`aria-expanded`/`aria-controls`/`aria-activedescendant` on the contenteditable; `role="listbox"` + `role="option"` + stable per-option ids on the popup).
  - Wired into `ParagraphEditor.vue` and `TitleEditor.vue`. Autocomplete activates only when `tags` is non-empty AND `syntax` matches a built-in preset.
  - Popup mounts at the theme root (outside the Canvas's `filter`-induced containing block) so dark-mode positioning stays correct. Viewport-flip logic places the popup above the caret when there's not enough room below; constrained to `max-h: 50vh` with internal scrolling.
  - New i18n key `mergeTag.suggestionEmpty` (en + de).

  **Behavior**
  - Trigger fires regardless of preceding character (no whitespace requirement) — `.{{` opens the popup just like ` {{`.
  - Custom-regex syntaxes silently disable autocomplete since the trigger string can't be inferred.

  **Cloud editor**
  - Inherited transitively — `CloudEditor.vue` uses the same `ParagraphBlock`/`TitleBlock` components, so autocomplete works there as well with no extra wiring.

### Patch Changes

- Updated dependencies [d65bb0f]
  - @templatical/renderer@1.0.0
  - @templatical/media-library@1.0.0

## 0.2.1

### Patch Changes

- e526711: Fix a batch of bugs uncovered by a targeted audit:
  - **`@templatical/core` `useAutoSave`**: a save scheduled inside the debounce window no longer fires after `enabled` flips to `false` or `pause()` is called. The setTimeout callback now re-checks both gates.
  - **`@templatical/media-library` `init()`**: two rapid `init()` calls no longer orphan the first-mounted Vue app. The "unmount existing" guard moved after the awaits so the second call observes the first instance.
  - **`@templatical/core` `useEditor.moveBlock`**: passing an invalid `targetSectionId` no longer deletes the block. The target section is resolved before the source is mutated, so an invalid target is now a clean no-op.
  - **`@templatical/core` `useEditor` lock checks**: `addBlock` and `moveBlock` now respect `isBlockLocked` for the target section / moved block, matching the existing checks on `updateBlock` and `removeBlock`.
  - **`@templatical/editor` keyboard shortcuts**: `Cmd/Ctrl+S` now triggers save when Caps Lock is on. The handler matches `e.key.toLowerCase() === "s"` to mirror the `z` (undo/redo) handler.
  - **`@templatical/editor` `init()` and `initCloud()`**: same race fix as the media-library one — concurrent calls no longer orphan the first-mounted editor app.
  - **`@templatical/types` `resolveSyntax`**: passing an unknown preset name now falls back to `liquid` instead of returning `undefined` and crashing downstream callers.
  - **`@templatical/editor` `useFonts`**: a custom font that fails to load is now registered for cleanup, so its `<link>` tag is removed on editor unmount instead of leaking in `<head>`.
  - **`@templatical/core` `useHistoryInterceptor`**: history snapshots are no longer recorded for no-op mutations (e.g. updating a peer-locked block), preventing the undo button from becoming a silent no-op.
  - **`@templatical/editor` `useRichTextEditor`**: unmounting the host component while TipTap extensions are still loading no longer leaks a TipTap editor instance. A `destroyed` guard short-circuits and disposes any editor created across the await boundary.
  - **`@templatical/media-library` `useMediaLibrary.loadItems` / `loadMore`**: a stale `browseMedia` response from a previous folder no longer overwrites the current view. Each request carries a monotonic token and only the latest response commits to state.
  - **`@templatical/types` `isMergeTagValue`**: handlebars logic tags such as `{{#if x}}` and `{{/if}}` are no longer misclassified as value merge tags by the liberal handlebars value regex.

- Updated dependencies [e526711]
  - @templatical/media-library@0.2.1
  - @templatical/renderer@0.2.1

## 0.2.0

### Minor Changes

- 058dfff: This release bundles three changes: an OSS/Cloud locale split, a fix for missing custom blocks in MJML/JSON exports, and a fix for incorrect background-color attributes on inner MJML elements.

  ## OSS/Cloud locale split

  Split `@templatical/editor` translations into OSS and cloud chunks so external locale contributions only need to cover the open-source surface.

  **Editor i18n changes**
  - Added `packages/editor/src/i18n/locales/cloud/{en,de}.ts` containing strings used only by `initCloud()` features: AI chat / rewrite / menu, comments, collaboration, scoring, snapshots, plan limits (`header.*`), test email, saved modules, design reference, cloud loading/error overlays. These groups were removed from the OSS `locales/{en,de}.ts`.
  - New exports from `@templatical/editor`: `loadCloudTranslations(locale)`, `getSupportedCloudLocales()`, `isCloudLocaleSupported(locale)`, type `CloudTranslations`.
  - New injection key `CLOUD_TRANSLATIONS_KEY` and composables `useCloudI18n()` (returns `CloudTranslations | null` for shared components that conditionally render cloud UI) / `useCloudI18nStrict()` (throws if not provided, for cloud-only components).
  - `initCloud()` now loads OSS + cloud translation chunks in parallel and provides both. `init()` (OSS) loads only the OSS chunk — the cloud strings are tree-shaken from the OSS bundle.
  - Supported-locale lists are auto-derived via `import.meta.glob`. OSS and cloud locales are tracked separately, so an OSS-only contributor adding `locales/fr.ts` without `locales/cloud/fr.ts` ships a French OSS UI while the cloud chunk gracefully falls back to English at runtime.

  **Locale parity enforcement**
  - Type-driven: every non-`en` locale file is now annotated `: typeof en` so missing/extra/mistyped keys fail `pnpm run typecheck`.
  - Runtime: `tests/i18n.test.ts` discovers locale files via `import.meta.glob` and asserts nested-key parity plus per-key `{placeholder}` parity. OSS parity is hard-required; cloud parity is skip-if-absent (only enforced for cloud locales that exist on disk). Same pattern applied to `@templatical/media-library`.

  **Migration notes for embedders**
  - No public API removals. `Translations`, `useI18n()`, `loadTranslations()`, `getSupportedLocales()`, `isLocaleSupported()`, `TRANSLATIONS_KEY` keep their previous names and behavior — they just refer to the OSS surface now.
  - If you imported cloud-only string paths through `Translations` (e.g. `t.aiChat.title`), switch to `useCloudI18n()` / `useCloudI18nStrict()`. Within `initCloud()` the cloud strings are still available; they are no longer present on the OSS `Translations` type.
  - Existing locale overrides passed to `init()` / `initCloud()` continue to work. Cloud overrides are not yet a supported public input — only locale strings are.

  ## Custom blocks now appear in MJML/JSON exports

  Custom blocks were missing from MJML/JSON exports because their rendered HTML was never persisted from the editor's UI ref into the export pipeline. The fix moves custom-block resolution into the renderer itself as an explicit contract.

  **Renderer**
  - `renderToMjml(content, options?)` is now **async** (`Promise<string>`). Custom blocks may need async resolution.
  - New `RenderOptions.renderCustomBlock?: (block: CustomBlock) => Promise<string>` option. The renderer walks the tree, awaits all custom-block resolutions in parallel, then runs the existing sync render pass.
  - If no callback is provided, the renderer falls back to `block.renderedHtml` (if present) and otherwise omits the custom block from output.

  **Editor**
  - `editor.toMjml()` is now `Promise<string>` (was sync), always present (was optional). Wires the editor's internal block registry into the renderer's `renderCustomBlock` callback automatically.
  - If `@templatical/renderer` is not installed, `toMjml()` throws a clear error — the renderer remains an optional peer dependency.
  - New method `editor.renderCustomBlock(block): Promise<string>` for headless callers that want to drive the renderer directly while reusing the editor's registry.
  - The Cloud editor does **not** expose `toMjml()` — the cloud backend handles MJML conversion server-side with additional processing (signed image URLs, asset rewriting). Use the OSS `init()` if you want client-side export.

  **Migration**
  - Add `await` everywhere you call `editor.toMjml()` or `renderToMjml(content)`.
  - Drop any optional-chain (`editor.toMjml?.()`) — the method is always defined now.
  - Headless / Node.js consumers calling `renderToMjml` directly with custom blocks should pass a `renderCustomBlock` resolver (e.g. a Liquid engine running against `block.fieldValues`) — see the renderer README for the full pattern.

  ## MJML inner-element background colors now render correctly

  Inner MJML elements (`mj-text`, `mj-image`, `mj-table`, `mj-navbar`, `mj-video`) only support `container-background-color` per the MJML spec; passing `background-color` was silently dropped by MJML compilers, leaving the rendered email's `<td>` wrapper without a background. The renderer now emits the correct attribute. `mj-section` and `mj-button` continue to use the native `background-color` attribute they natively support.

  The rule is centralized in a new `bgAttr(color, "container" | "native")` helper so future renderers can't regress, and round-trip MJML→HTML compile tests (`tests/mjml-bg-roundtrip.test.ts`) catch the silent-drop class of bug.

### Patch Changes

- Updated dependencies [058dfff]
  - @templatical/renderer@0.2.0
  - @templatical/media-library@0.2.0

## 0.1.2

### Patch Changes

- 31a59c0: Fix editor interactivity broken in 0.1.1.

  In 0.1.1 we bundled Vue inline but left `@templatical/core` and `@templatical/types` as external dependencies. Because `@templatical/core` imports reactivity primitives from `@vue/reactivity` (the standalone package), and the editor bundle shipped Vue's full runtime (which contains its own copy of the reactivity system), consumers ended up with **two separate reactivity instances at runtime** — each with its own dep-tracking `WeakMap`. Refs created by `@templatical/core`'s `useEditor` were never tracked by the editor's render functions, so clicks, drags, and every state mutation silently no-op'd: the editor rendered initial chrome but ignored all user input.

  This release bundles `@templatical/core`, `@templatical/types`, and all transitive Vue libraries (`@vueuse/core`, `vuedraggable`, `@tiptap/*`, `@lucide/vue`) **inline** into the editor's npm entry, with `vue` and `@vue/reactivity` deduped to a single instance via Vite's `resolve.dedupe`. The editor is now a truly self-contained drop-in:
  - Consumer install drops from 149 → 71 packages (no `vue`, no `@vue/*`, no `@tiptap/*`, no `@templatical/core`/`types` in `node_modules`).
  - Zero peer warnings on `npm install @templatical/editor` for any framework (React, Svelte, Angular, vanilla, Vue).
  - Interactivity works in every consumer setup verified — including a React app with `<div id="editor" />` rendered as a JSX child inside the React tree.

  The only externals that remain are the optional cloud/feature peers a consumer explicitly opts into: `@templatical/media-library`, `@templatical/renderer`, `pusher-js`.

  **Note for SDK contributors:** when adding a new runtime dependency to the editor that uses Vue's reactivity (or imports from `@vue/reactivity` directly), it MUST be bundled inline (i.e. listed in `devDependencies`, not `dependencies`, and not in `rolldownOptions.external`). Adding such a dep as a runtime/peer dep reintroduces the duplicate-reactivity bug.
  - @templatical/renderer@0.1.2
  - @templatical/media-library@0.1.2

## 0.1.1

### Patch Changes

- bdb338b: Fix consumer install/bundle of `@templatical/editor`.
  - **`@templatical/editor`/style.css export** — CSS now emits as `dist/style.css` so the `./style.css` subpath export resolves. Previously emitted as `dist/templatical-editor.css`, causing 404s for `import '@templatical/editor/style.css'` and breaking sandbox bundlers (bundlephobia, bundlejs).
  - **`@templatical/editor` peer deps** — `vue` and `tailwindcss` removed from `peerDependencies`. Vue is now bundled into the npm entry; Tailwind is build-time only (CSS already compiled). `npm install @templatical/editor` is now a complete install for any consumer (React, Svelte, Angular, vanilla, Vue) with no peer warnings. **Note for Vue app consumers:** Vue is now isolated inside the editor (Stripe-Elements pattern). Your Vue tree is unaffected, but Vue is shipped twice (~80KB gz duplicated).
  - **`@templatical/core`/cloud pusher-js** — clearer error when cloud features are used without the `pusher-js` optional peer installed.

- Updated dependencies [bdb338b]
  - @templatical/core@0.1.1
  - @templatical/media-library@0.1.1
  - @templatical/types@0.1.1
  - @templatical/renderer@0.1.1

## 0.1.0

### Minor Changes

- 180d247: Initial production release

### Patch Changes

- @templatical/types@0.1.0
- @templatical/core@0.1.0
- @templatical/renderer@0.1.0
- @templatical/media-library@0.1.0

## 0.0.6

### Patch Changes

- 41c11bb: Dependency update
  - @templatical/types@0.0.6
  - @templatical/core@0.0.6
  - @templatical/renderer@0.0.6
  - @templatical/media-library@0.0.6

## 0.0.5

### Patch Changes

- a32206e: Polish and component extraction
  - @templatical/types@0.0.5
  - @templatical/core@0.0.5
  - @templatical/renderer@0.0.5
  - @templatical/media-library@0.0.5

## 0.0.4

### Patch Changes

- 6f234f4: Fix CDN version of Editor + Style and animation fixes
- Updated dependencies [6f234f4]
  - @templatical/media-library@0.0.4
  - @templatical/types@0.0.4
  - @templatical/core@0.0.4
  - @templatical/renderer@0.0.4

## 0.0.3

### Patch Changes

- ce3297e: Test coverage and Media Library CDN build
- Updated dependencies [ce3297e]
  - @templatical/media-library@0.0.3
  - @templatical/types@0.0.3
  - @templatical/core@0.0.3
  - @templatical/renderer@0.0.3

## 0.0.2

### Patch Changes

- c1de323: Include CDN build (ES module with code-split chunks) in the editor package at dist/cdn/. Drop IIFE build in favor of ES-only output for smaller initial load. Add pusher-js as a dependency in core for typecheck support.
- c1de323: Countdown block for cloud editor
- Updated dependencies [c1de323]
- Updated dependencies [c1de323]
  - @templatical/core@0.0.2
  - @templatical/media-library@0.0.2
  - @templatical/renderer@0.0.2
  - @templatical/types@0.0.2
