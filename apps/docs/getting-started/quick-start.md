---
title: Quick Start
description: Get the Templatical email editor running in under 5 minutes.
---

# Quick Start

## 1. Install packages

```bash
npm install @templatical/vue @templatical/renderer
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
    import { init } from '@templatical/vue';
    import '@templatical/vue/style.css';

    const editor = init({
      container: '#editor',
    });

    window.save = async function () {
      const content = editor.getContent();
      const mjml = editor.toMjml();

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

## Next steps

- [How Rendering Works](/getting-started/how-rendering-works) -- understand the JSON → MJML pipeline.
- [Blocks](/guide/blocks) -- reference for all 12 block types.
- [Renderer API](/api/renderer-typescript) -- full `renderToMjml()` reference.
