# @templatical/editor

> Vue 3 visual drag-and-drop email editor — drop into any web app with one function call.

[![npm version](https://img.shields.io/npm/v/@templatical/editor?label=npm&color=cb3837)](https://www.npmjs.com/package/@templatical/editor)
[![License](https://img.shields.io/badge/license-FSL--1.1--MIT-blue)](https://github.com/templatical/sdk/blob/main/LICENSE)

The visual editor for [Templatical](https://github.com/templatical/sdk) — an open-source drag-and-drop email editor with JSON templates and MJML output.

- 🧩 **14 block types** — title, paragraph, image, button, section, divider, spacer, social icons, menu, table, HTML, video, countdown, custom
- 🛡 **Shadow DOM isolated** — mounts inside an open shadow root by default so host page CSS cannot bleed in
- 🎨 **27 design tokens** — full theming via `--tpl-user-*` CSS variables, dark mode, custom fonts
- 🔌 **Framework-agnostic** — works in React, Vue, Svelte, Angular, vanilla
- 📦 **JSON in, MJML out** — portable templates, render with any email provider
- 🌍 **Multilingual** — English, German, Portuguese, Spanish & Catalan built in
- 🔒 **TypeScript strict** — full type safety end to end

## Install

```bash
npm install @templatical/editor
```

`@templatical/renderer` is an optional peer — install it only if you need to convert templates to MJML. The two common cases are:

- **In the browser, alongside the editor**, when you call `editor.toMjml()` to export from the user's session.
- **In Node.js (or another runtime)**, when you only have stored template JSON and want to convert it to MJML server-side. You don't need the editor for this — install just the renderer.

```bash
npm install @templatical/renderer
```

If you call `editor.toMjml()` without the renderer installed, it throws a clear error naming the missing package.

## Usage

```ts
import { init } from '@templatical/editor';
import '@templatical/editor/style.css';

const editor = await init({
  container: '#editor',
  onChange(content) {
    // content is JSON — store/version/sync however you want
  },
});

// Render to MJML when sending email — async; requires @templatical/renderer
const mjml = await editor.toMjml();

// Always unmount when removing the editor (cleans up listeners + DOM)
editor.unmount();
```

```html
<div id="editor" style="height: 100vh"></div>
```

## Framework integration

First-class examples for **React, Vue, Svelte, Angular, and vanilla JS** are in the [installation guide](https://docs.templatical.com/getting-started/installation).

## Shadow DOM by default

The editor mounts inside an open shadow root attached to your container. Host page CSS — including resets like `* { color: red !important }` — cannot cascade into editor elements, and editor utility classes cannot leak out.

```ts
// Shadow DOM is on by default — no extra config
const editor = await init({ container: "#editor" });

// Opt out for light-DOM mount (older browsers, host-side document.querySelector access)
const editor = await init({ container: "#editor", shadowDom: false });
```

Theme via `:host`-style CSS variables — set `--tpl-user-*` on the container (or any ancestor) and the value inherits across the shadow boundary:

```css
#editor {
  --tpl-user-primary: oklch(65% 0.2 280);
  --tpl-user-radius: 14px;
}
```

See the [Shadow DOM guide](https://docs.templatical.com/guide/shadow-dom) for trade-offs, opt-out semantics, and browser-support tiers.

## Cloud features

For AI rewrite, real-time collaboration, comments, snapshots, and saved modules, use `initCloud()` instead. See the [Cloud guide](https://docs.templatical.com/cloud/getting-started).

## Documentation

- [Quick Start](https://docs.templatical.com/getting-started/quick-start)
- [Editor API reference](https://docs.templatical.com/api/editor)
- [Block reference](https://docs.templatical.com/guide/blocks)
- [Theming](https://docs.templatical.com/guide/theming)
- [Shadow DOM](https://docs.templatical.com/guide/shadow-dom)
- [Custom blocks](https://docs.templatical.com/guide/custom-blocks)

Full docs at **[docs.templatical.com](https://docs.templatical.com)**.

## License

[FSL-1.1-MIT](https://github.com/templatical/sdk/blob/main/LICENSE) — free for any non-competing commercial use, automatically converts to MIT after 2 years per release. [License FAQ](https://docs.templatical.com/license-faq).
