---
title: Editor API
description: Complete reference for the init() function, TemplaticalEditorConfig, and TemplaticalEditor instance.
---

# Editor API

The main entry point is the `init()` function from `@templatical/editor`.

## `init(config)`

Creates and mounts the editor into a container element. Returns a promise that resolves when the editor is ready.

```ts
import { init } from '@templatical/editor';
import '@templatical/editor/style.css';

const editor = await init({
  container: '#editor',
  content: savedTemplate,
  onChange(content) {
    // Auto-save or update state
  },
});
```

**Returns:** [`TemplaticalEditor`](#templaticaleditor)

## `unmount()`

Destroys the editor instance and cleans up event listeners.

```ts
import { unmount } from '@templatical/editor';

unmount();
```

## TemplaticalEditorConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `container` | `string \| HTMLElement` | Yes | CSS selector or DOM element to mount the editor into |
| `content` | `TemplateContent` | No | Initial template content. Defaults to empty template |
| `onChange` | `(content: TemplateContent) => void` | No | Called when template content changes (debounced) |
| `onSave` | `(content: TemplateContent) => void` | No | Called when the user triggers a save action |
| `onError` | `(error: Error) => void` | No | Called when an error occurs |
| `onRequestMedia` | `(context?: MediaRequestContext) => Promise<MediaResult \| null>` | No | Called when user wants to pick an image. Return `{ url, alt? }` or `null` |
| `mergeTags` | `MergeTagsConfig` | No | Merge tag configuration. See [Merge Tags](/guide/merge-tags) |
| `displayConditions` | `DisplayConditionsConfig` | No | Display condition configuration. See [Display Conditions](/guide/display-conditions) |
| `customBlocks` | `CustomBlockDefinition[]` | No | Custom block type definitions. See [Custom Blocks](/guide/custom-blocks) |
| `blockDefaults` | `BlockDefaults` | No | Default property overrides for new blocks. See [Defaults](/guide/defaults) |
| `templateDefaults` | `TemplateDefaults` | No | Default template settings for empty templates. See [Defaults](/guide/defaults) |
| `fonts` | `FontsConfig` | No | Font configuration. See [Custom Fonts](/guide/fonts) |
| `theme` | `ThemeOverrides` | No | Color token overrides. Supports a `dark` key for dark mode overrides. See [Theming](/guide/theming) |
| `uiTheme` | `'light' \| 'dark' \| 'auto'` | No | UI color scheme. `'auto'` follows system preference. Defaults to `'auto'` |
| `locale` | `string` | No | Locale code (e.g. `'en'`, `'de'`). Defaults to `'en'` |


## TemplaticalEditor

The object returned by `init()`.

### `getContent()`

Returns the current template content as a `TemplateContent` object.

```ts
const content = editor.getContent();
// { blocks: [...], settings: { width: 600, ... } }
```

### `setContent(content)`

Replaces the editor content.

```ts
import { createDefaultTemplateContent } from '@templatical/types';

editor.setContent(createDefaultTemplateContent());
```

### `setTheme(theme)`

Switches the UI color scheme at runtime without re-initializing the editor.

```ts
editor.setTheme('dark');
editor.setTheme('light');
editor.setTheme('auto'); // follow system preference
```

**Parameter:** `theme: 'light' | 'dark' | 'auto'`

### `unmount()`

Destroys this editor instance.

### `toMjml()`

Renders the current content to MJML markup. Only available when `@templatical/renderer` is installed.

```ts
const mjml = editor.toMjml?.();
```

To compile MJML to HTML, use any MJML library (e.g., [mjml](https://www.npmjs.com/package/mjml) for Node.js).

## Core Composables

For advanced use cases, you can use the composables from `@templatical/core` directly.

### `useEditor(options)`

The core composable that manages the entire editor state: the block tree, template settings, block selection, viewport mode, and all mutation methods. This is what `init()` uses internally. Use it directly if you're building a completely custom editor UI on top of the Templatical state engine.

```ts
import { useEditor } from '@templatical/core';

const editor = useEditor({ content: templateContent });

editor.selectBlock(blockId);
editor.updateBlock(blockId, { content: 'New text' });
editor.setViewport('mobile');
```

### `useHistory(options)`

Tracks content snapshots and provides undo/redo. Connects to the editor's content ref and captures state after each mutation. Configurable max history size prevents unbounded memory growth.

```ts
import { useHistory } from '@templatical/core';

const history = useHistory({
  content: editor.content,
  setContent: editor.setContent,
  isRemoteOperation: () => false, // skip recording during remote/collab updates
  maxSize: 50,
});

history.undo();
history.redo();
```

### `useBlockActions(options)`

Higher-level convenience methods for common block operations: creating a block and inserting it in one step, duplicating an existing block (deep clone with new ID), and deleting with automatic selection cleanup.

```ts
import { useBlockActions } from '@templatical/core';

const actions = useBlockActions({
  addBlock: editor.addBlock,
  removeBlock: editor.removeBlock,
  updateBlock: editor.updateBlock,
  selectBlock: editor.selectBlock,
});

const newBlock = actions.createAndAddBlock('text');
actions.duplicateBlock(existingBlock);
actions.deleteBlock(blockId);
actions.updateBlockProperty(blockId, 'content', '<p>Updated</p>');
```

### `useAutoSave(options)`

Watches the editor content and calls your save callback with configurable debounce. Includes pause/resume for temporarily disabling saves (e.g., during bulk operations) and a `flush()` method for immediate saves.

```ts
import { useAutoSave } from '@templatical/core';

const autoSave = useAutoSave({
  content: editor.content,
  isDirty: () => editor.state.isDirty,
  onChange: (content) => saveToServer(content),
  debounce: 1000,
  enabled: true,    // boolean or () => boolean
});

autoSave.flush();   // Save immediately
autoSave.cancel();  // Cancel pending debounced save
autoSave.pause();   // Pause auto-save
autoSave.resume();  // Resume
autoSave.destroy(); // Stop watching and clean up
```

### `useConditionPreview()`

Manages preview state for display conditions in the editor. Allows toggling individual blocks on/off to simulate how conditional content looks when different conditions are met.

```ts
import { useConditionPreview } from '@templatical/core';

const preview = useConditionPreview(editor);

preview.isHidden(blockId);         // Check if a block is hidden in preview
preview.toggleBlock(blockId);      // Toggle a block's visibility
preview.reset();                   // Reset all blocks to visible
preview.hasHiddenBlocks;           // ComputedRef<boolean>
```

### `useDataSourceFetch(options)`

Handles fetching external data for custom blocks with data sources. Manages loading state and error handling for the `onFetch` callback.

```ts
import { useDataSourceFetch } from '@templatical/core';

const dataFetch = useDataSourceFetch({
  definition: computed(() => customBlockDefinition),
  block: computed(() => customBlock),
  onUpdate: (fieldValues, fetched) => {
    updateBlock(block.id, { fieldValues, dataSourceFetched: fetched });
  },
});

dataFetch.isFetching;              // Ref<boolean>
dataFetch.fetchError;              // Ref<boolean>
dataFetch.hasDataSource;           // ComputedRef<boolean>
dataFetch.needsFetch;              // ComputedRef<boolean>
await dataFetch.fetch();           // Trigger the fetch
```
