---
title: Version History
description: Browse, preview and restore a template's past versions — over your own storage, or Templatical Cloud's.
---

# Version History

Give the editor a place to read versions from and it grows a history control in the header: step back through past states, preview one on the canvas, and restore it.

```ts
import { init } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  templates: myTemplatesProvider,
  versionHistory: {
    list: async (templateId) => {
      const res = await fetch(`/api/templates/${templateId}/versions`);
      return { versions: await res.json() };
    },

    get: async (templateId, versionId) => {
      const res = await fetch(
        `/api/templates/${templateId}/versions/${versionId}`,
      );
      const version = await res.json();
      return version.content;
    },

    create: false,

    restore: async (templateId, versionId) => {
      const res = await fetch(
        `/api/templates/${templateId}/versions/${versionId}/restore`,
        { method: 'POST' },
      );
      return res.json();
    },
  },
});
```

**Omitted by default.** With no provider the control does not render and none of its UI is downloaded.

Versions are scoped to a template id, so the control appears only once `create()` or `load()` has attached one. See [Saving & Loading](/backend/templates).

## The contract

```ts
interface TemplateVersion {
  id: string;
  createdAt: string;
  isAutomatic?: boolean;
  label?: string;
  author?: { id?: string; name?: string };
  content?: TemplateContent;
}

interface VersionHistoryProvider {
  list(templateId: string, params?: VersionHistoryListParams): Promise<VersionHistoryListResult>;
  get(templateId: string, versionId: string): Promise<TemplateContent>;
  create:  false | ((templateId: string, content: TemplateContent, meta?: { label?: string }) => Promise<TemplateVersion>);
  restore: false | ((templateId: string, versionId: string) => Promise<Template>);
}
```

`list` and `get` cannot be turned off — the editor must always be able to show a version and fetch its content. `create` and `restore` each take `false` in place of a function, and are **required** rather than optional: `false` states that the action is unavailable, and the editor hides it rather than disabling it. `restore: false` leaves the history browsable with no Restore button; `create: false` means only your `save` records versions.

The editor renders `list()`'s order verbatim and never re-sorts. Ordering is your store's call.

::: warning Not a security boundary
These flags live in the user's browser. They shape the UI; they do not protect your API. Restoring overwrites the current template, so enforce server-side who may call it — and who may read a version's content, which is a past state of a document they may no longer have access to.
:::

## Recording versions

**The editor never records a version by itself.** Whichever `TemplatesProvider.save` you supply decides whether a save also records one:

```ts
const templates = {
  load: (id) => db.templates.get(id),
  create: (input) => db.templates.insert(input),
  save: async (id, patch) => {
    const template = await db.templates.update(id, patch);
    // Your call, your storage, your throttle.
    if (patch.content) await db.versions.insert({ id, content: patch.content });
    return template;
  },
};
```

`create` exists for versions a *person* asks for — a named checkpoint before a risky edit. The editor never calls it on its own. The rule is literal: nothing the editor does, including restoring, records a version behind your back.

::: tip Why the editor stays out of it
Throttling, retention and dedupe are decisions only the side paying for the storage can make. An editor that recorded a version per autosave tick would turn history into a keystroke log on someone else's disk.
:::

The one hazard this leaves — a restore discarding unsaved work — the editor handles by asking rather than by writing. See [Restoring](#restoring).

## Restoring

Restore is **append-only**: it adds an entry rather than rewriting one. Undo stays coherent, and two different backends cannot end up disagreeing about what history looks like afterwards.

A store with no atomic restore endpoint composes one in a line:

```ts
restore: async (templateId, versionId) => {
  const content = await versions.get(templateId, versionId);
  return templates.save(templateId, { content });
},
```

Two round-trips and a slightly wider failure window — and, because your `save` records a version, append-only for free.

With `restore: false` the history stays browsable and previewable, and the Restore button does not render.

### Unsaved changes

Cancelling a preview puts your work back; confirming a restore does not. The backup is discarded, so anything unsaved would exist nowhere afterwards.

Restore therefore asks first when there are unsaved changes, and offers to **save them before restoring**. The work then enters history the ordinary way, through your `templates.save` — user-initiated, and only if your `save` records versions at all.

Without a `templates` provider, or with one whose `save` is `false`, the offer isn't made: the confirmation says the changes will be lost, because there is nowhere to put them. With no unsaved changes, Restore goes through immediately.

## The `content` hint

Once a preview is open, stepping to another version swaps the canvas immediately — provided the content is already in hand. That is what the optional `content` field on each entry is for:

```ts
list: async (templateId) => {
  const rows = await db.versions.forTemplate(templateId);
  return rows.map((row, index) => ({
    id: row.id,
    createdAt: row.createdAt,
    isAutomatic: row.automatic,
    // Hydrate the recent ones; let the rest cost a round-trip.
    ...(index < 20 ? { content: row.content } : {}),
  }));
},
```

It is a **cache hint, never an alternative to `get`**, and it is evaluated per entry — hydrating recent versions and omitting older ones is a supported middle ground. When it is absent the editor calls `get` once for that version and caches the result, so only the first visit waits.

`get` stays required: the editor must always be able to obtain a version's content, whether or not the hint is there.

## In the editor

- **The history control** sits in the header next to the viewport and preview toggles: arrows to step older and newer, and a dropdown listing every version with a relative timestamp, its label if it has one, and an *auto* badge for save-recorded ones.
- **The preview banner** appears while a past version is on the canvas, with Cancel and Restore.
- **Cancel** puts back exactly what you were editing, including unsaved changes. Autosave is paused for the duration of a preview, so a previewed version is never mistaken for your work and saved over it.
- **Restore** confirms first when there are unsaved changes — see [Unsaved changes](#unsaved-changes).

## Pagination

`list` takes `{ limit?, cursor? }` and resolves to an envelope:

```ts
type VersionHistoryListResult = { versions: TemplateVersion[]; nextCursor?: string };
```

The editor loads one page and calls `list` bare — it never sends `limit` or `cursor`, and it ignores `nextCursor`. A store that returns its whole history at once omits `nextCursor` and is finished.

The envelope exists so that adding pagination later is not a breaking change: a cursor has somewhere to live from day one. Reserving only the params object would have covered the request and left the response needing a new shape. `useVersionHistory` exposes `nextCursor` for headless callers that do page — see [Headless use](#headless-use).

## Events

```ts
versionHistory: {
  list, get, create, restore,
  onCreated:   (version) => {},
  onRestored:  (template) => {},
}
```

`onCreated` fires once `create()` resolves, with the recorded `TemplateVersion`. `onRestored` fires once `restore()` resolves, with the resulting `Template` rather than the `TemplateVersion` that was restored from — the caller already has that version's id, since it's what `restore(templateId, versionId)` was given.

A handler that throws is caught and reported to `onError` — it never fails the create or restore that triggered it.

## Headless use

`useVersionHistory` from `@templatical/core` is the reactive state on its own, without the editor:

```ts
import { useVersionHistory } from '@templatical/core';

const history = useVersionHistory({
  provider: myVersionHistoryProvider,
  getTemplateId: () => currentTemplateId,
  onError: (error) => console.error(error),
});

await history.load();
history.versions.value;                      // TemplateVersion[] — this page
history.nextCursor.value;                    // string | undefined — pass back as { cursor }
history.peekContent(v);                      // TemplateContent | null — no round-trip
await history.resolveContent(v);             // the hint, or get(), cached
await history.restore(v.id);
```

**Using Templatical Cloud?** It implements this contract with nothing to configure — see [Version History on Cloud](/cloud/version-history).
