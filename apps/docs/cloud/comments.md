---
title: Comments
description: Templatical Cloud as one implementation of the comments contract.
---

# Comments

Comments are an [open contract](/backend/comments). Templatical Cloud implements it, the same way your own backend would.

```ts
const editor = await initCloud({ container: '#editor', auth: { url: '/api/token' } });
```

Nothing to configure. Cloud supplies the provider and the identity, and the header's Comments button appears as soon as a template is saved.

## What Cloud's adapter does

| Method | Cloud |
|---|---|
| `list` | Every thread for the template, each with its replies |
| `create` | Stores a comment or a reply, **signed** with the token's user claim |
| `update` | Edits a comment's body |
| `delete` | Removes a comment, and a root's replies with it |
| `setResolved` | Marks a thread resolved or reopened |
| `subscribe` | Binds Cloud's realtime channel, so a colleague's comment appears as they write it |

All four mutations are enabled: comment storage and its realtime fan-out are what the `commenting` plan feature pays for, so there is no Cloud tier that can read a thread but not reply to it.

## Availability

Three conditions, and none implies another:

- **`commenting: false`** switches the feature off entirely.
- **The `commenting` plan feature** must be granted.
- **The template must be saved.** Cloud anchors a comment server-side, so there has to be a stored template to anchor it to — the Comments button does not render before the first save.

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  commenting: false, // off
  onComment: (event) => {
    // 'created' | 'updated' | 'deleted' | 'resolved' | 'unresolved'
    console.log(event.type, event.comment.id);
  },
});
```

## The author is signed, not supplied

Cloud sends `user_id` / `user_name` / `user_signature` with every write, taken from the auth token's `user` claim and verified by its backend. So `initCloud()` accepts **no `user` key**: it fills `init({ user })` from that same claim, and a browser-supplied identity could only disagree with the one the server trusts.

A project whose token endpoint omits the `user` claim gets no comments feature at all — [unavailable rather than anonymous](/backend/comments#user-is-required-and-it-is-a-top-level-key).

## Bringing your own

You can't, inside `initCloud()` — the same boundary [`templates`](/backend/templates) and [version history](/cloud/version-history) draw, for the same reason.

A comment is keyed to a template id **Cloud issued**, and its author is signed by Cloud's token. A consumer-supplied provider would drive the UI while Cloud's own store stayed the one the server writes to and bills for.

`initCloud({ comments })` is therefore not on the config type, and a provider passed from JavaScript is ignored with a console warning.

Bring your own with [`init()`](/backend/comments), where the whole set — templates, version history, comments, rendering — is yours.

## Headless use

`useComments` and `useCommentListener` moved to `@templatical/core` when comments became a shared feature; they take a provider rather than an `authManager`. Cloud's adapter is `createCloudCommentsProvider` from `@templatical/core/cloud`:

```ts
import { useComments, useCommentListener } from '@templatical/core';
import { createCloudCommentsProvider } from '@templatical/core/cloud';

const provider = createCloudCommentsProvider({
  authManager,
  channel,                                 // Ref<PresenceChannel | null>
  getSocketId: () => websocket.getSocketId(),
});

const comments = useComments({
  provider,
  getTemplateId: () => templateId,
  getUser: () => ({ id: authManager.userConfig.id, name: authManager.userConfig.name }),
});

useCommentListener({ comments, provider, getTemplateId: () => templateId });
```

See the [comments guide](/backend/comments#headless-use) for the full reactive surface.
