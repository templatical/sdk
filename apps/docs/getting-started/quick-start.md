---
title: Quick Start
description: Get the Templatical email editor running in under 5 minutes.
---

# Quick Start

This guide gets you from zero to a working editor in under 5 minutes.

## 1. Install packages

```bash
npm install @templatical/vue @templatical/renderer
```

## 2. Add a container element

The editor mounts into a DOM element. Give it a fixed height -- the editor fills its container.

```html
<div id="editor" style="height: 100vh;"></div>
```

## 3. Import and initialize

```ts
import { init } from '@templatical/vue';
import '@templatical/vue/style.css';

const editor = init({
  container: '#editor',
  onChange(content) {
    console.log('Content changed', content);
  },
});
```

`init()` accepts a CSS selector string or an `HTMLElement` reference. It creates a Vue application internally -- you do not need to set up Vue yourself.

## 4. Read the current content

Call `getContent()` at any time to get the template as a serializable JSON object:

```ts
const content = editor.getContent();
console.log(JSON.stringify(content, null, 2));
```

The returned `TemplateContent` object contains `blocks` (the block tree) and `settings` (width, background color, font family, preheader text).

## 5. Export to HTML

With `@templatical/renderer` installed, the editor instance exposes `toMjml()` and `toHtml()`:

```ts
// Synchronous -- returns an MJML string
const mjml = editor.toMjml();

// Asynchronous -- compiles MJML to HTML
const html = await editor.toHtml();
```

## Complete example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Templatical Editor</title>
  <style>
    body { margin: 0; }
    #editor { height: 100vh; }
  </style>
</head>
<body>
  <div id="editor"></div>

  <script type="module">
    import { init } from '@templatical/vue';
    import '@templatical/vue/style.css';

    const editor = init({
      container: '#editor',
      onChange(content) {
        // Auto-save, sync to server, etc.
        localStorage.setItem('email-template', JSON.stringify(content));
      },
    });

    // Restore previously saved content
    const saved = localStorage.getItem('email-template');
    if (saved) {
      editor.setContent(JSON.parse(saved));
    }

    // Export button (assuming you add one to your UI)
    window.exportHtml = async () => {
      const html = await editor.toHtml();
      console.log(html);
    };
  </script>
</body>
</html>
```

## Cleanup

When the editor is no longer needed (e.g. navigating away in a SPA), call `unmount()` to tear down the Vue instance and release resources:

```ts
editor.unmount();
```

## Next steps

- [Your First Template](/getting-started/your-first-template) -- create content programmatically with factory functions.
- [Export](/getting-started/export) -- detailed export options for JSON, MJML, and HTML.
- [Blocks](/guide/blocks) -- reference for all 13 block types.
