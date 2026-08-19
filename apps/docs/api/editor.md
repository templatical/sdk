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
| `onError`           | `(error: Error) => void`                                          | No       | Called when an error occurs                                                                                                                                                                                                                                                                |
| `onDirtyChange`     | `(isDirty: boolean) => void`                                      | No       | Called whenever the unsaved-changes state flips. Works with or without a `templates` provider — use it to guard a client-side router, which `beforeunload` cannot cover. See [Saving & Loading](/backend/templates#unsaved-changes) |
| `onComment`         | `(event: CommentEvent) => void`                                   | No       | Called for every comment change the editor applied, including ones that arrived through a provider's `subscribe` — the hook for an unread badge outside the editor |
| `templates`         | `TemplatesProvider`                                               | No       | Storage backend for the template itself — the save/load lifecycle. The editor provides the name field, save button, save status, Cmd+S, autosave and the unsaved-changes guard; you provide persistence. Omit to disable the feature entirely. See [Saving & Loading](/backend/templates) |
| `render`            | `RenderProvider`                                                  | No       | Rendering backend for `toMjml()` / `toHtml()`. Every method (`toMjml`, `toHtml`, `compileMjml`) is independently optional and resolved separately. Omit and `toMjml()` renders locally while `toHtml()` rejects — the SDK bundles no MJML compiler. See [Rendering & Export](/backend/render) |
| `versionHistory`    | `VersionHistoryProvider`                                          | No       | Storage backend for the template's version history — the past states a user can browse, preview and restore. The editor provides the header control, preview banner and restore flow; you provide the storage. It never records a version itself: your `templates.save` decides that. Omit to disable the feature entirely. See [Version History](/backend/version-history) |
| `comments`          | `CommentsProvider`                                                | No       | Storage backend for review comments — threads anchored to a block or the template. The editor provides the sidebar, the composer, resolve/reply and the block indicators; you provide persistence. **Requires `user`**: without an identity the feature reports itself unavailable rather than writing anonymous comments. An optional `subscribe` pushes remote changes in. See [Comments](/backend/comments) |
| `user`              | `EditorUser`                                                      | No       | Who is using the editor — `{ id, name }`. Needed by any feature that attributes work to a person; today that is `comments`. Not a security boundary: it identifies the user to the editor's UI, in the user's own browser. Attribute writes server-side from the session your backend already trusts |
| `autoSave`          | `boolean \| { debounce?: number }`                               | No       | Save automatically, debounced, after the user stops editing. Requires `templates`; ignored with a warning without it. `{ debounce }` sets the cadence in the same key; the debounce governs `onChange` too, since both ride one timer. Defaults to `false`. See [Saving & Loading](/backend/templates#autosave) |
| `unsavedChangesGuard` | `boolean`                                                       | No       | Warn before the tab closes with unsaved changes. On by default whenever `templates` is configured; never active without it. Set to `false` to own the prompt yourself. Cannot cover client-side route changes — use `onDirtyChange` for those |
| `onRequestMedia`    | `(context?: MediaRequestContext) => Promise<MediaResult \| null>` | No       | Called when user wants to pick an image. Return `{ url, alt? }` or `null`                                                                                                                                                                                                                  |
| `resolveImageUrl`   | `(src: string) => string \| null \| Promise<string \| null>`      | No       | Display-only resolver for image `src` values: maps a canonical src to a preview URL for the canvas. Content and `toMjml()` output keep the canonical value. Return `null` to use the src as-is. Called once per committed src (debounced), cached per src. See [Images](/guide/images#display-only-url-resolution) |
| `mergeTags`         | `MergeTagsConfig`                                                 | No       | Merge tag configuration. Each tag may carry an optional `sample` — an example value previews render in its place. See [Merge Tags](/guide/merge-tags) |
| `resolvePreview`    | `ResolvePreview`                                                  | No       | Resolves the template for preview surfaces — typically evaluating logic tags against real data on your backend. Display-only: never in `getContent()`, a send or an export. See [Preview Rendering](/guide/preview-rendering) |
| `displayConditions` | `DisplayConditionsConfig`                                         | No       | Display condition configuration. See [Display Conditions](/guide/display-conditions)                                                                                                                                                                                                       |
| `logicTags`         | `LogicTagsConfig`                                                 | No       | Logic tag configuration — template-language control flow (conditionals, loops) inserted inline in rich text and text inputs. See [Logic Tags](/guide/logic-tags)                                                                                                                            |
| `customBlocks`      | `CustomBlockDefinition[]`                                         | No       | Custom block type definitions. See [Custom Blocks](/guide/custom-blocks)                                                                                                                                                                                                                   |
| `savedBlocks`       | `SavedBlocksProvider`                                             | No       | Storage backend for saved blocks — reusable block groups users save and re-insert. The editor provides the UI; you provide persistence. Omit to disable the feature entirely. Use `createLocalStorageSavedBlocksProvider()` for a zero-backend option. See [Saved Blocks](/backend/saved-blocks) |
| `testEmail`         | `TestEmailProvider`                                               | No       | Sending backend for test emails — lets users mail themselves the template they are editing. The editor provides the trigger, dialog, validation and states; you provide delivery. Omit to disable the feature entirely. `allowedRecipients` restricts the picker but is **not** a security boundary — validate server-side. See [Test Emails](/backend/test-email) |
| `paletteBlocks`     | `string[]`                                                        | No       | Allowlist + order for the block palette. Only the listed types appear, in this order; unlisted built-ins are hidden. Built-ins use their bare type (`'image'`), custom blocks the `custom:`-prefixed type (`'custom:qrcode'`). See [Customizing the block palette](#customizing-the-block-palette) |
| `htmlBlockPreview`  | `boolean \| { enabled: boolean }`                                 | No       | Render each HTML block's content as a live preview in the canvas — inside a sandboxed `<iframe>` with no script execution — instead of the static placeholder. Defaults to `false`. Preview-only; the MJML/HTML export renders HTML blocks regardless. See [Previewing HTML blocks](#previewing-html-blocks) |
| `blockDefaults`     | `BlockDefaults`                                                   | No       | Default property overrides for new blocks. See [Defaults](/guide/defaults)                                                                                                                                                                                                                 |
| `templateDefaults`  | `TemplateDefaults`                                                | No       | Default template settings for empty templates. See [Defaults](/guide/defaults)                                                                                                                                                                                                             |
| `fonts`             | `FontsConfig`                                                     | No       | Font configuration. See [Custom Fonts](/guide/fonts)                                                                                                                                                                                                                                       |
| `colors`            | `ColorsConfig`                                                    | No       | Color-picker palette. `presets` render as a clickable grid in every picker; `allowCustom: false` locks authors to them. See [Preset colors](#preset-colors)                                                                                                                                |
| `theme`             | `ThemeOverrides`                                                  | No       | Color token overrides. Supports a `dark` key for dark mode overrides. See [Theming](/guide/theming)                                                                                                                                                                                        |
| `uiTheme`           | `'light' \| 'dark' \| 'auto'`                                     | No       | UI color scheme. `'auto'` follows system preference. Defaults to `'auto'`                                                                                                                                                                                                                  |
| `locale`            | `string`                                                          | No       | Locale code (e.g. `'en'`, `'de'`, `'pt-BR'`, `'es'`, `'ca'`, `'fr'`, `'nl'`). Defaults to `'en'`                                                                                                                                                                                                                                      |
| `branding`          | `boolean`                                                         | No       | Show the "Powered by Templatical" footer. Defaults to `true`. Set to `false` to hide it                                                                                                                                                                                                    |
| `smallScreenNotice` | `boolean`                                                         | No       | Show a "use a larger screen" notice instead of the editor on viewports narrower than ~768px. Defaults to `true`. The drag-and-drop editor is a desktop-class tool and can't lay out usably on a phone. Set to `false` to render the editor at any width if you handle small screens yourself |
| `templateNameField` | `boolean`                                                         | No       | Show the template's name in the header, inline-editable. Defaults to `true`. Set to `false` when your store has no name column, or when your own chrome owns the name — `create({ name })`, `setName()` and the `name` in each save patch keep working. No effect without a `templates` provider — the header renders no name field either way |
| `lint`              | `LintOptions`                                                     | No       | Template linter configuration, from `@templatical/quality` (an optional peer). Unset, the linter loads on demand when the panel is opened. `disabled: true` skips the import entirely and hides the sidebar tab and inline badges. See [Quality options](/quality/options) |

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

Every color picker in the editor — block toolbars, template settings, rich-text color, custom-block color fields — opens a popover with a color wheel and a hex input. Pass `colors` to add a row of preset colors to that popover, and optionally to remove the free-form controls. It is the baseline for every picker; a custom block's color field can narrow it for itself (see the last bullet):

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
- **`allowCustom`** — defaults to `true`. Set to `false` (together with `presets`) to hide the wheel and hex input so authors can only pick from the palette — useful when embedding the editor as a white-label / brand-kit tool. In this locked mode the palette leads with a "no colour" chip that restores the unset (inherit) state, since the hex field's clear button is hidden. Also in locked mode, the editor logs a development warning when any `blockDefaults` / `templateDefaults` colour falls outside `presets` — new blocks would otherwise start on a colour no picker can reselect, so set those defaults from the same palette. Ignored with a warning when no `presets` are configured, since that would leave the picker with no way to set a color.
- **Per-field narrowing.** A custom block's `color` field can carry its own `presets` / `allowCustom` — see [per-field color presets](/guide/custom-blocks#color). A field may swap in its own palette, or lock one field while the rest of the editor stays free-form; its `presets` replace this grid for that field rather than intersecting it, so a locked field can offer colors that appear nowhere in `presets` here. What a field can never do is unlock the editor: `allowCustom: false` here still locks every picker.

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

### `create(input?)` / `load(id)` / `save()`

The template save/load lifecycle, over the `templates` provider.

```ts
const template = await editor.create({ name: "Welcome email" });
await editor.load(template.id);
await editor.save();
```

- **`create(input?)`** persists the current content as a new template and adopts the result. Pass `content` to replace the editor's content first.
- **`load(id)`** fetches a template and makes it the editor's content, discarding local edits.
- **`save()`** persists the loaded template's name and content as one patch.

All three return a `Promise<Template>` and are always present on the type. They reject with an explanatory error when no `templates` provider is configured, when the provider withheld the relevant method (`create: false` / `save: false`), or — for `save()` — when nothing has been created or loaded yet. See [Saving & Loading](/backend/templates).

### `isDirty()`

Whether there are edits the editor knows aren't persisted. Cleared by a successful `save()`, `create()` or `load()`.

```ts
router.beforeEach((to, from, next) => {
  if (editor.isDirty() && !confirm("Discard unsaved changes?")) return next(false);
  next();
});
```

`onDirtyChange` is the push-based counterpart.

### `toMjml()`

Renders the current content to MJML markup. Returns a `Promise<string>` because resolving custom blocks may require asynchronous work (the editor's liquid renderer is loaded on demand).

```ts
const mjml = await editor.toMjml();
```

Resolves `render.toMjml` first when a [`render` provider](/backend/render) supplies it, then the local `@templatical/renderer`. Rejects with a clear error when neither is available — the renderer is an optional peer dependency, so install it if you need local MJML export. See [Installation](/getting-started/installation).

### `toHtml()`

Renders the current content to sending-ready HTML.

```ts
const html = await editor.toHtml();
```

Resolves `render.toHtml` first, then `toMjml()`'s output through `render.compileMjml`. **Requires one of the two**: the SDK bundles no MJML compiler, so with no `render` provider this always rejects, and the error names the method to add. See [Rendering & Export](/backend/render).

::: tip Cloud editor
The Cloud editor exposes **both** methods, resolved against Cloud's server-side renderer (or your own `render` provider). Note Cloud renders the *saved* template, so each call saves first.
:::

### `renderCustomBlock(block)`

Renders a single custom block to its HTML representation. Useful for headless callers that want to drive `@templatical/renderer`'s `renderCustomBlock` option from outside the editor instance — for example, when invoking the renderer directly with a custom configuration.

```ts
const html = await editor.renderCustomBlock(customBlock);
```

### `getCustomBlockStylesheet(customType)`

Returns the definition-level CSS registered for a custom block type, or `undefined` when the type is unknown or has no stylesheet. The companion to `renderCustomBlock()` for headless callers driving `@templatical/renderer`'s `getCustomBlockStylesheet` option themselves.

```ts
const css = editor.getCustomBlockStylesheet("qrcode");
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

const newBlock = actions.createAndAddBlock("paragraph");
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
  debounce: 2000, // the default
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
