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
  <a href="https://play.templatical.com">
    <img src="https://templatical.com/preview.png" alt="Templatical editor preview" width="900" />
  </a>
</p>

<p align="center">
  <a href="https://play.templatical.com"><b>▶ Try it live in the playground</b></a>
</p>

---

**Templatical** is a production-ready drag-and-drop email editor you can drop into any web app with a single function call. Templates are portable JSON, output is MJML (so they render correctly in every email client), and the editor itself is framework-agnostic — Vue under the hood, but you embed it in React, Svelte, Angular, or vanilla JS the same way. It's an open-source alternative to Beefree and Unlayer, with an optional Cloud tier for AI rewrites and real-time collaboration.

## Power features

Things that are usually paid features in commercial editors — open-source in Templatical:

- **Custom blocks with API-backed data sources** — register your own block types whose content is rendered from a static template *or* fetched live from your API at preview time. Paid tier elsewhere ($750–$2,500/mo).
- **Merge tags with pluggable syntax** — `{{handlebars}}`, `{liquid}`, `${js}`, or your own — with automatic human-readable label replacement directly in the editor canvas. Build your CRM-aware tag picker in minutes.
- **Display conditions** — show/hide blocks based on recipient attributes, with live preview in the editor.
- **Full theming via design tokens** — 27 OKLch tokens, custom fonts, dark mode, complete theme overrides. No CSS hacking, no paid tier.
- **Template & block defaults** — define your brand once. New templates and new blocks pick up your brand automatically.

> **Cloud features** — AI rewrite, AI chat, real-time collaboration with block locking, comments, snapshots, and more — are part of the Templatical Cloud tier currently in development. The Cloud implementation is also open code in `@templatical/core/cloud`. [Learn more about Cloud →](https://docs.templatical.com/cloud/)

## And the table-stakes (still important)

- **Drop-in mount** — one `init()` call, one `unmount()`. No framework lock-in.
- **14 block types** — Title, Paragraph, Image, Button, Section, Divider, Spacer, Social Icons, Menu, Table, HTML, Video, Countdown, Custom.
- **JSON templates** — portable, versionable, store anywhere, render anywhere.
- **MJML output** — works with any email provider (Postmark, Resend, SES, Mailgun, anything).
- **Framework-agnostic** — first-class examples for React, Vue, Svelte, Angular, vanilla.
- **Tailwind 4 with `tpl:` prefix** — no preflight reset, no style leaks into your app.
- **Bilingual** — en/de built in, easy to add more locales.
- **TypeScript strict** — full types for blocks, config, and callbacks.
- **Battle-tested** — ~1,400 unit tests + Playwright E2E coverage.

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
| [`@templatical/core`](https://www.npmjs.com/package/@templatical/core) | Framework-agnostic editor logic, state, history | [FSL-1.1-MIT](./LICENSE) |
| [`@templatical/media-library`](https://www.npmjs.com/package/@templatical/media-library) | Media library — composable, components, standalone SDK | [FSL-1.1-MIT](./LICENSE) |
| [`@templatical/types`](https://www.npmjs.com/package/@templatical/types) | Shared TypeScript types and block factories | [MIT](./LICENSE-MIT) |
| [`@templatical/renderer`](https://www.npmjs.com/package/@templatical/renderer) | JSON → MJML → HTML renderer (browser + Node) | [MIT](./LICENSE-MIT) |
| [`@templatical/import-beefree`](https://www.npmjs.com/package/@templatical/import-beefree) | Convert BeeFree templates to Templatical format | [MIT](./LICENSE-MIT) |

## How does it compare?

|  | **Templatical** | Beefree SDK | Unlayer | GrapesJS + MJML |
|---|---|---|---|---|
| Open source | ✅ FSL → MIT | ❌ Closed source | ⚠️ Wrapper only (MIT) | ✅ BSD-3 |
| Self-hostable | ✅ | ❌ Iframe-only | ❌ Iframe-only | ✅ |
| MJML output | ✅ Native | ❌ Proprietary JSON | ❌ Proprietary JSON | ✅ |
| Custom blocks | ✅ Open API | Paid tier (Superpowers, $2.5k/mo) | Paid tier (Scale, $750/mo) | ✅ Open API |
| Real-time collaboration | ✅ Cloud / OSS code | Paid tier ($2.5k/mo) | Team-level only | ❌ |
| AI rewrite | ✅ Cloud / OSS code | Paid tier | Paid tier (Scale+) | ❌ |
| Comments / review | ✅ Cloud / OSS code | Paid tier | Audit tab only | ❌ |
| Embed price floor (paid) | Free / self-host | $350–$5,000+/mo | $250–$2,000+/mo | Free |

[Full comparison with prose, sources, and "when *not* to choose Templatical" →](https://docs.templatical.com/comparison)

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

Templatical is built and maintained by a solo developer. If your company uses it in production, consider [sponsoring on GitHub](https://github.com/sponsors/orkhanahmadov) — it directly funds new features, faster releases, and continued open development.

## License

- **Editor packages** (`@templatical/editor`, `@templatical/core`, `@templatical/media-library`) — [FSL-1.1-MIT](./LICENSE)
- **Types, renderer, importers** — [MIT](./LICENSE-MIT)
