---
title: Saving & Loading Templates
description: Wire the editor's save/load lifecycle to your own storage — name, save button, autosave and unsaved-changes guard included.
---

# Saving & Loading Templates

Give the editor somewhere to save to and it grows the chrome that goes with it: an inline-editable template name, a save button, a save-status indicator, `Cmd`/`Ctrl`+`S`, optional autosave, and a warning before the tab closes with unsaved work.

The editor owns all of that. **You own persistence** — three methods against your own API.

## Quick start

```ts
import { init } from "@templatical/editor";

const editor = await init({
  container: "#editor",
  templates: {
    load: async (id) => {
      const res = await fetch(`/api/templates/${id}`);
      return res.json();
    },

    create: async (input) => {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return res.json();
    },

    save: async (id, patch) => {
      const res = await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      return res.json();
    },
  },
});

// Opening a template is imperative — your app decides which one.
await editor.load("tpl_123");
```

**Omit `templates` and the feature is absent** — no name field, no save button, no status indicator. `create()` / `load()` / `save()` then reject with an explanatory error, and you persist the content yourself from [`onChange`](#persisting-without-a-provider).

## The contract

```ts
interface Template {
  id: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  content: TemplateContent;
}

type TemplatePatch = Partial<{ name: string; content: TemplateContent }>;

interface TemplatesProvider {
  load(id: string): Promise<Template>;
  create:
    | false
    | ((input: {
        name?: string;
        content: TemplateContent;
      }) => Promise<Template>);
  save: false | ((id: string, patch: TemplatePatch) => Promise<Template>);
}
```

- **`id` comes from your store**, returned by `create()`. The editor never generates one — a database key, a slug, a document id, whatever your storage already uses.
- **`save` receives a patch**, not bare content, so a rename can travel without content and a new field can be added without breaking your implementation. The editor sends `name` (when the template has one) and `content` together, in one round-trip.
- **`createdAt` / `updatedAt` are optional, ISO 8601, and display-only.** Both are absent from `TemplatePatch`, so the editor never writes them — what it shows is whatever `load` or `save` returned. See [The write time](#the-write-time).
- **`name` is optional.** With no name column, leave it out — the header renders a dimmed "Untitled" in its place. The field stays editable as long as `save` is a function, so a rename still travels as `save(id, { name, content })`. A store that ignores it returns a template with no name, and the header reverts to "Untitled". With no use for names at all, [hide the field](#hiding-the-name-field).
- **Persistence side effects belong in `save()`'s body.** It runs on every write, so logging, cache invalidation or a webhook call has one home. See [Events](#events) for what the editor exposes once that write has settled.

Every method may reject. The editor reports the failure through `onError`, shows it in the header, and leaves its state untouched — nothing is marked saved that wasn't.

### No list, no delete

The editor has no template browser. Choosing _which_ template to open belongs to your application; the editor's job starts once you hand it an id.

## Events

```ts
templates: {
  load, create, save,
  onSaved:   (template, { trigger }) => {},
  onCreated: (template) => {},
  onLoaded:  (template) => {},
}
```

`trigger` is one of `manual`, `autosave`, `rename`, `restore`, `api`. `manual` covers the header's Save button and `Cmd`/`Ctrl`+`S`.

::: tip Where post-save logic belongs
Persistence goes in `save()` — it is your function, and its body runs before the editor has adopted the response. `onSaved` is for the two things that body cannot give you: which affordance fired the save, and a point at which the editor has settled. Navigating from `save()` runs while `isDirty` is still `true`, so your own router guard blocks you.
:::

A handler that throws is caught and reported to `onError` — it never fails the save, create or load that triggered it.

## Disabling create or save

`create` and `save` are `false | fn` and **required**, not optional. `load` cannot be turned off — without it there is nothing to open.

```ts
templates: {
  load: (id) => fetchTemplate(id),
  create: false,  // editor.create() rejects
  save: false,    // read-only: loads and edits locally, persists nothing
}
```

**`save: false`** hides the save button and the status indicator, and makes the name read-only — there is nowhere for a change to go. `Cmd`/`Ctrl`+`S` and autosave become no-ops rather than errors. Loading a template and editing it locally still works.

**`create: false`** makes `editor.create()` reject. It hides nothing, because the editor has no create affordance of its own — creating is always your app calling `editor.create()`. You set the flag, so gate your own New-template control on the same value, or `try` / `catch` the call.

::: warning Not a security boundary
These flags live in the user's browser. They shape the UI; they do not protect your API. Enforce permissions server-side.
:::

## The header

<!-- prettier-ignore -->
| Where | What |
| --- | --- |
| left | the template name, click-to-edit, and the write time under it |
| right | the save status, then the save button |

The name commits on `Enter` or blur, cancels on `Escape`, and reverts an empty value — a cleared field is far likelier a slip than an intent. A rename is an ordinary unsaved change: it marks the editor dirty and persists on the next save, in the same patch as the content.

The status indicator has three states:

| State           | Shown when                                                       |
| --------------- | ---------------------------------------------------------------- |
| **Unsaved**     | there are edits the editor knows aren't persisted                |
| **Saved**       | a save just succeeded (for a few seconds)                        |
| **Save failed** | the last attempt rejected — your error message is in the tooltip |

The save button is disabled until a template exists, because `save()` patches an id. Call `create()` or `load()` first.

### The write time

A template carrying `updatedAt` renders a relative line under the name, with the full date on hover:

> Updated 5m ago

`createdAt` is the fallback when `updatedAt` is absent, and the wording follows whichever was used — a template your store has never rewritten reads "Created", never "Updated". Neither field, or a value that does not parse, renders nothing at all. The line refreshes while the editor stays open.

::: warning Do not stamp `updatedAt` in `create`
Set `createdAt` alone when a template is first written. Stamping both makes a brand-new template read **"Updated just now"** before anyone has edited it — the editor prefers `updatedAt` and labels it accordingly, so it is reporting exactly what your store claimed.

This is easy to hit by accident: a column default of `updated_at = created_at` on insert, or a single `now()` assigned to both, produces it. Let the first `save` be the first thing that sets `updatedAt`.
:::

::: tip
It renders whether or not `save` is available, which is what a read-only template has in place of a status indicator.
:::

### Hiding the name field

```ts
init({
  templates: {
    nameField: false,
    /* … */
  },
});
```

Removes the field from the header, whether or not your provider can save. `editor.create({ name })`, `setName()` and the `name` in each save patch keep working, so your own chrome can still manage names. `initCloud()` accepts the same key on its own `templates` object.

With the field hidden, the write time becomes the header's only left-column content.

## Autosave

```ts
await init({
  container: "#editor",
  templates: {
    autoSave: true,
    /* … */
  },
  changeDebounce: 5000, // defaults to 2000
});
```

`templates.autoSave` turns saving on. `changeDebounce` sets the cadence, at the config root rather than alongside it.

::: tip `changeDebounce` also paces `onChange`
The same timer drives both, and [`onChange`](#persisting-without-a-provider) fires whether or not `templates` is configured — so the cadence has to stay reachable from a config with no provider at all.
:::

The debounce restarts on every change, so a burst of typing produces one save. It pauses while the user steps through undo/redo, and skips the save entirely when nothing is dirty.

::: warning `autoSave` needs somewhere to save
`true` with a provider whose `save` is `false` logs a warning and saves nothing. Persist from `onChange` instead.
:::

## Cmd+S

`Cmd`/`Ctrl`+`S` always means "persist now":

- with a `templates` provider it calls `save()`;
- without one it flushes the `onChange` debounce immediately, so a consumer persisting from `onChange` still gets the keystroke.

## Unsaved changes

Two mechanisms, because neither covers the other:

```ts
await init({
  container: "#editor",
  templates: {
    unsavedChangesGuard: true, // the default
    /* … */
  },
  onDirtyChange: (isDirty) => {
    hasUnsavedWork.value = isDirty;
  },
});
```

**`templates.unsavedChangesGuard`** is a `beforeunload` prompt, on by default whenever a provider is configured. It covers closing or reloading the tab. Set it to `false` to own that prompt yourself. Without a provider the editor never warns — it has no way to know whether you already persisted the change.

**`onDirtyChange`** (and its pull-based twin `editor.isDirty()`) is what you guard a client-side router with, since `beforeunload` does not fire on an in-app navigation:

```ts
router.beforeEach((to, from, next) => {
  if (editor.isDirty() && !confirm("Discard unsaved changes?"))
    return next(false);
  next();
});
```

`onDirtyChange` works with or without a provider, at the config root either way. `initCloud()` accepts `unsavedChangesGuard` on its own `templates` object, on the same terms — Cloud always has a store to save to, so the guard is on there unless you refuse it.

## The instance API

```ts
const template = await editor.create({ name: "Welcome email" });
await editor.load(template.id);
await editor.save();
editor.isDirty(); // boolean
```

- **`create(input?)`** persists the current content as a new template. Pass `content` to replace the editor's content first, so `create({ content })` loads and stores in one step.
- **`load(id)`** fetches a template and makes it the editor's content, discarding local edits.
- **`save()`** persists the loaded template's name and content as one patch.

All three are always present on the type, and reject with an explanatory error when no provider is configured or the provider withheld the relevant method. Guard with `try` / `catch` if you call them from a button of your own. The header hides its own save controls when `save` is withheld, but `create()` and `load()` have no editor UI at all — a control for either is yours to gate.

## Persisting without a provider

A provider is not the only way to keep a template. `onChange` fires, debounced, whenever the content changes:

```ts
await init({
  container: "#editor",
  onChange: (content) => myStore.save(content),
});
```

`Cmd`/`Ctrl`+`S` flushes that debounce immediately, so the keystroke still reaches you. You then own the save button, the status and the dirty prompt as well. Use `onChange` when the editor's chrome isn't what you want; use the provider when it is.

## Reference

- [`init()` options](/api/editor)
- [Rendering & Export](/backend/render) — bring-your-own MJML/HTML rendering
- [Saved Blocks](/backend/saved-blocks) — the same bring-your-own-storage shape, for reusable groups of blocks
- [Test Emails](/backend/test-email) — bring-your-own sending

**Using Templatical Cloud?** It implements this contract with nothing to configure — see [Templates on Cloud](/cloud/templates).
