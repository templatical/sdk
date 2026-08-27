---
"@templatical/types": minor
"@templatical/core": minor
"@templatical/editor": minor
---

Move `autoSave`, `unsavedChangesGuard` and `templateNameField` onto `templates`, and split `autoSave`'s cadence out to a root `changeDebounce`

`autoSave`, `unsavedChangesGuard` and `templateNameField` moved off the root
of `init()` / `initCloud()` and onto the `templates` object, alongside the
`onSaved` / `onCreated` / `onLoaded` events already there. The type that
carries them is renamed `TemplatesEvents` → `TemplatesOptions`, and
`TemplatesProvider extends TemplatesOptions`.

```ts
// Before
await init({
  container,
  templates: { load, create, save },
  autoSave: { debounce: 5000 },
  unsavedChangesGuard: false,
  templateNameField: false,
});

// After
await init({
  container,
  templates: {
    load, create, save,
    autoSave: true,
    unsavedChangesGuard: false,
    nameField: false,
  },
  changeDebounce: 5000,
});
```

### Breaking — `autoSave`, `unsavedChangesGuard` and `templateNameField` move onto `templates`

- **`autoSave` is `boolean` only now** — the `{ debounce }` shape is gone.
  Its cadence is the new root `changeDebounce?: number` instead, because one
  timer paces both the save and the `onChange` notification, and `onChange`
  fires with no `templates` provider configured at all. Set `changeDebounce`
  on its own, with no `templates` key, to pace `onChange` alone — the
  capability the split preserves.
- **`unsavedChangesGuard`** reads from `templates.unsavedChangesGuard`, not
  the config root.
- **`templateNameField`** is renamed to `templates.nameField` and moved off
  the config root.
- **`TemplatesEvents`** is renamed `TemplatesOptions`.

`initCloud()` takes the same two keys `init()` does — `templates.autoSave`
(defaults `true`, since a Cloud session always has a store) and
`changeDebounce` (defaults `2000`, the same constant both entry points use)
— so moving a config from one entry point to the other needs no edit:

```ts
// Before
await initCloud({ container, auth, autoSave: { debounce: 5000 } }); // slower

// After
await initCloud({ container, auth, changeDebounce: 5000 });         // slower
```
