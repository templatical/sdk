---
title: Editor API
description: Complete reference for the init() function, TemplaticalEditorConfig, and TemplaticalEditor instance.
---

# Editor API

The main entry point is the `init()` function from `@templatical/editor`.

## `init(config)`

Creates and mounts the editor into a container element.

```ts
import { init } from '@templatical/editor';
import '@templatical/editor/style.css';

const editor = init({
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
| `onRequestMedia` | `() => Promise<MediaResult \| null>` | No | Called when user wants to pick an image. Return `{ url, alt? }` or `null` |
| `mergeTags` | `MergeTagsConfig` | No | Merge tag configuration. See [Merge Tags](/guide/merge-tags) |
| `displayConditions` | `DisplayConditionsConfig` | No | Display condition configuration. See [Display Conditions](/guide/display-conditions) |
| `customBlocks` | `CustomBlockDefinition[]` | No | Custom block type definitions. See [Custom Blocks](/guide/custom-blocks) |
| `fonts` | `FontsConfig` | No | Font configuration. See [Custom Fonts](/guide/fonts) |
| `theme` | `ThemeOverrides` | No | Color token overrides. See [Theming](/guide/theming) |
| `locale` | `string` | No | Locale code (e.g. `'en'`, `'de'`). Defaults to `'en'` |
| `plugins` | `EditorPlugin[]` | No | Editor plugins. See [Plugin System](#plugin-system) |

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

### `unmount()`

Destroys this editor instance.

### `toMjml()`

Renders the current content to MJML markup. Only available when `@templatical/renderer` is installed.

```ts
const mjml = editor.toMjml?.();
```

To compile MJML to HTML, use any MJML library (e.g., [mjml](https://www.npmjs.com/package/mjml) for Node.js).

## Plugin System

Plugins extend the editor with custom toolbar actions, sidebar panels, and block context actions.

::: warning Work in progress
The plugin registration methods (`registerToolbarAction`, `registerSidebarPanel`, `registerBlockAction`) are defined in the type system and available in the plugin context, but their UI rendering is not yet implemented. You can use plugins today for reading state, reacting to changes, and calling mutation methods — but registered actions won't appear in the UI until a future release.
:::

### EditorPlugin

```ts
interface EditorPlugin {
  name: string;
  install(context: EditorPluginContext): void | Promise<void>;
  destroy?(): void;
}
```

### EditorPluginContext

The context passed to `install()`:

| Property | Type | Description |
|----------|------|-------------|
| `state` | `DeepReadonly<EditorState>` | Current editor state |
| `content` | `Ref<TemplateContent>` | Reactive template content |
| `selectedBlockId` | `Ref<string \| null>` | Currently selected block ID |
| `viewport` | `Ref<ViewportSize>` | Current viewport |
| `addBlock` | `(block, sectionId?, colIdx?, idx?) => void` | Add a block |
| `updateBlock` | `(blockId, updates) => void` | Update a block |
| `removeBlock` | `(blockId) => void` | Remove a block |
| `moveBlock` | `(blockId, newIdx, sectionId?, colIdx?) => void` | Move a block |
| `updateSettings` | `(updates) => void` | Update template settings |
| `selectBlock` | `(blockId \| null) => void` | Select a block |
| `registerToolbarAction` | `(action: ToolbarAction) => void` | Add a toolbar button |
| `registerSidebarPanel` | `(panel: SidebarPanel) => void` | Add a sidebar panel |
| `registerBlockAction` | `(action: BlockContextAction) => void` | Add a block context menu action |

### Example Plugin

```ts
const analyticsPlugin: EditorPlugin = {
  name: 'analytics',
  install(ctx) {
    ctx.registerToolbarAction({
      id: 'analytics',
      icon: 'bar-chart',
      label: 'Analytics',
      onClick() {
        const blockCount = ctx.content.value.blocks.length;
        console.log(`Template has ${blockCount} blocks`);
      },
    });
  },
};

const editor = init({
  container: '#editor',
  plugins: [analyticsPlugin],
});
```

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
});

autoSave.flush();   // Save immediately
autoSave.pause();   // Pause auto-save
autoSave.resume();  // Resume
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
