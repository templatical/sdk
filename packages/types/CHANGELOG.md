# @templatical/types

## 1.0.0

## 0.4.0

### Minor Changes

- f5a94ab: Add new `@templatical/import-unlayer` package that converts Unlayer design JSON (the output of `editor.saveDesign(...)`) into Templatical's `TemplateContent` shape. Mirrors `@templatical/import-beefree`: maps `text`, `heading`, `image`, `button`, `divider`, `html`, `menu`, `social`, `video`; reports `timer` as html-fallback and `form` as skipped; flattens 4+ column rows; surfaces a per-content conversion report. MIT-licensed.

  The Unlayer migration guide (`/guide/migration-from-unlayer` and `/de/guide/migration-from-unlayer`) is rewritten around the importer. The playground replaces the BeeFree-only chooser button with a single "Import existing template" modal that exposes BeeFree and Unlayer as tabs. README, license FAQ, security policy, and contributing guide reflect the new package; cloud headless API reference adds the matching `templates/import/from-unlayer` route row.

## 0.3.2

## 0.3.1

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

## 0.1.2

## 0.1.1

## 0.1.0

## 0.0.6

## 0.0.5

## 0.0.4

## 0.0.3

## 0.0.2
