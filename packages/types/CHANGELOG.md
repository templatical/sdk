# @templatical/types

## 0.16.2

## 0.16.1

## 0.16.0

### Minor Changes

- e5156a5: Add document-level link color and underline controls

  `TemplateSettings` gains an optional `linkColor` and a required `linkUnderline` (default `true`). The renderer emits them as a single global `a { color; text-decoration }` rule. `linkColor` cascades to every link — rich-text and menu alike; unset keeps `color: inherit` (links follow the surrounding text color). `linkUnderline` underlines body (rich-text) links; buttons and menu items carry their own inline `text-decoration` and are unaffected. An inline per-link/per-item color (a Menu item's `color`, `MenuBlock.linkColor`) still overrides the color.

  Both are exposed in the editor's Appearance settings — a link-color picker and an underline toggle next to the text color — and reflected live on the canvas, fixing the previous preview/export mismatch (the canvas hardcoded a blue underlined link that never shipped).

  Newly created content (via `createDefaultTemplateContent()` / `init()` defaults) now underlines body links by default — the common, more accessible email default. Set `linkUnderline: false` for no underline.

  **Breaking (types):** `TemplateSettings.linkUnderline` is now required — add it when hand-constructing settings, or use `createDefaultTemplateContent()` / `init({ templateDefaults })`, which supply it. `linkColor` is optional; omit it to keep links inheriting the text color.

  Runtime stays backward-compatible for stored content: content lacking `linkUnderline` still renders without an underline (the renderer treats an absent value as off), so already-saved templates are unchanged. (#352)

- d35d36e: Add a document-level default text color with a full per-block cascade

  `TemplateSettings` gains a required `textColor` (default `#1a1a1a`, customizable via `templateDefaults`). Every text block — Title, Paragraph, Menu, Table — inherits it unless it sets its own color, so a document text color now flows through the whole template. To enable that, the per-block `color` on Title, Menu and Table is now optional: unset means "inherit the document color", and new blocks default to unset. An explicit per-block color (or an inline text-color mark) still overrides, and links inherit via `color: inherit`.

  It's exposed as a color picker in the editor's Appearance settings (next to Background color) and reflected live on the canvas; each text block's own color picker gains an unset/inherit state.

  **Breaking (types):** `TemplateSettings.textColor` is now required — add it when hand-constructing settings (including content passed to `init()`), or use `createDefaultTemplateContent()` / `init({ templateDefaults: { textColor } })`, which supply it. `TitleBlock`, `MenuBlock`, and `TableBlock` now have an optional `color` (`string | undefined`) — handle the unset case if you read it (unset means the block inherits the document color).

  Runtime stays backward-compatible: content lacking `textColor` still renders (falling back to the previous default), and existing templates with explicit block colors are byte-for-byte unchanged. Only newly created content shifts — paragraph body text resolves to `#1a1a1a` instead of MJML's default `#000000`, a negligible and more consistent shade. (#355)

## 0.15.1

## 0.15.0

### Minor Changes

- 7afeacb: Add type-ahead merge tag autocomplete to input and textarea fields

  Typing the syntax opener (e.g. `{{`) in any merge-tag-enabled input or textarea — button/image/video/menu links, image alt text, template settings, and custom-block text fields — now surfaces the same autocomplete popup as the rich-text editor. The popup, filtering, keyboard navigation (Arrow / Enter / Tab / Escape), and caret positioning are shared with the TipTap path, so behavior is identical across both surfaces. Controlled by the existing `mergeTags.autocomplete` flag (default on; auto-disabled when `tags` is empty or a custom syntax is used).

  `@templatical/types` gains `getSyntaxClosingChar()` alongside `getSyntaxTriggerChar()`.

## 0.14.0

### Minor Changes

- 718d781: Add an optional outer frame to section blocks (`section.wrapper`) — a full-width band with its own background, padding, and corner radius that frames the section, rendered as an `mj-wrapper` around the section's `mj-section`. This makes the common "white card on a colored band" layout possible without nesting sections (which MJML forbids). Enable it from the section toolbar's Wrapper panel, or set `createSectionBlock({ wrapper: { backgroundColor, padding, borderRadius } })`; omit it and existing templates are unchanged. (#312)

### Patch Changes

- 710c9be: Add an optional `borderRadius` (px) to section blocks. Set it from the section toolbar or via `createSectionBlock({ borderRadius })`; the renderer emits it as `border-radius` on the `mj-section`, so a section with a background color reads as a rounded card on a contrasting background. Omitted or `0` keeps square corners, so existing templates are unchanged. First step toward the framed "card on colored background" pattern. (#312)

## 0.13.0

## 0.12.1

## 0.12.0

### Minor Changes

- 7b76e46: Add a `width` option to button blocks: buttons can be set to a fixed pixel width or stretched to full width (`'full'`), independently of their label, instead of always shrinking to fit their content. Omitting `width` keeps the previous content-sized behavior, so existing templates are unaffected (#260).
- a209073: Add website option to social icons

### Patch Changes

- 67f44fb: Centralize social-icon glyph data (SVG path + brand color) into a single `SOCIAL_ICON_GLYPHS` map in `@templatical/types`, shared by the editor's inline-SVG renderer and the renderer's PNG rasterizer (which previously each kept their own copy). Adding a platform to the `SocialPlatform` union is now a compile error until its glyph exists, so the editor and renderer can no longer drift out of sync. Social platform dropdown labels now resolve through i18n (`social.platforms`) instead of a hardcoded English name.

## 0.11.1

## 0.11.0

## 0.10.4

## 0.10.3

## 0.10.2

### Patch Changes

- 5676cb3: Fix `Converting circular structure to JSON` when exporting after a drag inside a section (#203)

  Dragging a block within a section column could leave a Sortable expando back-ref (`HTMLDivElement.SortableXXX → instance → el → div`) reachable from the editor's live content. The public `getContent()` serialized with a naked `JSON.stringify`, so it threw on that cycle and broke export until the section was removed.

  - `@templatical/types`: add the cycle-safe `safeClone()` helper (`WeakSet`-replacer JSON round-trip that drops self-referencing back-refs instead of throwing).
  - `@templatical/editor`: `init().getContent()` and `initCloud().getContent()` now clone via `safeClone()`; the pre-ready fallback also defaults to an empty template instead of throwing when no content was supplied.
  - `@templatical/core`: `history.cloneContent()` now reuses `safeClone()` (same behavior, deduplicated).

## 0.10.1

### Patch Changes

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

## 0.10.0

### Minor Changes

- 2d9779b: Custom blocks can now declare default block styles in their definition, and the renderer honors `block.styles.padding` on custom and HTML blocks.

  **New `defaultStyles` on `CustomBlockDefinition`.** Custom block authors can now declare default `padding` and `backgroundColor` alongside `template` and `fields`. The value is a `Partial<BlockStyles>` deep-merged over the base defaults — specify only the fields you want to override. Controls both the editor canvas wrapper and the rendered MJML/email output.

  ```ts
  customBlocks: [
    {
      type: 'pricing-table',
      template: '<table>…</table>',
      fields: [...],
      defaultStyles: {
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    },
  ]
  ```

  **`renderCustom` and `renderHtml` now honor `block.styles.padding`.** Previously the renderer emitted `<mj-text>` without an explicit `padding` attribute for custom and HTML blocks, so MJML's built-in `10px 25px` default applied regardless of `block.styles.padding`. Both renderers now pass `padding="..."` from the block's styles, matching how every other built-in renderer (paragraph, title, menu, table) already worked.

  **Behavior change for existing custom and HTML blocks.** Previously, rendered email output used MJML's `mj-text` default of `10px 25px`. Now it uses `block.styles.padding`, which defaults to `10px` all around from `createDefaultStyles()`. To restore the old visual, set `defaultStyles: { padding: { top: 10, right: 25, bottom: 10, left: 25 } }` on the custom block definition, or override `padding` on the individual block instance via the editor.

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

## 0.9.1

## 0.9.0

### Minor Changes

- 4dfe37e: Add a built-in merge tag picker modal. When `mergeTags.tags` is configured without `mergeTags.onRequest`, clicking "Insert merge tag" now opens a searchable, keyboard-navigable picker that lists every tag. The picker supports optional grouping (via a new `group` field on `MergeTag`) and per-tag helper text (via a new `description` field). `onRequest` continues to take precedence when set.

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

## 0.8.4

## 0.8.3

## 0.8.2

## 0.8.1

## 0.8.0

## 0.7.3

## 0.7.2

## 0.7.1

## 0.7.0

## 0.6.7

## 0.6.6

## 0.6.5

## 0.6.4

## 0.6.3

## 0.6.2

## 0.6.1

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

## 0.5.1

## 0.5.0

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
