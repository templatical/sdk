---
title: Installation
description: Installieren Sie den Templatical-E-Mail-Editor über npm oder CDN.
---

# Installation

## Voraussetzungen

- **Moderner Browser** -- Chrome 80+, Firefox 80+, Safari 14+, Edge 80+
- **Container-Element** -- muss eine definierte Höhe haben (der Editor füllt seinen Container aus)

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

`@templatical/editor` ist der visuelle Editor. `@templatical/renderer` konvertiert Templates zu MJML für den E-Mail-Versand.

## Paketübersicht

| Paket | Beschreibung | Erforderlich |
|---|---|---|
| `@templatical/editor` | Visueller Drag-and-Drop-Editor und `init()`-Einstiegspunkt | Ja |
| `@templatical/types` | Gemeinsame TypeScript-Typen, Block-Factory-Funktionen, Type Guards | Automatisch installiert |
| `@templatical/core` | Framework-agnostische Editor-Logik (State, History, Plugins) | Automatisch installiert |
| `@templatical/renderer` | Rendert Templates zu MJML | Empfohlen |
| `@templatical/import-beefree` | Konvertiert BeeFree-JSON-Templates in das Templatical-Format | Optional |

`@templatical/types` und `@templatical/core` sind direkte Abhängigkeiten von `@templatical/editor` und werden automatisch installiert.
## Framework-Integration

Templatical wird in jedes beliebige DOM-Element eingebunden. Intern erstellt es seine eigene isolierte Anwendung und funktioniert daher mit jedem Framework – oder ganz ohne Framework.

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

// Später, beim Entfernen des Editors:
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

::: warning Wichtig
Rufen Sie immer `unmount()` auf, wenn Sie den Editor von der Seite entfernen. Dadurch werden Event-Listener, Timer und DOM-Elemente aufgeräumt. Dies ist besonders wichtig in Single-Page-Anwendungen, bei denen Komponenten während der Navigation ein- und ausgebunden werden.
:::

## TypeScript-Unterstützung

Alle Pakete werden mit vollständigen TypeScript-Typdefinitionen ausgeliefert. Konfigurationsoptionen, Callback-Payloads, Blocktypen und Instanzmethoden sind vollständig typisiert:

```ts
import { init, unmount } from '@templatical/editor';
import type { TemplaticalEditor, TemplaticalEditorConfig } from '@templatical/editor';
import type { TemplateContent, Block, ThemeOverrides, FontsConfig } from '@templatical/types';
```

## CDN

Wenn Sie keinen Paketmanager verwenden möchten, können Sie den Editor direkt über Script-Tags laden:

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

Der CDN-Build ist vollständig eigenständig – alle Abhängigkeiten sind gebündelt. Schwere Bibliotheken (TipTap, Vue, Pusher usw.) werden per Code-Splitting in separate Chunks aufgeteilt und bei Bedarf nachgeladen.
