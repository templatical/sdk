---
"@templatical/types": minor
"@templatical/core": minor
"@templatical/editor": minor
---

Provider objects now carry their own configuration and events

Every BYO provider takes its outward events on the provider object itself, next
to the storage methods, instead of as root config callbacks. The type carrying
them is `<Feature>Options`, which `<Feature>Provider` extends — so `init()` takes
the provider, `initCloud()` takes the options, and moving between tiers means
deleting a key rather than rewriting one.

```ts
templates:      { load, create, save,               onSaved, onCreated, onLoaded }
comments:       { list, create, update, delete, setResolved, subscribe,
                  onCreated, onUpdated, onDeleted, onResolved, onUnresolved }
savedBlocks:    { list, create, update, delete,     onCreated, onUpdated, onDeleted }
versionHistory: { list, get, create, restore,       onCreated, onRestored }
testEmail:      { send,                             onSent }
```

Handlers fire once the editor has settled — template adopted, `isDirty` cleared,
`isSaving` false — so a handler may navigate without tripping your own
unsaved-changes guard, which a side effect inside `save()` cannot. A handler that
throws is reported through `onError` and never fails the operation.

**`onSaved` carries the trigger**: `manual` (Save button or Cmd/Ctrl+S),
`autosave`, `rename`, `restore`, or `api`. Gate navigation on
`trigger === "manual"` rather than `trigger !== "autosave"` — a rename commit and
a save-before-restore are both real saves you almost certainly don't want to
navigate on. On Cloud, `toMjml()`, `toHtml()` and sending a test email each
persist first and report `api`.

**Comment handlers carry `{ origin: 'local' | 'remote' }`.** `local` means the
mutation ran through this editor; `remote` means it arrived via `subscribe` —
someone else, in another browser. A "new comments" badge should count `remote`
only.

Payloads worth noting: `savedBlocks.onDeleted` receives the removed block, not an
id, and emits nothing when the id was never loaded locally.
`versionHistory.onRestored` receives the resulting `Template`, not the version it
was restored from.

## Breaking

| Before | After |
|---|---|
| `onComment: (e) => …` | `comments: { onCreated, onUpdated, onDeleted, onResolved, onUnresolved }` |
| `initCloud({ onCreate, onLoad })` | `templates: { onCreated, onLoaded }` |
| `initCloud({ commenting: false })` | `comments: false` |
| `autoSave: { debounce: 5000 }` | `templates: { autoSave: true }` + root `changeDebounce: 5000` |
| `unsavedChangesGuard: false` | `templates: { unsavedChangesGuard: false }` |
| `templateNameField: false` | `templates: { nameField: false }` |
| `TemplatesEvents` | `TemplatesOptions` |
| `CommentEvent`, `CommentEventType` | removed — match on the handler name |

- **`autoSave` is `boolean` only.** Its cadence is the root `changeDebounce?: number`,
  because one timer paces both the save and the `onChange` notification, and
  `onChange` fires with no `templates` provider at all. Set `changeDebounce` alone
  to pace `onChange` by itself.
- **`initCloud`'s `onCreate` / `onLoad` also change when they fire.** They used to
  run inside Cloud's adapter, before the editor adopted the template; `onCreated` /
  `onLoaded` run after, so a handler reading `editor.getContent()` now sees the
  template that just loaded.
- `CommentChange` — the *inward* shape a `subscribe` implementation reports — is
  unrelated and unchanged. Cloud's `commenting` **plan feature** is unchanged; only
  the config key beside it was renamed.

### A transport that echoes your own writes no longer double-fires

A store whose `subscribe` reports your own write back (Pusher's default, most SSE
fan-outs) used to fire `onComment` twice for one comment. A remote change is now
emitted only when it actually alters the loaded list.

**If you de-duplicated by comment id to work around this, remove it** — unless
your transport can echo a write back *before* your mutation's own response
resolves. In that ordering the echo is applied first as `origin: 'remote'` and
your local call still emits `origin: 'local'`, so keep de-duplicating. Everywhere
else the guard now discards real information: a second event on the same comment,
such as an edit after its creation, arrives once. **Templatical Cloud is
unaffected** — its writes carry an `X-Socket-ID` the backend uses to exclude the
sender.

## New on `initCloud()`

`versionHistory` was refused wholesale; it now accepts
`versionHistory?: VersionHistoryOptions`, whose `onCreated` and `onRestored` reach
Cloud's own store. Cloud keeps every storage method — a version is keyed to a
template id Cloud issued, the same reason `templates` and `comments` do.

`savedBlocks: { onCreated }` and `testEmail: { onSent }` are now supported shapes,
meaning Cloud's own store or sender plus your handlers.

## Fixed

- **`savedBlocks: { onCreated }` and `testEmail: { onSent }` crashed on Cloud.**
  `initCloud()` installed such a value directly as the provider, so the first
  browse or first send hit a missing `list` / `send`. Both keys now tell an
  events-only value from a full provider by that method's presence, never by
  `typeof value === "object"`.
- **A plan-gating bypass behind the same bug.** That truthy events-only value read
  as "the consumer brought their own store", skipping Cloud's `saved_modules` /
  `test_email` plan check and granting the feature to plans without it.
  Availability now follows the same discriminated value.
