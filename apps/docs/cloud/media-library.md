---
title: Media Library
description: Templatical Cloud as one implementation of the media storage contract.
---

# Media Library

Media is an [open contract](/backend/media). Templatical Cloud implements it, the same way your own backend would.

```ts
const editor = await initCloud({ container: '#editor', auth: { url: '/api/token' } });
```

Nothing to configure — this one is on by default. Cloud supplies the provider, and Browse appears on image fields, video thumbnails and custom-block image fields. The modal ships in the editor; Cloud is the store.

## The adapter

| Method | Cloud |
| --- | --- |
| `list` | Project library, search / folder / category / cursor forwarded |
| `create` | Uploads the file into the project |
| `update` | Filename and alt |
| `delete` | Bulk remove |
| `folders` | Nested folders; Cloud flattens a tree payload into the contract's flat list |
| `replace` | Replaces the file in place |
| `importFromUrl` | Pulls a remote URL into the library |
| `checkUsage` | Templates that reference the assets |
| `frequentlyUsed` | Recents for the current user |
| `storage` | Quota ring; `null` until plan config has loaded |

**One library per project**, shared by everyone on it. Cloud **ignores `templateId`**: the store is project-scoped.

Every method is a function. `storage`, `maxFileSize` and `mimeTypes` are **live getters** over plan config — they fill in after construction, so a snapshot at setup would pin quota to `null` for the whole session.

When Cloud's store is in play, consumer `maxFileSize` / `mimeTypes` on an events-only object are ignored (Cloud's plan owns those limits). Only `onCreated` / `onUpdated` / `onDeleted` forward.

## Bringing your own

You can, and `initCloud()` accepts this as a full swap, the same way it accepts `savedBlocks` and `testEmail`. The key takes the same type as `init()`'s, plus a third shape unique to this entry point: keep Cloud's library and add your own event handlers.

```ts
await initCloud({ container, auth });                        // Cloud's library
await initCloud({ container, auth, media: { onCreated } });  // Cloud's library, plus your events
await initCloud({ container, auth, media: mine });           // your own, on Cloud
await initCloud({ container, auth, media: false });          // off — URL field only
```

<!-- prettier-ignore -->
| `media` | Store |
| --- | --- |
| omitted | Cloud |
| `false` | off |
| options (`{ onCreated }`) | Cloud, plus those handlers |
| full provider | yours, **not** plan-gated |

Cloud tells them apart by `list`, never by whether the value is an object: something with a working `list` replaces Cloud's store outright, and anything else — `false`, an events-only object — keeps Cloud's own store and forwards whatever events it carries onto it.

A provider you supply is **not** plan-gated — the plan licenses Cloud's *storage*, not the editor's UI. An events-only object still uses Cloud's store.

A malformed object that has `create` (or other mutations) but no working `list` falls through to Cloud's store, with a warning naming the ignored methods.

## UI override

`onRequestMedia` is a host widget (Bynder, Cloudinary, a modal of your own). It is not the store. When both are set, the callback wins and Cloud's modal never opens. It returns `{ url, alt? }` — see [Images](/guide/images).

```ts
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  onRequestMedia: async (context) => {
    const selected = await myMediaPicker.open(context);
    if (!selected) return null;
    return { url: selected.url, alt: selected.alt };
  },
});
```

## Standalone

The same UI, without Confirm, via `@templatical/media-library`. Pass a `provider` — Cloud is `createCloudMediaProvider` from `@templatical/core/cloud`:

```ts
import { init } from '@templatical/media-library';
import { createCloudMediaProvider } from '@templatical/core/cloud';

const mediaLibrary = await init({
  container: '#media-library',
  provider: createCloudMediaProvider(authManager),
  onSelect: (asset) => {
    console.log('Selected:', asset.url);
  },
});
```

`onSelect` is optional. `accept` narrows categories; omit it for every category.

## Headless use

For server-side or programmatic media operations, `MediaApiClient` is exported from `@templatical/core/cloud`. `createCloudMediaProvider` maps the response onto `MediaProvider`.

```ts
import { MediaApiClient } from '@templatical/core/cloud';

const client = new MediaApiClient(authManager);

const response = await client.browseMedia({ folderId: 'folder-id', search: 'hero', category: 'images' });
const item = await client.uploadMedia(file, folderId);
await client.deleteMedia(['item-id-1', 'item-id-2']);
const usage = await client.checkMediaUsage(['item-id-1']);
```
