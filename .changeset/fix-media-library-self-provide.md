---
"@templatical/media-library": patch
"@templatical/editor": patch
---

Fix: the media library could not mount at all on 0.27.0 — in either mount mode.

0.27.0 moved `authManager` / `projectId` / `planConfig` to props and had `MediaLibraryModal` re-provide the plan config under `PLAN_CONFIG_KEY` for its descendants, while `useMediaCategories()` was given a named throw for the no-provider case. Both host shells then called `useMediaCategories()` with no argument — and **a component never sees its own `provide`**, because Vue resolves `inject` against the *parent* chain. So the new throw fired in the very components that supplied the value:

```
[Templatical] useMediaCategories() needs a plan config in scope.
Render it under <MediaLibraryModal> (pass its `planConfig` prop) …
```

This hit the editor path (`initCloud()`) **and** the standalone SDK, which had worked before 0.27.0 — its `useMediaCategories()` previously injected the bare string `"planConfig"` that `standalone/MediaLibrary.vue` provided. `useMediaCategories(planConfigOverride?)` now takes the value explicitly, which both shells pass; descendants inject exactly as before.

Two further key-identity faults in the same file are fixed with it, both invisible until the modal could mount:

- **Translations.** `useI18n()` injected the bare string `"translations"`, which never resolves the `Symbol` `@templatical/editor` provides under the same name — so a host-mounted modal got `undefined` and threw on its first of 28 `t.mediaLibrary.*` reads. Strings now cross the package boundary as a **`locale` prop** on `MediaLibraryModal`, which loads its own translations and provides them under a `Symbol`; `useI18n()` falls back to bundled English rather than asserting non-null.
- **Dark mode.** Four components injected the bare string `"tplUiTheme"`, so `data-tpl-theme` was always `undefined` and the library rendered light inside a dark editor. `MediaLibraryModal` takes a `uiTheme` prop and provides it for the three sub-modals, which teleport out of its DOM.

`initCloud()` consumers get all of this by upgrading — `CloudPanels` forwards `locale` and the resolved UI theme automatically.

### Breaking — only if you mount `MediaLibraryModal` yourself

Both new props are optional, so nothing is required. Pass them to get the behaviour the editor gets:

```vue
<MediaLibraryModal
  :visible="open"
  :locale="locale"
  :ui-theme="resolvedTheme"
  :auth-manager="authManager"
  :project-id="authManager.projectId"
  :plan-config="planConfig"
  @select="onSelect"
  @close="open = false"
/>
```

Omit `locale` and it loads English; omit `uiTheme` and no `data-tpl-theme` is stamped. If you called `useMediaCategories()` from a component that *also* provides `PLAN_CONFIG_KEY`, pass your value: `useMediaCategories(planConfig)`.

The regression escaped because no test or e2e had ever mounted either shell — the standalone suite mocks Vue's `createApp` wholesale, and the plan-config audit exercised the composable through an app-level `provide`, the one topology where self-injection works. Both shells are now mounted in tests, and the package's injection audit bans *any* bare-string `inject` rather than an enumerated list of names.
