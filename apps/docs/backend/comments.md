---
title: Comments
description: A threaded review conversation on a template — over your own storage, or Templatical Cloud's.
---

# Comments

Give the editor a place to read and write comments from and it grows a review panel: threads with replies, per-block anchors, resolve and reopen, and a count badge on every commented block in the canvas.

```ts
import { init } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  templates: myTemplatesProvider,
  user: { id: 'u_7', name: 'Ada Lovelace' },
  comments: {
    list: async (templateId) => {
      const res = await fetch(`/api/templates/${templateId}/comments`);
      return res.json();
    },

    create: async (templateId, input) => {
      const res = await fetch(`/api/templates/${templateId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      return res.json();
    },

    update: async (templateId, commentId, patch) => {
      const res = await fetch(
        `/api/templates/${templateId}/comments/${commentId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        },
      );
      return res.json();
    },
    delete: async (templateId, commentId) => {
      await fetch(`/api/templates/${templateId}/comments/${commentId}`, {
        method: 'DELETE',
      });
    },
    setResolved: async (templateId, commentId, resolved) => {
      const res = await fetch(
        `/api/templates/${templateId}/comments/${commentId}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolved }),
        },
      );
      return res.json();
    },
  },
});
```

**Omitted by default.** With no provider the panel, its trigger and the per-block indicators do not render, and none of that UI is downloaded.

Comments are scoped to a template id, so the panel appears only once `create()` or `load()` has attached one. See [Saving & Loading](/backend/templates).


## Author identity

`user` is a **top-level key**, and comments require it. Without an author the feature reports itself unavailable rather than writing an anonymous comment: no trigger, no panel, no indicators.

```ts
init({ container, user: { id: 'u_7', name: 'Ada Lovelace' } });
```

`user.id` is compared against each comment's `author.id` to decide what may be edited or deleted. `user.name` is shown on comments this session writes.

::: tip Why it sits outside the provider
Collaboration presence needs the same value. A copy inside the comments provider would be the first thing to drift once a second feature wants it.
:::

::: warning Not a security boundary
`user` identifies the person to the editor's UI, in the user's own browser. Attribute writes server-side, from the session your backend already trusts. Nothing here stops a browser claiming a different name.
:::

## The contract

```ts
interface Comment {
  id: string;
  body: string;
  author: { id: string; name: string };
  createdAt: string;
  updatedAt?: string;
  blockId?: string | null;
  parentId?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: { id: string; name: string } | null;
  replies?: Comment[];
}

interface CommentsProvider {
  list(templateId: string, params?: CommentsListParams): Promise<Comment[]>;
  create:      false | ((templateId: string, input: CommentInput) => Promise<Comment>);
  update:      false | ((templateId: string, commentId: string, patch: CommentPatch) => Promise<Comment>);
  delete:      false | ((templateId: string, commentId: string) => Promise<void>);
  setResolved: false | ((templateId: string, commentId: string, resolved: boolean) => Promise<Comment>);
  subscribe?:  (templateId: string, onChange: (change: CommentChange) => void) => () => void;
}
```

`list` cannot be turned off — without it the panel has nothing to show. Each of the four mutations takes `false` in place of a function, and is **required** rather than optional: `false` states that the action is unavailable, and the editor hides it rather than disabling it. See [Read-only review](#read-only-review).

The editor renders `list()`'s order verbatim and never re-sorts. Ordering is your store's call.

### Thread depth

One level. A thread root carries `replies`; a reply never does. Flatten deeper trees in your store.

### `updatedAt`

Present means edited — the panel shows an *(edited)* marker. Set it on edit, **not on creation**: a store that stamps it alongside `createdAt` marks every comment edited.

### `setResolved`

Takes the target state, not a toggle. The call is idempotent, so two clicks in flight cannot leave a thread inverted and your endpoint never has to read current state before writing.

The editor reports the result your store returned, not the state it asked for. A store that refuses to reopen a thread answers "still resolved", and that is what the UI and [`onResolved`](#events) report.

## Read-only review

Withhold all four mutations and the panel stays readable and navigable. Threads and replies render, jump-to-block works, and the composer, resolve, edit and delete affordances are **absent** rather than disabled:

```ts
comments: {
  list: (templateId) => api.comments(templateId),
  create: false,
  update: false,
  delete: false,
  setResolved: false,
}
```

Each is independent: `setResolved: false` alone leaves commenting and editing intact with nothing to resolve; `update: false` alone removes only the pencil.

A programmatic call to a withheld mutation **rejects** rather than resolving — a resolved promise reads as "saved" to whoever awaited it.

Per-comment ownership composes on top: edit and delete are offered only on the current user's own comments, and only where the store supplied those mutations.

## Realtime updates

`subscribe` pushes remote changes into the open panel so a colleague's comment appears without a reload. **Optional** — without it, comments work the same and someone else's appears on the next read.

```ts
subscribe: (templateId, onChange) => {
  const source = new EventSource(`/api/templates/${templateId}/comments/stream`);
  source.onmessage = (event) => onChange(JSON.parse(event.data));
  return () => source.close();
},
```

Return an unsubscribe function; the editor calls it when the template changes and on teardown.

```ts
type CommentChange =
  | { type: 'created'; comment: Comment }
  | { type: 'updated'; comment: Comment }
  | { type: 'deleted'; commentId: string; parentId?: string | null };
