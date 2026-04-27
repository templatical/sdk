<p align="center">
  <img src="https://templatical.com/logo.svg" alt="Templatical" width="64" />
</p>

<h1 align="center">Templatical</h1>

<p align="center">
  Open-source drag-and-drop email editor for modern apps
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@templatical/editor"><img src="https://img.shields.io/npm/v/@templatical/editor?label=npm&color=cb3837" alt="npm version" /></a>
  <a href="https://github.com/templatical/sdk/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-FSL--1.1--MIT-blue" alt="License" /></a>
  <a href="https://github.com/templatical/sdk/actions"><img src="https://img.shields.io/github/actions/workflow/status/templatical/sdk/ci.yml?branch=main" alt="CI" /></a>
  <a href="https://codecov.io/gh/templatical/sdk"><img src="https://codecov.io/gh/templatical/sdk/branch/main/graph/badge.svg" alt="Coverage" /></a>
  <a href="https://github.com/templatical/sdk/stargazers"><img src="https://img.shields.io/github/stars/templatical/sdk?style=social" alt="GitHub stars" /></a>
</p>

<p align="center">
  <a href="https://play.templatical.com"><b>Playground</b></a> ·
  <a href="https://docs.templatical.com"><b>Documentation</b></a> ·
  <a href="https://templatical.com"><b>Website</b></a> ·
  <a href="https://github.com/templatical/sdk/discussions"><b>Discussions</b></a>
</p>

<p align="center">
  <img src=".github/assets/demo.gif" alt="Templatical editor demo" width="900" />
</p>

---

**Templatical** is a production-ready drag-and-drop email editor you can drop into any web app with a single function call. Templates are portable JSON, output is MJML (so they render correctly in every email client), and the editor itself is framework-agnostic — Vue under the hood, but you embed it in React, Svelte, Angular, or vanilla JS the same way. It's an open-source alternative to Beefree and Unlayer, with an optional Cloud tier for AI rewrites and real-time collaboration.

## Features

- **Drop-in mount** — one `init()` call, one `unmount()`. No framework lock-in.
- **14 block types** — Title, Paragraph, Image, Button, Section, Divider, Spacer, Social Icons, Menu, Table, HTML, Video, Countdown, Custom.
- **JSON templates** — portable, versionable, store anywhere, render anywhere.
- **MJML output** — works with any email provider (Postmark, Resend, SES, Mailgun, anything).
- **Framework-agnostic** — first-class examples for React, Vue, Svelte, Angular, vanilla.
- **Theming** — 27 OKLch design tokens, custom fonts, dark mode, full theme overrides.
- **Custom blocks** — plugin system for your own block types and inspectors.
- **Display conditions, merge tags, liquid syntax** — built-in personalization.
- **Tailwind 4 with `tpl:` prefix** — no preflight reset, no style leaks into your app.
- **Bilingual** — en/de built in, easy to add more locales.
- **TypeScript strict** — full types for blocks, config, callbacks, plugins.
- **Battle-tested** — ~1,400 unit tests + Playwright E2E coverage.
- **Optional Cloud tier** — AI chat/rewrite, real-time collaboration, comments, snapshots.

## Quick Start

```bash
npm install @templatical/editor @templatical/renderer
```

```js
import { init } from '@templatical/editor';
import '@templatical/editor/style.css';

const editor = await init({
  container: '#editor',
  onChange(content) {
    // content is JSON — store it, version it, send it anywhere
    console.log('Template updated:', content);
  },
});

// Render to MJML when you're ready to send
const mjml = editor.toMjml();
```

```html
<div id="editor" style="height: 100vh"></div>
```

