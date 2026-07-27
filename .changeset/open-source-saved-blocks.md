---
"@templatical/types": minor
"@templatical/core": minor
"@templatical/editor": minor
---

Open-source **Saved Blocks** — reusable groups of blocks users save and re-insert — backed by a consumer-supplied storage provider. Previously Cloud-only ("Saved Modules").

The editor owns the UI; you own persistence. Templatical Cloud now consumes the same interface as one adapter rather than a separate implementation.

Saving starts from a block's bookmark action and opens a **pick session**: plain clicks add or remove blocks on the canvas, a bar shows the count with Save/Cancel (Escape cancels, Enter confirms), and Save opens a dialog that asks for a name and previews the picked blocks. The preview lists them in pick order and each row can be dragged (or moved with the arrow keys from its grip handle) to reorder before saving; blocks are stored in whatever order the list ends in. Picking never touches the editor's block selection. Browsing gives search, an optional free-text **category** filter, live preview, insert-at-position, rename and delete. A category is set in the save dialog (suggesting the ones already in use) and editable inline afterwards; it is flat and optional — there are no folders. Both filters run in the editor over whatever `list()` returned, so a provider that simply returns its entries gets search and categories for free.

```js
import { init, createLocalStorageSavedBlocksProvider } from '@templatical/editor';

// Zero-backend option, for demos and prototypes:
await init({
  container: '#editor',
  savedBlocks: createLocalStorageSavedBlocksProvider(),
});

// Or implement `SavedBlocksProvider` against your own API:
await init({ container: '#editor', savedBlocks: myProvider });
```

**Off by default.** With no `savedBlocks` provider the feature is entirely absent and none of its UI code is downloaded — the pick bar and both dialogs are lazily loaded chunks fetched only when actually used.

Ordering belongs to the provider: the browser renders `list()`'s order verbatim and never re-sorts, so you control it server-side. `created_at` / `updated_at` are display only — each entry shows a relative timestamp (hover for the absolute date) and both fields are optional.

New exports:

- `@templatical/types` — `SavedBlock`, `SavedBlocksListParams`, `SavedBlocksProvider`
- `@templatical/core` — `useSavedBlocks`, `createLocalStorageSavedBlocksProvider`
- `@templatical/core/cloud` — `createCloudSavedBlocksProvider`
- `@templatical/editor` — `savedBlocks` config option, plus re-exports of the provider factory and types

### Breaking changes

- **`useSavedModules` is removed** from `@templatical/core/cloud`. Use `useSavedBlocks` from `@templatical/core` with a provider — `createCloudSavedBlocksProvider(authManager)` for Cloud. The return shape changed: `modules`/`loadModules`/`createModule`/`updateModule`/`deleteModule` → `savedBlocks`/`load`/`create`/`update`/`remove`.
- **`SavedModule` is removed** from `@templatical/types`. Use `SavedBlock`, whose `created_at`/`updated_at` are now optional (a browser-local or in-memory store may not track them).
- **`initCloud()`'s `modules` option is renamed to `savedBlocks`.** `modules: false` becomes `savedBlocks: false`.
- **Editor translation keys renamed.** `blockActions.saveAsModule` → `blockActions.saveAsBlock`, `sidebarNav.browseModules` → `sidebarNav.browseSavedBlocks`, and the cloud chunk's `modules.*` namespace moved into the OSS chunk as `savedBlocks.*`. Only affects consumers overriding translations directly.

The Cloud REST contract is unchanged: `ApiClient.listModules`/`createModule`/`updateModule`/`deleteModule` and the `saved-modules` routes keep their names and paths.

### Fixes

- Cloud no longer renders a dead "save as block" button on plans without the saved-blocks entitlement. Availability is now a reactive signal on the capability, so the control appears only when the feature actually works.
