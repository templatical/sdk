<p align="center">
  <img src="https://templatical.com/logo.svg" alt="Templatical" width="48" />
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
</p>

<p align="center">
  <a href="https://play.templatical.com">Playground</a> · <a href="https://docs.templatical.com">Documentation</a> · <a href="https://templatical.com">Website</a>
</p>

## Quick Start

```bash
npm install @templatical/editor @templatical/renderer
```

```js
import { init } from '@templatical/editor';
import '@templatical/editor/style.css';

const editor = init({
  container: '#editor',
  onChange(content) {
    console.log('Template updated:', content);
  },
});
```

```html
<div id="editor" style="height: 100vh"></div>
```

[Read the full guide →](https://docs.templatical.com/getting-started/quick-start)

## Packages

| Package | Description | License |
|---------|-------------|---------|
| [`@templatical/editor`](https://www.npmjs.com/package/@templatical/editor) | Email editor | [FSL-1.1-MIT](./LICENSE) |
| [`@templatical/core`](https://www.npmjs.com/package/@templatical/core) | Framework-agnostic editor logic, state, history, plugins | [FSL-1.1-MIT](./LICENSE) |
| [`@templatical/types`](https://www.npmjs.com/package/@templatical/types) | Shared TypeScript types and block factories | [MIT](./LICENSE-MIT) |
| [`@templatical/renderer`](https://www.npmjs.com/package/@templatical/renderer) | Editor JSON to MJML renderer | [MIT](./LICENSE-MIT) |
| [`@templatical/media-library`](https://www.npmjs.com/package/@templatical/media-library) | Media library management | [FSL-1.1-MIT](./LICENSE) |
| [`@templatical/import-beefree`](https://www.npmjs.com/package/@templatical/import-beefree) | Convert BeeFree templates to Templatical format | [MIT](./LICENSE-MIT) |

## Documentation

For guides, API reference, and examples, visit **[docs.templatical.com](https://docs.templatical.com)**.

## Contributing

```bash
git clone https://github.com/templatical/sdk.git
cd editor
bun install
bun run build
bun run test
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

- **Editor packages** (`@templatical/editor`, `@templatical/core`, `@templatical/media-library`) — [FSL-1.1-MIT](./LICENSE)
- **Types, renderers, importers** — [MIT](./LICENSE-MIT)
