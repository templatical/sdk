# @templatical/editor

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
