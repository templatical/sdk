---
title: Quick Start
description: Get the Templatical email editor running in under 5 minutes.
---

# Quick Start

## 1. Install packages

::: code-group

```bash [npm]
npm install @templatical/editor @templatical/renderer
```

```bash [pnpm]
pnpm add @templatical/editor @templatical/renderer
```

```bash [yarn]
yarn add @templatical/editor @templatical/renderer
```

```bash [bun]
bun add @templatical/editor @templatical/renderer
```

:::

## 2. Mount the editor {#mount-the-editor}

Paste this into an HTML file and open it. No bundler. Framework and package-manager mounts live on [Installation](/getting-started/installation). Pin a version for production — [CDN](/getting-started/installation#cdn).

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Templatical Editor</title>
  <link
    rel="stylesheet"
    href="https://unpkg.com/@templatical/editor/dist/cdn/editor.css"
  />
  <style>
    body { margin: 0; }
    #editor { height: 100vh; }
  </style>
</head>
<body>
  <div id="editor"></div>
  <script type="module">
    import { init } from "https://unpkg.com/@templatical/editor/dist/cdn/editor.js";

    const editor = await init({
      container: "#editor",
    });

    const json = editor.getContent();
    const mjml = await editor.toMjml();
  </script>
</body>
</html>
```

[Open in playground](https://play.templatical.com/scenes/minimum)

Store `json` so users can edit later. Compile `mjml` on the server — `toMjml()` does not produce HTML.

## 3. Compile MJML to HTML

On the server, compile the MJML you just posted with any [MJML library](https://mjml.io) — Node, PHP, Python, Ruby, and others. [How Rendering Works](/getting-started/how-rendering-works) lists them. The Node package is `mjml`:

::: code-group

```bash [npm]
npm install mjml
```

```bash [pnpm]
pnpm add mjml
```

```bash [yarn]
yarn add mjml
```

```bash [bun]
bun add mjml
```

:::

```ts
import mjml2html from "mjml";

const { html } = mjml2html(mjml);
// html is ready to send
```

From a saved JSON file, without mounting the editor (also needs `mjml`):

::: code-group

```bash [npm]
npx -y @templatical/template-tools render template.json --format html -o email.html
```

```bash [pnpm]
pnpm dlx @templatical/template-tools render template.json --format html -o email.html
```

```bash [yarn]
yarn dlx @templatical/template-tools render template.json --format html -o email.html
```

```bash [bun]
bunx @templatical/template-tools render template.json --format html -o email.html
```

:::

See [Template Tools](/api/template-tools).

::: info Shadow DOM by default
The editor mounts inside a Shadow DOM, so host page CSS cannot cascade into editor elements. Use a `<div>` — or any [shadow-host-eligible element](/api/editor#container-element-requirements) — as the container; elements like `<table>`, `<form>`, or `<input>` cannot host a shadow root.

Pass `shadowDom: false` to opt out if you need an unusual container, target editor internals from `document.querySelector`, or support Firefox <101 / Safari <16.4. See the [Shadow DOM guide](/guide/shadow-dom) for the full trade-off list and theming via `:host`.
:::

## Next steps

- [Starting points](/getting-started/paths) — embed, backend, prompt, or JSON → HTML.
- [Embedding](/getting-started/embedding) — container rules, stacking, and what breaks host CSS isolation.
- [Connect your backend](/backend/) — save, versions, comments, saved blocks, media, test email, render.
- [Template Tools](/api/template-tools) — validate, render, import, and live-preview from a CLI or script.
- [How Rendering Works](/getting-started/how-rendering-works) — JSON → MJML → HTML, and what to store.
