---
"@templatical/editor": patch
---

Fix editor interactivity broken in 0.1.1.

In 0.1.1 we bundled Vue inline but left `@templatical/core` and `@templatical/types` as external dependencies. Because `@templatical/core` imports reactivity primitives from `@vue/reactivity` (the standalone package), and the editor bundle shipped Vue's full runtime (which contains its own copy of the reactivity system), consumers ended up with **two separate reactivity instances at runtime** — each with its own dep-tracking `WeakMap`. Refs created by `@templatical/core`'s `useEditor` were never tracked by the editor's render functions, so clicks, drags, and every state mutation silently no-op'd: the editor rendered initial chrome but ignored all user input.

This release bundles `@templatical/core`, `@templatical/types`, and all transitive Vue libraries (`@vueuse/core`, `vuedraggable`, `@tiptap/*`, `@lucide/vue`) **inline** into the editor's npm entry, with `vue` and `@vue/reactivity` deduped to a single instance via Vite's `resolve.dedupe`. The editor is now a truly self-contained drop-in:

- Consumer install drops from 149 → 71 packages (no `vue`, no `@vue/*`, no `@tiptap/*`, no `@templatical/core`/`types` in `node_modules`).
- Zero peer warnings on `npm install @templatical/editor` for any framework (React, Svelte, Angular, vanilla, Vue).
- Interactivity works in every consumer setup verified — including a React app with `<div id="editor" />` rendered as a JSX child inside the React tree.

The only externals that remain are the optional cloud/feature peers a consumer explicitly opts into: `@templatical/media-library`, `@templatical/renderer`, `pusher-js`.

**Note for SDK contributors:** when adding a new runtime dependency to the editor that uses Vue's reactivity (or imports from `@vue/reactivity` directly), it MUST be bundled inline (i.e. listed in `devDependencies`, not `dependencies`, and not in `rolldownOptions.external`). Adding such a dep as a runtime/peer dep reintroduces the duplicate-reactivity bug.
