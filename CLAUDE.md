# CLAUDE.md — templatical-sdk

Open-source Templatical email editor. Bun monorepo with 6 npm packages, a playground app, and a docs site.

## Packages

| Package | Description | License | Key exports |
|---------|-------------|---------|-------------|
| `@templatical/types` | Shared TS types, block factories, event emitter | MIT | Block types, guards, factory fns, `EventEmitter`, merge tag presets |
| `@templatical/core` | Framework-agnostic editor logic, state, history, plugins | FSL-1.1-MIT | `useEditor`, `useHistory`, `useBlockActions`, `useAutoSave`, plugins |
| `@templatical/core/cloud` | Cloud-only modules (subpath export) | FSL-1.1-MIT | Auth, API, WebSocket, AI chat/rewrite, collaboration, comments, scoring, MCP, export |
| `@templatical/media-library` | Media library management (types, composable, API client, Vue components, standalone SDK) | FSL-1.1-MIT | `useMediaLibrary`, `MediaApiClient`, `MediaLibraryModal`, `MediaItem`, `init()` |
| `@templatical/editor` | Vue 3 visual drag-and-drop editor | FSL-1.1-MIT | `init()`, `initCloud()`, `unmount()` |
| `@templatical/renderer` | JSON → MJML → HTML renderer (browser + Node) | MIT | `renderToMjml()`, `renderToHtml()` |
| `@templatical/import-beefree` | BeeFree template converter | MIT | `convertBeeFreeTemplate()` |

### Dependency graph

```
@templatical/types  (no deps, devDep on media-library for type imports in cloud.ts)
  ├── @templatical/core  (+@vue/reactivity; peer: pusher-js [optional, cloud-only])
  ├── @templatical/renderer  (peer: mjml)
  └── @templatical/import-beefree

@templatical/core + @templatical/types
  └── @templatical/media-library  (+@vueuse/core, @lucide/vue, vue-advanced-cropper; peer: vue, tailwindcss)

@templatical/core + @templatical/types
  └── @templatical/editor  (+tiptap, vuedraggable, liquidjs; peer: vue, tailwindcss, @templatical/media-library [optional, cloud-only])
```

**Media types** (`MediaItem`, `MediaFolder`, etc.) are canonically defined in `@templatical/media-library`. The `@templatical/types` package imports them via devDependency for use in cloud config interfaces (`TemplaticalConfig`, `PlanConfig`). **Build order:** media-library before types.

## Commands

```bash
# Install
bun install

# Build all packages (tsup/vite per package)
bun run build

# CDN bundles (IIFE/ES for script-tag usage)
bun run build:email-editor           # → packages/editor/dist/cdn/
bun run build:media-library           # → packages/media-library/dist/cdn/
bun run build:all-sdk                 # both CDN builds

# Test (Vitest 3, all packages)
bun run test

# Lint & format
bun run lint          # eslint packages/*/src
bun run format        # prettier --write (auto-fix)
bun run format --check  # prettier check only (used in CI)

# Type check
bun run typecheck     # tsc/vue-tsc --noEmit per package

# Playground dev server
cd apps/playground && bun run dev

# Docs dev server (VitePress)
cd apps/docs && bun run docs:dev
```

## Quality Tools

### ESLint

Root config: `eslint.config.mjs` (flat config, ESLint 10).

- **Plugins:** `typescript-eslint` v8 + `eslint-plugin-vue` v10 with `vue-eslint-parser`
- **TS rules:** `no-unused-vars` set to `warn` with `argsIgnorePattern: "^_"` and `varsIgnorePattern: "^_"`. `no-explicit-any` and `no-empty-object-type` are off.
- **Vue rules:** `multi-word-component-names`, `no-v-html`, `html-self-closing`, `max-attributes-per-line`, and several formatting rules are off (deferred to Prettier).
- **Scope:** Only `packages/*/src/**/*.ts` and `packages/*/src/**/*.vue`. Test files, dist, node_modules, and `.d.ts` are ignored.

### Prettier

