---
"@templatical/types": minor
"@templatical/core": minor
"@templatical/editor": minor
---

Add a bring-your-own **templates provider**: the editor's save/load lifecycle over your own storage.

Pass three methods as `init({ templates })` and the editor grows the chrome that goes with them — an inline-editable template name in the header, a save button, a three-state save-status indicator, `Cmd`/`Ctrl`+`S`, optional debounced autosave, and a `beforeunload` guard for unsaved work:

```ts
const editor = await init({
  container: "#editor",
  templates: {
    load: (id) => fetch(`/api/templates/${id}`).then((r) => r.json()),
    create: (input) => post("/api/templates", input),
    save: (id, patch) => patchJson(`/api/templates/${id}`, patch),
  },
  autoSave: true,
});

await editor.load("tpl_123");
```

Omit `templates` and no chrome appears: no name field, no save button, no status indicator. `onChange` keeps working exactly as before, and `Cmd`/`Ctrl`+`S` flushes its debounce immediately so a consumer persisting from `onChange` still receives the keystroke. (`onSave` is removed in this same release — see the render-provider entry.)

New in `@templatical/types`: `Template`, `TemplatePatch`, `TemplatesProvider`. `create` and `save` are `false | fn` and **required**, mirroring `SavedBlocksProvider` — disabling one is a decision you state rather than something you get by forgetting a method. `save: false` yields a genuine read-only mode: the save button, the status indicator and the rename affordance all disappear, while loading and local editing keep working.

New in `@templatical/editor`: `templates`, `autoSave`, `autoSaveDebounce`, `onDirtyChange`, `templateNameField` and `unsavedChangesGuard` config keys, plus `create()`, `load()`, `save()` and `isDirty()` on the instance. The lifecycle methods are always present on the type and reject with an explanatory error when no provider is configured — the documented `toMjml()` convention.

The header chrome has two switches of its own:

- **`templateNameField: false`** hides the inline name field — for a store with no name column, or when your own chrome owns the name. It hides the field and nothing else: `create({ name })`, `setName()` and the `name` in each save patch keep working. `initCloud()` accepts the same key.
- **`Template.createdAt` / `updatedAt`** (optional, ISO 8601) render a relative line under the name — "Updated 5m ago" — with the full date on hover, refreshing while the editor stays open. `updatedAt` wins when both are present, and the wording follows whichever was used, so a template your store never rewrote reads "Created". Neither field, or a value that does not parse, renders nothing. Both are absent from `TemplatePatch`: the editor never writes them, and it renders whatever `load` or `save` returned. The line appears whether or not `save` is available, which is what a read-only template has in place of a status indicator.

The four relative-time labels now live in one shared top-level `time` namespace, replacing the three identical copies under `savedBlocks`, `comments` and `versionHistory`.

**Breaking, type-only:**

- `EditorState` in `@templatical/core` gains three required members — `template: Template | null`, `isSaving: boolean` and `isLoading: boolean`. Code that constructs an `EditorState` object literal, or that mirrors the interface, must add them. Reading state is unaffected.
- `Template` moved from `@templatical/types`' cloud module into its own `templates` module. It is still exported from the package root and re-exported from the cloud module, so no import breaks.
- `useConditionPreview`, `useHistoryInterceptor` and `useCollaborationBroadcast` now take the minimal structural slice of an editor they actually use, instead of a whole `UseEditorReturn`. Passing either editor still works; a caller that relied on the parameter type by name should use the exported `ConditionPreviewEditor` / `HistoryInterceptorEditor` instead.

Also fixed: a save that resolves *after* an edit landed mid-flight no longer clears the dirty flag. Clearing it claimed the edit was persisted, and — because autosave decides dirtiness at debounce time — made the follow-up save skip it.

Docs: [Saving & Loading Templates](https://docs.templatical.com/backend/templates).
