---
"@templatical/media-library": minor
"@templatical/editor": minor
---

Fix: Cloud's media library was non-functional inside the editor.

`MediaLibraryModal` reached for its host's state by injection under bare **string** keys — `inject("authManager")`, `inject("projectId")`, `inject("planConfig")`, all non-null-asserted — while `@templatical/editor` provides `Symbol("authManager")` and had no key at all for the other two. Vue matches injection keys by identity, so a string never resolves a Symbol: opening the media library through `initCloud()` received `undefined` for all three and nothing worked. Only the editor path was affected; the standalone media SDK (`init()` from `@templatical/media-library`) provided them correctly and is unchanged in behaviour.

The three values now travel as **props**, so `@templatical/editor`'s typecheck fails if a binding is dropped rather than the browser silently breaking again.

### Breaking — only if you mount `MediaLibraryModal` yourself

If you render `MediaLibraryModal` in your own Vue app, pass the three as props instead of providing them:

```vue
<MediaLibraryModal
  :visible="open"
  :auth-manager="authManager"
  :project-id="authManager.projectId"
  :plan-config="planConfig"
  @select="onSelect"
  @close="open = false"
/>
```

`planConfig` is a `UsePlanConfigReturn` (from `usePlanConfig(authManager)` in `@templatical/core/cloud`) — the same shape the modal read before. The modal re-provides it internally for the descendants that call `useMediaCategories`, so nothing below it changes.

`useMediaCategories()` now throws a named error when no plan config is in scope, instead of failing several frames later on `undefined.config`.
