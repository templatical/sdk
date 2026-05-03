---
title: Installation
description: Install the Templatical email editor via npm or CDN.
---

# Installation

::: tip Active development
Templatical is under active development and ships frequently. The public API is stabilizing — we follow [SemVer](https://semver.org), use [changesets](https://github.com/changesets/changesets) for every release, and document breaking changes in the [changelog](https://github.com/templatical/sdk/releases). Pin a version in production and watch [GitHub releases](https://github.com/templatical/sdk/releases) to stay current.

Have a feature request or hit a rough edge? [Open a discussion](https://github.com/templatical/sdk/discussions) — feedback shapes the roadmap.
:::

## Requirements

- **Modern browser** -- Chrome 80+, Firefox 80+, Safari 14+, Edge 80+
- **Container element** -- must have a defined height (the editor fills its container)
- **No peer dependencies** -- Vue, TipTap, and all internal libraries are bundled into the editor. You don't need to install Vue or any framework runtime, regardless of which framework your app uses.

## npm

::: code-group
```bash [npm]
npm install @templatical/editor
```
```bash [pnpm]
pnpm add @templatical/editor
```
```bash [yarn]
yarn add @templatical/editor
```
```bash [bun]
bun add @templatical/editor
```
:::

`@templatical/editor` is the visual editor. To convert templates to MJML, also install `@templatical/renderer`:

::: code-group
```bash [npm]
npm install @templatical/renderer
```
```bash [pnpm]
pnpm add @templatical/renderer
```
```bash [yarn]
yarn add @templatical/renderer
```
```bash [bun]
bun add @templatical/renderer
```
:::

The renderer is **optional**. Install it where you need MJML output:

- **Browser, with the editor** — when calling `editor.toMjml()` to export from the user's session.
- **Node.js / server** — when you only have stored template JSON and want to convert it to MJML server-side. You don't need the editor for this; install just the renderer.

If you call `editor.toMjml()` without the renderer installed, it throws a clear error naming the missing package.

## Package overview

| Package | Description | When to install |
|---|---|---|
| `@templatical/editor` | Visual drag-and-drop editor and `init()` entry point. Self-contained — Vue, TipTap, and `@templatical/core`/`/types` are bundled inside. | Required |
| `@templatical/renderer` | Converts templates to MJML for email sending. | Optional — install where you call `editor.toMjml()` (browser) or `renderToMjml()` (Node.js, server) |
| `@templatical/types` | Shared TypeScript types, block factory functions, type guards. | Only if you build templates programmatically without the editor (e.g. server-side workflows) |
| `@templatical/core` | Framework-agnostic editor logic (state, history) for headless setups. | Only for headless / non-editor consumers |
| `@templatical/import-beefree` | Converts BeeFree JSON templates to Templatical format. | Optional |
| `@templatical/import-unlayer` | Converts Unlayer JSON design templates to Templatical format. | Optional |

`@templatical/editor` ships as a single self-contained ESM bundle: every runtime dependency it needs (Vue, TipTap, vuedraggable, `@templatical/core`, `@templatical/types`, etc.) is inlined. You never install them separately — and you never get duplicate copies in your app's `node_modules`.
## Framework integration

Templatical mounts into any DOM element. It creates its own isolated application internally, so it works with any framework — or no framework at all.

::: code-group
```ts [Vanilla JS]
import { init } from '@templatical/editor';
import '@templatical/editor/style.css';

const editor = await init({
  container: '#editor',
  onChange(content) {
    console.log('Content changed', content);
  },
});

// Later, when removing the editor:
editor.unmount();
```
```tsx [React]
import { useRef, useEffect } from 'react';
import { init } from '@templatical/editor';
import '@templatical/editor/style.css';
import type { TemplaticalEditor } from '@templatical/editor';

export function EmailEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<TemplaticalEditor | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    init({
      container: containerRef.current,
      onChange(content) {
        console.log('Content changed', content);
      },
    }).then((ed) => {
      if (!cancelled) editorRef.current = ed;
    });

    return () => {
      cancelled = true;
      editorRef.current?.unmount();
    };
  }, []);

  return <div ref={containerRef} style={{ height: '100vh' }} />;
}
```
```vue [Vue]
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { init } from '@templatical/editor';
import '@templatical/editor/style.css';
import type { TemplaticalEditor } from '@templatical/editor';

const container = ref<HTMLElement>();
let editor: TemplaticalEditor | null = null;

onMounted(async () => {
  if (!container.value) return;

  editor = await init({
    container: container.value,
    onChange(content) {
      console.log('Content changed', content);
    },
  });
});

onUnmounted(() => {
  editor?.unmount();
});
</script>

<template>
  <div ref="container" style="height: 100vh" />
</template>
```
```svelte [Svelte]
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { init } from '@templatical/editor';
  import '@templatical/editor/style.css';
  import type { TemplaticalEditor } from '@templatical/editor';

  let containerEl: HTMLElement;
  let editor: TemplaticalEditor | null = null;

  onMount(async () => {
    editor = await init({
      container: containerEl,
      onChange(content) {
        console.log('Content changed', content);
      },
    });
  });

  onDestroy(() => {
    editor?.unmount();
  });
</script>

<div bind:this={containerEl} style="height: 100vh;" />
```
```ts [Angular]
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { init } from '@templatical/editor';
import '@templatical/editor/style.css';
import type { TemplaticalEditor } from '@templatical/editor';

@Component({
  selector: 'app-email-editor',
  standalone: true,
  template: `<div #editorContainer style="height: 100vh"></div>`,
})
export class EmailEditorComponent implements OnInit, OnDestroy {
  @ViewChild('editorContainer', { static: true })
  containerRef!: ElementRef<HTMLElement>;

  private editor: TemplaticalEditor | null = null;

  async ngOnInit(): Promise<void> {
    this.editor = await init({
      container: this.containerRef.nativeElement,
      onChange(content) {
        console.log('Content changed', content);
      },
    });
  }

  ngOnDestroy(): void {
    this.editor?.unmount();
  }
}
```
:::

::: warning Important
Always call `unmount()` when removing the editor from the page. This cleans up event listeners, timers, and DOM elements. This is especially important in single-page applications where components mount and unmount during navigation.
:::

## TypeScript support

All packages ship with full TypeScript type definitions. Configuration options, callback payloads, block types, and instance methods are fully typed:

```ts
import { init, unmount } from '@templatical/editor';
import type { TemplaticalEditor, TemplaticalEditorConfig } from '@templatical/editor';
import type { TemplateContent, Block, ThemeOverrides, FontsConfig } from '@templatical/types';
```

## CDN

If you prefer not to use a package manager, load the editor directly via script tags:

```html
<link rel="stylesheet" href="https://unpkg.com/@templatical/editor/dist/cdn/editor.css" />
<script type="module">
  import { init } from 'https://unpkg.com/@templatical/editor/dist/cdn/editor.js';

  const editor = await init({
    container: '#editor',
  });
</script>

<div id="editor" style="height: 100vh;"></div>
```

The CDN build is fully self-contained — all dependencies are bundled. Heavy libraries (TipTap, Vue, Pusher, etc.) are code-split into separate chunks and loaded on demand.
