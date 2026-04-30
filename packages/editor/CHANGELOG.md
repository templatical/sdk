# @templatical/editor

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
