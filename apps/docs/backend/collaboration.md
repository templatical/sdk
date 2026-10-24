---
title: Collaboration
description: Live co-editing over your own backend — ordered operations, presence and block locks.
---

# Collaboration

Give the editor a collaboration provider and several people can edit one template at once. Every edit reaches your backend as a batch of [operations](/api/operations), your backend puts the batches in one order, and every editor applies them in that order. Selecting a block locks it, so two people never type into the same block, and everyone sees who else has the template open.

```ts
import { init } from '@templatical/editor';

let sessionId = '';

const editor = await init({
  container: '#editor',
  user: { id: 'u_7', name: 'Ada Lovelace' },
  templates: myTemplatesProvider, // `load` returns the template's `revision`
  collaboration: {
    join: (templateId, session, handlers) => {
      sessionId = session.sessionId;
      return myRealtime.join(templateId, session, handlers);
    },
    submit: (templateId, batch) =>
      api(`/api/templates/${templateId}/operations`, {
        method: 'POST',
        headers: { 'X-Session-Id': sessionId },
        body: JSON.stringify(batch),
      }),
    operationsAfter: (templateId, revision) =>
      api(`/api/templates/${templateId}/operations?after=${revision}`, {
        headers: { 'X-Session-Id': sessionId },
      }),
    acquireLock: (templateId, blockId) =>
      api(`/api/templates/${templateId}/locks`, {
        method: 'POST',
        headers: { 'X-Session-Id': sessionId },
        body: JSON.stringify({ blockId }),
      }),
    renewLock: (templateId, blockId) =>
      api(`/api/templates/${templateId}/locks/${blockId}`, {
        method: 'PUT',
        headers: { 'X-Session-Id': sessionId },
      }),
    releaseLock: async (templateId, blockId) => {
      await fetch(`/api/templates/${templateId}/locks/${blockId}`, {
        method: 'DELETE',
        headers: { 'X-Session-Id': sessionId },
        keepalive: true,
      });
    },
  },
});

await editor.load('tpl_123');
```

`api` is your own fetch helper; a refused request must reject with the HTTP status as `statusCode` and the response's `code`, `holder` and `holders` (see [Refusals](#refusals)), because a missing status counts as a network failure and is retried.

The backend combines `X-Session-Id` with the authenticated user to identify the lock owner.

## What the editor does

- **Sends every edit as operations.** The editor compares the canvas with what it last sent and turns the difference into a batch: a drag becomes a `moveBlock`, typing an `updateBlock`. Typing into one block waits for a 300 ms pause, at most a second; everything else goes at once. One batch is in flight at a time, so a session's batches arrive in order, and a batch that fails in transit is sent again with the same `batchId`.
- **Applies everyone's batches in revision order.** Batches from other sessions are buffered and applied strictly by revision, with this session's unconfirmed edits replayed on top. A gap that isn't filled within a second is fetched with `operationsAfter`.
- **Locks the selected block.** Selecting a block takes its lock; another session's locked block shows its holder's name and colour and can't be selected. Locks renew every 10 seconds and are released on deselect, on loading another template and when the page closes.
- **Shows who is here.** The header shows one avatar per person: a user's sessions in several tabs count once, and each guest counts on their own.
- **Turns merge tags in arriving batches into tags.** A batch from another session — an agent's, another editor's, a server's — has the bare tokens in its titles and paragraphs converted as it arrives, the way [loaded content](/guide/merge-tags#tokens-in-loaded-content) is, and nothing is sent back for it. Arriving batches apply without their `expect`: your backend checked those against its own copy.
- **Shows agents' edits.** A batch whose actor has `type: 'mcp'` shows a notice naming `actor.client` and `actor.name` ("Claude for Ada changed 3 blocks") and outlines the blocks it changed for 2 seconds. A re-sync whose `actor` has `type: 'mcp'` shows "Claude for Ada updated the template", with no outline. Batches and re-syncs from one agent within 2 seconds share a notice. Agents need no presence and take no locks.
- **Shows the AI's edits.** A batch with `actor.type: 'ai'` shows "AI (for Ada) changed 3 blocks" and outlines the changed blocks. A re-sync shows a template-update notice without its own block outline. The requesting session sees only a batch's outline, with no notice. An [AI provider](/backend/ai)'s operations reach your backend as this user's batches with `origin: 'ai'`.
- **Undoes with operations.** Undo and redo send the inverse of your own batches, each guarded by what it expects to find. An undo that someone else's edit has overtaken is refused and skipped with a notice, never applied over their work. Other people's edits never enter your undo history.
- **Saves only renames.** Content reaches your backend through `submit`, so `templates.save` receives only a new name, after the editor's batches are confirmed. Autosave keeps working: it settles the batches and renames if needed.
- **Tells the user** when a selection or an edit was refused, when an undo step was skipped, when a version can't be restored because others hold locks, and while the connection is down.

## The contract

<<< @/snippets/collaboration-contract.ts

The declarations give every field, optional value and nullability. `OperationBatch.ops` holds 1–100 operations in application order; `batchId` is an editor-generated UUID. `RevisionedBatch.createdAt` is optional; use ISO 8601 if your backend supplies a timestamp. `BlockLock.expiresAt` is ISO 8601. Because renewals are not broadcast, another session removes a lock on release or session departure, never by that time. `CollaborationActor.id` is `null` for `api`, `sessionId` is `null` for `api` and `mcp`, and `CollaborationMember.userId` is `null` for guests.

### `join`

