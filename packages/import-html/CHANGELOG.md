# @templatical/import-html

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
