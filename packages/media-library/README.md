# @templatical/media-library

> Media library for Templatical — composable, Vue components, and a standalone visual SDK.

[![npm version](https://img.shields.io/npm/v/@templatical/media-library?label=npm&color=cb3837)](https://www.npmjs.com/package/@templatical/media-library)
[![License](https://img.shields.io/badge/license-FSL--1.1--MIT-blue)](https://github.com/templatical/sdk/blob/main/LICENSE)

Browse, upload, organize, crop, and replace media assets. Used by [`@templatical/editor`](https://www.npmjs.com/package/@templatical/editor) behind a `MediaProvider`, and available as a standalone SDK for any app that needs a media manager.

## Install

```bash
npm install @templatical/media-library
```

Peer deps: `vue@^3.5`, `tailwindcss@^4`.

> **Storage.** The library is storage-agnostic. Pass a `MediaProvider` — Cloud's adapter is `createCloudMediaProvider` from `@templatical/core/cloud`. See the [media contract](https://docs.templatical.com/backend/media) and the [Cloud adapter](https://docs.templatical.com/cloud/media-library).

## Usage

### Standalone visual SDK (mount anywhere)

```ts
import { init } from '@templatical/media-library';
import { createCloudMediaProvider } from '@templatical/core/cloud';
import '@templatical/media-library/style.css';

const media = await init({
  container: '#media',
  provider: createCloudMediaProvider(authManager),
  onSelect(asset) {
    console.log('Picked:', asset.url);
  },
});

// Later
media.unmount();
```

`onSelect` is optional. `accept` narrows categories; omit it for every category. Any object implementing `MediaProvider` works — Cloud is one adapter.

### Vue component

Use `MediaLibraryModal` inside a Vue 3 app. See [docs](https://docs.templatical.com/cloud/media-library) for the full prop reference.

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
import { createCloudMediaProvider } from '@templatical/core/cloud';

const lib = useMediaLibrary({
  provider: createCloudMediaProvider(authManager),
  onError(error) {
    console.error(error);
  },
});
```

### API client (low-level)

For server-side or programmatic media operations, `MediaApiClient` is exported from `@templatical/core/cloud`. It speaks Cloud's snake_case HTTP; `createCloudMediaProvider` is the mapping onto `MediaProvider`.

```ts
import { MediaApiClient, createCloudMediaProvider } from '@templatical/core/cloud';

const client = new MediaApiClient(authManager);
const response = await client.browseMedia({ folder_id: null });

const provider = createCloudMediaProvider(authManager);
const page = await provider.list();
```

## Exports

- **Standalone SDK** — `init()`, `unmount()`
- **Vue components** — `MediaLibraryModal` + 12 sub-components (grid, upload zone, folder tree, preview panel, edit/replace/import modals)
- **Composables** — `useMediaLibrary`, `useMediaCategories`, `useMediaPicker`, `useI18n`
- **Types** — `MediaItem`, `MediaFolder`, `MediaCategory`, `MediaConversion`, `MediaBrowseParams/Response`, `MediaUsageInfo/Response`, `MediaConfig`, etc.

The `MediaProvider` / `MediaAsset` contract lives in [`@templatical/types`](https://www.npmjs.com/package/@templatical/types).

## Inside the editor's Shadow DOM

When the editor mounts in its default shadow-DOM mode (`shadowDom: true`), the media library invocation teleports into the editor's shadow-aware popover root rather than `document.body`. The `MediaLibraryModal` accepts an optional `popoverTarget?: HTMLElement | null` prop and provides it to its three nested sub-modals (replace, edit, import-url) so the entire media UI lives inside the editor's shadow root. Standalone-SDK consumers (`init({ container })`) mount at `document.body`.

If you embed `MediaLibraryModal` manually inside another shadow-DOM-mounted UI, pass `popoverTarget` to keep its sub-modals scoped to your shadow root.

## Documentation

- [Media contract](https://docs.templatical.com/backend/media)
- [Cloud media library](https://docs.templatical.com/cloud/media-library)
- [Shadow DOM (editor)](https://docs.templatical.com/guide/shadow-dom)

Full reference at **[docs.templatical.com](https://docs.templatical.com)**.

## License

[FSL-1.1-MIT](https://github.com/templatical/sdk/blob/main/LICENSE) — free for any non-competing commercial use, automatically converts to MIT after 2 years per release.