Uses Prettier 3 with **default settings** (no `.prettierrc` or config in `package.json`). Formats `packages/*/src/**/*.{ts,vue}`.

### TypeScript

- Strict mode, target ES2022, module resolution `bundler` (from `tsconfig.base.json`).
- Each package has its own `tsconfig.json` extending the base.
- The `editor` and `media-library` packages use `vue-tsc` for typecheck (handles `.vue` SFCs). All others use plain `tsc`.
- **Critical:** `@templatical/core` aliases `vue` to `@vue/reactivity` at build time. In tests, `vue` resolves to the full Vue package (it's a devDependency). Don't add Vue runtime imports in core or cloud source modules.

### Cross-package type resolution (tsconfig paths)

Each package's `tsconfig.json` has `paths` mapping sibling `@templatical/*` imports to source directories. This allows `bun run typecheck` to work **without building first** — no `dist/` needed.

**How it works:** Instead of resolving `@templatical/types` via `node_modules/.../dist/index.d.ts` (which requires a build), the paths redirect to `../types/src/index.ts` (source).

**Maintenance rules when modifying tsconfigs:**
- When a package adds a new `@templatical/*` import, add the corresponding `paths` entry to its `tsconfig.json`.
- Non-vue packages (types, core, renderer, import-beefree) must point `@templatical/media-library` to `../media-library/src/types.ts` (not `index.ts`) because `tsc` cannot resolve `.vue` files that the barrel re-exports.
- Vue packages (media-library, editor) use `vue-tsc` and can point to `../*/src/index.ts` directly.
- The media-library package has a self-referencing path (`"@templatical/media-library": ["./src/index.ts"]`) because the types package imports from it, and media-library resolves types source which contains that import.

**Current path map:**

| Package | Paths to |
|---------|----------|
| `types` | media-library (types.ts only) |
| `core` | types, media-library (types.ts only) |
| `renderer` | types, media-library (types.ts only) |
| `import-beefree` | types, media-library (types.ts only) |
| `media-library` | types, core, core/cloud, media-library (self) |
| `editor` | types, core, core/cloud, media-library |

**Why not TypeScript project references (`composite: true`)?** The monorepo uses tsup (rollup-plugin-dts) and vite (vite-plugin-dts) for `.d.ts` generation. These are incompatible with `composite` mode, which requires `tsc` to generate granular declarations + `.tsbuildinfo`. Switching would require replacing the entire build toolchain.

## CDN Builds

Each package with a CDN build has a `vite.cdn.config.ts` alongside its main `vite.config.ts`:

- **`packages/editor/vite.cdn.config.ts`** — Builds `@templatical/editor` as ES with code-split chunks (icons, vue, tiptap, pusher, draggable, media-library, features). Output: `packages/editor/dist/cdn/`.
- **`packages/media-library/vite.cdn.config.ts`** — Builds `@templatical/media-library` standalone visual SDK as IIFE (`TemplaticalMediaLibrary` global) + ES with code-split chunks. Output: `packages/media-library/dist/cdn/`.

Both CDN configs resolve `@templatical/media-library`, `@templatical/core`, and `@templatical/types` to source via aliases.

## Cloud Subpath (`@templatical/core/cloud`)

Cloud modules live in `packages/core/src/cloud/`. They provide features that connect to the Templatical Cloud backend:

- **Auth** — `AuthManager`, `createSdkAuthManager` (JWT)
- **API** — `ApiClient` (HTTP requests with auth)
- **WebSocket** — `WebSocketClient` (Pusher protocol, presence channels)
- **AI** — `useAiChat` (streaming), `useAiRewrite`, `useAiConfig`
- **Collaboration** — `useCollaboration` (presence, block locking)
- **Comments** — `useComments`, `useCommentListener`
- **Templates** — `useSavedModules`, `useSnapshotHistory`
- **Quality** — `useTemplateScoring`, `useDesignReference`
- **Other** — `useTestEmail`, `useExport`, `usePlanConfig`, `performHealthCheck`, `API_ROUTES`, `buildUrl`

**Note:** Media functionality (`useMediaLibrary`, `MediaApiClient`) has moved to `@templatical/media-library`. It is NOT exported from `@templatical/core/cloud`.

Used by `@templatical/editor`'s `initCloud()`. The editor's cloud composables (`src/cloud/composables/`) are separate from these — they are editor-specific extractions, not core cloud modules.

## Media Library (`@templatical/media-library`)

Standalone package for media management. Lives in `packages/media-library/`. Built with Vite (has Vue components).

- **Types** — `MediaItem`, `MediaFolder`, `MediaCategory`, `MediaConversion`, `MediaBrowseParams/Response`, `MediaUsageInfo/Response`, `MediaRequestContext`, `StorageInfo`, `MediaConfig`, `MediaCategoryData` (canonical home for all media types)
- **Composable** — `useMediaLibrary` (reactive state machine for browse, upload, delete, move, folders, replace)
- **API Client** — `MediaApiClient` (HTTP requests for all media CRUD operations)
- **Vue Components** — `MediaLibraryModal` + 12 sub-components (grid, upload zone, folder tree, preview panel, edit/replace/import modals, etc.)
- **Composables** — `useMediaCategories`, `useMediaPicker`, `useImageCrop`, `useI18n`
- **Standalone SDK** — `init()` (visual mount) with own i18n (en/de) and styles
- **Dependencies** — `@templatical/core/cloud` (for AuthManager, buildUrl, API_ROUTES), `@templatical/types` (for ApiError, ApiResponse, PlanConfig)

## Conventions

- Always use i18n translation keys in components, never hardcoded strings.
- Use `tpl:` prefix for all SDK CSS classes (Tailwind prefix).
- Lazy-load heavy libraries via dynamic `import()` (e.g. `pusher-js`).
- Use `defineAsyncComponent` for non-critical UI panels (sidebars, modals).
- Keep `manualChunks` in `packages/editor/vite.cdn.config.ts` up to date when adding new cloud components.
- Use type-only imports for runtime-lazy packages.
- Don't statically import packages >20KB gzipped that are only used conditionally.
- **Never use `v-for` inside vuedraggable's `#item` slot** for scoped variable tricks (e.g. `v-for="x in [computedValue]"`). Sortable.js requires a static single root element per item — `v-for` breaks DOM tracking and prevents drag-and-drop reordering between items.
- Use `inject()` with explicit `null` defaults and null checks — never use `undefined as unknown as T` casts to bypass type safety.
- Cloud-only composables instantiated in `CloudEditor.vue` should be provided via `provide()`/`inject()` to child components (like `useComments`, `useTemplateScoring`) rather than re-instantiated in each child. This preserves state across component mount/unmount cycles.
- Async functions in components (`initialize()`, `saveTemplate()`, etc.) must guard against post-unmount execution with a `_destroyed` flag checked after every `await` point. This prevents zombie WebSocket connections, stale `emit()` calls, and dead ref writes.
- When extracting shared logic into composables that call `provide()`, the composable must be called from `setup()` context (Vue requirement). The `useEditorCore` composable demonstrates this pattern.

### i18n

Two separate i18n systems, same pattern. Supported locales: `en`, `de`.

- **`@templatical/editor`** — `src/i18n/` with `loadTranslations(locale)`, `getBaseLocale()`, `isLocaleSupported()`, `getSupportedLocales()`. Translations are deeply nested objects. Composable: `useI18n(override?)` with `format(template, values)` for `{placeholder}` substitution. Injected via `"translations"` key. **All components must use `useI18n()`** — never `inject<Translations>("translations")` directly. Use `format()` for string interpolation instead of `.replace()`.
- **`@templatical/media-library`** — `src/i18n/` with `loadMediaTranslations(locale)`. Flat namespace under `mediaLibrary.*`. Same `useI18n(override?)` pattern. Injected via `"translations"` key.

Both use dynamic `import()` for locale files. Locale normalization strips region codes (`en-US` → `en`) and falls back to `en` for unsupported locales. When adding new i18n keys, add to both `en.ts` and `de.ts` — tests verify key parity between locales.

- **Playground** — `apps/playground/src/i18n/` with `usePlaygroundI18n()` composable returning reactive `{ locale, t }`. Translations are eagerly imported (no dynamic `import()`). Locale persisted to `localStorage` key `tpl-playground-locale`. The `format(template, values)` helper handles `{placeholder}` substitution. Locale is passed to both `init({ locale })` and `initCloud({ locale })` so the editor SDK also switches language. Changing locale re-initializes the editor.

## Architecture

- **Build:** tsup for types, core, renderer, import-beefree. Vite for editor, media-library packages and CDN bundles. **Build order matters:** media-library must build before types (types has devDep on media-library for type imports).
- **TypeScript:** Strict mode, target ES2022, module resolution `bundler`.
- **Vue 3** with TipTap 3 for rich text editing, VueDraggable for drag-and-drop, Tailwind CSS 4 for styling.
- **Block types:** 14 types (Title, Paragraph, Image, Button, Section, Divider, Spacer, SocialIcons, Menu, Table, Html, Video, Countdown, Custom). Block IDs use UUID v7.

### Editor architecture (`@templatical/editor`)

Both the OSS `Editor.vue` and cloud `CloudEditor.vue` share a common base via the `useEditorCore` composable:

- **`useEditorCore`** (`src/composables/useEditorCore.ts`) — instantiates 10 shared composables (useI18n, useHistory, useHistoryInterceptor, useBlockActions, useConditionPreview, useAutoSave, useUiTheme, useThemeStyles, useBlockRegistry, keyboard handler), registers all 13 built-in block types, manages plugins (install/destroy lifecycle), and calls all 17 shared `provide()` keys. Both editors call `useEditorCore()` passing their own `useEditor()` return value — OSS from `@templatical/core`, Cloud from `@templatical/core/cloud`. The composable accepts a `BaseEditorReturn` structural type that both satisfy.

- **`Editor.vue`** (~280 lines) — calls `useEditor()` + `useEditorCore()`, mounts/unmounts. No cloud logic.

- **`CloudEditor.vue`** (~1260 lines) — calls cloud `useEditor()`, sets up collaboration/broadcast **before** `useEditorCore()` (ordering matters — broadcast wraps editor methods, then history interceptor wraps after), then instantiates cloud-specific composables.

- **Cloud composables** (`src/cloud/composables/`): `useSnapshotPreview`, `useCloudPanelState`, `useCollabUndoWarning`, `useCloudFeatureFlags`, `useCloudMediaLibrary`. These extract logical chunks from CloudEditor for testability and readability.

- **Cloud components** (`src/cloud/components/`): `CloudLoadingOverlay`, `CloudErrorOverlay`, `SnapshotPreviewBanner`, `CollabUndoToast`. Extracted template regions with simple prop/event interfaces.

### Shared utilities (`src/utils/`)

- **`keyboardShortcuts.ts`** — `handleEditorKeydown()` with permissive `metaKey || ctrlKey` modifier, `isEditingText()` guard. Used by `useEditorCore`. Supports `onSave`, `onBeforeUndo` hooks. Undo/redo defers to TipTap when editing text.
- **`blockTypeIcons.ts`** — maps block type strings to Lucide icon components. Used by `Sidebar.vue` and `Toolbar.vue` for dynamic icon rendering.
- **`blockTypeLabels.ts`** — `getBlockTypeLabel(type, translations)` for i18n block type names. Used by `Sidebar.vue` and `Toolbar.vue`.
- **`blockComponentResolver.ts`** — `resolveBlockComponent()` for registry-first component lookup, `getBlockWrapperStyle()` for shared style computation.
- **`registerBuiltInBlocks.ts`** — registers all 13 built-in block types into the block registry.

### Key types

- **`BaseEditorReturn`** (`src/composables/useEditorCore.ts`) — structural type shared by both OSS and Cloud `UseEditorReturn`. Cloud extends it with `create`, `load`, `save`, `createSnapshot`, `hasTemplate`, `savedBlockIds`.
- **`OnRequestMedia`** (`src/index.ts`) — named function type for media browser requests: `(context?: MediaRequestContext) => Promise<MediaResult | null>`. Used by both editors and all media-consuming components. Components inject it directly via `inject<OnRequestMedia | null>("onRequestMedia", null)` — there is no `provide("config")` wrapper.

### Shared CSS classes (`src/styles/index.css`)

- **`.tpl-text-toolbar-btn`** / **`.tpl-text-toolbar-btn--active`** — shared rich text toolbar button styles used by `ParagraphEditor.vue` and `TitleEditor.vue`. Avoids repeating the same Tailwind class string across 17 buttons.

## Tests

**Vitest 3.** All 6 packages have test coverage (~1,368 tests). Run `bun run test` to execute all. Every new feature, bug fix, or refactor **must** include tests. Tests must be regression-sensitive — a source code change without a corresponding test update should cause a failure.

### Test location

- **Location:** `tests/**/*.test.ts` per package (exception: import-beefree uses `src/__tests__/**/*.test.ts`).
- **Config:** Each package has `vitest.config.ts` with `include: ['tests/**/*.test.ts']`.

### Test structure

- **`describe`/`it` blocks** with clear, behavior-focused names (`"clears isDirty after save"`, not `"test save"`).
- **Factory functions** for test data (e.g. `createTitleBlock()`, `createParagraphBlock()`, `createMediaItem()`, `createMockAuthManager()`).
- **`beforeEach`** with `vi.mocked(X).mockClear()` for test isolation.

### Mocking patterns

- **API clients:** Cloud composables create `ApiClient` internally — mock via `vi.mock('../../src/cloud/api')` then `vi.mocked(ApiClient.prototype.methodName)`.
- **Fetch for AuthManager:** Use `vi.stubGlobal('fetch', mockFn)` since AuthManager calls `fetch()` directly. Clean up with `vi.unstubAllGlobals()` in `afterEach`.
- **WebSocket:** Mock via `vi.stubGlobal('WebSocket', MockClass)`. For timeout tests, use `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()`.
- **SSE streaming:** Use `createSSEResponse()` helper that builds a `ReadableStream` from SSE event objects. Used for ai-chat, ai-rewrite, template-scoring, design-reference.
- **Inject-dependent composables:** Use `withProvide()` helper that creates a real Vue app with `app.provide()`, runs the composable in setup, then unmounts. Used for useMergeTag, useMediaCategories, useMediaPicker, useI18n. Requires DOM stubs (`dom-stubs.ts`) imported before Vue.
- **Fake timers:** Use `vi.useFakeTimers()` in `beforeEach` and `vi.useRealTimers()` in `afterEach` for debounce/timeout tests (e.g. auto-save, health check).
- **Mock bleed:** When using `vi.mock()` on a module, prototype mocks persist across tests. To check "not called in this test", snapshot `mock.calls.length` before the action and compare, rather than `not.toHaveBeenCalled()`.

### Assertion requirements — regression sensitivity

Every test must assert on **concrete values or state**, not just "didn't crash." These rules ensure source code changes without test updates cause failures:

- **Never use `.toBeDefined()` or `.toBeTruthy()` as the sole assertion.** Always pair with a value check. Instead of `expect(block).toBeDefined()`, write `expect(block.type).toBe('text')`.
- **Never use `.not.toThrow()` as the sole assertion.** Always assert on the resulting state. Instead of `expect(() => editor.removeBlock('x')).not.toThrow()`, write `editor.removeBlock('x'); expect(editor.content.value.blocks).toHaveLength(1)`.
- **Never use `typeof` checks alone.** Instead of `expect(typeof result).toBe('string')`, assert the actual value: `expect(result).toBe('')` or `expect(result).toContain('<mj-text')`.
- **Prefer `.toBe()` / `.toEqual()` over loose matchers.** Use `expect(x).toBe(false)` not `expect(x).toBeFalsy()`.
- **Assert return values, not just side effects.** If a function returns a value, test it. If it modifies state, check the state before and after.
- **Test both branches of every `if/else`.** If a function behaves differently based on a condition, write tests for both paths.

### Coverage requirements — what to test

Every module with logic must have tests covering three categories:

1. **Happy path** — Normal expected usage, success scenarios. E.g. "creates template via API and sets state."
2. **Unhappy path** — Error handling, failure scenarios, invalid input. E.g. "calls onError when API rejects", "throws SdkError when no template loaded."
3. **Edge cases** — Boundary conditions, empty inputs, null/undefined, double calls, state transitions. E.g. "double destroy is safe", "moveBlock with invalid target section removes block from source", "empty fieldValues merges without error."

When adding a new function or composable:
- Test every `if/else` branch in the implementation
- Test every `try/catch` — trigger the catch path
- Test every early `return` — verify the guard condition
- Test computed properties react to state changes
- Test that callbacks receive correct arguments (use `toHaveBeenCalledWith`)

### Test patterns by package

**`@templatical/types`** — Pure functions, no mocking needed. Test factory defaults, partial overrides, and type guards with all block types.

**`@templatical/core`** — Uses `@vue/reactivity` (ref, computed, watch). Composables can be tested directly without Vue mount. Use `vi.useFakeTimers()` for debounce-based composables (auto-save). Mock `ApiClient` for cloud modules.

**`@templatical/core/cloud`** — Mock `ApiClient.prototype.*` methods. Use `createMockAuthManager()` factory. Test API success, failure (onError called + error rethrown), and state transitions (isLoading/isSaving flags). For health check, mock both `fetch` global and `WebSocket` global.

**`@templatical/renderer`** — Pure render functions. Create blocks via `@templatical/types` factories, pass to `renderBlock()` with a `RenderContext`. Assert output with `.toContain()` for expected MJML/HTML fragments. Test hidden blocks return `''`.

**`@templatical/import-beefree`** — Test `convertModule()` with crafted `BeeFreeeModule` objects. Assert both the returned `block` properties and the `entry` status/metadata. Test unknown module types fall back to HTML.

**`@templatical/media-library`** — Mock `MediaApiClient` for composable tests. Use `createMediaItem()` / `createFolder()` factories. Test both API success and error paths. For image crop, mock `document.createElement('canvas')` and canvas context.

**`@templatical/editor`** — Import `dom-stubs.ts` before Vue in any test that touches Vue components or extensions. Use `withProvide()` for composables that use `inject()`. For TipTap extensions, test the config object properties directly (name, group, attributes, parseHTML) — don't instantiate a full editor. For component structure tests, read `.vue`/`.ts` source files with `node:fs` and assert on content patterns. When testing for patterns that moved to `useEditorCore`, check `composables/useEditorCore.ts` instead of `Editor.vue`/`CloudEditor.vue`.

### Editor package DOM stubs

The `packages/editor/tests/dom-stubs.ts` file provides minimal DOM stubs for tests that import Vue or TipTap extensions. **Always import it first** — before any Vue imports — because Vue captures `document` at module load time. The stubs include a `style` property on elements for ProseMirror compatibility.

## E2E Tests

**Playwright.** Browser-level smoke tests against the playground app. Lives in `apps/playground/e2e/`.

```bash
bun run test:e2e          # Run all e2e tests (headless)
bun run test:e2e:headed   # Run with visible browser
bun run test:e2e:ui       # Open Playwright UI mode
```

### Structure

```
apps/playground/e2e/
  helpers/selectors.ts       -- Centralized data-testid selectors
  pages/chooser.page.ts      -- Template chooser page object
  pages/editor.page.ts       -- Editor page object
  fixtures/editor.fixture.ts -- Extended test with page object fixtures
  tests/smoke.spec.ts        -- Core smoke tests
```

### Page object pattern

Tests use page objects (`ChooserPage`, `EditorPage`) accessed via Playwright fixtures. Selectors are centralized in `e2e/helpers/selectors.ts` using `data-testid` attributes added to `apps/playground/src/App.vue`.

### Flakiness rules

- **Never `page.waitForTimeout()`.** Wait on concrete state: `locator.waitFor()`, `expect(locator).toBeVisible()`, or `expect.poll(() => ...).toBe(...)`.
- **Never `isVisible().catch(() => false)`.** It swallows errors and makes passes meaningless. If an element is optional, check and assert both branches. If it's required, hard-assert.
- **Never `.toBeTruthy()` / `.toBeDefined()` / `typeof x === 'string'` as the sole assertion.** Pair with a value check. Same rule as Vitest (see Tests section).
- **Never `force: true`** on click/drag. Hides real interaction failures. If an element is covered, fix the selector or wait for the overlay to close.
- **Never compare `innerHTML` for equality.** Whitespace, dynamic IDs, and compiler markers drift. Assert on semantic properties (textContent, attribute values, element counts) or a normalized fingerprint.
- **Never pixel-hardcode drag positions.** Compute from `boundingBox()` and use relative offsets (e.g. `box.height * 0.1`).
- **Prefer `.toBe()` / `.toEqual()` / `.toHaveText()` over loose matchers.** Use `toBeHidden()` for disappearance, not `not.toBeVisible()` with a timeout.

### Selector priority

Order of preference when picking a selector:

1. `data-testid` — add one to the source if missing. Cheap, stable, locale-independent.
2. Semantic data attributes (`data-block-type`, `data-block-id`, `data-palette-type`).
3. ARIA roles + accessible name (`getByRole("button", { name: /save/i })`).
4. Stable SDK class names prefixed with `tpl-` or `pg-`.
5. Last resort: structural CSS (`.absolute.bottom-4 button`) — avoid.

Never use `.first()` / `.nth()` without a semantic anchor. Never use text-based locators for content that varies by locale — add a testid instead. When a test needs an element with no good selector, add one in the source rather than working around it.

### State waits

- **Hydration gate.** `EditorPage.waitForReady()` waits for the editor container AND either a rendered block or the empty-state placeholder — not just the DOM shell.
- **App bootstrap state (localStorage, cookies) must be set via `page.addInitScript()` before navigation.** Setting it after `page.goto()` races with the app's mount-time read.
- **Overlay/modal dismissal.** After clicking a dismiss button, wait for the overlay to go hidden (`waitFor({ state: "hidden" })` or `toHaveCount(0)`). Don't assume the click is synchronous.
- **Text input (TipTap).** Click `[contenteditable="true"]` (the ProseMirror root), not the outer `.tpl-text-editable` wrapper — clicking the wrapper doesn't reliably focus the editor.
- **Drag-and-drop via Sortable.js.** Sortable listens to pointer events and needs multiple intermediate `mousemove` events. Playwright's `locator.dragTo()` emits only two, which is often insufficient. For canvas block reordering, drive the mouse manually in ~20 steps (`page.mouse.down()` → loop `mouse.move()` → `mouse.up()`). `dragTo` works fine for palette-to-canvas drops (HTML5 drag events).

### Page objects self-verify

Mutating methods on `EditorPage` (drag, reorder, viewport switch) wait for the resulting state before returning, using `expect.poll()`. Callers then only assert business-level outcomes, not the fact that "something happened."

```ts
// Good — caller doesn't re-wait.
async dragBlockFromSidebar(blockType: string) {
  const countBefore = await this.getBlocks().count();
  await sidebarItem.dragTo(canvas);
  await expect.poll(() => this.getBlocks().count()).toBe(countBefore + 1);
}

// Bad — caller has to guess how long to wait.
async dragBlockFromSidebar(blockType: string) {
  await sidebarItem.dragTo(canvas);
}
```

### Adding a testid when one is missing

If a test needs to target an element with no stable selector, add `data-testid` to the source rather than working around it. Conventions:

- Overlays/modals: `data-testid="<feature>-overlay"` + `data-testid="<feature>-close"` (or `-dismiss`) for the dismiss button.
- Palette / list items: `data-<semantic>-type` (e.g. `data-palette-type`, `data-block-type`) when the item has a discriminator.
- Inputs/buttons inside a panel: `data-testid="<panel>-<action>"`.

Add the selector to `apps/playground/e2e/helpers/selectors.ts` so it's centralized. Never reach for `.nth()` / `.last()` as a substitute for a missing testid.

### Playwright MCP

Configured in `.mcp.json` at repo root. Provides browser interaction tools for Claude Code debugging and test authoring. Available after Claude Code restart.

## Changesets

Versioning and publishing use `@changesets/cli`. CI (`.github/workflows/publish.yml`) runs `@changesets/action` to create release PRs and `bunx changeset publish` to publish to npm.

## CI

GitHub Actions (`.github/workflows/ci.yml`) on push to main + PRs:

```
lint ──────┐
typecheck ─┤──→ test (build + test)
           ├──→ build ──→ e2e
```

1. **Lint** (parallel) — `bun run format --check` (Prettier) + `bun run lint` (ESLint)
2. **Typecheck** (parallel) — `bun run typecheck` (tsc/vue-tsc --noEmit per package, no build needed)
3. **Test** (after lint + typecheck) — `bun run build` then `bun run test` (tests import from dist)
4. **Build** (after lint + typecheck) — `bun run build` (tsup/vite per package in dependency order)
5. **E2E** (after build) — Installs Chromium, runs `bun run test:e2e` against playground. Uploads HTML report as artifact on failure.

All four gates must pass. Lint and typecheck run in parallel first; test and build only run if both pass. Run checks locally before pushing: `bun run format --check && bun run lint && bun run typecheck && bun run build && bun run test`.

## Design Context

### Users

Two audiences: **developers** who embed the editor into their SaaS products, and **marketers/content creators** who use the editor day-to-day to build email templates. The UI must be immediately productive for non-technical users while feeling like quality tooling to developers evaluating it.

### Brand Personality

**Clean, precise, confident.** The editor should feel like a premium, purpose-built tool — not a generic widget. Trust and reliability over flash. Every interaction should feel intentional and fast.

### Aesthetic Direction

- **References:** Linear, Vercel — sleek, developer-focused, high production quality
- **Anti-references:** Cluttered enterprise tools (Salesforce, HubSpot builders), generic Bootstrap/Material UI aesthetics, overly playful/casual (Canva-style)
- **Theme:** Light mode default with dark mode support (`'auto'` for system preference)

### Design System

- **Colors:** OKLch color space, 27 semantic tokens. Primary: amber/golden `oklch(70% 0.16 55)`. Secondary: blue `oklch(60% 0.118 184.71)`. All customizable via `ThemeOverrides`.
- **Typography:** Geist (400/500/600), 14px base, `ui-sans-serif` fallback
- **Spacing:** 3-level radius (7/10/14px), 5-level shadow system
- **Motion:** 120ms spring easing `cubic-bezier(0.16, 1, 0.3, 1)`. All animations respect `prefers-reduced-motion`.
- **CSS:** Tailwind CSS 4 with `tpl:` prefix to avoid consumer style conflicts. No preflight reset. All styles scoped via CSS custom properties.
- **Icons:** @lucide/vue

### Design Principles

1. **Invisible until needed** — The editor chrome should disappear, putting the email canvas front and center. Controls surface contextually, not all at once.
2. **Snappy over smooth** — Prefer fast, spring-physics transitions (120ms) over slow, cinematic ones. The tool should feel instant.
3. **Token-driven, never magic** — Every color, radius, and shadow comes from a design token. No hardcoded values. This enables theming and keeps the system coherent.
4. **Embeddable-first** — All CSS is prefixed (`tpl:`), no global resets, no style leaks. The editor must coexist with any host application's styles.
5. **Accessible by default** — Focus rings on all interactive elements, keyboard navigation, reduced motion support, WCAG AA contrast ratios.
