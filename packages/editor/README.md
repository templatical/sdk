# @templatical/editor

> Vue 3 visual drag-and-drop email editor — drop into any web app with one function call.

[![npm version](https://img.shields.io/npm/v/@templatical/editor?label=npm&color=cb3837)](https://www.npmjs.com/package/@templatical/editor)
[![License](https://img.shields.io/badge/license-FSL--1.1--MIT-blue)](https://github.com/templatical/sdk/blob/main/LICENSE)

The visual editor for [Templatical](https://github.com/templatical/sdk) — an open-source drag-and-drop email editor with JSON templates and MJML output.

- 🧩 **14 block types** — title, paragraph, image, button, section, divider, spacer, social icons, menu, table, HTML, video, countdown, custom
- 🎨 **27 design tokens** — full theming, dark mode, custom fonts
- 🔌 **Framework-agnostic** — works in React, Vue, Svelte, Angular, vanilla
- 📦 **JSON in, MJML out** — portable templates, render with any email provider
- 🌍 **Bilingual** — English + German built in
- 🔒 **TypeScript strict** — full type safety end to end

## Install

Install the editor alongside `@templatical/renderer` — the renderer is what enables `editor.toMjml()` (the editor auto-detects it at runtime).

```bash
npm install @templatical/editor @templatical/renderer
```

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

// Render to MJML when sending email
const mjml = editor.toMjml();

// Always unmount when removing the editor (cleans up listeners + DOM)
editor.unmount();
```

```html
<div id="editor" style="height: 100vh"></div>
```

## Framework integration

First-class examples for **React, Vue, Svelte, Angular, and vanilla JS** are in the [installation guide](https://docs.templatical.com/getting-started/installation).

## Cloud features

For AI rewrite, real-time collaboration, comments, snapshots, and saved modules, use `initCloud()` instead. See the [Cloud guide](https://docs.templatical.com/cloud/getting-started).

## Documentation

- [Quick Start](https://docs.templatical.com/getting-started/quick-start)
- [Editor API reference](https://docs.templatical.com/api/editor)
- [Block reference](https://docs.templatical.com/guide/blocks)
- [Theming](https://docs.templatical.com/guide/theming)
- [Custom blocks](https://docs.templatical.com/guide/custom-blocks)

Full docs at **[docs.templatical.com](https://docs.templatical.com)**.

## License

[FSL-1.1-MIT](https://github.com/templatical/sdk/blob/main/LICENSE) — free for any non-competing commercial use, automatically converts to MIT after 2 years per release. [License FAQ](https://docs.templatical.com/license-faq).
