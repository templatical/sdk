---
"@templatical/types": minor
"@templatical/core": minor
"@templatical/editor": minor
---

Add template lifecycle events to `TemplatesProvider`

`templates` now takes `onSaved`, `onCreated` and `onLoaded` alongside its
`load`, `create` and `save` storage methods. `onSaved` carries the trigger —
`manual` (Save button or Cmd+S), `autosave`, `rename`, `restore` or `api` —
so post-save navigation can fire for a deliberate save and stay put for a
background one.

Events fire once the editor has settled: the template adopted, `isDirty`
cleared, `isSaving` false. A handler may navigate without tripping your own
unsaved-changes guard, which a side effect inside `save()` cannot.

`initCloud()` accepts `templates` for its events. Its methods are ignored with a
warning naming them, so an OSS integration moving to Cloud leaves the key as-is.

### Breaking — `initCloud`'s `onCreate` and `onLoad` are removed

Cloud-only; `init()` never had them.

```ts
// Before
initCloud({ onLoad: (t) => breadcrumb(t.name) });

// After
initCloud({ templates: { onLoaded: (t) => breadcrumb(t.name) } });
```

They also fired from inside Cloud's own adapter, before the editor had adopted
the template. `onLoaded` fires after, so a handler reading `editor.getContent()`
now sees the loaded template rather than the previous one.
