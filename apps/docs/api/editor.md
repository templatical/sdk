---
title: Editor API
description: Complete reference for the init() function, TemplaticalEditorConfig, and TemplaticalEditor instance.
---

# Editor API

The main entry point is the `init()` function from `@templatical/editor`.

## `init(config)`

Creates and mounts the editor into a container element. Returns a promise that resolves when the editor is ready.

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: "#editor",
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
import { unmount } from "@templatical/editor";

unmount();
```

## TemplaticalEditorConfig

| Property            | Type                                                              | Required | Description                                                                                                                                                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `container`         | `string \| HTMLElement`                                           | Yes      | CSS selector or DOM element to mount the editor into. In default (shadow DOM) mode, must be an element that can host a Shadow DOM — `<div>` is recommended. See [Container element requirements](#container-element-requirements) below                                                    |
| `shadowDom`         | `boolean`                                                         | No       | Mount inside a Shadow DOM for CSS isolation from the host page. Defaults to `true`. Set to `false` to mount in light DOM instead (e.g. for `document.querySelector` access to editor internals or Firefox <101 / Safari <16.4 support). See [Shadow DOM](/guide/shadow-dom) for trade-offs |
| `content`           | `TemplateContent`                                                 | No       | Initial template content. Defaults to empty template                                                                                                                                                                                                                                       |
| `onChange`          | `(content: TemplateContent) => void`                              | No       | Called when template content changes (debounced)                                                                                                                                                                                                                                           |
| `onSave`            | `(content: TemplateContent) => void`                              | No       | Called when the user triggers a save action                                                                                                                                                                                                                                                |
| `onError`           | `(error: Error) => void`                                          | No       | Called when an error occurs                                                                                                                                                                                                                                                                |
| `onRequestMedia`    | `(context?: MediaRequestContext) => Promise<MediaResult \| null>` | No       | Called when user wants to pick an image. Return `{ url, alt? }` or `null`                                                                                                                                                                                                                  |
| `resolveImageUrl`   | `(src: string) => string \| null \| Promise<string \| null>`      | No       | Display-only resolver for image `src` values: maps a canonical src to a preview URL for the canvas. Content and `toMjml()` output keep the canonical value. Return `null` to use the src as-is. Called once per committed src (debounced), cached per src. See [Images](/guide/images#display-only-url-resolution) |
| `mergeTags`         | `MergeTagsConfig`                                                 | No       | Merge tag configuration. See [Merge Tags](/guide/merge-tags)                                                                                                                                                                                                                               |
| `displayConditions` | `DisplayConditionsConfig`                                         | No       | Display condition configuration. See [Display Conditions](/guide/display-conditions)                                                                                                                                                                                                       |
| `customBlocks`      | `CustomBlockDefinition[]`                                         | No       | Custom block type definitions. See [Custom Blocks](/guide/custom-blocks)                                                                                                                                                                                                                   |
| `paletteBlocks`     | `string[]`                                                        | No       | Allowlist + order for the block palette. Only the listed types appear, in this order; unlisted built-ins are hidden. Built-ins use their bare type (`'image'`), custom blocks the `custom:`-prefixed type (`'custom:qrcode'`). See [Customizing the block palette](#customizing-the-block-palette) |
| `htmlBlockPreview`  | `boolean \| { enabled: boolean }`                                 | No       | Render each HTML block's content as a live preview in the canvas — inside a sandboxed `<iframe>` with no script execution — instead of the static placeholder. Defaults to `false`. Preview-only; the MJML/HTML export renders HTML blocks regardless. See [Previewing HTML blocks](#previewing-html-blocks) |
| `blockDefaults`     | `BlockDefaults`                                                   | No       | Default property overrides for new blocks. See [Defaults](/guide/defaults)                                                                                                                                                                                                                 |
| `templateDefaults`  | `TemplateDefaults`                                                | No       | Default template settings for empty templates. See [Defaults](/guide/defaults)                                                                                                                                                                                                             |
| `fonts`             | `FontsConfig`                                                     | No       | Font configuration. See [Custom Fonts](/guide/fonts)                                                                                                                                                                                                                                       |
| `colors`            | `ColorsConfig`                                                    | No       | Color-picker palette. `presets` render as a clickable grid in every picker; `allowCustom: false` locks authors to them. See [Preset colors](#preset-colors)                                                                                                                                |
| `theme`             | `ThemeOverrides`                                                  | No       | Color token overrides. Supports a `dark` key for dark mode overrides. See [Theming](/guide/theming)                                                                                                                                                                                        |
| `uiTheme`           | `'light' \| 'dark' \| 'auto'`                                     | No       | UI color scheme. `'auto'` follows system preference. Defaults to `'auto'`                                                                                                                                                                                                                  |
| `locale`            | `string`                                                          | No       | Locale code (e.g. `'en'`, `'de'`, `'pt-BR'`, `'es'`, `'ca'`). Defaults to `'en'`                                                                                                                                                                                                                                      |
| `branding`          | `boolean`                                                         | No       | Show the "Powered by Templatical" footer. Defaults to `true`. Set to `false` to hide it                                                                                                                                                                                                    |
| `smallScreenNotice` | `boolean`                                                         | No       | Show a "use a larger screen" notice instead of the editor on viewports narrower than ~768px. Defaults to `true`. The drag-and-drop editor is a desktop-class tool and can't lay out usably on a phone. Set to `false` to render the editor at any width if you handle small screens yourself |

### Container element requirements

The default (shadow DOM) mount calls `attachShadow()` on your container, and the HTML spec only allows shadow roots on a fixed set of elements. Use one of:

`<article>`, `<aside>`, `<blockquote>`, `<body>`, `<div>` (recommended), `<footer>`, `<h1>`–`<h6>`, `<header>`, `<main>`, `<nav>`, `<p>`, `<section>`, `<span>`, plus any custom element you've defined.

**Not allowed:** `<table>`, `<tr>`, `<td>`, `<form>`, `<input>`, `<button>`, `<select>`, list elements (`<ul>`, `<ol>`, `<li>`), `<iframe>`, replaced elements (`<img>`, `<video>`, etc.). Passing one of these throws a `DOMException` from `attachShadow()`.

If your integration must use an unsupported element (e.g. mounting into a `<form>` cell of a CMS layout), pass `shadowDom: false` — light-DOM mount accepts any element. The trade-off is the host-CSS isolation you give up.

### Customizing the block palette

By default the sidebar palette lists every built-in block type. Pass `paletteBlocks` to restrict the palette to a specific set and control their order — useful for hiding block types you don't use (`video`, `table`, …) or promoting a frequently-used [custom block](/guide/custom-blocks) above the built-ins.

```ts
const editor = await init({
  container: "#editor",
  customBlocks: [qrCodeDefinition],
  paletteBlocks: [
    "section",
    "title",
    "paragraph",
    "image",
    "custom:qrcode", // a custom block, interleaved among built-ins
    "button",
  ],
});
```

- **Strict allowlist + order.** Only the listed types are shown, in exactly this order. Any built-in not listed (here `divider`, `video`, `social`, `menu`, `table`, `spacer`, `html`) is hidden from the palette.
- **Reference built-ins by their bare type** (`"section"`, `"image"`, …) and **custom blocks by their `custom:`-prefixed type** (`"custom:qrcode"`), so the two can be interleaved freely.
- **Unknown entries are skipped.** A typo, an unregistered custom block, or `countdown` outside a Cloud plan is logged to the console with a warning and left out of the palette.
- **Filtering the palette never affects rendering.** Hiding a block type only removes it from the palette — existing content that already uses that type still renders correctly. `paletteBlocks` controls what users can _insert_, not what the editor can _display_.

Omit `paletteBlocks` (or pass an empty array) to show the full default palette.

### Previewing HTML blocks {#previewing-html-blocks}

By default, an HTML block shows a placeholder card in the canvas rather than rendering its markup — the content is only realized on export. Set `htmlBlockPreview` to render each HTML block's content live in the canvas instead:

```ts
const editor = await init({
  container: "#editor",
  htmlBlockPreview: true, // shorthand for { enabled: true }
});
```

- **Off by default.** Omit the option (or pass `false` / `{ enabled: false }`) to keep the static placeholder.
- **Rendered in a sandboxed iframe.** The content is shown verbatim inside an `<iframe sandbox="allow-same-origin">` with **no** `allow-scripts` — scripts and inline event handlers never execute, and the fragment's styles can't leak into the rest of the editor. This keeps arbitrary or collaborator-authored HTML from running in your app's origin.
- **Preview-only.** This setting controls the editor canvas, not output — `renderToMjml()` / `editor.toMjml()` render HTML blocks regardless.

### Preset colors {#preset-colors}

Every color picker in the editor — block toolbars, template settings, rich-text color, custom-block color fields — opens a popover with a color wheel and a hex input. Pass `colors` to add a row of preset colors to that popover, and optionally to remove the free-form controls:

```ts
const editor = await init({
  container: "#editor",
  colors: {
    presets: ["#0b5cff", "#111827", "#6b7280", "#ffffff"],
    allowCustom: false,
  },
});
```

- **`presets`** — hex strings rendered as a clickable grid. Clicking one applies it; the preset matching the current value is marked selected. Supplements the wheel and hex input. Each entry must be a `#rgb` or `#rrggbb` hex string — 4-/8-digit alpha hex and other formats are skipped with a console warning listing the offending entries.
- **`allowCustom`** — defaults to `true`. Set to `false` (together with `presets`) to hide the wheel and hex input so authors can only pick from the palette — useful when embedding the editor as a white-label / brand-kit tool. Ignored with a warning when no `presets` are configured, since that would leave the picker with no way to set a color.

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
import { createDefaultTemplateContent } from "@templatical/types";

