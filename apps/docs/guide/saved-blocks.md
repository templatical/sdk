---
title: Saved Blocks
description: Let users save reusable groups of blocks and insert them into other templates, backed by your own storage.
---

# Saved Blocks

Saved blocks let your users capture a group of blocks — a header, a footer, a product grid, a CTA — and re-insert it into any other template.

The editor owns the whole experience: a save action on every block, a searchable browser with live preview, insert-at-position, rename, and delete. **You own storage.** Implement a small provider interface against your own API and the feature lights up.

::: tip Not the same as custom blocks
[Custom blocks](/guide/custom-blocks) are *developer-defined block types* with their own template and fields. Saved blocks are *instances* of ordinary blocks that end users save and reuse. The two are independent.
:::

## Quick start

The fastest way to try it is the bundled browser-local provider — no backend needed:

```js
import { init, createLocalStorageSavedBlocksProvider } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  savedBlocks: createLocalStorageSavedBlocksProvider(),
});
```

That stores entries in `localStorage` under `templatical:saved-blocks`. Good for demos, prototypes, and single-device use — entries live in one browser profile, don't sync across devices or users, and disappear when site data is cleared. For anything real, supply your own provider.

## Bring your own storage

`savedBlocks` takes any object implementing `SavedBlocksProvider` — four promise-returning methods:

```ts
interface SavedBlocksProvider {
  list(params?: { search?: string }): Promise<SavedBlock[]>;
  create(input: { name: string; content: Block[] }): Promise<SavedBlock>;
  update(
    id: string,
    patch: Partial<{ name: string; content: Block[] }>,
  ): Promise<SavedBlock>;
  delete(id: string): Promise<void>;
}
```

A minimal REST implementation:

```ts
import { init } from '@templatical/editor';
import type { SavedBlocksProvider } from '@templatical/editor';

const json = (res: Response) => {
  if (!res.ok) throw new Error(`Saved blocks request failed: ${res.status}`);
  return res.json();
};

const savedBlocks: SavedBlocksProvider = {
  list: ({ search } = {}) =>
    fetch(`/api/saved-blocks?search=${encodeURIComponent(search ?? '')}`).then(json),

  create: (input) =>
    fetch('/api/saved-blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then(json),

  update: (id, patch) =>
    fetch(`/api/saved-blocks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(json),

  delete: (id) =>
    fetch(`/api/saved-blocks/${id}`, { method: 'DELETE' }).then((res) => {
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
    }),
};

await init({ container: '#editor', savedBlocks });
```

### The data shape

```ts
interface SavedBlock {
  id: string;            // assigned by your store, returned from create()
  name: string;
  content: Block[];      // top-level blocks; a section carries its own children
  created_at?: string;   // optional — display only, never affects ordering
  updated_at?: string;
}
```

Four contract points worth knowing:

- **Your store owns `id`.** The editor never generates one; it uses whatever `create()` returns. Scope entries per user, per team, or per account however you like — the editor doesn't care.
- **Renaming is `update(id, { name })`.** There is no separate rename method; `update` takes a partial patch.
- **You own the ordering.** The editor renders entries in exactly the order `list()` returns and never re-sorts them — not by date, not by name. Search filters the list without reordering it. Sort server-side however you like.
- **Timestamps are display only.** Each entry shows a relative "5m ago" label (from `updated_at`, falling back to `created_at`) with the absolute date on hover. They never affect ordering. Both are optional — omit them and the label is simply not shown.

### Error handling

Any method may reject. The editor reports the failure through the editor's `onError` callback and leaves its in-memory list untouched, so a failed delete doesn't make a block vanish from the UI. The save dialog additionally shows the rejection message inline.

## What the user sees

Once a provider is configured:

- **Save** — selecting a top-level block reveals a bookmark action, which opens a dialog to name the entry and tick which blocks to include. Blocks inside a section column aren't individually savable — save the whole section instead, which carries its columns and their contents with it.
- **Browse** — a saved-blocks entry appears in the left rail once at least one block is saved, opening a searchable browser with a live preview.
- **Insert** — choose a position (at the beginning, after any existing block, or at the end) and insert. Inserted blocks always get **fresh IDs**, so inserting the same entry twice never collides.
- **Rename / delete** — inline on each row in the browser; delete asks for confirmation first.

## Off by default

Omit `savedBlocks` and the feature is completely absent: no save action, no rail entry, and **none of its code is downloaded**. The UI is split into lazily-loaded chunks that are fetched only when a dialog is actually opened, so consumers who don't use saved blocks pay nothing for them.

## Templatical Cloud

With [`initCloud()`](/cloud/getting-started), saved blocks are wired to the Cloud backend automatically — persisted server-side and shared across your team, scoped per project and tenant. You don't pass a provider; Cloud supplies its own implementation of the same interface.

Disable it explicitly if you don't want it:

```js
await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  savedBlocks: false,
});
```

Cloud availability also depends on your plan — when a plan doesn't include saved blocks, the UI stays hidden.

## Headless use

The reactive state layer is exported from `@templatical/core` if you want to build your own UI over a provider:

```ts
import { useSavedBlocks } from '@templatical/core';

const {
  savedBlocks, // Ref<SavedBlock[]>
  isLoading,   // Ref<boolean>
  load,        // (search?) => Promise<void>
  create,      // (name, content) => Promise<SavedBlock>
  update,      // (id, patch) => Promise<SavedBlock>
  remove,      // (id) => Promise<void>
} = useSavedBlocks({
  provider,
  onError: (error) => {
    /* handle */
  },
});
```

It keeps the list in sync after each successful call — prepending on create, replacing on update, removing on delete — and re-throws after reporting to `onError`.
