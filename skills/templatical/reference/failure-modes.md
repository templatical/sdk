# Failure modes

**Consulted by:** [integrate.md](integrate.md) · [scaffold.md](scaffold.md) ·
[diagnose.md](diagnose.md)

Read forwards when integrating — things to avoid. Read backwards when
diagnosing — symptom, then cause, then confirm it in their code before changing
anything.

A working mount snippet doesn't protect against any of these. Every row is a
verified fact about this SDK, not a general best practice.

| Trap | The rule |
| --- | --- |
| **Duplicate Vue reactivity** | The editor bundles Vue, `@templatical/core` and `@templatical/types` inline, and dedupes `vue`/`@vue/reactivity` to one instance at build time. Add `@templatical/core` — or any other Vue-using `@templatical/*` package — to the consumer's own dependencies and it can resolve to a second, separate reactivity instance with its own dep-tracking `WeakMap`: refs the editor creates are never seen by that second instance's effects, and the editor renders its chrome and then silently ignores every click, drag and keystroke — nothing thrown, nothing logged. Never add a Vue-using `@templatical/*` package to the consumer's own dependencies; the bundled copy is the only one the editor needs. |
| **Tailwind is never a peer** | `dist/style.css` ships fully compiled. `tailwindcss` is a build-time dev dependency of the editor's own project, never a peer — don't tell a consumer to install it; doing so changes nothing about the editor's styles. |
| **The stylesheet subpath** | `import "@templatical/editor/style.css"` — the package's `exports` map resolves that subpath to `dist/style.css` specifically so this works. Forgetting it mounts a fully functional, completely unstyled editor — easy to mistake for a broken integration. |
| **ESM only** | No CJS, no UMD, no `require` export. The `exports` map exposes only an `import` condition plus `types` — there's no `main` field at all. A consumer whose own build is CJS-only needs a bundler that can consume ESM, not a workaround here. |
| **Host style inheritance** | Shadow DOM blocks the host's *rules*, not *inheritance* — twelve typography properties (letter-spacing, word-spacing, text-transform, font-style, font-weight, text-indent, text-align, white-space, list-style-type, cursor, font-variant-numeric, text-shadow), plus font-family/size/line-height/color, cross the boundary in both DOM modes. The editor neutralizes them at its own root. **Don't advise resetting the container** — `all: initial`/`revert` there wipes the `--tpl-user-*` custom properties that are the theming surface, and can break the height chain below. See `reference/getting-started/embedding.md`. |
| **A trapped `position: fixed`** | Any ancestor of the container with `transform`, `filter`, `backdrop-filter`, `perspective`, `will-change`, `contain`, `isolation`, `opacity` below `1`, or a positioned element carrying a `z-index`, becomes a stacking context or a containing block the editor's dialogs resolve against instead of the viewport. Symptoms: dialogs clipped or painted under the host's own chrome, or a drag-and-drop ghost that drifts from the cursor. See `reference/getting-started/embedding.md`. |
| **The height chain** | The container needs a definite height — the editor fills it. Without one, a small anti-collapse floor (~320px) keeps the mount from vanishing outright, but its chrome is positioned assuming real height, so the sidebar's last items, the footer and panel content clip with no way to scroll them into view. Fix the container's height rather than the symptom. |
| **`toHtml()` needs a provider** | The SDK bundles no MJML compiler. `toHtml()` resolves `render.toHtml`, else `toMjml()`'s result through `render.compileMjml`, else rejects — there's no local HTML path, ever. `toMjml()` alone falls back to the local `@templatical/renderer` only when no `render.toMjml` is configured. See Providers, below. |
| **Four optional peers, each lazy and feature-gated** | `@templatical/renderer` (first `toMjml()` call), `@templatical/quality` (Issues sidebar, loaded at mount), `@templatical/media-library` (first media-browser open, `initCloud()` only), `pusher-js` (Cloud realtime connect, `initCloud()` only). Installing one that's unused is dead weight; omitting one that's needed is a silent missing feature, not a thrown error. |
| **The browser floor differs by mount mode** | Default shadow mount: Chrome/Edge 80+, Firefox 101+, Safari 16.4+ (driven by `adoptedStyleSheets`). `shadowDom: false` drops the floor to Firefox 80+ / Safari 14+, at the cost of host-CSS isolation. |
