---
title: Installation
description: Install the Templatical email editor via npm or CDN.
---

# Installation

## Requirements

- **Modern browser** -- Chrome 80+, Firefox 80+, Safari 14+, Edge 80+
- **Container element** -- must have a defined height (the editor fills its container)

## npm

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

`@templatical/editor` is the visual editor. `@templatical/renderer` converts templates to MJML for email sending.

## Package overview

| Package | Description | Required |
|---|---|---|
| `@templatical/editor` | Visual drag-and-drop editor and `init()` entry point | Yes |
| `@templatical/types` | Shared TypeScript types, block factory functions, type guards | Auto-installed |
| `@templatical/core` | Framework-agnostic editor logic (state, history, plugins) | Auto-installed |
| `@templatical/renderer` | Renders templates to MJML | Recommended |
| `@templatical/import-beefree` | Converts BeeFree JSON templates to Templatical format | Optional |

`@templatical/types` and `@templatical/core` are direct dependencies of `@templatical/editor` and are installed automatically.
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
<link rel="stylesheet" href="https://unpkg.com/@templatical/editor/dist/cdn/email-editor.css" />
<script src="https://unpkg.com/@templatical/editor/dist/cdn/email-editor.js"></script>

<div id="editor" style="height: 100vh;"></div>

<script>
  const editor = TemplaticalEmailEditor.init({
    container: '#editor',
    onChange(content) {
      console.log('Template updated', content);
    },
  });
</script>
```

The CDN build is fully self-contained — everything is bundled in a single file. No additional scripts needed.
