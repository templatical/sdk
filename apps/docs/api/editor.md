---
title: Editor API
description: Complete reference for the init() function, TemplaticalEditorConfig, and TemplaticalEditor instance.
---

# Editor API

The main entry point is the `init()` function from `@templatical/vue`.

## `init(config)`

Creates and mounts the editor into a container element.

```ts
import { init } from '@templatical/vue';
import '@templatical/vue/style.css';

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
import { unmount } from '@templatical/vue';

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
| `onRequestMedia` | `(callback: (url: string) => void) => void` | No | Called when user wants to pick an image. Call `callback` with the URL |
| `onRequestMergeTag` | `() => Promise<MergeTag \| null>` | No | Called when user wants to insert a merge tag. Return the tag or `null` |
| `mergeTags` | `MergeTagsConfig` | No | Merge tag configuration. See [Merge Tags](/guide/merge-tags) |
| `displayConditions` | `DisplayConditionsConfig` | No | Display condition configuration. See [Display Conditions](/guide/display-conditions) |
| `customBlocks` | `CustomBlockDefinition[]` | No | Custom block type definitions. See [Custom Blocks](/guide/custom-blocks) |
| `fonts` | `FontsConfig` | No | Font configuration. See [Theming](/guide/theming) |
| `theme` | `ThemeOverrides` | No | Color token overrides. See [Theming](/guide/theming) |
| `locale` | `string` | No | Locale code (e.g. `'en'`, `'de'`). Defaults to `'en'` |
| `darkMode` | `boolean \| 'auto'` | No | Dark mode setting. `'auto'` follows system preference |
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

### `toHtml()`

Renders the current content to HTML. Only available when `@templatical/renderer` is installed. Returns a `Promise` because MJML compilation is async.

```ts
const html = await editor.toHtml?.();
```

## Plugin System

Plugins extend the editor with custom toolbar actions, sidebar panels, and block context actions.

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

Manages editor state, block selection, viewport, and content mutations.

```ts
import { useEditor } from '@templatical/core';

const editor = useEditor({ content: templateContent });

editor.selectBlock(blockId);
editor.updateBlock(blockId, { content: 'New text' });
editor.setViewport('mobile');
```

### `useHistory(options)`

Provides undo/redo functionality.

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

High-level block creation, duplication, and deletion.

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

Debounced auto-save with pause/resume control.

```ts
import { useAutoSave } from '@templatical/core';

const autoSave = useAutoSave({
  content: editor.content,
  isDirty: editor.state.isDirty,
  onChange: (content) => saveToServer(content),
  debounce: 1000,
});

autoSave.flush();   // Save immediately
autoSave.pause();   // Pause auto-save
autoSave.resume();  // Resume
```