[Read the full guide →](https://docs.templatical.com/getting-started/quick-start) · [React, Svelte, Angular examples →](https://docs.templatical.com/getting-started/installation)

## Packages

| Package | Description | License |
|---------|-------------|---------|
| [`@templatical/editor`](https://www.npmjs.com/package/@templatical/editor) | Vue 3 visual drag-and-drop editor | [FSL-1.1-MIT](./LICENSE) |
| [`@templatical/core`](https://www.npmjs.com/package/@templatical/core) | Framework-agnostic editor logic, state, history, plugins | [FSL-1.1-MIT](./LICENSE) |
| [`@templatical/media-library`](https://www.npmjs.com/package/@templatical/media-library) | Media library — composable, components, standalone SDK | [FSL-1.1-MIT](./LICENSE) |
| [`@templatical/types`](https://www.npmjs.com/package/@templatical/types) | Shared TypeScript types and block factories | [MIT](./LICENSE-MIT) |
| [`@templatical/renderer`](https://www.npmjs.com/package/@templatical/renderer) | JSON → MJML → HTML renderer (browser + Node) | [MIT](./LICENSE-MIT) |
| [`@templatical/import-beefree`](https://www.npmjs.com/package/@templatical/import-beefree) | Convert BeeFree templates to Templatical format | [MIT](./LICENSE-MIT) |

## How does it compare?

|  | **Templatical** | Beefree | Unlayer | GrapesJS MJML |
|---|---|---|---|---|
| Open source | ✅ FSL → MIT | ❌ | Limited | ✅ MIT |
| Self-hostable | ✅ | ❌ | Paid only | ✅ |
| MJML output | ✅ native | ❌ | ❌ | ✅ |
| Framework-agnostic embed | ✅ | ✅ | ✅ | ✅ |
| Custom blocks (plugin API) | ✅ | Limited | Limited | ✅ |
| Real-time collaboration | ✅ Cloud | ❌ | ❌ | ❌ |
| AI rewrite | ✅ Cloud | ❌ | ✅ | ❌ |
| Embed pricing | Free / Cloud | $$$$ | $$$ | Free |

[Full comparison →](https://docs.templatical.com/comparison)

## Why FSL-1.1-MIT?

Editor packages (`@templatical/editor`, `@templatical/core`, `@templatical/media-library`) are licensed under [Functional Source License 1.1](./LICENSE), which automatically converts to MIT after **2 years per release**. You can:

- ✅ Embed it in your SaaS, CRM, marketing tool, or transactional product
- ✅ Self-host, modify, fork for internal use
- ✅ Use it commercially without paying anything

The only restriction: don't repackage Templatical itself as a directly competing email-editor product. Renderers, types, and importers are pure MIT.

[Full license FAQ →](https://docs.templatical.com/license-faq)

## Documentation

- [Getting Started](https://docs.templatical.com/getting-started/quick-start) — install, mount, render
- [Block Reference](https://docs.templatical.com/guide/blocks) — all 14 block types
- [Theming](https://docs.templatical.com/guide/theming) — design tokens, dark mode, custom fonts
- [Custom Blocks](https://docs.templatical.com/guide/custom-blocks) — extend with your own
- [Cloud (AI, Collab, Comments)](https://docs.templatical.com/cloud/) — optional managed tier
- [Migrating from BeeFree](https://docs.templatical.com/guide/migration-from-beefree)

Full docs: **[docs.templatical.com](https://docs.templatical.com)** (English + Deutsch).

## Roadmap

- More built-in block types (accordion, code, AMP-for-email)
- Built-in Unlayer template importer
- Plain-text email auto-generation
- More locales (community contributions welcome)
- Plugin marketplace

Track progress on [GitHub Issues](https://github.com/templatical/sdk/issues) or open a [Discussion](https://github.com/templatical/sdk/discussions) to propose something.

## Contributing

Contributions, bug reports, and feature requests are welcome.

```bash
git clone https://github.com/templatical/sdk.git
cd sdk
bun install
bun run build
bun run test
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide and [CLAUDE.md](./CLAUDE.md) for architecture details.

## Sponsors

Templatical is built and maintained by a solo developer. If your company uses it in production, consider [sponsoring on GitHub](https://github.com/sponsors/templatical) — it directly funds new features, faster releases, and continued open development.

## License

- **Editor packages** (`@templatical/editor`, `@templatical/core`, `@templatical/media-library`) — [FSL-1.1-MIT](./LICENSE)
- **Types, renderer, importers** — [MIT](./LICENSE-MIT)
