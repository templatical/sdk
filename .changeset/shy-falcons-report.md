---
"@templatical/types": minor
"@templatical/core": minor
"@templatical/editor": minor
---

Add outward events to `SavedBlocksProvider`, `VersionHistoryProvider` and `TestEmailProvider`, and let `initCloud()` accept `versionHistory`

`savedBlocks`, `versionHistory` and `testEmail` each carry new events, the
same shape `templates`' `onSaved`/`onCreated`/`onLoaded` and `comments`' own
handlers already use:

```ts
savedBlocks: {
  list, create, update, delete,
  onCreated: (block) => {},
  onUpdated: (block) => {},
  onDeleted: (block) => {}, // the removed block itself, not an id
}

versionHistory: {
  list, get, create, restore,
  onCreated: (version) => {},
  onRestored: (template) => {}, // the resulting Template, not the restored-from version
}

testEmail: {
  send,
  onSent: (payload) => {},
}
```

`TestEmailOptions` now carries `includeMjml`, `allowedRecipients` and
`defaultRecipient` alongside `onSent` — those moved off `TestEmailProvider`
directly and onto the options type it extends, which is what lets `initCloud()`
accept a value with no `send` at all. A full `TestEmailProvider` is unchanged.

### `versionHistory` is a new key on `initCloud()`

Previously refused wholesale — passing it did nothing. `initCloud()` now
accepts `versionHistory?: VersionHistoryOptions`: `onCreated` and `onRestored`
reach Cloud's own store, which still owns every storage method (a version is
keyed to a template id Cloud issued, the same reason `templates` and
`comments` keep their own storage on Cloud).

```ts
await initCloud({
  container, auth,
  versionHistory: { onRestored: (template) => navigate(`/templates/${template.id}`) },
});
```

### Fixed — `savedBlocks: { onCreated }` and `testEmail: { onSent }` used to crash on Cloud

For a TypeScript consumer this was a compile error, not a crash: the old,
narrower types required `list` on `savedBlocks` and `send` on `testEmail`,
rejecting an events-only value outright. The type widening above turns that
into supported capability — Cloud's own store or sender, plus your handlers —
which the fix below makes safe to rely on.

`initCloud()` used to install a value shaped like that directly as the
feature's provider. Both are missing the method that makes something a full
provider — `list` for `savedBlocks`, `send` for `testEmail` — so the first
browse or the first send crashed instead of using Cloud's own store or
sender. Both keys now discriminate an events-only value from a full provider
by that method's presence, never by `typeof value === "object"`.

### Fixed — a plan-gating bypass hiding behind the same bug

The same events-only value was truthy, so availability checking read it as
"a consumer supplied their own store" and skipped Cloud's `saved_modules` /
`test_email` plan check entirely — granting the feature to a plan that
doesn't have it. Availability now follows the same discriminated value the
crash fix introduced, so an events-only value stays plan-gated exactly like
Cloud's own store always was.