editor.setContent(createDefaultTemplateContent());
```

### `setTheme(theme)`

Switches the UI color scheme at runtime without re-initializing the editor.

```ts
editor.setTheme("dark");
editor.setTheme("light");
editor.setTheme("auto"); // follow system preference
```

**Parameter:** `theme: 'light' | 'dark' | 'auto'`

### `unmount()`

Destroys this editor instance.

### `toMjml()`

Renders the current content to MJML markup. Returns a `Promise<string>` because resolving custom blocks may require asynchronous work (the editor's liquid renderer is loaded on demand).

```ts
const mjml = await editor.toMjml();
```

Throws a clear error if `@templatical/renderer` is not installed. The renderer is an optional peer dependency — install it only if you need MJML export from the browser. See [Installation](/getting-started/installation) for details.

To compile MJML to HTML, use any MJML library (e.g., [mjml](https://www.npmjs.com/package/mjml) for Node.js).

::: tip Cloud editor
The Cloud editor does **not** expose `toMjml()` — the cloud backend handles MJML conversion server-side with additional processing (signed image URLs, asset rewriting). Use the OSS editor (`init`, not `initCloud`) if you want client-side MJML export.
:::

### `renderCustomBlock(block)`

Renders a single custom block to its HTML representation. Useful for headless callers that want to drive `@templatical/renderer`'s `renderCustomBlock` option from outside the editor instance — for example, when invoking the renderer directly with a custom configuration.

```ts
const html = await editor.renderCustomBlock(customBlock);
```

## Core Composables

For advanced use cases, you can use the composables from `@templatical/core` directly.

### `useEditor(options)`

The core composable that manages the entire editor state: the block tree, template settings, block selection, viewport mode, and all mutation methods. This is what `init()` uses internally. Use it directly if you're building a completely custom editor UI on top of the Templatical state engine.

```ts
import { useEditor } from "@templatical/core";

