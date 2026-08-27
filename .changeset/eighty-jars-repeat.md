---
"@templatical/types": minor
"@templatical/core": minor
"@templatical/editor": minor
---

Provider objects now carry their own configuration and events

Every BYO provider takes its outward events on the provider object itself, next
to the storage methods, instead of as root config callbacks:

```ts
templates:      { load, create, save,               onSaved, onCreated, onLoaded }
comments:       { list, create, update, delete, setResolved, subscribe,
                  onCreated, onUpdated, onDeleted, onResolved, onUnresolved }
savedBlocks:    { list, create, update, delete,     onCreated, onUpdated, onDeleted }
versionHistory: { list, get, create, restore,       onCreated, onRestored }
testEmail:      { send,                             onSent }
```

Each provider's events and configuration are declared on a `<Feature>Options`
type that `<Feature>Provider` extends, so a bundle of handlers can be typed and
passed around on its own.

Handlers fire once the editor has settled — template adopted, `isDirty` cleared,
`isSaving` false — so a handler may navigate without tripping your own
unsaved-changes guard, which a side effect inside `save()` cannot. A handler that
throws is reported through `onError` and never fails the operation.

**`onSaved` carries the trigger**: `manual` (Save button or Cmd/Ctrl+S),
`autosave`, `rename`, `restore`, or `api`. Gate navigation on
`trigger === "manual"` rather than `trigger !== "autosave"` — a rename commit and
a save-before-restore are both real saves you almost certainly don't want to
navigate on.

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
| `autoSave: { debounce: 5000 }` | `templates: { autoSave: true }` + root `changeDebounce: 5000` |
| `unsavedChangesGuard: false` | `templates: { unsavedChangesGuard: false }` |
| `templateNameField: false` | `templates: { nameField: false }` |
| `TemplatesEvents` | `TemplatesOptions` |
| `CommentEvent`, `CommentEventType` | removed — match on the handler name |

- **`autoSave` is `boolean` only.** Its cadence is the root `changeDebounce?: number`,
  because one timer paces both the save and the `onChange` notification, and
  `onChange` fires with no `templates` provider at all. Set `changeDebounce` alone
  to pace `onChange` by itself.
- `CommentChange` — the *inward* shape a `subscribe` implementation reports — is
  unrelated and unchanged.

### A transport that echoes your own writes no longer double-fires

A store whose `subscribe` reports your own write back (Pusher's default, most SSE
fan-outs) used to fire `onComment` twice for one comment. A remote change is now
emitted only when it actually alters the loaded list.

**If you de-duplicated by comment id to work around this, remove it** — unless
your transport can echo a write back *before* your mutation's own response
resolves. In that ordering the echo is applied first as `origin: 'remote'` and
your local call still emits `origin: 'local'`, so keep de-duplicating. Everywhere
else the guard now discards real information: a second event on the same comment,
such as an edit after its creation, arrives once.
