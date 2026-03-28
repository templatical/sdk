<p align="center">
  <img src="https://templatical.com/images/logo.svg" alt="Templatical" width="48" />
</p>

<h1 align="center">Templatical</h1>

<p align="center">
  Open-source drag-and-drop email editor for modern apps
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@templatical/vue"><img src="https://img.shields.io/npm/v/@templatical/vue?label=npm&color=cb3837" alt="npm version" /></a>
  <a href="https://github.com/templatical/editor/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-FSL--1.1--MIT-blue" alt="License" /></a>
  <a href="https://github.com/templatical/editor/actions"><img src="https://img.shields.io/github/actions/workflow/status/templatical/editor/ci.yml?branch=main" alt="CI" /></a>
  <a href="https://codecov.io/gh/templatical/sdk"><img src="https://codecov.io/gh/templatical/sdk/branch/main/graph/badge.svg" alt="Coverage" /></a>
  <a href="https://github.com/templatical/editor/stargazers"><img src="https://img.shields.io/github/stars/templatical/editor?style=flat" alt="Stars" /></a>
</p>

<p align="center">
  <a href="https://play.templatical.com">Playground</a> · <a href="https://docs.templatical.com">Documentation</a> · <a href="https://templatical.com">Templatical Cloud</a>
</p>

<br />

<!-- TODO: Replace with animated GIF (15s loop: drag block → edit text → switch viewport → export) -->
<p align="center">
  <img src="https://templatical.com/images/editor-preview.png" alt="Templatical Editor" width="720" />
</p>

## Why Templatical?

- **Production-ready email editor** — 13 block types, drag-and-drop, undo/redo, responsive preview, dark mode, and client-side export. Drop it into your app in minutes.
- **Truly open-source** — Not a freemium widget with a paywall. The editor and renderer are free to use (FSL → MIT after 2 years). Types and renderers are MIT today.
- **Framework-agnostic rendering** — TypeScript renderer for browser and Node.js, PHP renderer for server-side. Your templates are portable JSON — no vendor lock-in.

## Quick Start

```bash
npm install @templatical/vue @templatical/renderer
```

```js
import { init } from '@templatical/vue';
import '@templatical/vue/style.css';

const editor = init({
  container: '#editor',
  onChange(content) {
    console.log('Template updated:', content);
  },
});

// Get the template content at any time
const content = editor.getContent();

// Export to MJML or HTML
const mjml = editor.toMjml();
const html = await editor.toHtml();
```

```html
<div id="editor" style="height: 100vh"></div>
```

That's it. [Read the full guide →](https://docs.templatical.com/getting-started/quick-start)

## Features

| Feature | Description |
|---------|-------------|
| **13 Block Types** | Text, Image, Button, Section, Divider, Spacer, Social Icons, Menu, Table, HTML, Video, Countdown, Custom |
| **Drag & Drop** | Intuitive block reordering with visual drop indicators |
| **Undo / Redo** | Full history with configurable stack size |
| **Responsive Preview** | Desktop, tablet, and mobile viewport switching |
| **Dark Mode** | Built-in light and dark themes with customizable tokens |
| **Merge Tags** | Dynamic content placeholders with 5 syntax presets (Liquid, Handlebars, Mailchimp, AMPscript, Django) |
| **Display Conditions** | Conditional block visibility with grouped conditions |
| **Custom Blocks** | Define your own block types with fields, templates, and data sources |
| **Multi-Column Layouts** | 5 column configurations (1, 2, 3, 2-1, 1-2) |
| **Theming** | 27 color tokens for complete visual customization |
| **i18n** | Built-in internationalization support |
| **Client-Side Export** | JSON → MJML → HTML, all in the browser |
| **Plugin System** | Extend the editor with custom toolbar actions, sidebar panels, and block actions |

## Comparison

| | **Templatical** | BeeFree | Unlayer | GrapesJS |
|---|---|---|---|---|
| Open source | Yes (FSL → MIT) | No | No | Yes (BSD-3) |
| Email-focused | Yes | Yes | Yes | No (generic) |
| Drag & drop | Yes | Yes | Yes | Yes |
| Responsive preview | Yes | Yes | Yes | Manual |
| Merge tags | Yes (5 presets) | Yes | Yes | Plugin |
| Custom blocks | Yes | Limited | Yes | Yes |
| Dark mode | Yes | No | No | No |
| Plugin system | Yes | No | Yes | Yes |
| TypeScript | First-class | No | Partial | No |
| Self-hosted | Yes | No | No | Yes |
| JSON format | Portable | Proprietary | Proprietary | HTML-based |
| Bundle size | ~180KB gzipped | N/A (hosted) | ~400KB | ~300KB |
| Server rendering | TS + PHP | No | No | No |
| Free | Yes | No ($) | No ($) | Yes |

## Packages

| Package | Description | License |
|---------|-------------|---------|
| [`@templatical/vue`](https://www.npmjs.com/package/@templatical/vue) | Vue 3 visual editor — the main package | [FSL-1.1-MIT](./LICENSE) |
| [`@templatical/core`](https://www.npmjs.com/package/@templatical/core) | Framework-agnostic editor logic, state, history, plugins | [FSL-1.1-MIT](./LICENSE) |
| [`@templatical/types`](https://www.npmjs.com/package/@templatical/types) | Shared TypeScript types and block factories | [MIT](./LICENSE-MIT) |
| [`@templatical/renderer`](https://www.npmjs.com/package/@templatical/renderer) | JSON → MJML → HTML renderer (browser + Node.js) | [MIT](./LICENSE-MIT) |
| [`@templatical/import-beefree`](https://www.npmjs.com/package/@templatical/import-beefree) | Convert BeeFree templates to Templatical format | [MIT](./LICENSE-MIT) |
| [`templatical/renderer`](https://packagist.org/packages/templatical/renderer) | PHP JSON → MJML renderer (Composer) | [MIT](./LICENSE-MIT) |

## Templatical Cloud

The open-source editor covers everything you need to build and render email templates. [Templatical Cloud](https://templatical.com) adds the features teams need at scale:

- **AI Assistant** — Generate, rewrite, and improve email content with AI
- **Real-time Collaboration** — Multiple editors working simultaneously
- **Media Library** — Upload, organize, and manage images
- **Template Scoring** — Automated quality and deliverability checks
- **Comments & Reviews** — Inline commenting on blocks
- **Saved Modules** — Reusable template sections
- **Test Emails** — Send test emails directly from the editor
- **Snapshots** — Version history with restore
- **MCP Integration** — Connect AI agents to the editor
- **Multi-tenant** — Project and tenant isolation with API keys

[Learn more →](https://templatical.com)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

```bash
# Clone and install
git clone https://github.com/templatical/editor.git
cd editor
bun install

# Build all packages
bun run build

# Run tests
bun run test

# Start the playground
cd apps/playground
bun run dev
```

## License

- **Editor packages** (`@templatical/vue`, `@templatical/core`) — [FSL-1.1-MIT](./LICENSE) (free to use; converts to MIT after 2 years)
- **Types, renderers, importers** — [MIT](./LICENSE-MIT)

See [LICENSE](./LICENSE) for full terms including revenue threshold and commercial licensing details.
