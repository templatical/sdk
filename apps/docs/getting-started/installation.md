---
title: Installation
description: Install the Templatical email editor via npm or CDN.
---

# Installation

## npm

Install the editor package and, optionally, the renderer for MJML/HTML export:

```bash
npm install @templatical/vue
```

```bash
npm install @templatical/renderer
```

The renderer is an optional peer dependency of `@templatical/vue`. Install it if you need `toMjml()` or `toHtml()` export methods on the editor instance.

## CDN

Load the editor directly in the browser using the UMD build:

```html
<link rel="stylesheet" href="https://unpkg.com/@templatical/vue/dist/style.css" />
<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
<script src="https://unpkg.com/@templatical/vue/dist/templatical-vue.umd.cjs"></script>

<div id="editor"></div>

<script>
  const editor = Templatical.init({
    container: '#editor',
    onChange(content) {
      console.log('Template updated', content);
    },
  });
</script>
```

Replace `@templatical/vue` with a pinned version (e.g. `@templatical/vue@0.1.0`) for production use.

## Package Overview

The Templatical editor is split into focused packages. Most applications only need `@templatical/vue` and optionally `@templatical/renderer`.

| Package | Description | Required |
|---|---|---|
| `@templatical/vue` | Visual drag-and-drop editor component and `init()` entry point | Yes |
| `@templatical/types` | Shared TypeScript types, block factory functions, and type guards | Auto-installed |
| `@templatical/core` | Framework-agnostic editor logic (state, history, plugins) | Auto-installed |
| `@templatical/renderer` | Renders `TemplateContent` to MJML and HTML (browser + Node.js) | Optional |
| `@templatical/import-beefree` | Converts BeeFree JSON templates to Templatical format | Optional |
| `templatical-php` | PHP renderer (Composer package, separate repository) | Optional |

`@templatical/types` and `@templatical/core` are direct dependencies of `@templatical/vue` and are installed automatically.

## Requirements

- **Vue 3.4+** -- listed as a peer dependency of `@templatical/vue`.
- **Modern browser** -- Chrome, Firefox, Safari, or Edge. ES2020+ support required.
- **Node.js 18+** -- for server-side rendering with `@templatical/renderer`.
