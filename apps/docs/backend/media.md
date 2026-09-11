---
title: Media
description: Back the editor's image picker with your own gallery, DAM or CMS — or use the bundled browser-local store.
---

# Media

The editor owns the picker: Browse on image fields, video thumbnails and custom-block image fields, drag-and-drop upload, crop, folders, search. **You own storage.**

`onRequestMedia` is a separate seam — a UI override for a host widget (Bynder, Cloudinary, a modal of your own). It is not this store. When both are set, the callback wins and the built-in modal never opens. See [Images](/guide/images).

## Quick start

The bundled browser-local provider needs no backend:

```js
import { init, createLocalStorageMediaProvider } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  media: createLocalStorageMediaProvider(),
});
```

Entries go into `localStorage` under `templatical:media`. `create` stores the file as a data URL — a demo-sized model. `localStorage` quotas are typically around 5 MB, and a few large images will fill it. Folders, replace, import, usage, frequently-used and quota are `false`. Supply a provider for anything beyond demos, prototypes and a single device.

## Installation

::: warning Only needed standalone
Do not install [`@templatical/media-library`](/getting-started/installation#package-overview) next to the editor. `init({ media })` and Cloud's store already ship Browse as a lazy chunk; Vue is not installed. This package is the standalone SDK — `init()`, `useMediaLibrary`, or `MediaLibraryModal` in your own Vue app.
:::

::: code-group

```bash [npm]
npm install @templatical/media-library
```

```bash [pnpm]
pnpm add @templatical/media-library
```

```bash [yarn]
yarn add @templatical/media-library
```

```bash [bun]
bun add @templatical/media-library
```

:::

That package takes `vue` as a peer. Skip it when:

- you pass `onRequestMedia` and no `media` key — the host widget never mounts the modal
- you omit `media` entirely — image fields stay URL-only
- you call provider methods yourself — they are ordinary functions

::: tip Loading the editor from the CDN?
There is nothing to install. The CDN editor inlines the same chunk that the npm editor ships.
:::

## The contract

`media` takes any object implementing `MediaProvider`. `list` is a method; every other member is **either a function or `false`**:

```ts
interface MediaProvider {
  list(params?: MediaListParams): Promise<MediaListPage>;

  create: false | ((input: MediaCreateInput) => Promise<MediaAsset>);
  update: false | ((id: string, patch: MediaAssetPatch) => Promise<MediaAsset>);
  delete: false | ((ids: string[]) => Promise<void>);
  folders: false | MediaFoldersProvider;
  replace: false | ((id: string, file: File) => Promise<MediaAsset>);
  importFromUrl:
    | false
    | ((url: string, folderId?: string | null, templateId?: string) => Promise<MediaAsset>);
  checkUsage: false | ((ids: string[]) => Promise<Record<string, MediaUsageInfo>>);
  frequentlyUsed: false | (() => Promise<MediaAsset[]>);
  storage: false | (() => Promise<MediaStorageInfo | null>);
}

interface MediaFoldersProvider {
  list(): Promise<MediaFolder[]>; // FLAT; the UI trees via parentId
  create: false | ((input: MediaFolderInput) => Promise<MediaFolder>);
  update: false | ((id: string, patch: { name: string }) => Promise<MediaFolder>);
  delete: false | ((id: string) => Promise<void>);
  move: false | ((ids: string[], folderId: string | null) => Promise<MediaAsset[]>);
}
```

`false` means the current user may not perform that action, and the editor hides the affordance.

`list` cannot be `false`: without it the picker has nothing to show. Search, folder, category and cursor are sent on every listing — galleries outgrow one response. A provider that returns everything at once omits `nextCursor`.

`delete` and `checkUsage` are bulk: the grid is multi-select. `folders` is nested so a gallery without folders writes `folders: false` once; `folders.list()` returns a **flat** array and the UI trees it via `parentId`.

Cropping is client-side. Persist a crop by calling `create` or `replace` with the resulting `File`. There is no crop method on the provider, and no upload-progress callback: `create` takes a `File` and resolves with the asset.

Confirm always inserts `asset.url`. The grid uses `thumbnailUrl`, falling back to `url`. There is no conversion set (`small` / `medium` / `large`) on `MediaAsset` — if a derivative belongs in the email, put that URL on `url`.

### The data shape

```ts
interface MediaAsset {
  id: string;              // assigned by the provider, returned from create()
  url: string;             // lands on the block
  alt?: string;
  filename?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  size?: number;           // bytes
  thumbnailUrl?: string;   // grid; falls back to url
  folderId?: string | null;
  canUpdate?: boolean;     // optional — absent means allowed; set false to forbid
  canDelete?: boolean;
  createdAt?: string;      // optional — display only, never affects ordering
  updatedAt?: string;
}

interface MediaListParams {
  search?: string;
  cursor?: string;
  folderId?: string | null;
  category?: MediaCategory;   // "images" | "documents" | "videos" | "audio"
  templateId?: string;        // when a template is loaded; Cloud ignores
}

interface MediaListPage {
  items: MediaAsset[];
  nextCursor?: string;
}

interface MediaCreateInput {
  file: File;
  folderId?: string | null;
  alt?: string;
  filename?: string;
  templateId?: string;
}
```

- **`id` comes from the provider.** The editor never generates one; it uses whatever `create()` returns.
- **`templateId` is opportunistic.** Passed on `list` / `create` / `importFromUrl` when a template is loaded; omitted on a blank canvas. Media is not gated on it. Cloud ignores it; a CMS that scopes a gallery per template reads it here.
- **Ordering comes from the provider.** The editor renders `list()`'s order and never re-sorts.
- **Timestamps are display only.** Omit both and no label renders.
- **`maxFileSize` / `mimeTypes`** on the provider are a client pre-check, not a security boundary — the backend must enforce too.

```ts
interface MediaOptions {
  maxFileSize?: number; // bytes
  mimeTypes?: Partial<Record<MediaCategory, string[]>>;
  onCreated?: (asset: MediaAsset) => void;
  onUpdated?: (asset: MediaAsset) => void;
  onDeleted?: (asset: MediaAsset) => void;
}
```

`MediaProvider` extends `MediaOptions`, so one object carries storage and events.

## Controlling permissions

**Withhold a whole capability** by passing `false` instead of a function. The editor hides what it can't do: no upload zone and no drop when `create` is off, no edit when `update` is off, no delete when `delete` is off, no folder tree when `folders` is off.

```ts
const media: MediaProvider = {
  list: ({ search, cursor, templateId }) =>
    myCms.page({ search, cursor, templateId }),
  create: ({ file }) => myCms.upload(file),
  update: false,
  delete: false,
  folders: false,
  replace: false,
  importFromUrl: false,
  checkUsage: false,
  frequentlyUsed: false,
  storage: false,
};
```

**Withhold a single entry** with `canUpdate` / `canDelete` on it. Absent means allowed, so set them only on the exceptions. The two levers compose in one direction: `canUpdate: true` cannot re-enable an `update` the provider passed as `false`.

### A read-only library

Every mutation `false` gives a curated gallery users browse, search and pick from but never modify:

```ts
const media: MediaProvider = {
  list: async () => {
    const res = await fetch('/api/media');
    return json(res);
  },
  create: false,
  update: false,
  delete: false,
  folders: false,
  replace: false,
  importFromUrl: false,
  checkUsage: false,
  frequentlyUsed: false,
  storage: false,
};
```

Picking still works — it copies `{ url, alt }` onto the canvas, and nothing reaches the provider. Drop does not: drop needs `create`. `list` is the one member that can't be disabled.

::: warning Not a security boundary
Hiding a control stops the editor offering an action; it doesn't stop a determined caller. Provider methods run in the user's browser, so enforce permissions server-side too — including who may read, change or delete an asset in a library shared across a team.
:::

## Error handling

Any method may reject. The editor reports the failure through `onError` and leaves its in-memory list untouched, so a failed delete doesn't make an asset vanish from the UI. The modal stays open. Provider messages are user-presentable: they reach the UI verbatim.

Failed `create` does not prepend. `importFromUrl` keeps an inline field error.

## In the editor

The surface is a **picker**. There is no sidebar rail and no "manage media" chrome.

- **Browse** — an image field (and the video thumbnail, and a custom-block image field) shows a browse button when `media` **or** `onRequestMedia` is configured. With a `media` provider and no callback, the click opens the library modal. With `onRequestMedia`, the callback runs instead — the modal never mounts. Image fields and the video thumbnail pass `accept: ["images"]`; custom blocks may pass other categories. The modal forces `list({ category })` to that set and hides other tabs.
- **Confirm** — Confirm or double-click commits **one** previewed asset that matches `accept`, as `{ url: asset.url, alt: asset.alt }`. Multi-select is for bulk delete and move only. Close, Escape or backdrop returns `null`.
- **Drop** — dragging an image file onto an image block or field:

  | Config | Drop |
  | --- | --- |
  | `onRequestMedia` | yes — `context.files` |
  | provider, `create` is a function | yes — `provider.create({ file, templateId? })` |
  | provider, `create: false` | no |
  | neither | no |

  The drop zone pre-filters to `image/` MIME types. Size and type after that are `MediaOptions`, then the server. Don't return a `blob:` URL: `URL.createObjectURL(file)` is session-local and breaks export.
- **Lazy load** — omit `media` and none of the library UI is downloaded. `onRequestMedia` alone never mounts the modal.

## Off by default

Omit `media` and image fields stay URL-only, unless you passed `onRequestMedia`.

## Events

```ts
media: {
  // ...list, create, update, delete, …
  onCreated: (asset) => {},
  onUpdated: (asset) => {},
  onDeleted: (asset) => {},
}
```

Each fires once the matching mutation resolves, with the stored asset:

- **`onCreated`** after `create` or `importFromUrl`. A drop calls `create` and fires this without opening the modal and without prepending a listing row — the URL lands on the block.
- **`onUpdated`** after `update` or `replace`.
- **`onDeleted`** after `delete`.

There is no editor-level media list. The modal's own listing (when it is open) prepends, replaces and filters on success; a drop never touches that listing.

::: tip `onDeleted` carries the asset, not an id
`delete` resolves to nothing, so the handler receives the entry captured from the modal's loaded listing immediately before removing it.
:::

::: tip A delete outside the loaded listing fires no event
The captured entry has to already be in the modal's listing. Deleting an id that listing never held still deletes successfully; there is nothing to pass to `onDeleted`, so it does not fire.
:::

A handler that throws is caught and reported to `onError` — it never fails the create, update or delete that triggered it.

## Headless use

There is no `useMedia` in `@templatical/core`. Media state is modal-scoped; the provider methods **are** the headless API. Call them from your own UI, or drive the bundled modal's state machine:

```ts
import { useMediaLibrary } from '@templatical/media-library';

const {
  items,          // Ref<MediaAsset[]>
  isLoading,      // Ref<boolean>
  hasMore,        // Ref<boolean>
  loadItems,      // () => Promise<void>
  loadMore,       // () => Promise<void>
  uploadFile,     // (file: File) => Promise<MediaAsset | null>
  confirmDelete,  // () => Promise<void>
} = useMediaLibrary({
  provider,
  onError: (error) => {
    /* handle */
  },
});
```

It keeps the list in sync after each successful call — prepending on create, replacing on update, removing on delete — and reports to `onError` without mutating the list on failure. A stale `list` / `loadMore` response is discarded.

**Using Templatical Cloud?** It implements this contract with nothing to configure — see [Media Library on Cloud](/cloud/media-library).

## Bringing your own

A minimal REST implementation:

```ts
import { init } from '@templatical/editor';
import type { MediaProvider } from '@templatical/editor';

const json = async (res: Response) => {
  if (!res.ok) throw new Error(`Media request failed: ${res.status}`);
  return res.json();
};

const media: MediaProvider = {
  list: async (params) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.folderId) query.set('folderId', params.folderId);
    if (params?.category) query.set('category', params.category);
    if (params?.templateId) query.set('templateId', params.templateId);
    const res = await fetch(`/api/media?${query}`);
    return json(res);
  },

  create: async (input) => {
    const body = new FormData();
    body.append('file', input.file);
    if (input.folderId) body.append('folderId', input.folderId);
    if (input.templateId) body.append('templateId', input.templateId);
    const res = await fetch('/api/media', { method: 'POST', body });
    return json(res);
  },

  update: async (id, patch) => {
    const res = await fetch(`/api/media/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    return json(res);
  },

  delete: async (ids) => {
    const res = await fetch('/api/media', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  },

  folders: false,
  replace: false,
  importFromUrl: false,
  checkUsage: false,
  frequentlyUsed: false,
  storage: false,
};

await init({ container: '#editor', media });
```

A CMS gallery that lists and uploads, and nothing else, is the same shape as the permissions example above. Shared and per-template galleries merge inside `list({ templateId })`.
