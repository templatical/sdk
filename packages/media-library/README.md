# @templatical/media-library

> Media library for Templatical — composable, Vue components, and a standalone visual SDK.

[![npm version](https://img.shields.io/npm/v/@templatical/media-library?label=npm&color=cb3837)](https://www.npmjs.com/package/@templatical/media-library)
[![License](https://img.shields.io/badge/license-FSL--1.1--MIT-blue)](https://github.com/templatical/sdk/blob/main/LICENSE)

Browse, upload, organize, crop, and replace media assets. Used by [`@templatical/editor`](https://www.npmjs.com/package/@templatical/editor)'s Cloud build, and available as a standalone SDK for any app that needs a media manager.

## Install

```bash
npm install @templatical/media-library
```

Peer deps: `vue@^3.5`, `tailwindcss@^4`.

> **Authentication.** The media library connects to Templatical Cloud and authenticates against your backend. Your server exposes a token endpoint (returning a short-lived JWT for the current user/project), and you pass that endpoint URL as `auth.url`. See the [authentication guide](https://docs.templatical.com/cloud/authentication) for the full setup.

## Usage

### Standalone visual SDK (mount anywhere)

```ts
import { init } from '@templatical/media-library';
import '@templatical/media-library/style.css';

const media = await init({
  container: '#media',
  auth: {
    url: 'https://your-app.com/api/templatical/token',
  },
  onSelect(item) {
    console.log('Picked:', item.url);
  },
});

// Later
media.unmount();
```

### Vue component

Use `MediaLibraryModal` inside a Vue 3 app. See [docs](https://docs.templatical.com/cloud/media-library) for the full prop reference.

```ts
import { MediaLibraryModal } from '@templatical/media-library';
import '@templatical/media-library/style.css';
```

### Composable (build your own UI)

```ts
import { AuthManager } from '@templatical/core/cloud';
import { useMediaLibrary } from '@templatical/media-library';

const authManager = new AuthManager({
  url: 'https://your-app.com/api/templatical/token',
});
await authManager.initialize();

const lib = useMediaLibrary({
  projectId: authManager.projectId,
  authManager,
});
```

### API client (low-level)

```ts
import { AuthManager } from '@templatical/core/cloud';
import { MediaApiClient } from '@templatical/media-library';

const api = new MediaApiClient(authManager);
const response = await api.browseMedia({ folder_id: null });
```

## Exports

- **Standalone SDK** — `init()`, `unmount()`
- **Vue components** — `MediaLibraryModal` + 12 sub-components (grid, upload zone, folder tree, preview panel, edit/replace/import modals)
- **Composables** — `useMediaLibrary`, `useMediaCategories`, `useMediaPicker`, `useI18n`
- **API client** — `MediaApiClient`
- **Types** — `MediaItem`, `MediaFolder`, `MediaCategory`, `MediaConversion`, `MediaBrowseParams/Response`, `MediaUsageInfo/Response`, `MediaConfig`, etc.

## Documentation

- [Media library guide](https://docs.templatical.com/cloud/media-library)

Full reference at **[docs.templatical.com](https://docs.templatical.com)**.

## License

[FSL-1.1-MIT](https://github.com/templatical/sdk/blob/main/LICENSE) — free for any non-competing commercial use, automatically converts to MIT after 2 years per release.
