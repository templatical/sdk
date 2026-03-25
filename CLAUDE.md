# CLAUDE.md — templatical-sdk

Open-source Templatical email editor. Bun monorepo with 6 npm packages, a playground app, and a docs site.

## Packages

| Package | Description | License | Key exports |
|---------|-------------|---------|-------------|
| `@templatical/types` | Shared TS types, block factories, event emitter | MIT | Block types, guards, factory fns, `EventEmitter`, merge tag presets |
| `@templatical/core` | Framework-agnostic editor logic, state, history, plugins | FSL-1.1-MIT | `useEditor`, `useHistory`, `useBlockActions`, `useAutoSave`, plugins |
| `@templatical/core/cloud` | Cloud-only modules (subpath export) | FSL-1.1-MIT | Auth, API, WebSocket, AI chat/rewrite, collaboration, comments, scoring, MCP, export |
| `@templatical/media-library` | Media library management (types, composable, API client, Vue components, standalone SDK) | FSL-1.1-MIT | `useMediaLibrary`, `MediaApiClient`, `MediaLibraryModal`, `MediaItem`, `init()` |
| `@templatical/vue` | Vue 3 visual drag-and-drop editor | FSL-1.1-MIT | `init()`, `initCloud()`, `unmount()` |
| `@templatical/renderer` | JSON → MJML → HTML renderer (browser + Node) | MIT | `renderToMjml()`, `renderToHtml()` |
| `@templatical/import-beefree` | BeeFree template converter | MIT | `convertBeeFreeTemplate()` |

### Dependency graph

```
@templatical/types  (no deps, devDep on media-library for type imports in cloud.ts)
  ├── @templatical/core  (+@vue/reactivity, pusher-js)
  ├── @templatical/renderer  (peer: mjml)
  └── @templatical/import-beefree

@templatical/core + @templatical/types
  └── @templatical/media-library  (+@vueuse/core, lucide-vue-next, vue-advanced-cropper; peer: vue, tailwindcss)

@templatical/core + @templatical/types + @templatical/media-library
  └── @templatical/vue  (+tiptap, vuedraggable, liquidjs; peer: vue, tailwindcss)
```

**Media types** (`MediaItem`, `MediaFolder`, etc.) are canonically defined in `@templatical/media-library`. The `@templatical/types` package imports them via devDependency for use in cloud config interfaces (`TemplaticalConfig`, `PlanConfig`). **Build order:** media-library before types.

## Commands

```bash
# Install
bun install

# Build all packages (tsup/vite per package)
bun run build

# CDN bundles (IIFE/ES for script-tag usage)
bun run build:email-editor           # → dist/email-editor/
bun run build:media-library           # → dist/media-library/
bun run build:all-sdk                 # both CDN builds

# Test (Vitest 3, all packages)
bun run test

# Lint & format
bun run lint          # eslint packages/*/src
bun run format        # prettier

# Type check
bun run typecheck     # tsc --noEmit per package

# Playground dev server
cd apps/playground && bun run dev

# Docs dev server (VitePress)
cd apps/docs && bun run docs:dev
```

## CDN Builds

Root-level Vite configs produce standalone bundles for CDN/script-tag usage:

- **`vite.email-editor.config.ts`** — Builds `@templatical/vue` as IIFE (`TemplaticalEmailEditor` global) + ES with code-split chunks (icons, vue, tiptap, pusher, draggable, media-library, features). Output: `dist/email-editor/`.
- **`vite.media-library.config.ts`** — Builds `@templatical/media-library` standalone visual SDK as IIFE (`TemplaticalMediaLibrary` global) + ES with code-split chunks. Output: `dist/media-library/`.

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

Used by `@templatical/vue`'s `initCloud()`.

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
- Keep `manualChunks` in `vite.email-editor.config.ts` up to date when adding new cloud components.
- Use type-only imports for runtime-lazy packages.
- Don't statically import packages >20KB gzipped that are only used conditionally.

## Architecture

- **Build:** tsup for types, core, renderer, import-beefree. Vite for vue, media-library packages and CDN bundles. **Build order matters:** media-library must build before types (types has devDep on media-library for type imports).
- **TypeScript:** Strict mode, target ES2020, module resolution `bundler`.
- **Vue 3** with TipTap 2 for rich text editing, VueDraggable for drag-and-drop, Tailwind CSS 4 for styling.
- **Tests:** Vitest 3. Files in `tests/**/*.test.ts` (or `src/__tests__/*.test.ts` for import-beefree). Run per-package with `vitest run --config vitest.config.ts`.
- **`vue` alias in core:** `@templatical/core` aliases `vue` to `@vue/reactivity` — this is critical, do not add Vue runtime imports in core or cloud modules.
- **Block types:** 13 types (Text, Image, Button, Section, Divider, Spacer, SocialIcons, Menu, Table, Html, Video, Countdown, Custom). Block IDs use UUID v7.

## Changesets

Versioning and publishing use `@changesets/cli`. CI (`.github/workflows/publish.yml`) runs `@changesets/action` to create release PRs and `bunx changeset publish` to publish to npm.

## CI

GitHub Actions (`.github/workflows/ci.yml`) on push to main + PRs:

1. Lint (`bun run format --check` + `bun run lint`)
2. Typecheck (`bun run typecheck`)
3. Test (`bun run test`)
4. Build (`bun run build`)

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
- **Icons:** lucide-vue-next

### Design Principles

1. **Invisible until needed** — The editor chrome should disappear, putting the email canvas front and center. Controls surface contextually, not all at once.
2. **Snappy over smooth** — Prefer fast, spring-physics transitions (120ms) over slow, cinematic ones. The tool should feel instant.
3. **Token-driven, never magic** — Every color, radius, and shadow comes from a design token. No hardcoded values. This enables theming and keeps the system coherent.
4. **Embeddable-first** — All CSS is prefixed (`tpl:`), no global resets, no style leaks. The editor must coexist with any host application's styles.
5. **Accessible by default** — Focus rings on all interactive elements, keyboard navigation, reduced motion support, WCAG AA contrast ratios.
