# @templatical/core

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

- a476576: Fix the editor allowing a section to be dropped into another section's column (dragged from the sidebar palette) and then silently losing it on export. MJML cannot nest `mj-section` inside `mj-column`, so `renderToMjml()` / `editor.toMjml()` dropped the nested section and all of its content. Dragging a section into a column is now rejected up front, and the core `addBlock` / `moveBlock` APIs refuse to nest a section into a column, so the invalid state can no longer be created. (#292)
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

- 5676cb3: Fix `Converting circular structure to JSON` when exporting after a drag inside a section (#203)

  Dragging a block within a section column could leave a Sortable expando back-ref (`HTMLDivElement.SortableXXX → instance → el → div`) reachable from the editor's live content. The public `getContent()` serialized with a naked `JSON.stringify`, so it threw on that cycle and broke export until the section was removed.

  - `@templatical/types`: add the cycle-safe `safeClone()` helper (`WeakSet`-replacer JSON round-trip that drops self-referencing back-refs instead of throwing).
  - `@templatical/editor`: `init().getContent()` and `initCloud().getContent()` now clone via `safeClone()`; the pre-ready fallback also defaults to an empty template instead of throwing when no content was supplied.
  - `@templatical/core`: `history.cloneContent()` now reuses `safeClone()` (same behavior, deduplicated).

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
  - @templatical/types@0.7.3

## 0.7.2

### Patch Changes

- 5d1b0c5: Block clone now inserts directly after the source block (in the same section column when applicable) instead of appending to the end of the canvas. Action bar now follows the editor's UI theme — appears dark in editor dark mode instead of being forced light by the canvas-wrapper override. Canvas dark-mode preview refactored: filter moved from `.tpl-canvas-wrapper` onto a sibling bg layer + per-block `.tpl-block-content` wrapper, so block chrome (action bar, indicators) is never inside the filter region — no more counter-filter flicker when toggling dark preview. Fixes drag-inside-section in Chrome: all three `<VueDraggable>` instances (sidebar, canvas, section) now use `force-fallback` to bypass Chrome's silent failure to initiate native drag from a nested HTML5 Sortable AND to ensure consistent cross-list drag-over coordination (Sortable only binds native `dragover` in HTML5 mode, so mixing modes breaks cross-list drops). Fixes a `cyclic object value` error that broke clone/move after a within-section drag — `history.cloneContent` is now cycle-safe (drops back-refs instead of throwing) and `SectionBlock.setColumnBlocks` deep-clones each emitted block to strip any Sortable expando the drag handler might attach. Adds `findBlockLocation(blockId)` to `useEditor` (and the cloud variant) and an optional `findBlockLocation` option on `useBlockActions` to power the new "insert clone after source" behavior.
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

### Patch Changes

- @templatical/types@1.0.0

## 0.4.0

### Minor Changes

- f5a94ab: Add new `@templatical/import-unlayer` package that converts Unlayer design JSON (the output of `editor.saveDesign(...)`) into Templatical's `TemplateContent` shape. Mirrors `@templatical/import-beefree`: maps `text`, `heading`, `image`, `button`, `divider`, `html`, `menu`, `social`, `video`; reports `timer` as html-fallback and `form` as skipped; flattens 4+ column rows; surfaces a per-content conversion report. MIT-licensed.

  The Unlayer migration guide (`/guide/migration-from-unlayer` and `/de/guide/migration-from-unlayer`) is rewritten around the importer. The playground replaces the BeeFree-only chooser button with a single "Import existing template" modal that exposes BeeFree and Unlayer as tabs. README, license FAQ, security policy, and contributing guide reflect the new package; cloud headless API reference adds the matching `templates/import/from-unlayer` route row.

### Patch Changes

- Updated dependencies [f5a94ab]
  - @templatical/types@1.0.0

## 0.3.2

### Patch Changes

- @templatical/types@0.3.2

## 0.3.1

### Patch Changes

- @templatical/types@0.3.1

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
  - @templatical/types@1.0.0

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
  - @templatical/types@0.2.1

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
  - @templatical/types@0.2.0

## 0.1.2

### Patch Changes

- @templatical/types@0.1.2

## 0.1.1

### Patch Changes

- bdb338b: Fix consumer install/bundle of `@templatical/editor`.
  - **`@templatical/editor`/style.css export** — CSS now emits as `dist/style.css` so the `./style.css` subpath export resolves. Previously emitted as `dist/templatical-editor.css`, causing 404s for `import '@templatical/editor/style.css'` and breaking sandbox bundlers (bundlephobia, bundlejs).
  - **`@templatical/editor` peer deps** — `vue` and `tailwindcss` removed from `peerDependencies`. Vue is now bundled into the npm entry; Tailwind is build-time only (CSS already compiled). `npm install @templatical/editor` is now a complete install for any consumer (React, Svelte, Angular, vanilla, Vue) with no peer warnings. **Note for Vue app consumers:** Vue is now isolated inside the editor (Stripe-Elements pattern). Your Vue tree is unaffected, but Vue is shipped twice (~80KB gz duplicated).
  - **`@templatical/core`/cloud pusher-js** — clearer error when cloud features are used without the `pusher-js` optional peer installed.
  - @templatical/types@0.1.1

## 0.1.0

### Patch Changes

- @templatical/types@0.1.0

## 0.0.6

### Patch Changes

- @templatical/types@0.0.6

## 0.0.5

### Patch Changes

- @templatical/types@0.0.5

## 0.0.4

### Patch Changes

- @templatical/types@0.0.4

## 0.0.3

### Patch Changes

- @templatical/types@0.0.3

## 0.0.2

### Patch Changes

- c1de323: Include CDN build (ES module with code-split chunks) in the editor package at dist/cdn/. Drop IIFE build in favor of ES-only output for smaller initial load. Add pusher-js as a dependency in core for typecheck support.
  - @templatical/types@0.0.2
