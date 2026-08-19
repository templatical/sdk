---
"@templatical/types": minor
"@templatical/core": minor
"@templatical/editor": minor
---

Comments become a bring-your-own provider, and the editor learns who is using it.

`init()` takes a new `comments?: CommentsProvider` key. Configure it — together with the new top-level `user` key — and the editor grows a review panel: threads with replies, per-block anchors, resolve and reopen, a count badge on every commented block. Omit it and none of that UI is downloaded.

```ts
init({
  container,
  templates: myTemplatesProvider,
  user: { id: "u_7", name: "Ada Lovelace" },
  comments: {
    list: (templateId) =>
      fetch(`/api/templates/${templateId}/comments`).then((r) => r.json()),
    create: (templateId, input) =>
      fetch(`/api/templates/${templateId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }).then((r) => r.json()),
    update: (templateId, commentId, patch) =>
      fetch(`/api/templates/${templateId}/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then((r) => r.json()),
    delete: async (templateId, commentId) => {
      await fetch(`/api/templates/${templateId}/comments/${commentId}`, { method: "DELETE" });
    },
    setResolved: (templateId, commentId, resolved) =>
      fetch(`/api/templates/${templateId}/comments/${commentId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved }),
      }).then((r) => r.json()),
  },
});
```

`list` is the operation and cannot be disabled; `create`, `update`, `delete` and `setResolved` each take `false` instead of a function, so turning one off is a decision you state rather than something you get by forgetting a method. Withhold all four and you get a genuine read-only review: threads and replies render, jump-to-block works, and the composer, resolve, edit and delete affordances are **absent** rather than disabled. The composable rejects a withheld mutation rather than no-opping, because a resolved promise reads as "saved" to whoever awaited it.

**`setResolved` takes the target state, not a toggle** — idempotent, so two clicks in flight can't leave a thread inverted. The editor reports whatever your store returned rather than what it asked for, so a store that refuses to reopen a thread is believed.

### `user` — a new top-level config key

```ts
init({ container, user: { id: "u_7", name: "Ada Lovelace" } });
```

Comments are the first feature to need "who are you" (the panel compares `user.id` against each comment's `author.id` to decide what may be edited or deleted), and collaboration presence will want the same answer — so it is a top-level key rather than part of the comments provider, where a second copy would inevitably drift.

**With no `user`, comments report themselves unavailable — never anonymous.** No trigger, no panel, no indicators. An unattributable comment is worse than no comment feature, the same reasoning that makes an explicitly empty `TestEmailProvider.allowedRecipients` disable test email rather than fall through to free text. Not a security boundary: attribute writes server-side.

### Realtime is optional

`CommentsProvider.subscribe` is optional and pushes remote changes into the open panel. **Comments without it work identically** — you simply see a colleague's on the next read rather than immediately:

```ts
subscribe: (templateId, onChange) => {
  const source = new EventSource(`/api/templates/${templateId}/comments/stream`);
  source.onmessage = (e) => onChange(JSON.parse(e.data));
  return () => source.close();
},
```

Your own writes may echo back through it with no de-duplication on your side: a `created` for a comment already in the list is ignored, and an `updated` replaces it in place.

### `initCloud()` rejects a consumer-supplied `comments`

Exactly as it rejects `templates` and `versionHistory`: a comment is keyed to a template id Cloud issued, and its author is signed by the auth token, so Cloud owns the conversation. One passed from JavaScript is ignored with a console warning. `initCloud()` takes no `user` key either — it fills `init({ user })` from the token's `user` claim, the same claim its backend verifies. Switch the feature off with `commenting: false`.

Cloud's availability now folds three conditions, none implying another: `commenting: false`, the `commenting` plan feature, and **the template being saved** (Cloud anchors a comment server-side). The last is new — the button previously rendered before the first save.

### Breaking — the comments API

| Before | After |
| --- | --- |
| `Comment` (`@templatical/types`) — snake_case | `CommentResponse` — still Cloud's wire shape. The contract shape is the new camelCase `Comment` |
| `CommentThread` | **Removed.** It was an alias for `Comment` |
| `useComments` (`@templatical/core/cloud`) | `useComments` in `@templatical/core`, shared by both tiers, taking a `provider` + `getUser` instead of an `authManager` |
| `loadComments` / `addComment` / `editComment` / `removeComment` / `toggleResolve` | `load` / `create` / `update` / `remove` / `setResolved` — and each **rejects** on failure instead of returning `null`/`false` |
| `useCommentListener({ comments, channel })` (`@templatical/core/cloud`) | `useCommentListener({ comments, provider, getTemplateId })` in `@templatical/core` — driven by the provider's `subscribe`, so it knows nothing about Pusher |
| `CommentBroadcastPayload` | **Removed.** Cloud's broadcast shape is internal to its adapter now |
| `comments.*` translation keys (cloud chunk) | `comments.*` in the **OSS** chunk, in all seven OSS locales |

`CommentEvent` / `CommentEventType` keep their names and now carry the camelCase `Comment`. New export: `createCloudCommentsProvider` (plus `RealtimeChannel`, the structural channel shape its `subscribe` binds — named structurally so the optional `pusher-js` peer stays optional).

Two dead translation keys (`comments.addComment`, `comments.resolved`) were dropped rather than carried across, and `comments.jumpToBlock` replaces the one hard-coded English string the panel had.

### Shared rather than cloud-only

`CommentsSidebar` moved out of `cloud/components/`, the Comments trigger moved from `CloudHeaderExtras` into the shared header, and both are lazily loaded behind the capability — so an OSS consumer without a provider pays nothing for them. `capabilities.comments` is now built by the shared feature and gained `isAvailable`, `unresolvedCount` and the four `can*` flags.