---
"@templatical/types": minor
"@templatical/core": minor
"@templatical/editor": minor
---

Replace the root `onComment` callback with five named events on the `comments` provider, and stop a double-fire on echoing transports

`onComment` is gone from both `init()` and `initCloud()`. The `comments`
provider now carries `onCreated`, `onUpdated`, `onDeleted`, `onResolved` and
`onUnresolved` directly — the same shape `templates`' `onSaved` / `onCreated`
/ `onLoaded` already use — instead of a single callback switching on a `type`
field.

```ts
// Before
init({
  comments: myProvider,
  onComment: (event) => {
    if (event.type === 'created') incrementUnread();
  },
});

// After
init({
  comments: {
    ...myProvider,
    onCreated: (comment, { origin }) => {
      if (origin === 'remote') incrementUnread();
    },
  },
});
```

Each handler's second argument is `{ origin: 'local' | 'remote' }`. `local`
means the mutation ran through this editor's own `create` / `update` /
`delete` / `setResolved`; `remote` means it arrived through the provider's
`subscribe` — someone else, in another browser. **A "new comments" badge
should count `remote` only** — counting `local` too increments a user's own
unread count on their own comment, a distinction `event.type` had no way to
carry.

### Breaking — `onComment` and `CommentEvent` are gone

- **`onComment` is removed from `TemplaticalEditorConfig` and
  `TemplaticalCloudEditorConfig`.** Move each handler onto the `comments`
  provider object, matching on the handler name instead of `event.type`.
- **`CommentEvent` and `CommentEventType` are removed from
  `@templatical/types`.** `CommentChange` — the *inward* shape a `subscribe`
  implementation reports — is unrelated and unchanged.
- **Cloud's `commenting?: boolean` is gone, collapsed into
  `comments?: false | CommentsOptions`.** Omit the key for Cloud's store,
  pass `false` to turn it off regardless of plan, or pass an options object
  for Cloud's store plus your handlers.

  ```ts
  // Before
  initCloud({ commenting: false, onComment: (event) => {} });

  // After
  initCloud({ comments: false });
  ```

  The `commenting` **plan feature** is unchanged and still gates entitlement
  on Cloud — this only renames the config key that used to sit beside it.

### Breaking — a transport that echoes your own writes no longer double-fires

A store whose `subscribe` reports your own write back to you (Pusher's
default, most SSE fan-outs) used to fire `onComment` **twice** for one
comment — once for the local write, once for the echo. A change arriving
through `subscribe` is now emitted only when it actually alters the loaded
list, so an echo that lands **after** your mutation's own response is
silently absorbed instead of re-reported.

That bound holds only for that ordering. If your echo can arrive **before**
your mutation's response resolves, it is applied first as `origin: 'remote'`
and your local call still emits its own `origin: 'local'` event once its
response lands — two events for one write, the first attributed to the wrong
origin. **Templatical Cloud is unaffected**: `createCloudCommentsProvider`
stamps every write with an `X-Socket-ID` header that Cloud's backend uses to
exclude the sender, so no early echo ever reaches this editor.

**If your own handler de-duplicated by comment id to work around the
double-fire, remove it unless your transport can echo a write back before
your mutation resolves** — in that case, keep de-duplicating on your side.
Elsewhere, that guard now discards real information: a second event on the
same comment — an edit after its creation, a resolve after an edit — arrives
once, and a leftover id-based guard would drop it.
