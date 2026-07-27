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

`savedBlocks` takes any object implementing `SavedBlocksProvider` — four members. `list` is a method; each mutation is **either a function or `false`**:

```ts
interface SavedBlocksProvider {
  list(params?: { search?: string; category?: string }): Promise<SavedBlock[]>;

  create: false | ((input: SavedBlockInput) => Promise<SavedBlock>);
  update: false | ((id: string, patch: SavedBlockPatch) => Promise<SavedBlock>);
  delete: false | ((id: string) => Promise<void>);
}
```

Passing `false` tells the editor the current user may not perform that action, and it hides the affordance instead of letting them try and fail. They're required rather than optional on purpose: disabling something should be a decision you write down, not something you get by forgetting a method.

A minimal REST implementation:

```ts
import { init } from '@templatical/editor';
import type { SavedBlocksProvider } from '@templatical/editor';

const json = (res: Response) => {
  if (!res.ok) throw new Error(`Saved blocks request failed: ${res.status}`);
  return res.json();
};

const savedBlocks: SavedBlocksProvider = {
  // Return everything the current user may see — scope it per user, team or
  // account here. The editor calls this with no arguments and filters in the
  // browser, so you don't have to implement search or category filtering.
  list: () => fetch('/api/saved-blocks').then(json),

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
  category?: string;     // optional — free-text grouping, drives the browser filter
  canUpdate?: boolean;   // optional — absent means allowed; set false to forbid
  canDelete?: boolean;
  createdAt?: string;    // optional — display only, never affects ordering
  updatedAt?: string;
}
```

Five contract points worth knowing:

- **Your store owns `id`.** The editor never generates one; it uses whatever `create()` returns. Scope entries per user, per team, or per account however you like — the editor doesn't care.
- **Renaming is `update(id, { name })`, recategorising is `update(id, { category })`.** There are no separate methods; `update` takes a partial patch.
- **You own the ordering.** The editor renders entries in exactly the order `list()` returns and never re-sorts them — not by date, not by name. Filtering narrows the list without reordering it. Sort server-side however you like.
- **Filtering is the editor's job, not yours.** The browser's search box and category filter run in memory over whatever `list()` returned, so a provider that just returns an array gets both for free. `list()` does accept a `{ search, category }` params object, but the editor never sends it — it only arrives if you drive `useSavedBlocks` yourself (see [Headless use](#headless-use)). Deciding *which* entries a user may see at all is still entirely yours, in `list()`.
- **You decide who may change what.** Pass `false` for `create`, `update` or `delete` to withhold it, and set `canUpdate` / `canDelete` on individual entries to carve out exceptions. See [Controlling permissions](#controlling-permissions).
- **Timestamps are display only.** Each entry shows a relative "5m ago" label (from `updatedAt`, falling back to `createdAt`) with the absolute date on hover. They never affect ordering. Both are optional — omit them and the label is simply not shown.

### Controlling permissions

Two independent levers, both yours:

**Withhold a whole capability** by passing `false` instead of a function. The editor hides what it can't do — no bookmark action on blocks when `create` is off (so no save flow at all), no rename control when `update` is off, no delete control when `delete` is off.

```ts
const savedBlocks: SavedBlocksProvider = {
  list: () => fetch('/api/saved-blocks').then(json),

  // This user may add to the library but never change or remove what's there.
  create: (input) => post('/api/saved-blocks', input),
  update: false,
  delete: false,
};
```

**Withhold a single entry** by returning `canUpdate` / `canDelete` on it. Absent means allowed — these exist only to forbid, so you set them just on the exceptions. Return them from your API where the answer is already known; the editor never computes its own and never second-guesses yours.

```json
[
  { "id": "1", "name": "My header", "content": [] },
  { "id": "2", "name": "Team footer", "content": [], "canUpdate": false, "canDelete": false }
]
```

That renders a library where the user can edit their own entry and only insert the shared one. Note the two levers compose in one direction: `canUpdate: true` cannot re-enable an `update` you passed as `false` — the capability wins.

#### A read-only library

Set all three to `false` and you get a curated library users browse, preview and insert from but never modify:

```ts
const savedBlocks: SavedBlocksProvider = {
  list: () => fetch('/api/saved-blocks').then(json),
  create: false,
  update: false,
  delete: false,
};
```

Insertion still works, because it only ever touches the canvas — nothing reaches your store. `list` is the one member that can't be disabled; without it the feature has nothing to show.

::: tip These are UI affordances, not security
Hiding a control stops the editor from offering an action; it doesn't stop a determined caller. Enforce permissions in your API as well — the provider methods run in the user's browser.
:::

### Error handling

Any method may reject. The editor reports the failure through the editor's `onError` callback and leaves its in-memory list untouched, so a failed delete doesn't make a block vanish from the UI. The save dialog additionally shows the rejection message inline.

## What the user sees

Once a provider is configured:

- **Save** — selecting a top-level block reveals a bookmark action, which starts a *pick session*: that block is picked, and plain clicks (no modifier keys) add or remove others. A bar over the canvas shows the count with Save and Cancel; Save then opens a dialog that asks for a name and previews the picked blocks. Escape cancels, Enter confirms.
  The preview lists the blocks in the order you picked them, and each row has a grip handle to drag it — or Arrow Up / Arrow Down with the handle focused — so you can reorder before saving. Whatever order the list ends in is the order the blocks are stored in. Clicking inside a section picks the whole section — section children aren't individually savable, since a section carries its columns and their contents with it.
  The dialog also asks for an optional **category**, suggesting the ones already in use.
- **Browse** — a saved-blocks entry sits in the left rail whenever the feature is configured, opening a searchable browser with a live preview. It's there from the first paint whether anything is saved or not, so the rail never shifts, and an empty library opens to a state that explains how to fill it. Nothing is fetched until that browser (or the save dialog) opens — your `list()` is never called on editor load, and a first open shows placeholder rows until it answers.
- **Categorise** — a category is free text, flat, and optional; there are no folders and no nesting. The browser shows a category filter as soon as anything is categorised, listing exactly the categories in use — a category exists for as long as some entry carries it. Search and the category filter narrow the list together.
- **Insert** — choose a position (at the beginning, after any existing block, or at the end) and insert. Inserted blocks always get **fresh IDs**, so inserting the same entry twice never collides.
- **Rename / recategorise / delete** — inline on each row in the browser; the edit row covers both the name and the category, and clearing the category field uncategorises the entry. Delete asks for confirmation first.

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
  categories,  // ComputedRef<string[]> — distinct categories, sorted
  canCreate,   // ComputedRef<boolean> — did the provider supply create?
  canUpdate,
  canDelete,
  canUpdateBlock, // (block) => boolean — capability AND the entry's own flag
  canDeleteBlock,
  load,        // (params?: { search?, category? }) => Promise<void>
  create,      // (name, content, category?) => Promise<SavedBlock>
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

Check `canCreate` / `canUpdateBlock` / `canDeleteBlock` before offering an action in your own UI. Calling a mutation the provider withheld — or one an entry forbids — rejects rather than silently resolving, so a caller can never mistake a refusal for a save.