const editor = useEditor({ content: templateContent });

editor.selectBlock(blockId);
editor.updateBlock(blockId, { content: "New text" });
editor.setViewport("mobile");
```

### `useHistory(options)`

Tracks content snapshots and provides undo/redo. Connects to the editor's content ref and captures state after each mutation. Configurable max history size prevents unbounded memory growth.

```ts
import { useHistory } from "@templatical/core";

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
import { useBlockActions } from "@templatical/core";

const actions = useBlockActions({
  addBlock: editor.addBlock,
  removeBlock: editor.removeBlock,
  updateBlock: editor.updateBlock,
  selectBlock: editor.selectBlock,
});

const newBlock = actions.createAndAddBlock("text");
actions.duplicateBlock(existingBlock);
actions.deleteBlock(blockId);
actions.updateBlockProperty(blockId, "content", "<p>Updated</p>");
```

### `useAutoSave(options)`

Watches the editor content and calls your save callback with configurable debounce. Includes pause/resume for temporarily disabling saves (e.g., during bulk operations) and a `flush()` method for immediate saves.

```ts
import { useAutoSave } from "@templatical/core";

const autoSave = useAutoSave({
  content: editor.content,
  isDirty: () => editor.state.isDirty,
  onChange: (content) => saveToServer(content),
  debounce: 1000,
  enabled: true, // boolean or () => boolean
});

autoSave.flush(); // Save immediately
autoSave.cancel(); // Cancel pending debounced save
autoSave.pause(); // Pause auto-save
autoSave.resume(); // Resume
autoSave.destroy(); // Stop watching and clean up
```

### `useConditionPreview()`

Manages preview state for display conditions in the editor. Allows toggling individual blocks on/off to simulate how conditional content looks when different conditions are met.

```ts
import { useConditionPreview } from "@templatical/core";

const preview = useConditionPreview(editor);

preview.isHidden(blockId); // Check if a block is hidden in preview
preview.toggleBlock(blockId); // Toggle a block's visibility
preview.reset(); // Reset all blocks to visible
preview.hasHiddenBlocks; // ComputedRef<boolean>
```

### `useDataSourceFetch(options)`

Handles fetching external data for custom blocks with data sources. Manages loading state and error handling for the `onFetch` callback.

```ts
import { useDataSourceFetch } from "@templatical/core";

const dataFetch = useDataSourceFetch({
  definition: computed(() => customBlockDefinition),
  block: computed(() => customBlock),
  onUpdate: (fieldValues, fetched) => {
    updateBlock(block.id, { fieldValues, dataSourceFetched: fetched });
  },
});

dataFetch.isFetching; // Ref<boolean>
dataFetch.fetchError; // Ref<boolean>
dataFetch.hasDataSource; // ComputedRef<boolean>
dataFetch.needsFetch; // ComputedRef<boolean>
await dataFetch.fetch(); // Trigger the fetch
```
