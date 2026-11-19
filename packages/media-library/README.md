# @templatical/media-library

> Media library for Templatical — composable, Vue components, and a standalone visual SDK.

[![npm version](https://img.shields.io/npm/v/@templatical/media-library?label=npm&color=cb3837)](https://www.npmjs.com/package/@templatical/media-library)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/templatical/sdk/blob/main/LICENSE)

Browse, upload, organize, crop, and replace media assets. Used by [`@templatical/editor`](https://www.npmjs.com/package/@templatical/editor) behind a `MediaProvider` (the editor bundles the Browse UI — you do not install this package for `init({ media })`), and available as a standalone SDK for any app that needs a media manager.

## Install

```bash
npm install @templatical/media-library
```

Peer dep: `vue@^3.5`. Not needed next to `@templatical/editor` — that package already contains the modal.

> **Storage.** The library is storage-agnostic. Pass a `MediaProvider` you implement. See the [media contract](https://docs.templatical.com/backend/media).

## Usage

### Standalone visual SDK (mount anywhere)

```ts
import { init } from '@templatical/media-library';
import type { MediaLibraryConfig } from '@templatical/media-library';
import '@templatical/media-library/style.css';

const provider = {
  list: async () => ({ items: [] }),
  create: false,
  update: false,
  delete: false,
  folders: false,
  replace: false,
  importFromUrl: false,
  checkUsage: false,
  frequentlyUsed: false,
  storage: false,
} satisfies MediaLibraryConfig['provider'];

const container = document.createElement('div');
document.body.append(container);
const media = await init({
  container,
  provider,
  onSelect(asset) {
    console.log('Picked:', asset.url);
  },
});

// Later
media.unmount();
```

This provider opens an empty, read-only library. Replace `list` with your storage query to show assets. `onSelect` is optional. `accept` narrows categories; omit it for every category.

### Vue component

Use `MediaLibraryModal` inside a Vue 3 app. See the [media contract](https://docs.templatical.com/backend/media) for the provider the modal sits on.

```ts
import { MediaLibraryModal } from '@templatical/media-library';
import '@templatical/media-library/style.css';
```

```vue
<MediaLibraryModal
  :visible="open"
  :provider="provider"
  :on-error="onError"
  @select="onSelect"
  @close="open = false"
/>
```

### Composable (build your own UI)

```ts
import { useMediaLibrary } from '@templatical/media-library';
import type { MediaLibraryConfig } from '@templatical/media-library';

const provider = {
  list: async () => ({ items: [] }),
  create: false,
  update: false,
  delete: false,
  folders: false,
  replace: false,
  importFromUrl: false,
  checkUsage: false,
  frequentlyUsed: false,
  storage: false,
} satisfies MediaLibraryConfig['provider'];

const lib = useMediaLibrary({
  provider,
  onError(error) {
    console.error(error);
  },
});
```

This provider returns an empty, read-only library. See the [media contract](https://docs.templatical.com/backend/media) to connect your storage.

## Exports

- **Standalone SDK** — `init()`, `unmount()`
- **Vue components** — `MediaLibraryModal` + 12 sub-components (grid, upload zone, folder tree, preview panel, edit/replace/import modals)
- **Composables** — `useMediaLibrary`, `useMediaCategories`, `useMediaPicker`, `useI18n`
- **Types** — `MediaAsset`, `MediaFolder`, `MediaCategory`, `MediaRequestContext`, `MediaUsageInfo`, `MediaResult` (re-exported from `@templatical/types`)

The `MediaProvider` / `MediaAsset` contract lives in [`@templatical/types`](https://www.npmjs.com/package/@templatical/types).

## Inside the editor's Shadow DOM

When the editor mounts in its default shadow-DOM mode (`shadowDom: true`), the media library invocation teleports into the editor's shadow-aware popover root rather than `document.body`. The `MediaLibraryModal` accepts an optional `popoverTarget?: HTMLElement | null` prop and provides it to its three nested sub-modals (replace, edit, import-url) so the entire media UI lives inside the editor's shadow root. Standalone-SDK consumers (`init({ container })`) mount at `document.body`.

If you embed `MediaLibraryModal` manually inside another shadow-DOM-mounted UI, pass `popoverTarget` to keep its sub-modals scoped to your shadow root.

## Documentation

- [Media contract](https://docs.templatical.com/backend/media)
- [Shadow DOM (editor)](https://docs.templatical.com/guide/shadow-dom)

Full reference at **[docs.templatical.com](https://docs.templatical.com)**.

## License

[MIT](https://github.com/templatical/sdk/blob/main/LICENSE).
