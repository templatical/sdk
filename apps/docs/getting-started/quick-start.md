---
title: Quick Start
description: Get the Templatical email editor running in under 5 minutes.
---

# Quick Start

## 1. Install packages

```bash
npm install @templatical/editor @templatical/renderer
```

## 2. Mount the editor

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Templatical Editor</title>
  <style>
    body { margin: 0; }
    #editor { height: calc(100vh - 48px); }
    #toolbar { height: 48px; display: flex; align-items: center; padding: 0 16px; border-bottom: 1px solid #e5e7eb; }
    #toolbar button { padding: 8px 16px; background: #1a73e8; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
  </style>
</head>
<body>
  <div id="toolbar">
    <button onclick="save()">Save Template</button>
  </div>
  <div id="editor"></div>

  <script type="module">
    import { init } from '@templatical/editor';
    import '@templatical/editor/style.css';

    const editor = await init({
      container: '#editor',
    });

    window.save = async function () {
      const content = editor.getContent();
      const mjml = await editor.toMjml();

      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, mjml }),
      });
    };
  </script>
</body>
</html>
```

Your backend receives both the JSON (store it to let users edit later) and the MJML (compile to HTML with any [MJML library](https://mjml.io) and send).

::: info Shadow DOM by default
The editor mounts inside a Shadow DOM, so host page CSS cannot cascade into editor elements. Use a `<div>` — or any [shadow-host-eligible element](/api/editor#container-element-requirements) — as the container; elements like `<table>`, `<form>`, or `<input>` cannot host a shadow root.

Pass `shadowDom: false` to opt out if you need an unusual container, target editor internals from `document.querySelector`, or support Firefox <101 / Safari <16.4. See the [Shadow DOM guide](/guide/shadow-dom) for the full trade-off list and theming via `:host`.
:::

## Next steps

- [How Rendering Works](/getting-started/how-rendering-works) -- understand the JSON → MJML pipeline.
- [Blocks](/guide/blocks) -- reference for all 14 block types.
- [Renderer API](/api/renderer-typescript) -- full `renderToMjml()` reference.
