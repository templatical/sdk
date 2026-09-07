<p align="center">
  <img src="https://templatical.com/logo.svg" alt="Templatical" width="64" />
</p>

<h1 align="center">Templatical</h1>

<p align="center">
  Drag-and-drop email editor for modern apps — source-available, MIT after two years
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
  <a href="https://docs.templatical.com/changelog"><b>Changelog</b></a> ·
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

**Templatical** is a production-ready drag-and-drop email editor you can drop into any web app with a single function call. Templates are portable JSON, output is MJML (so they render correctly in every email client), and the editor itself is framework-agnostic — Vue under the hood, but you embed it in React, Svelte, Angular, or vanilla JS the same way. An optional Cloud tier is in development for AI rewrites, real-time collaboration, comments, saved blocks, multi-tenancy, test email sending, MCP support, and more.

## Design a complete email from a prompt

Describe the email you want and your AI coding agent builds it — then preview it in the real editor, hand-edit anything, and export send-ready MJML/HTML. **Free, open-source, no backend, no API key** — your agent is the inference, and nothing is sent to us. Ship a one-off campaign, or generate branded starter templates for your [`@templatical/editor`](https://docs.templatical.com/getting-started/quick-start) integration: if you have a coding agent, you have a complete email tool.

The [`templatical-email` Agent Skill](./skills/templatical-email) is an [Agent Skills](https://agentskills.io) folder — Claude Code, Codex CLI, Cursor, Gemini CLI, GitHub Copilot and others all read `SKILL.md`. The email it exports sends through any provider — Amazon SES, Postmark, Resend, Mailchimp, anything.

In **Claude Code**, two commands and you're done:

```text
/plugin marketplace add templatical/sdk
/plugin install templatical-email@templatical
```

Every other agent takes the folder. `~/.agents/skills/` is the vendor-neutral location most of them read, so one copy covers Codex CLI, Gemini CLI and friends:

```bash
cp -r skills/templatical-email ~/.agents/skills/
```

You can also **preview it live**: ask to "show it live" and the skill opens your template in the real Templatical editor in a browser, updating as you prompt and reconciling any edits you make by hand. It's local and adds no dependencies (a tiny Node bridge; the editor loads from the CDN).

[Skill guide →](https://docs.templatical.com/guide/agent-skill)

> Want a hosted, managed experience instead — AI chat inside the editor, tuned prompts, an MCP server we run? That's the Templatical Cloud tier (below).

## Power features

Things that are usually paid features in commercial editors — free in Templatical:

- **Custom blocks with API-backed data sources** — register your own block types whose content is rendered from a static template _or_ fetched live from your API at preview time. Typically a paid-tier feature in commercial editors.
- **Merge tags with pluggable syntax** — `{{handlebars}}`, `{liquid}`, `${js}`, or your own — with automatic human-readable label replacement directly in the editor canvas. Build your CRM-aware tag picker in minutes.
- **Display conditions** — show/hide blocks based on recipient attributes, with live preview in the editor.
- **Reusable saved blocks** — let users save a group of blocks and re-insert it across templates, with search, preview, rename and delete. You supply storage via a small provider interface (or use the bundled browser-local one); the editor owns the whole UI.
- **Version history** — browse, preview and restore a template's past versions from the header. Storage is a four-method provider you implement; the editor owns the control, the preview and the restore flow.
- **Full theming via design tokens** — 27 OKLch tokens, custom fonts, dark mode, complete theme overrides. No CSS hacking, no paid tier.
- **Template & block defaults** — define your brand once. New templates and new blocks pick up your brand automatically.

### And more

- **Drop-in mount** — one `init()` call, one `unmount()`. No framework lock-in.
- **Style-isolated, both directions** — Shadow DOM by default keeps host CSS out of the editor; `tpl:` Tailwind prefix and no preflight reset keep editor styles out of your app. Drops into any page, any framework, any CMS — no resets, no conflicts. [Learn more →](https://docs.templatical.com/guide/shadow-dom)
- **14 block types** — Title, Paragraph, Image, Button, Section, Divider, Spacer, Social Icons, Menu, Table, HTML, Video, Countdown, Custom.
- **JSON templates** — portable, versionable, store anywhere, render anywhere.
- **MJML output** — works with any email provider (Postmark, Resend, SES, Mailgun, anything).
- **Framework-agnostic** — first-class examples for React, Vue, Svelte, Angular, vanilla.
- **Multilingual** — English, German, Portuguese, Spanish, Catalan, French & Dutch built in, easy to add more locales.
- **TypeScript strict** — full types for blocks, config, and callbacks.
- **Battle-tested** — ~3,900 unit tests + Playwright E2E coverage.

## Quick Start

```bash
npm install @templatical/editor @templatical/renderer
```

```js
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: "#editor",
  onChange(content) {
    // content is JSON — store it, version it, send it anywhere
    console.log("Template updated:", content);
  },
});

// Render to MJML when you're ready to send
const mjml = await editor.toMjml();
```

```html
<div id="editor" style="height: 100vh"></div>
```

[Read the full guide →](https://docs.templatical.com/getting-started/quick-start) · [React, Svelte, Angular examples →](https://docs.templatical.com/getting-started/installation)

## Packages

| Package                                                                                    | Description                                                      | License                  |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------ |
| [`@templatical/editor`](https://www.npmjs.com/package/@templatical/editor)                 | Visual drag-and-drop editor                                      | [FSL-1.1-MIT](./LICENSE) |
| [`@templatical/core`](https://www.npmjs.com/package/@templatical/core)                     | Framework-agnostic editor logic, state, history                  | [FSL-1.1-MIT](./LICENSE) |
| [`@templatical/media-library`](https://www.npmjs.com/package/@templatical/media-library)   | Media library — composable, components, standalone SDK           | [FSL-1.1-MIT](./LICENSE) |
| [`@templatical/types`](https://www.npmjs.com/package/@templatical/types)                   | Shared TypeScript types and block factories                      | [MIT](./LICENSE-MIT)     |
| [`@templatical/renderer`](https://www.npmjs.com/package/@templatical/renderer)             | JSON → MJML → HTML renderer (browser + Node)                     | [MIT](./LICENSE-MIT)     |
| [`@templatical/quality`](https://www.npmjs.com/package/@templatical/quality)               | Accessibility linter for templates (browser + Node)              | [MIT](./LICENSE-MIT)     |
| [`@templatical/import-beefree`](https://www.npmjs.com/package/@templatical/import-beefree) | Convert BeeFree templates to Templatical format                  | [MIT](./LICENSE-MIT)     |
| [`@templatical/import-unlayer`](https://www.npmjs.com/package/@templatical/import-unlayer) | Convert Unlayer templates to Templatical format                  | [MIT](./LICENSE-MIT)     |
| [`@templatical/import-html`](https://www.npmjs.com/package/@templatical/import-html)       | Convert HTML email templates (table-based) to Templatical format | [MIT](./LICENSE-MIT)     |
| [`@templatical/import-mjml`](https://www.npmjs.com/package/@templatical/import-mjml)       | Convert MJML email templates to Templatical format               | [MIT](./LICENSE-MIT)     |

## Why FSL-1.1-MIT?

Editor packages (`@templatical/editor`, `@templatical/core`, `@templatical/media-library`) are licensed under [Functional Source License 1.1](./LICENSE), which automatically converts to MIT after **2 years per release**. You can:

- ✅ Embed it in your SaaS, CRM, marketing tool, or transactional product
- ✅ Self-host, modify, fork for internal use
- ✅ Use it commercially without paying anything

The only restriction: don't repackage Templatical itself as a directly competing email-editor product. Embedding is granted explicitly in the license text — the canonical FSL-1.1-MIT template, unmodified, plus an [Additional Permission](./LICENSE) covering products that include the editor as one feature among others. The other six packages — types, renderer, quality and all three importers — are pure MIT.

[Full license FAQ →](https://docs.templatical.com/license-faq)

## Documentation

- [Getting Started](https://docs.templatical.com/getting-started/quick-start) — install, mount, render
- [Block Reference](https://docs.templatical.com/guide/blocks) — all 14 block types
- [Theming](https://docs.templatical.com/guide/theming) — design tokens, dark mode, custom fonts
- [Custom Blocks](https://docs.templatical.com/guide/custom-blocks) — extend with your own
- [Saving & Loading](https://docs.templatical.com/backend/templates) — the template lifecycle over your own storage
- [Saved Blocks](https://docs.templatical.com/backend/saved-blocks) — reusable block groups over your own storage
- [Version History](https://docs.templatical.com/backend/version-history) — browse, preview and restore past versions over your own storage
- [AI Agent Skill](https://docs.templatical.com/guide/agent-skill) — generate emails from a prompt in your own agent
- [Cloud (AI, Collab, Comments)](https://docs.templatical.com/cloud/) — optional managed tier
- [Migrating from BeeFree](https://docs.templatical.com/guide/migration-from-beefree)
- [Migrating from Unlayer](https://docs.templatical.com/guide/migration-from-unlayer)
- [Migrating from HTML](https://docs.templatical.com/guide/migration-from-html)
- [Migrating from MJML](https://docs.templatical.com/guide/migration-from-mjml)
- [Changelog](https://docs.templatical.com/changelog) — every release, all packages, one page

Full docs: **[docs.templatical.com](https://docs.templatical.com)** (English + Deutsch).

Releases are also published as [GitHub Releases](https://github.com/templatical/sdk/releases) — one per version. Subscribe via the [Atom feed](https://github.com/templatical/sdk/releases.atom) or _Watch → Custom → Releases_.

## Contributing

Contributions, bug reports, and feature requests are welcome.

```bash
git clone https://github.com/templatical/sdk.git
cd sdk
pnpm install
pnpm run build
pnpm run test
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide.

## Sponsors

Templatical is built and maintained by a solo developer. If your company uses it in production, consider [sponsoring on GitHub](https://github.com/sponsors/orkhanahmadov) — it directly funds new features, faster releases, and continued open development.

## License

- **Editor packages** (`@templatical/editor`, `@templatical/core`, `@templatical/media-library`) — [FSL-1.1-MIT](./LICENSE)
- **Types, renderer, quality, importers** — [MIT](./LICENSE-MIT)
