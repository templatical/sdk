# @templatical/import-html

## 0.28.1

### Patch Changes

- @templatical/types@0.28.1

## 0.28.0

### Minor Changes

- 2cacdbc: Image and video blocks take an explicit height

  Reported on #594: the editor had no height input for images. It wasn't a missing control — `ImageBlock` had nowhere to put a height, so neither the toolbar, the canvas, nor the renderer could carry one.

  `ImageBlock.height` and `VideoBlock.height` are new optional pixel numbers. Absent means the height is derived from the width, which is the existing behaviour and stays the default for every template: no migration, and a new block still keeps its aspect ratio.

  The toolbar control has two modes — Auto and Custom — rather than a bare number field, because `Number("")` is `0` and a stored `0` has to stay distinguishable from "no opinion". Custom seeds 200px; switching back to Auto clears the field. Empty, zero and negative input keep the last valid height instead of committing, the same guard the custom width input carries (#259).

  The renderer emits `height="Npx"` on `mj-image`, and omits the attribute entirely when unset so MJML applies its own `auto`. The px suffix is load-bearing: `height` is a Unit attribute accepting only `px` or `auto`, so a bare number is a validation error and MJML drops it silently. Compiled through MJML, the value lands in both the `<img>` inline style (webmail) and its `height` attribute (Outlook) — locked by `mjml-image-height-roundtrip.test.ts`.

  All three importers now carry a source height across instead of dropping it: `import-html` from the `<img>`'s `height` attribute or its `height` style, `import-unlayer` from `src.height`, `import-beefree` from `image.height` — plus the BeeFree video thumbnail's `style.height`. `auto` and any non-positive value are read as "no height", which is what a responsive source template means by them. Nothing gains a default: an imported template with no stated height still derives it from the width, exactly as before.

  Width and height together **stretch** the image; they never crop. `object-fit` is unsupported in Outlook and most email clients, so the editor canvas stretches identically rather than previewing a crop the inbox won't deliver.

### Patch Changes

- Updated dependencies [2cacdbc]
  - @templatical/types@0.28.0

## 0.27.6

### Patch Changes

- @templatical/types@0.27.6

## 0.27.5

### Patch Changes

- @templatical/types@0.27.5

## 0.27.4

### Patch Changes

- @templatical/types@0.27.4

## 0.27.3

### Patch Changes

- @templatical/types@0.27.3

## 0.27.2

### Patch Changes

- @templatical/types@0.27.2

## 0.27.1

### Patch Changes

- 18f6b38: Remove dead code, dead translations, and comments that only recorded history.

  ### Breaking — `restoreMergeTagMarkup` is removed from `@templatical/types`

  It converted raw `{{ tag }}` tokens in stored HTML back into `<span data-merge-tag>` markup, and nothing in the SDK called it. It was also **unsafe**: its only guard was a literal `data-merge-tag="` lookbehind, so a token in any other attribute had an element injected into the attribute value —

  ```html
  <a href="{{unsubscribe_url}}">
  <!-- became -->
  <a href="<span data-merge-tag="{{unsubscribe_url}}">Unsubscribe URL</span>">
  ```

  — which is worse than the bare token it was meant to fix. Position-awareness needs parsing, not better lookarounds, so the fix is a parse-based replacement rather than a patch to this function. If you were calling it, stop: it corrupts attribute-positioned tokens. Its private `escapeRegExp` helper went with it.

  ### Breaking — `_internal` is removed from `@templatical/import-html`

  A test-support barrel (`export const _internal = { convertButton, … }`) that the tests had stopped using. Removing it revealed `convertSpacer` as reachable only through it — a line-for-line duplicate of the live `buildSpacerFromCell` in `section-builder.ts`, which is what actually converts spacer cells. Both are gone; conversion output is unchanged.

  ### Smaller locale chunks

  **772 unused translation strings** removed across ten locale files. The bulk was an 81-key `mediaLibrary` block in the editor's own OSS locales — a key-for-key duplicate of `@templatical/media-library`'s, read by nothing, which every OSS consumer downloaded for a package they do not install. The rest were strings for UI that was never built: a 23-key `aiRewrite` block (the composable is headless and unaffected), add/remove row and column labels for a table toolbar that uses number inputs, singular `social.platform`/`social.url` beside the live plural `social.platforms[…]`, and video platform names nothing renders.

  Every OSS session fetches exactly one locale chunk, so this is a direct **~1.1 KB gzip (−14%)** off it; cloud locales drop 18–19%.

  Nothing in the public API changes: `init()` accepts only `locale`, with no way to supply or type against these keys.

  A new guard (`i18n-key-usage.test.ts`) now checks locale ↔ source agreement in both directions — no reference to a missing key, no key without a reader — which the existing locale-parity test and `typecheck` both structurally miss, since each compares locales to _each other_ or derives the type from `en.ts`.

- Updated dependencies [18f6b38]
  - @templatical/types@0.27.1

## 0.27.0

### Patch Changes

- Updated dependencies [d256b41]
- Updated dependencies [d256b41]
- Updated dependencies [d256b41]
- Updated dependencies [d256b41]
- Updated dependencies [d256b41]
  - @templatical/types@0.27.0

## 0.26.3

### Patch Changes

- @templatical/types@0.26.3

## 0.26.2

### Patch Changes

- Updated dependencies [4b976a8]
  - @templatical/types@0.26.2

## 0.26.1

### Patch Changes

- Updated dependencies [a95274c]
  - @templatical/types@0.26.1

## 0.26.0

### Minor Changes

- 753262e: Add an alignment option to the button block (#536).

  `ButtonBlock` gains `align: "left" | "center" | "right"`, surfaced in the button toolbar as the same sliding control image, video, social, title, menu and table already use. The renderer passes it through to `mj-button`'s native `align` attribute, and the editor canvas — which previously hardcoded centering — now mirrors it, so the preview, saved-block previews and the test-email dialog all agree with what gets sent.

  **Breaking (types):** `align` is required, matching `ImageBlock` / `VideoBlock` / `SocialIconsBlock`. Code that constructs a `ButtonBlock` literal without going through `createButtonBlock()` must add the field. Nothing else changes: the factory defaults to `"center"`, and both the renderer and the editor fall back to `"center"` for templates stored before the field existed, so existing content renders byte-for-byte as it did.

  Note `align` has no visible effect when `width` is `"full"` — the button spans the column either way. The control stays visible in that state rather than appearing and disappearing with the width mode, matching the image toolbar.

  The three importers now carry button alignment across instead of dropping it: BeeFree and Unlayer read the button's own `text-align`, and the HTML importer reads the wrapping cell's `text-align` or its legacy `align` attribute (an anchor is sized to its content, so its own `text-align` says nothing about placement).

### Patch Changes

- Updated dependencies [753262e]
  - @templatical/types@0.26.0

## 0.25.2

### Patch Changes

- @templatical/types@0.25.2

## 0.25.1

### Patch Changes

- @templatical/types@0.25.1

## 0.25.0

### Patch Changes

- Updated dependencies [7c24a7c]
  - @templatical/types@0.25.0

## 0.24.1

### Patch Changes

- @templatical/types@0.24.1

## 0.24.0

### Patch Changes

- Updated dependencies [c9b9eea]
  - @templatical/types@0.24.0

## 0.23.0

### Patch Changes

- Updated dependencies [7d51750]
  - @templatical/types@0.23.0

## 0.22.0

### Patch Changes

- @templatical/types@0.22.0

## 0.21.2

### Patch Changes

- Updated dependencies [635eb7e]
  - @templatical/types@0.21.2

## 0.21.1

### Patch Changes

- @templatical/types@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [fc545c2]
  - @templatical/types@0.21.0

## 0.20.0

### Patch Changes

- Updated dependencies [90f088e]
  - @templatical/types@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [ef6deec]
- Updated dependencies [b8fbca0]
  - @templatical/types@0.19.0

## 0.18.0

### Patch Changes

- @templatical/types@0.18.0

## 0.17.1

### Patch Changes

- @templatical/types@0.17.1

## 0.17.0

### Patch Changes

- @templatical/types@0.17.0

## 0.16.5

### Patch Changes

- @templatical/types@0.16.5

## 0.16.4

### Patch Changes

- Updated dependencies [1801876]
  - @templatical/types@0.16.4

## 0.16.3

### Patch Changes

- @templatical/types@0.16.3

## 0.16.2

### Patch Changes

- @templatical/types@0.16.2

## 0.16.1

### Patch Changes

- @templatical/types@0.16.1

## 0.16.0

### Patch Changes

- Updated dependencies [e5156a5]
- Updated dependencies [d35d36e]
  - @templatical/types@0.16.0

## 0.15.1

### Patch Changes

- @templatical/types@0.15.1

## 0.15.0

### Patch Changes

- Updated dependencies [7afeacb]
  - @templatical/types@0.15.0

## 0.14.0

### Patch Changes

- Updated dependencies [710c9be]
- Updated dependencies [718d781]
  - @templatical/types@0.14.0

## 0.13.0

### Patch Changes

- @templatical/types@0.13.0

## 0.12.1

### Patch Changes

- @templatical/types@0.12.1

## 0.12.0

### Patch Changes

- Updated dependencies [7b76e46]
- Updated dependencies [67f44fb]
- Updated dependencies [a209073]
  - @templatical/types@0.12.0

## 0.11.1

### Patch Changes

- @templatical/types@0.11.1

## 0.11.0

### Patch Changes

- @templatical/types@0.11.0

## 0.10.4

### Patch Changes

- @templatical/types@0.10.4

## 0.10.3

### Patch Changes

- @templatical/types@0.10.3

## 0.10.2

### Patch Changes

- Updated dependencies [5676cb3]
  - @templatical/types@0.10.2

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

- 2ed1b80: Migrate the framework-agnostic packages from tsup to tsdown (Rolldown + Oxc)

  The six framework-agnostic library packages — `types`, `core`, `renderer`,
  `import-beefree`, `import-unlayer`, `import-html` — now build with
  [`tsdown`](https://tsdown.dev) instead of tsup. This drops `rollup` /
  `rollup-plugin-dts` from the build path and aligns these packages with Rolldown
  (which Vite already uses). Published output is functionally equivalent: same ESM
  exports, same externals, equivalent `.d.ts`.

  The Vue/CSS packages (`editor`, `media-library`) and `quality` deliberately
  remain on Vite + `vue-tsc`/`tsc` + `@microsoft/api-extractor` — `rolldown-plugin-dts`
  inlines the editor's bundled-but-type-external third-party surface (~950 kB vs
  ~11 kB), and Vite's batteries-included handling (env replacement, CSS/Tailwind,
  glob, dts externalization) isn't worth reconstructing manually there.

- Updated dependencies [2ed1b80]
  - @templatical/types@0.10.1

## 0.10.0

### Minor Changes

- af913bb: Remove `margin` from `BlockStyles`.

  `margin` was a canvas-only style: it surfaced in the block settings panel and applied to the editor wrapper, but the renderer never read it, so it was dropped from the exported email — a WYSIWYG mismatch. Email spacing is expressed via `padding` (the renderer honors it on every block), so `margin` added a second, unreliable spacing control with no email output.
  - `BlockStyles.margin` is removed from the type and from `createDefaultStyles()`.
  - The Margin inputs are removed from the block settings panel, and the editor canvas no longer applies a wrapper margin.
  - The BeeFree, Unlayer, and HTML importers no longer emit a `margin` field on converted blocks.

  Use `padding` for block spacing. Persisted templates that still carry a `margin` key load fine — the extra field is ignored.

### Patch Changes

- Updated dependencies [2d9779b]
- Updated dependencies [ac9eab8]
- Updated dependencies [5d961a3]
- Updated dependencies [4309923]
- Updated dependencies [af913bb]
- Updated dependencies [72e1e58]
  - @templatical/types@0.10.0

## 0.9.1

### Patch Changes

- @templatical/types@0.9.1

## 0.9.0

### Patch Changes

- Updated dependencies [4dfe37e]
  - @templatical/types@0.9.0

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
  - @templatical/types@0.8.5

## 0.8.4

### Patch Changes

- @templatical/types@0.8.4

## 0.8.3

### Patch Changes

- @templatical/types@0.8.3

## 0.8.2

### Patch Changes

- @templatical/types@0.8.2

## 0.8.1

### Patch Changes

- @templatical/types@0.8.1

## 0.8.0

### Patch Changes

- @templatical/types@0.8.0

## 0.7.3

### Patch Changes

- @templatical/types@0.7.3

## 0.7.2

### Patch Changes

- @templatical/types@0.7.2

## 0.7.1

### Patch Changes

- @templatical/types@0.7.1

## 0.7.0

### Patch Changes

- @templatical/types@0.7.0

## 0.6.7

### Patch Changes

- @templatical/types@0.6.7

## 0.6.6

### Patch Changes

- @templatical/types@0.6.6

## 0.6.5

### Patch Changes

- @templatical/types@0.6.5

## 0.6.4

### Patch Changes

- @templatical/types@0.6.4

## 0.6.3

### Patch Changes

- @templatical/types@0.6.3

## 0.6.2

### Patch Changes

- de4b0a3: Polish and general bug fixes
  - @templatical/types@0.6.2

## 0.6.1

### Patch Changes

- @templatical/types@0.6.1

## 0.6.0

### Patch Changes

- Updated dependencies [55002de]
  - @templatical/types@1.0.0

## 0.5.1

### Patch Changes

- @templatical/types@0.5.1

## 0.5.0

### Minor Changes

- 34c4636: Add `@templatical/import-html` package. Converts table-based HTML email templates (MJML output, Mailchimp/SendGrid/Campaign Monitor exports, hand-coded marketing emails) to Templatical JSON via `convertHtmlTemplate(html)`. Resolves `<style>` blocks onto inline styles, recognizes layout tables, button cells, spacer cells, and dividers. Unknown elements are preserved as HTML-fallback blocks.

### Patch Changes

- @templatical/types@1.0.0
