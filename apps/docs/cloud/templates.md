---
title: Templates
description: Templatical Cloud as one implementation of the saving-and-loading contract.
---

# Templates

Saving and loading is an [open contract](/backend/templates). Templatical Cloud implements it, the same way your own backend would.

```ts
const editor = await initCloud({ container: '#editor', auth: { url: '/api/token' } });
await editor.create({ name: 'Spring campaign' });
```

Nothing to configure. Cloud supplies the provider, so the whole lifecycle — the inline name field, the save button, the save status, `Cmd`/`Ctrl`+`S`, autosave and the unsaved-changes guard — works with no key to pass and no storage to run.

## The adapter

| Method | Cloud |
| --- | --- |
| `load` | Fetches a stored template by id, scoped to the token's project |
| `create` | Stores a new template and issues the id everything else keys off |
| `save` | Persists the content and the name, and records an automatic version |

Both mutations are enabled — no Cloud tier can open a template but not save it. Plans cap **how many** templates a project may hold, which is a quantity limit, not a capability one.

## Automatic versions

Cloud's `save` writes a version in the same call, throttled to at most one per minute. That is what makes [version history](/cloud/version-history) work with nothing else configured. A save that only renames the template records nothing.

## Autosave

Unlike `init()`, where autosave stays off until you have somewhere to save to, a Cloud session always does — so it defaults to **on, with a 5000ms debounce**. (`init()` defaults to off, and to 2000ms once enabled: Cloud's saves cost a server-side store, so it waits longer.) The key and its type are the same on both entry points:

```js
await initCloud({ container, auth, autoSave: { debounce: 2000 } }); // more eager
await initCloud({ container, auth, autoSave: false });              // off
```

## Bringing your own

You can't, inside `initCloud()`.

The id Cloud's store issues is what anchors comments, version history, collaboration, AI rewrite, scoring and the server-side export. A store Cloud never issued ids for cannot be wired into features Cloud hosts, so `initCloud({ templates })` is not on the config type, and a provider passed from JavaScript is ignored with a console warning.

Bring your own with [`init()`](/backend/templates), where the whole set — templates, version history, comments, rendering — is yours.

## Headless use

The REST surface is `getTemplate`, `createTemplate` and `updateTemplate` on `ApiClient` — see the [headless API](/cloud/headless-api#templates).
