# @templatical/core

> Framework-agnostic editor logic — state, history, plugins, auto-save. The reactive engine behind `@templatical/editor`.

[![npm version](https://img.shields.io/npm/v/@templatical/core?label=npm&color=cb3837)](https://www.npmjs.com/package/@templatical/core)
[![License](https://img.shields.io/badge/license-FSL--1.1--MIT-blue)](https://github.com/templatical/sdk/blob/main/LICENSE)

Powers [`@templatical/editor`](https://www.npmjs.com/package/@templatical/editor). Use this package directly if you want to build a custom UI on top of the Templatical state model — for example, a CLI tool, automation pipeline, or your own visual editor.

Built on `@vue/reactivity` (no full Vue runtime), so it works anywhere reactive primitives do.

## Install

```bash
npm install @templatical/core @templatical/types
```

## Usage

```ts
import { useEditor } from '@templatical/core';
import { createDefaultTemplateContent, createTitleBlock } from '@templatical/types';
import { watch } from '@vue/reactivity';

const editor = useEditor({
  content: createDefaultTemplateContent(),
});

// Mutate state — these methods live on the editor return value
editor.addBlock(createTitleBlock({ text: 'Welcome!' }));
editor.selectBlock(editor.content.value.blocks[0].id);

// Read reactive state
console.log(editor.content.value);          // current TemplateContent
console.log(editor.selectedBlock.value);    // currently selected Block | null
console.log(editor.state.isDirty);          // dirty flag

// React to changes
watch(editor.content, (next) => {
  console.log('Template updated', next);
});
```

## Exports

- `useEditor` — reactive state (content, selection, viewport, darkMode, isDirty) + mutation methods (`addBlock`, `removeBlock`, `moveBlock`, `updateBlock`, `updateSettings`, `selectBlock`, …)
- `useHistory` — undo/redo stack
- `useHistoryInterceptor` — wraps mutation methods so they push onto the history stack automatically
- `useBlockActions` — higher-level helpers built on top of `useEditor` (`createAndAddBlock(type)`, `duplicateBlock`, `deleteBlock`, `updateBlockProperty`)
- `useAutoSave` — debounced save with onSave callback
- `useConditionPreview` — display condition preview state
- `useDataSourceFetch` — fetch helper for custom block data sources

## Cloud subpath

The `@templatical/core/cloud` subpath provides Templatical Cloud integrations (Auth, API client, WebSocket, AI chat/rewrite, collaboration, comments, scoring). Used by `@templatical/editor`'s `initCloud()`. See [Cloud docs](https://docs.templatical.com/cloud/).

## Documentation

Full reference at **[docs.templatical.com](https://docs.templatical.com)**.

## License

[FSL-1.1-MIT](https://github.com/templatical/sdk/blob/main/LICENSE) — free for any non-competing commercial use, automatically converts to MIT after 2 years per release.
