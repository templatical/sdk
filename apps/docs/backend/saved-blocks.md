---
title: Saved Blocks
description: Let users save reusable groups of blocks and insert them into other templates, backed by your own storage.
---

# Saved Blocks

Saved blocks let your users capture a group of blocks — a header, a footer, a product grid, a CTA — and re-insert it into any other template.

The editor owns the experience: a save action on every block, a searchable browser with live preview, insert-at-position, rename and delete. **You own storage.**

::: tip Not the same as custom blocks
[Custom blocks](/guide/custom-blocks) are *developer-defined block types* with their own template and fields. Saved blocks are *instances* of ordinary blocks that end users save and reuse. The two are independent.
:::

## Quick start

The bundled browser-local provider needs no backend:

```js
import { init, createLocalStorageSavedBlocksProvider } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  savedBlocks: createLocalStorageSavedBlocksProvider(),
});
```

Entries go into `localStorage` under `templatical:saved-blocks`. Good for demos, prototypes and single-device use — they live in one browser profile, don't sync, and disappear when site data is cleared. Supply a provider for anything beyond that.

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

`false` means the current user may not perform that action, and the editor hides the affordance.

A minimal REST implementation:

```ts
import { init } from '@templatical/editor';
import type { SavedBlocksProvider } from '@templatical/editor';

const json = async (res: Response) => {
  if (!res.ok) throw new Error(`Saved blocks request failed: ${res.status}`);
  return res.json();
};

const savedBlocks: SavedBlocksProvider = {
  // Return everything the current user may see — scope it per user, team or
  // account here. The editor calls this with no arguments and filters in the
  // browser.
  list: async () => {
    const res = await fetch('/api/saved-blocks');
    return json(res);
  },

  create: async (input) => {
    const res = await fetch('/api/saved-blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return json(res);
  },

  update: async (id, patch) => {
    const res = await fetch(`/api/saved-blocks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    return json(res);
  },

  delete: async (id) => {
    const res = await fetch(`/api/saved-blocks/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  },
};

await init({ container: '#editor', savedBlocks });
```

### The data shape

```ts
interface SavedBlock {
  id: string;            // assigned by the provider, returned from create()
  name: string;
  content: Block[];      // top-level blocks; a section carries its own children
  category?: string;     // optional — free-text grouping, drives the browser filter
  canUpdate?: boolean;   // optional — absent means allowed; set false to forbid
  canDelete?: boolean;
  createdAt?: string;    // optional — display only, never affects ordering
  updatedAt?: string;
}
```

- **`id` comes from the provider.** The editor never generates one; it uses whatever `create()` returns.
- **Rename with `update(id, { name })`, recategorise with `update(id, { category })`.** There are no separate methods — `update` takes a partial patch.
- **Ordering comes from the provider.** The editor renders `list()`'s order and never re-sorts; filtering narrows without reordering. Sort server-side, before `list()` returns.
- **Filtering happens in the editor.** The search box and category filter run in memory over whatever `list()` returned. `list()` accepts `{ search, category }`, but the editor never sends it — that path exists for callers driving `useSavedBlocks` directly (see [Headless use](#headless-use)). Which entries a user may see at all is decided in `list()`.
- **Timestamps are display only.** Each entry shows a relative "5m ago" label (from `updatedAt`, falling back to `createdAt`) with the absolute date on hover. Omit both and no label renders.

## Controlling permissions

**Withhold a whole capability** by passing `false` instead of a function. The editor hides what it can't do: no bookmark action when `create` is off (so no save flow at all), no rename control when `update` is off, no delete control when `delete` is off.

```ts
const savedBlocks: SavedBlocksProvider = {
  list: async () => {
    const res = await fetch('/api/saved-blocks');
    return json(res);
  },

  // This user may add to the library but never change or remove what's there.
  create: (input) => post('/api/saved-blocks', input),
  update: false,
  delete: false,
};
```

**Withhold a single entry** with `canUpdate` / `canDelete` on it. Absent means allowed, so set them only on the exceptions:

```json
[
  { "id": "1", "name": "My header", "content": [] },
  { "id": "2", "name": "Team footer", "content": [], "canUpdate": false, "canDelete": false }
]
```

The user can edit their own entry and only insert the shared one. The two levers compose in one direction: `canUpdate: true` cannot re-enable an `update` the provider passed as `false`.

### A read-only library

All three `false` gives a curated library users browse, preview and insert from but never modify:

```ts
const savedBlocks: SavedBlocksProvider = {
  list: async () => {
    const res = await fetch('/api/saved-blocks');
    return json(res);
  },
  create: false,
  update: false,
  delete: false,
};
```

Insertion still works — it only touches the canvas, and nothing reaches the provider. `list` is the one member that can't be disabled.

::: tip UI affordances, not security
Hiding a control stops the editor offering an action; it doesn't stop a determined caller. Provider methods run in the user's browser, so enforce permissions server-side too.
:::

## Error handling

Any method may reject. The editor reports the failure through `onError` and leaves its in-memory list untouched, so a failed delete doesn't make a block vanish from the UI. The save dialog also shows the rejection message inline.

## In the editor

- **Save** — selecting a top-level block reveals a bookmark action in its action bar, which starts a *pick session* with that block already picked.

  ![A selected block's action bar, with the bookmark action that starts a pick session](/images/saved-blocks-pick-start.png)

  During a session, plain clicks add or remove blocks and a bar over the canvas shows the count with Save and Cancel. Clicking inside a section picks the whole section — section children aren't individually savable, since a section carries its columns and their contents with it. Escape cancels, Enter confirms.

  ![A pick session on the canvas — two picked blocks outlined, with a floating bar below reading "2 block(s) selected" beside Cancel and Save Block](/images/saved-blocks-pick-selector.png)

  Confirming opens a dialog asking for a name and an optional **category**, suggesting the ones already in use. The preview lists blocks in pick order, each row draggable by its grip handle — or Arrow Up / Arrow Down with the handle focused. Whatever order the list ends in is the order the blocks are stored in.

  ![The Save as Block dialog — a name and a category field above a reorderable preview of the two picked blocks, each row with a grip handle](/images/saved-blocks-save.png)

- **Browse** — a saved-blocks entry sits in the left rail whenever the feature is configured, opening a searchable browser with a live preview. It renders from the first paint whether anything is saved or not, so the rail never shifts. Nothing is fetched until the browser or the save dialog opens; a first open shows placeholder rows until `list()` answers.

  ![The Browse Saved Blocks modal — search and a category filter above the entry list on the left, a live preview and the insert-position picker on the right](/images/saved-blocks-browse.png)

- **Categorise** — free text, flat, optional. No folders, no nesting. The category filter appears as soon as anything is categorised and lists exactly the categories in use. Search and the filter narrow together.
- **Insert** — choose a position (beginning, after any existing block, or end). Inserted blocks always get **fresh IDs**, so inserting the same entry twice never collides.
- **Rename / recategorise / delete** — inline on each row. The edit row covers name and category together, and clearing the category field uncategorises the entry. Delete asks for confirmation.

## Off by default

Omit `savedBlocks` and the feature is absent: no save action, no rail entry, and **none of its code is downloaded**. The UI is split into lazily-loaded chunks fetched only when a dialog opens.

## Headless use

The reactive state layer is exported from `@templatical/core` if you want your own UI over a provider:

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

Check `canCreate` / `canUpdateBlock` / `canDeleteBlock` before offering an action in your own UI. Calling a withheld mutation — or one an entry forbids — rejects rather than silently resolving, so a caller can never mistake a refusal for a save.

**Using Templatical Cloud?** It implements this contract with nothing to configure — see [Saved Blocks on Cloud](/cloud/saved-blocks).
