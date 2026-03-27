---
title: Vanilla JavaScript
description: Using Templatical with plain HTML and a script tag — no build tools required.
---

# Vanilla JavaScript

The simplest way to use Templatical. No build tools, no framework -- just a script tag.

## CDN setup

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email Editor</title>
  <link rel="stylesheet" href="https://unpkg.com/@templatical/vue@0.1.0/dist/email-editor/email-editor.css" />
  <style>
    body { margin: 0; }
    #editor { height: 100vh; }
  </style>
</head>
<body>
  <div id="editor"></div>

  <script src="https://unpkg.com/@templatical/vue@0.1.0/dist/email-editor/email-editor.js"></script>
  <script>
    const editor = Templatical.init({
      container: '#editor',
      onChange(content) {
        console.log('Content changed:', content);
      },
    });
  </script>
</body>
</html>
```

The CDN build bundles Vue 3 internally -- you don't need to load Vue separately.

## With merge tags

```html
<script>
  const editor = Templatical.init({
    container: '#editor',
    mergeTags: {
      syntax: 'liquid',
      tags: [
        { label: 'First Name', value: '{{first_name}}' },
        { label: 'Email', value: '{{email}}' },
        { label: 'Company', value: '{{company}}' },
      ],
    },
    onChange(content) {
      localStorage.setItem('email-template', JSON.stringify(content));
    },
  });
</script>
```

## Loading saved content

```html
<script>
  const saved = localStorage.getItem('email-template');
  const content = saved ? JSON.parse(saved) : undefined;

  const editor = Templatical.init({
    container: '#editor',
    content,
    onChange(content) {
      localStorage.setItem('email-template', JSON.stringify(content));
    },
  });
</script>
```

## Dark mode and theming

```html
<script>
  const editor = Templatical.init({
    container: '#editor',
    darkMode: 'auto', // follows system preference
    theme: {
      primary: '#6d28d9',
      primaryHover: '#5b21b6',
      primaryLight: '#ede9fe',
    },
  });
</script>
```

## Export

```html
<button onclick="exportJson()">Export JSON</button>
<button onclick="exportMjml()">Export MJML</button>

<script src="https://unpkg.com/@templatical/vue@0.1.0/dist/email-editor/email-editor.js"></script>
<script>
  const editor = Templatical.init({ container: '#editor' });

  function exportJson() {
    const json = JSON.stringify(editor.getContent(), null, 2);
    download(json, 'template.json', 'application/json');
  }

  function exportMjml() {
    if (!editor.toMjml) return alert('Renderer not available in CDN build');
    const mjml = editor.toMjml();
    download(mjml, 'template.mjml', 'text/plain');
  }

  function download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>
```

## Notes

- The IIFE build exposes `window.Templatical` with `init()` and `unmount()` methods.
- The CDN build includes export buttons in the editor UI but does not include the renderer for programmatic `toMjml()` calls. For server-side rendering, use the npm package.
- Always pin the CDN version in production to avoid unexpected changes.