```

A delete carries only the id and its parent — there is no comment left to send, and the parent saves the editor a lookup.

Your own writes may echo back through here, and need **no de-duplication on your side**: a `created` for a comment already in the list is ignored, and an `updated` replaces it in place.

## Filtering

The panel filters **in memory** over whatever `list()` returned — unresolved (the default), all, or this block. Your provider decides what is visible; the editor decides how it is narrowed within that.

`CommentsListParams` is reserved for future *filters* and is empty today; the editor always calls `list` bare.

::: tip Comments are deliberately not paginated
`list` returns every thread at once. The unresolved badge and the per-block canvas counts are derived over the whole list, so a partial page would make both under-report silently — wrong rather than slow. A long-lived template caps its own growth by having `list()` stop returning resolved threads past some age; the panel hides those by default anyway. [Version history](/backend/version-history#pagination) does page, because its list is a flat menu with nothing aggregating over it.
:::

## In the editor

- **A Comments button** in the header, badged with the unresolved thread count. It appears once a template is loaded and the feature is available.
- **A comment indicator on each commented block**, showing that block's count. Clicking it opens the panel filtered to that block.
- **The panel** on the right: thread cards with author, relative time, an *(edited)* marker, the resolve toggle, and reply / edit / delete where the store allows them.
- **A "missing block" badge** on a comment whose anchor block no longer exists, so an orphaned thread reads as orphaned rather than as a mystery.

## Events

```ts
comments: {
  // ...list, create, update, delete, setResolved
  onCreated:    (comment, { origin }) => {},
  onUpdated:    (comment, { origin }) => {},
  onDeleted:    (comment, { origin }) => {},
  onResolved:   (comment, { origin }) => {},
  onUnresolved: (comment, { origin }) => {},
}
```

`origin` is `'local'` for a write this editor made — `create`, `update`, `delete` or `setResolved`, called through the editor's own UI or `useComments`. It is `'remote'` for a change that arrived through [`subscribe`](#realtime-updates): someone else, in another browser.

A "new comments" badge outside the editor should count `remote` only. Counting `local` too increments a user's own unread count on their own comment.

Which of `onResolved` / `onUnresolved` fires is decided by the **stored** result's `resolvedAt`, not the state the call requested — a store that refuses to reopen a thread still reports `onResolved`.

::: tip Handlers usually fire once per change
A transport that echoes a write back to its sender — `subscribe`'s contract permits it — is compared against the stored comment: an echo that changes nothing is applied silently, with no event.

That bound holds for an echo that lands **after** the mutation's own response. One that arrives first applies as `origin: 'remote'`, and the local call still emits its own `origin: 'local'` event once its response settles — two events for one write, the first attributed to the wrong origin. Keep de-duplicating on your side if your transport can echo that early.

**Templatical Cloud is unaffected.** `createCloudCommentsProvider` stamps every write with an `X-Socket-ID` header, and Cloud's backend excludes that connection when it fans the change back out, so no early echo reaches this editor.
:::

A handler that throws is caught and reported to `onError` — it never fails the write that triggered it.

## Headless use

`useComments` from `@templatical/core` is the reactive state on its own, without the editor:

```ts
import { useComments } from '@templatical/core';

const comments = useComments({
  provider: myCommentsProvider,
  getTemplateId: () => currentTemplateId,
  getUser: () => currentUser,
  onError: (error) => console.error(error),
});

await comments.load();
comments.comments.value;                    // Comment[] — thread roots with replies
comments.unresolvedCount.value;             // number
comments.commentCountByBlock.value;         // Map<string, number>
await comments.create({ body: 'Looks good' });
await comments.setResolved('c_1', true);
```

The handlers from [Events](#events) are members of `myCommentsProvider` itself — the same object `list` / `create` / `update` / `delete` / `setResolved` live on — so one object satisfies `init()` and `useComments` alike.

`useCommentListener` wires a provider's `subscribe` into the same state, and is a no-op for a provider without one:

```ts
import { useCommentListener } from '@templatical/core';

useCommentListener({
  comments,
  provider: myCommentsProvider,
  getTemplateId: () => currentTemplateId,
});
```

**Using Templatical Cloud?** It implements this contract with nothing to configure — see [Comments on Cloud](/cloud/comments).