Called when a template is loaded, with this editor's session id (a UUID the editor makes). Subscribe to the template's events, then answer with its current revision, the unexpired locks and everyone with it open, this session included. Call the handlers for everything that happens afterwards; `leave()` stops them.

`join` is called again for the same template after a reconnect: answer with fresh state without subscribing twice. Call `onConnectionChange` when your realtime connection drops and comes back; the editor re-joins and catches up on `connected`.

### `submit`

Apply the batch's operations to the template, in order and all or nothing, then answer with the revision it produced. `baseRevision` is the last revision the editor had confirmed; batches are applied to the current content whatever it is, which is what the operations' sibling anchors and preconditions are for. A `batchId` you have already applied answers with that batch's revision and applies nothing, because the editor resends after a failure in transit. Send the batch to every other session with `onBatch`, with its revision and actor.

### `operationsAfter`

Answer with every batch after `revision`, in order. When you no longer have them all, answer `{ revision, resync: true }` and the editor reloads the template through `templates.load`. Call `onResync(revision, actor)` for a change batches can't describe, such as a `setContent`, a restored version or a broadcast too large for your transport. `actor` is who made the change, in the shape of a batch's; the editor uses it only for an agent's or the AI's notice, and leaving it out changes nothing else.

### Locks

`acquireLock` grants the lock or refuses with `lock_held` and the holder; `renewLock` extends it or refuses with `lock_lost`; `releaseLock` lets it go and never fails. Send `onLock` and `onUnlock` to the other sessions. The three methods are optional together: without them the editor takes no locks.

### Refusals

The editor reads `statusCode` for retry classification, plus `code` and `holder` or `holders` for refusals. `CollaborationConflict` from `@templatical/types` carries them, and any error with the same fields works.

| `code` | From | The editor |
|---|---|---|
| any of the [operation errors](/api/operations#errors) | `submit` | Drops the batch, puts back your backend's state and says the change wasn't saved, naming the holder for `lock_held` |
| `content_too_large` | `submit` | Drops the batch and says the change was too large |
| `lock_held` (with `holder`) | `acquireLock` | Deselects and says who is editing the block |
| `lock_lost` | `renewLock` | Takes the lock again if the block is still selected |

Network errors, 5xx, 408 and 429 are retried with the same `batchId` after 1, 2, 5, 10 and 30 seconds.

## Templates

With a collaboration provider, `templates.load` must return the template's `revision` along with its content, and may return its unexpired `locks`. `templates.save` receives only `{ name }`; the content is already on your backend. `create` works as usual and starts a template at revision 0.

## Building a backend

### Applying a batch

When a batch carries `origin: 'ai'`, broadcast it with `actor.type: 'ai'`, the same `id`, `name` and `sessionId`; the editors name it as the AI's. The playground's host does this.

```ts
import { applyOperations, OperationError } from '@templatical/types';

app.post('/api/templates/:id/operations', async (req, res) => {
  const { batchId, ops } = req.body;
  const sessionId = req.get('X-Session-Id') ?? null; // however you identify it
  const template = await db.templates.lockForUpdate(req.params.id);

  const known = await db.batches.find(template.id, batchId);
  if (known) return res.json({ revision: known.revision });

  const locks = await db.locks.unexpired(template.id);
  let content;
  try {
    content = applyOperations(template.content, ops, {
      locks: locks.map((lock) => ({ blockId: lock.blockId, sessionId: lock.owner })),
      session: sessionId ? ownerOf(req.user, sessionId) : null,
    });
  } catch (error) {
    if (!(error instanceof OperationError)) throw error;
    return res.status(error.code === 'invalid_operation' ? 422 : 409).json({
      message: error.message,
      code: error.code,
      opIndex: error.opIndex,
    });
  }

  const revision = template.revision + 1;
  await db.templates.update(template.id, { content, revision });
  const batch = { revision, batchId, actor: actorOf(req.user, sessionId), ops };
  await db.batches.insert(template.id, batch);
  realtime.toOthers(template.id, sessionId, 'batch', batch);
  res.json({ revision });
});
```

Serialize the batches of one template: two applied at once would both read the same revision. Run the same `applyOperations` the editor runs, so a batch the editor considered valid is valid on your server too.

### Locks and ownership

A lock belongs to a session and to the identity behind it together: the user id, or `guest:<sessionId>` for a session without a user. Compare both, as `ownerOf` does above, so a session id borrowed from another user's request can't act on their lock. Give locks a short expiry (Templatical Cloud uses 30 seconds; the editor renews every 10), and when a session takes a new block, release the block it held before. Leave lock checks to `applyOperations`: pass every unexpired lock with its owner, and the acting owner as `session`.

### Catching up

Keep recent batches for `operationsAfter`. How many is up to you: when an editor asks for revisions you no longer have, answer `resync` and it reloads the template.

### Presence

Members are sessions, not users: the same user in two tabs is two members, and the editor groups them. Give each member a colour that stays the same for the same person everywhere, for example from a hash of the user id.

## Without realtime

A backend without a realtime channel can still collaborate in order: `join` answers with the revision and empty `locks` and `members` and never calls a handler, and the provider has no lock methods. Every edit still goes through `submit`, refusals still work, and other people's edits appear when the template is loaded again.

## Events

`init({ onRemoteChange })` is called with `{ actor, ops }` after another session's batch is applied on the canvas. It isn't called for this editor's own edits, nor for a re-sync that reloads the template.

## In the playground

The **Collaboration** setup runs this contract between browser tabs, over a backend built on `applyOperations` in a shared worker. Open it in two tabs, and add `?user=Ada` to one to sign it in.

[Open in playground](https://play.templatical.com/scenes/collaboration)
