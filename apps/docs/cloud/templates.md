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

Cloud does not return `createdAt` / `updatedAt` yet, so the header shows no [write time](/backend/templates#the-write-time) on this tier. The keys are read the moment the API sends them, with no SDK change.

Both mutations are enabled — no Cloud tier can open a template but not save it. Plans cap **how many** templates a project may hold, which is a quantity limit, not a capability one.

## Automatic versions

Cloud's `save` writes a version in the same call, throttled to at most one per minute. That is what makes [version history](/cloud/version-history) work with nothing else configured. A save that only renames the template records nothing.

## Autosave

Unlike `init()`, where autosave stays off until you have somewhere to save to, a Cloud session always does — so `templates.autoSave` defaults to **on**. `changeDebounce` is the same 2000ms default both entry points use; only the on/off default differs. The keys and their types are identical to `init()`'s:

```js
await initCloud({ container, auth, templates: { autoSave: false } }); // off
await initCloud({ container, auth, changeDebounce: 5000 });           // slower
```

::: tip Pace `onChange` alone with `templates.autoSave: false`
Cloud always injects its own `templates`, so there is no `templates`-less config here the way there is on `init()`. Persist nothing while still pacing `onChange` at `changeDebounce` by setting `templates: { autoSave: false }`, rather than by leaving `templates` out.
:::

## Bringing your own

Configuration and events, inside `initCloud()` — never storage.

The id Cloud's store issues is what anchors comments, version history, collaboration, AI rewrite, scoring and the server-side export. A store Cloud never issued ids for cannot be wired into features Cloud hosts, so `initCloud()`'s `templates` key takes [`TemplatesOptions`](/backend/templates#events) — `autoSave`, `unsavedChangesGuard`, `nameField`, `onSaved`, `onCreated` and `onLoaded` — rather than a full provider:

```ts
await initCloud({
  container: '#editor',
  auth: { url: '/api/token' },
  templates: {
    unsavedChangesGuard: false,
    nameField: false,
    onSaved:   (template, { trigger }) => {},
    onCreated: (template) => {},
    onLoaded:  (template) => {},
  },
});
```

::: tip Rendering and test email save too
`toMjml()`, `toHtml()` and sending a test email each save the template first, so `onSaved` fires with `trigger: "api"` for an action the user did not experience as a save. Gate navigation on `trigger === "manual"` rather than on the absence of `"autosave"`.
:::

Passing a full provider is fine: `load`, `create` and `save` are ignored with a console warning naming them, while the rest of the object reaches the editor regardless. An OSS `templates` provider moving to Cloud needs no change — leave the key exactly as it is.

Bring your own storage with [`init()`](/backend/templates), where the whole set — templates, version history, comments, rendering — is yours.

## Headless use

The REST surface is `getTemplate`, `createTemplate` and `updateTemplate` on `ApiClient` — see the [headless API](/cloud/headless-api#templates).
