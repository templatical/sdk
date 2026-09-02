# @templatical/core

## 0.29.1

### Patch Changes

- @templatical/types@0.29.1

## 0.29.0

### Minor Changes

- 09f6136: Provider objects now carry their own configuration and events

  Every BYO provider takes its outward events on the provider object itself, next
  to the storage methods, instead of as root config callbacks:

  ```ts
  templates:      { load, create, save,               onSaved, onCreated, onLoaded }
  comments:       { list, create, update, delete, setResolved, subscribe,
                    onCreated, onUpdated, onDeleted, onResolved, onUnresolved }
  savedBlocks:    { list, create, update, delete,     onCreated, onUpdated, onDeleted }
  versionHistory: { list, get, create, restore,       onCreated, onRestored }
  testEmail:      { send,                             onSent }
  ```

  Each provider's events and configuration are declared on a `<Feature>Options`
  type that `<Feature>Provider` extends, so a bundle of handlers can be typed and
  passed around on its own.

  Handlers fire once the editor has settled — template adopted, `isDirty` cleared,
  `isSaving` false — so a handler may navigate without tripping your own
  unsaved-changes guard, which a side effect inside `save()` cannot. A handler that
  throws is reported through `onError` and never fails the operation.

  **`onSaved` carries the trigger**: `manual` (Save button or Cmd/Ctrl+S),
  `autosave`, `rename`, `restore`, or `api`. Gate navigation on
  `trigger === "manual"` rather than `trigger !== "autosave"` — a rename commit and
  a save-before-restore are both real saves you almost certainly don't want to
  navigate on.

  **Comment handlers carry `{ origin: 'local' | 'remote' }`.** `local` means the
  mutation ran through this editor; `remote` means it arrived via `subscribe` —
  someone else, in another browser. A "new comments" badge should count `remote`
  only.

  Payloads worth noting: `savedBlocks.onDeleted` receives the removed block, not an
  id, and emits nothing when the id was never loaded locally.
  `versionHistory.onRestored` receives the resulting `Template`, not the version it
  was restored from.

  ## Breaking

  | Before                             | After                                                                     |
  | ---------------------------------- | ------------------------------------------------------------------------- |
  | `onComment: (e) => …`              | `comments: { onCreated, onUpdated, onDeleted, onResolved, onUnresolved }` |
  | `autoSave: { debounce: 5000 }`     | `templates: { autoSave: true }` + root `changeDebounce: 5000`             |
  | `unsavedChangesGuard: false`       | `templates: { unsavedChangesGuard: false }`                               |
  | `templateNameField: false`         | `templates: { nameField: false }`                                         |
  | `TemplatesEvents`                  | `TemplatesOptions`                                                        |
  | `CommentEvent`, `CommentEventType` | removed — match on the handler name                                       |
  - **`autoSave` is `boolean` only.** Its cadence is the root `changeDebounce?: number`,
    because one timer paces both the save and the `onChange` notification, and
    `onChange` fires with no `templates` provider at all. Set `changeDebounce` alone
    to pace `onChange` by itself.
  - `CommentChange` — the _inward_ shape a `subscribe` implementation reports — is
    unrelated and unchanged.

  ### A transport that echoes your own writes no longer double-fires

  A store whose `subscribe` reports your own write back (Pusher's default, most SSE
  fan-outs) used to fire `onComment` twice for one comment. A remote change is now
  emitted only when it actually alters the loaded list.

  **If you de-duplicated by comment id to work around this, remove it** — unless
  your transport can echo a write back _before_ your mutation's own response
  resolves. In that ordering the echo is applied first as `origin: 'remote'` and
  your local call still emits `origin: 'local'`, so keep de-duplicating. Everywhere
  else the guard now discards real information: a second event on the same comment,
  such as an edit after its creation, arrives once.

### Patch Changes

- Updated dependencies [09f6136]
  - @templatical/types@0.29.0

## 0.28.1

### Patch Changes

- @templatical/types@0.28.1

## 0.28.0

### Patch Changes

- Updated dependencies [2cacdbc]
  - @templatical/types@0.28.0

## 0.27.6

### Patch Changes

- @templatical/types@0.27.6

## 0.27.5

### Patch Changes

- @templatical/types@0.27.5

## 0.27.4

### Patch Changes

- @templatical/types@0.27.4

## 0.27.3

### Patch Changes

- @templatical/types@0.27.3

## 0.27.2

### Patch Changes

- @templatical/types@0.27.2

## 0.27.1

### Patch Changes

- Updated dependencies [18f6b38]
  - @templatical/types@0.27.1

## 0.27.0

### Minor Changes

- d256b41: Comments become a bring-your-own provider, and the editor learns who is using it.

  `init()` takes a new `comments?: CommentsProvider` key. Configure it — together with the new top-level `user` key — and the editor grows a review panel: threads with replies, per-block anchors, resolve and reopen, a count badge on every commented block. Omit it and none of that UI is downloaded.

  ```ts
  init({
    container,
    templates: myTemplatesProvider,
    user: { id: "u_7", name: "Ada Lovelace" },
    comments: {
      list: (templateId) =>
        fetch(`/api/templates/${templateId}/comments`).then((r) => r.json()),
      create: (templateId, input) =>
        fetch(`/api/templates/${templateId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }).then((r) => r.json()),
      update: (templateId, commentId, patch) =>
        fetch(`/api/templates/${templateId}/comments/${commentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }).then((r) => r.json()),
      delete: async (templateId, commentId) => {
        await fetch(`/api/templates/${templateId}/comments/${commentId}`, {
          method: "DELETE",
        });
      },
      setResolved: (templateId, commentId, resolved) =>
        fetch(`/api/templates/${templateId}/comments/${commentId}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolved }),
        }).then((r) => r.json()),
    },
  });
  ```

  `list` is the operation and cannot be disabled; `create`, `update`, `delete` and `setResolved` each take `false` instead of a function, so turning one off is a decision you state rather than something you get by forgetting a method. Withhold all four and you get a genuine read-only review: threads and replies render, jump-to-block works, and the composer, resolve, edit and delete affordances are **absent** rather than disabled. The composable rejects a withheld mutation rather than no-opping, because a resolved promise reads as "saved" to whoever awaited it.

  **`setResolved` takes the target state, not a toggle** — idempotent, so two clicks in flight can't leave a thread inverted. The editor reports whatever your store returned rather than what it asked for, so a store that refuses to reopen a thread is believed.

  ### `user` — a new top-level config key

  ```ts
  init({ container, user: { id: "u_7", name: "Ada Lovelace" } });
  ```

  Comments are the first feature to need "who are you" (the panel compares `user.id` against each comment's `author.id` to decide what may be edited or deleted), and collaboration presence will want the same answer — so it is a top-level key rather than part of the comments provider, where a second copy would inevitably drift.

  **With no `user`, comments report themselves unavailable — never anonymous.** No trigger, no panel, no indicators. An unattributable comment is worse than no comment feature, the same reasoning that makes an explicitly empty `TestEmailProvider.allowedRecipients` disable test email rather than fall through to free text. Not a security boundary: attribute writes server-side.

  ### Realtime is optional

  `CommentsProvider.subscribe` is optional and pushes remote changes into the open panel. **Comments without it work identically** — you simply see a colleague's on the next read rather than immediately:

  ```ts
  subscribe: (templateId, onChange) => {
    const source = new EventSource(`/api/templates/${templateId}/comments/stream`);
    source.onmessage = (e) => onChange(JSON.parse(e.data));
    return () => source.close();
  },
  ```

  Your own writes may echo back through it with no de-duplication on your side: a `created` for a comment already in the list is ignored, and an `updated` replaces it in place.

  ### `initCloud()` rejects a consumer-supplied `comments`

  Exactly as it rejects `templates` and `versionHistory`: a comment is keyed to a template id Cloud issued, and its author is signed by the auth token, so Cloud owns the conversation. One passed from JavaScript is ignored with a console warning. `initCloud()` takes no `user` key either — it fills `init({ user })` from the token's `user` claim, the same claim its backend verifies. Switch the feature off with `commenting: false`.

  Cloud's availability now folds three conditions, none implying another: `commenting: false`, the `commenting` plan feature, and **the template being saved** (Cloud anchors a comment server-side). The last is new — the button previously rendered before the first save.

  ### Breaking — the comments API

  | Before                                                                            | After                                                                                                                                                       |
  | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `Comment` (`@templatical/types`) — snake_case                                     | `CommentResponse` — still Cloud's wire shape. The contract shape is the new camelCase `Comment`                                                             |
  | `CommentThread`                                                                   | **Removed.** It was an alias for `Comment`                                                                                                                  |
  | `useComments` (`@templatical/core/cloud`)                                         | `useComments` in `@templatical/core`, shared by both tiers, taking a `provider` + `getUser` instead of an `authManager`                                     |
  | `loadComments` / `addComment` / `editComment` / `removeComment` / `toggleResolve` | `load` / `create` / `update` / `remove` / `setResolved` — and each **rejects** on failure instead of returning `null`/`false`                               |
  | `useCommentListener({ comments, channel })` (`@templatical/core/cloud`)           | `useCommentListener({ comments, provider, getTemplateId })` in `@templatical/core` — driven by the provider's `subscribe`, so it knows nothing about Pusher |
  | `CommentBroadcastPayload`                                                         | **Removed.** Cloud's broadcast shape is internal to its adapter now                                                                                         |
  | `comments.*` translation keys (cloud chunk)                                       | `comments.*` in the **OSS** chunk, in all seven OSS locales                                                                                                 |

  `CommentEvent` / `CommentEventType` keep their names and now carry the camelCase `Comment`. New export: `createCloudCommentsProvider` (plus `RealtimeChannel`, the structural channel shape its `subscribe` binds — named structurally so the optional `pusher-js` peer stays optional).

  Two dead translation keys (`comments.addComment`, `comments.resolved`) were dropped rather than carried across, and `comments.jumpToBlock` replaces the one hard-coded English string the panel had.

  ### Shared rather than cloud-only

  `CommentsSidebar` moved out of `cloud/components/`, the Comments trigger moved from `CloudHeaderExtras` into the shared header, and both are lazily loaded behind the capability — so an OSS consumer without a provider pays nothing for them. `capabilities.comments` is now built by the shared feature and gained `isAvailable`, `unresolvedCount` and the four `can*` flags.

- d256b41: **The `initCloud()` collapse — heavily breaking.** `initCloud()` is now a thin adapter-wiring wrapper over `init()`: it authenticates, fetches the plan, builds Cloud's providers, and delegates. One `Editor.vue`, one `useEditor`, one header. Read every bullet below — `minor` is the breaking channel on a 0.x line, and it still under-states this.

  **`TemplaticalCloudEditor` is now `TemplaticalEditor`.** The two entry points return the same type, which is the proof the unification worked. Three cloud-only members went with it:

  - `create(content)` → `create({ name?, content? })`, matching `init()`.
  - `setThemeOverrides(overrides)` — **removed.** `config.theme` is applied at init on both entry points, and the entitlement that gated changing it later is gone.
  - `sendTestEmail(recipient)` — **removed.** The shared test-email dialog is the supported path.

  **`initCloud()` rejects on a failed bootstrap** instead of mounting an editor that shows an error overlay. Auth, the health check and the plan fetch now run _before_ the mount, so a session that cannot authenticate never produces an editor. Handle it like any other rejected promise. A session that dies _later_ — a token refresh that cannot renew — still surfaces as an overlay. The 30s "initialization timed out" rejection is gone with the post-mount readiness handshake.

  **Eleven of the sixteen `PlanFeatures` are deleted.** An entitlement is legitimate only when it meters a resource Cloud itself buys; a gate on editor capability that OSS gives away free is either backwards or inert. Removed: `custom_fonts`, `theme_customization`, `custom_blocks`, `auto_save`, `pluggable_media`, `media_folders`, `import_from_url`, `white_label`, `html_block`, `export_mjml`, `headless_sdk`. Surviving: `ai_generation`, `collaboration`, `commenting`, `saved_modules`, `test_email`, plus all four limits (`max_templates` + `template_count`, `storage_limit_bytes`, `max_file_size_mb`, `media_categories`), including the header's usage readout. Behavioural consequences: custom fonts, custom blocks and `theme` are applied on every plan; media folders and URL import render on every plan; `onRequestMedia` needs only to be configured; and Cloud's renderer no longer drops custom faces from the export payload.

  **Removed APIs**

  - `@templatical/core/cloud` no longer exports `useEditor` / `UseEditorOptions` / `UseEditorReturn`. There is one editor core, exported from `@templatical/core`. The Cloud core's last member over it, `savedBlockIds`, was always a comments dependency and now reaches `CommentsSidebar` through `capabilities.comments.isBlockSaved`.
  - `@templatical/types` no longer exports `EditorState`; the surviving definition is exported from `@templatical/core`.
  - `resolveExportFonts(fonts, allowCustomFonts)` → `resolveExportFonts(fonts)`.
  - `createCloudRenderProvider({ …, canUseCustomFonts })` → the option is gone.
  - `useFonts()` no longer returns `customFontsEnabled` / `setCustomFontsEnabled`, and `resolveRenderFonts` no longer reads them.
  - `useMediaLibraryUI({ …, canUseMediaFolders })` → the option is gone.
  - The duplicated `header.save` / `saving` / `saved` / `unsaved` / `saveFailed` keys are removed from the cloud i18n chunk; the OSS chunk's copies are the only ones. `header.templatesUsed` stays cloud-only.

  **Internal deletions** (not public API, listed because they were large): `cloud/CloudEditor.vue`, `cloud/components/CloudHeader.vue`, `cloud/composables/useCloudInitialization.ts`, `cloud/composables/useCloudLifecycle.ts` and `core/src/cloud/editor.ts`. Their content is `EditorHeader.vue` (one shared header, with three slots for Cloud's controls), `cloud/createCloudRuntime.ts` (bootstrap + adapters) and Cloud's decorated templates provider, which is where the websocket-connect-on-load choreography belongs.

  **New on `initCloud()`:** `onDirtyChange` and `unsavedChangesGuard`, the two keys `init()` already had. The `beforeunload` guard is on by default, so a Cloud session can no longer lose work on tab close; pass `unsavedChangesGuard: false` to own that prompt yourself.

  **Fixed along the way:** the OSS editor's drag ghost showed an English "Drop here" whatever the locale, and `init({ fonts: { defaultFont } })` never seeded a blank template's body font — both were wired only on the deleted Cloud side.

  **Preserved deliberately:** Cloud's lint save-gate. `TemplatesProvider` saves now route through an optional `SaveGate`, so the shared header's Save, `Cmd`+`S`, autosave and the version-restore confirmation all still honour the server's `accessibility.blockOnError` policy — autosave by skipping silently rather than raising a prompt on a debounce timer.

- d256b41: Rendering becomes a bring-your-own provider, and the editor grows `toHtml()`.

  `init()` takes a new `render?: RenderProvider` key. Every method is independently optional, and each is resolved on its own:

  | Call              | Order                                                                 |
  | ----------------- | --------------------------------------------------------------------- |
  | `editor.toMjml()` | `render.toMjml` → the bundled `@templatical/renderer` → reject        |
  | `editor.toHtml()` | `render.toHtml` → `toMjml()`'s result + `render.compileMjml` → reject |

  **`compileMjml` is the cheap tier and the point of the whole shape.** MJML compilation is a commodity — a hosted service, a container, a CLI shell-out — whereas rendering Templatical's block model is not. Wire up that one function and `toHtml()` works while the SDK keeps rendering the MJML itself, so a non-Node backend never has to stand up a Node sidecar. There is deliberately **no local HTML path**: with neither `toHtml` nor `compileMjml`, `toHtml()` rejects with an error naming the method to add.

  Provider methods receive a **render-complete** payload — custom blocks already resolved into `renderedHtml`, plus the editor's effective fonts. Both are things a backend cannot reconstruct from the template JSON, and the custom-block case failed silently before (a renderer given one with neither a resolver nor `renderedHtml` omits it from the output).

  **The Cloud editor now exposes `toMjml()` and `toHtml()`**, which it never did — Cloud consumers had to fish HTML out of the save result.

  ### Breaking — `SaveResult` is removed

  `SaveResult` is deleted from `@templatical/types` (and its re-export from `@templatical/editor`). The Cloud editor's `save()` resolved to `{ templateId, html, mjml, content }`; it now resolves to the stored `Template`.

  ```ts
  // Before
  const { html, mjml } = await editor.save();

  // After
  const template = await editor.save();
  const html = await editor.toHtml();
  const mjml = await editor.toMjml();
  ```

  It only ever existed because Cloud's save stitched `editor.save()` and its export endpoint together. Saving and rendering run at different frequencies — autosave was compiling MJML server-side on every debounce tick — and fail in different ways, so they are separate calls now.

  ### Breaking — `onSave` is removed from both entry points

  `init({ onSave })` and `initCloud({ onSave })` are gone. The provider _is_ the save.

  - **OSS** — `onSave` meant "the user hit Cmd+S, you persist it". With a `templates` provider, Cmd+S now calls `save()`. Without one, Cmd+S flushes the `onChange` debounce immediately, so a consumer persisting from `onChange` still receives the keystroke:

    ```ts
    // Before
    init({ container, onChange: persist, onSave: persist });

    // After
    init({ container, onChange: persist });
    ```

  - **Cloud** — `onSave` meant "a save completed", and carried the `SaveResult`. Use the resolved value of `await editor.save()`; `onCreate` and `onLoad` are unchanged.

  ### Breaking — `@templatical/renderer` marks unrenderable blocks instead of dropping them

  A block type with no built-in renderer **and** no `blockRenderers` override now emits an `mj-raw` placeholder comment plus a `console.warn`, where it previously returned an empty string:

  ```html
  <mj-raw
    ><!-- templatical:unrenderable-block type="countdown" id="0192…" --></mj-raw
  >
  ```

  `countdown` is the only built-in block that lands here (Cloud renders it server-side as an animated GIF). Not a throw, because the renderer runs inside send pipelines and killing an entire render over one block is worse than shipping a marked gap; not silence either, because a countdown vanishing from a marketing email reaches recipients as a missing section with nothing anywhere explaining why. The marker survives an `mjml2html` compile under strict validation, and a block hidden on every viewport still renders nothing and warns about nothing.

  Two new exports go with it, so a send pipeline never hardcodes the marker text:

  ```ts
  import {
    UNRENDERABLE_MARKER_PREFIX,
    renderUnrenderableBlock,
  } from "@templatical/renderer";

  if (mjml.includes(UNRENDERABLE_MARKER_PREFIX)) {
    throw new Error(
      "Refusing to send: a block in this template rendered as a gap.",
    );
  }
  ```

  `UNRENDERABLE_MARKER_PREFIX` is the marker's stable leading text — scan for it before shipping. `renderUnrenderableBlock(block)` emits one and logs the warning, so a `blockRenderers` override can degrade the same way for a variant it decides it cannot handle, rather than returning `""` and reintroducing the silent drop.

  ### New — `blockRenderers` on `renderToMjml()`

  A per-block-type override map that generalises `renderCustomBlock`:

  ```ts
  renderToMjml(content, {
    blockRenderers: {
      countdown: (block) => `<mj-image src="${countdownGifUrl(block)}" />`,
      video: (block, ctx) => renderVideoWithPlayButton(block, ctx),
    },
  });
  ```

  An entry replaces the built-in renderer for that type wholesale, including its hidden-on-all-viewports check. It exists so a backend whose output is a _superset_ of the browser's can inject exactly that delta instead of forking the renderer — which is how Cloud now runs the published renderer rather than a copy of it.

  `BlockRenderer` moved to `render-context.ts` next to the new `BlockRendererMap` and is re-exported from its previous path, so consumer imports are unaffected.

  ### Breaking — Cloud internals (`@templatical/core/cloud`)

  Consumers using `initCloud()` are unaffected; these matter only if you import the cloud subpath directly.

  - `useEditor({ templates })` is now required — Cloud persists through `createCloudTemplatesProvider(authManager)` rather than hardcoded `ApiClient` calls.
  - `ApiClient.updateTemplate(id, patch)` takes a `TemplatePatch` instead of bare content; `createTemplate(content, name?)` gained an optional name.
  - `useExport`'s methods take an explicit fonts payload and its options are now just `{ authManager }` — the `canUseCustomFonts` entitlement gate moved into `createCloudRenderProvider`, where plan gating belongs. New `resolveExportFonts()` helper.
  - New exports: `createCloudTemplatesProvider`, `createCloudRenderProvider`.

  `editor.toMjml()` / `toHtml()` also now pass the editor's resolved fonts to the bundled renderer. A template using a custom font family previously exported with no `<mj-font>` declaration and no fallback stack, so mail clients silently substituted.

  `initCloud()` deliberately does **not** take this key. Cloud renders server-side for delivery as well — test email, scheduled sends and API exports — so a consumer-supplied renderer would have changed `toMjml()` / `toHtml()` and nothing else, leaving what you preview and export out of step with what Cloud sends. One passed from JavaScript is ignored with a console warning. For your own MJML on Cloud, call `renderToMjml(editor.getContent())` directly.

- d256b41: Add a bring-your-own **templates provider**: the editor's save/load lifecycle over your own storage.

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

  Also fixed: a save that resolves _after_ an edit landed mid-flight no longer clears the dirty flag. Clearing it claimed the edit was persisted, and — because autosave decides dirtiness at debounce time — made the follow-up save skip it.

  Docs: [Saving & Loading Templates](https://docs.templatical.com/backend/templates).

- d256b41: Version history becomes a bring-your-own provider, and "snapshot" is renamed to "version" throughout.

  `init()` takes a new `versionHistory?: VersionHistoryProvider` key. Configure it and the editor grows a history control in the header — step older and newer through past states, preview one on the canvas, restore it. Omit it and none of that UI is downloaded.

  ```ts
  init({
    container,
    templates: myTemplatesProvider,
    versionHistory: {
      list: (templateId) =>
        fetch(`/api/templates/${templateId}/versions`).then((r) => r.json()),
      get: (templateId, versionId) =>
        fetch(`/api/templates/${templateId}/versions/${versionId}`)
          .then((r) => r.json())
          .then((v) => v.content),
      create: false,
      restore: (templateId, versionId) =>
        fetch(`/api/templates/${templateId}/versions/${versionId}/restore`, {
          method: "POST",
        }).then((r) => r.json()),
    },
  });
  ```

  `list` and `get` are the operations and cannot be disabled; `create` and `restore` each take `false` instead of a function, so turning one off is a decision you state rather than something you get by forgetting a method.

  **Your `save` records the versions, not the editor.** Whichever `TemplatesProvider.save` you supply decides whether a save also records a version, which keeps throttling, retention and dedupe with the side that pays for the storage. `create` exists for versions a person asks for; the editor never calls it on its own.

  That rule is literal, and restore is no exception. Confirming a restore discards unsaved work, so **Restore asks first when there are unsaved changes** and offers to save them before restoring — through your ordinary `templates.save`, user-initiated. Without a `templates` provider, or with one whose `save` is `false`, the offer isn't made and the confirmation says plainly that the changes will be lost, because there is nowhere to put them.

  `initCloud()` does **not** take `versionHistory`, exactly as it does not take `templates`: a version is keyed to a template id Cloud issued, and Cloud's templates adapter keeps recording into Cloud's own store regardless. One passed from JavaScript is ignored with a console warning.

  **Restore is append-only** — it adds an entry rather than rewriting one. A backend with no atomic endpoint composes it in one line (`get` the old content, then `save` it), which the docs spell out.

  **Scrubbing stays synchronous.** Each `TemplateVersion` may carry an optional `content` — a _cache hint_, evaluated per entry, never an alternative to `get`. When it is present the editor previews that version in the same tick; when it is absent it calls `get` once and caches the result. So a provider that hydrates recent versions and omits older ones is a supported middle ground, and Templatical Cloud (which returns content on every entry) never waits.

  ### Breaking — snapshot → version, everywhere

  The rename is the largest part of this release. Cloud's REST routes change too.

  | Before                                                                   | After                                                                                                                                                     |
  | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `TemplateSnapshot` (`@templatical/types`)                                | `TemplateVersionResponse` — still Cloud's snake_case wire shape. The contract shape is the new camelCase `TemplateVersion`                                |
  | `useSnapshotHistory` (`@templatical/core/cloud`)                         | **Removed.** The reactive state is now `useVersionHistory` in `@templatical/core`, shared by both tiers, and takes a provider instead of an `authManager` |
  | `editor.createSnapshot()` (cloud core)                                   | **Removed.** A save records a version; `versionHistory.create` records one on demand                                                                      |
  | `ApiClient.getSnapshots` / `createSnapshot` / `restoreSnapshot`          | `getVersions` / `getVersion` / `createVersion` / `restoreVersion`                                                                                         |
  | `API_ROUTES["snapshots.*"]`, `templates/{id}/snapshots`                  | `API_ROUTES["versions.*"]`, `templates/{id}/versions`                                                                                                     |
  | `snapshotHistory.*` / `snapshotPreview.*` translation keys (cloud chunk) | `versionHistory.*` / `versionPreview.*` in the **OSS** chunk, in all seven OSS locales                                                                    |

  "Snapshot" was an implementation word, and it collided with the editor's undo/redo history — a different thing entirely (in-session, unsaved, per-keystroke).

  ### Breaking — Cloud internals (`@templatical/core/cloud`)

  Consumers using `initCloud()` are unaffected; these matter only if you import the cloud subpath directly.

  - `useEditor({ authManager })` is gone — the option was unused once persistence moved behind `TemplatesProvider`. Pass `templates` alone.
  - `createCloudTemplatesProvider`'s `save` now also records an automatic version, throttled to at most one per minute, and records nothing for a rename-only patch. This replaces the editor-side `createSnapshot()` on a timer, which put Cloud's retention policy in the editor. A version write that fails still resolves the save, but now logs a warning instead of being swallowed.
  - New export: `createCloudVersionHistoryProvider`.

  ### Cloud behaviour changes
  - **Autosave saves the template.** It previously created a snapshot and left the template itself unsaved, which meant "autosave" named two different things across the two entry points. It now routes through the same save the header button uses.
  - **Autosave does not fire while the lint save-gate would block.** No modal — one firing on a debounce timer would interrupt typing — but no save either, so `accessibility.blockOnError` stays a policy on every write path rather than a manual-save-only speed bump. The header keeps saying "unsaved", which is true, and the blocking issues stay listed in the Issues panel. Cmd+S and the header button remain gated, modal and all.
  - **The history list re-reads on every open** rather than only when empty, and no longer re-reads after every save. History also grows server-side, so a list fetched once went stale silently; and a refresh per save was a round-trip for a dropdown nobody had open.
  - The history control and preview banner are now shared components lazily loaded behind the capability, so an OSS consumer without a provider pays nothing for them.

  `VersionHistoryProvider.list` resolves to `{ versions, nextCursor? }` rather than a bare `TemplateVersion[]`, and `VersionHistoryListParams` carries `{ limit?, cursor? }`. The editor loads one page and calls `list` bare; a store that returns its whole history at once omits `nextCursor`. The envelope is there so that adding pagination later is not a breaking change — reserving only the params object would have covered the request and left the response needing a new shape.

### Patch Changes

- Updated dependencies [d256b41]
- Updated dependencies [d256b41]
- Updated dependencies [d256b41]
- Updated dependencies [d256b41]
- Updated dependencies [d256b41]
  - @templatical/types@0.27.0

## 0.26.3

### Patch Changes

- @templatical/types@0.26.3

## 0.26.2

### Patch Changes

- Updated dependencies [4b976a8]
  - @templatical/types@0.26.2

## 0.26.1

### Patch Changes

- Updated dependencies [a95274c]
  - @templatical/types@0.26.1

## 0.26.0

### Patch Changes

- Updated dependencies [753262e]
  - @templatical/types@0.26.0

## 0.25.2

### Patch Changes

- cff9e99: Fix `onChange` never firing for the first content change after the dirty flag resets (#522).

  Auto-save's watcher runs synchronously inside the mutation, before the editor sets `state.isDirty = true` — and `isDirty` sits outside the watched `content` subtree, so setting it never re-triggers the watcher. The dirty check in the watcher therefore observed the pre-mutation flag and dropped the change entirely; a second edit was needed before `onChange` fired at all. Dirtiness is now decided at debounce time, where the flag is settled.

  Affects both editors. In `init()` this swallowed the first edit of the session; in `initCloud()` it recurred, since `create` / `load` / `save` each reset `isDirty` — so the first edit after every save skipped its auto-snapshot.
  - @templatical/types@0.25.2

## 0.25.1

### Patch Changes

- @templatical/types@0.25.1

## 0.25.0

### Patch Changes

- Updated dependencies [7c24a7c]
  - @templatical/types@0.25.0

## 0.24.1

### Patch Changes

- @templatical/types@0.24.1

## 0.24.0

### Patch Changes

- Updated dependencies [c9b9eea]
  - @templatical/types@0.24.0

## 0.23.0

### Minor Changes

- 7d51750: Add **bring-your-own test emails** — let users mail themselves the template they're editing, sent through your own infrastructure.

  Previously Cloud-only. Now `init()` accepts a `testEmail` provider and one method is the whole integration:

  ```ts
  await init({
    container: "#editor",
    testEmail: {
      send: async ({ recipient, content }) => {
        const res = await fetch("/api/test-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipient, content }),
        });
        if (!res.ok) throw new Error("Could not send the test email");
      },
    },
  });
  ```

  The editor owns the trigger, the dialog, recipient validation and the sending / success / error states; you own delivery. Omit `testEmail` and the feature is entirely absent — no button, and none of its UI code is downloaded.

  **Restricting recipients.** `allowedRecipients` drives the dialog: omitted gives a free-text field, one entry a read-only field, several a picker, and an empty array means nobody may be sent to (so no button renders at all). It restricts the _picker_ only — the array lives in the user's browser, so **validate the recipient on your server**.

  **Optional MJML.** Set `includeMjml` and the payload carries the rendered MJML, saving you a `renderToMjml()` call. It needs the optional `@templatical/renderer` peer; without it the send still happens with JSON only and one warning is logged, so always guard for `payload.mjml` being absent.

  **A live preview.** The dialog renders the template chrome-free at email width with a desktop / mobile switch, so a user can confirm what they're sending without leaving it. It honours display conditions — a block a condition excludes is omitted, so the preview never shows content the recipient won't get — and responsive blocks follow the switch rather than always rendering desktop. Merge tags render unresolved, and the dialog says so: it answers "is this the right template?", not "is this exactly what lands in the inbox?".

  `SavedBlockPreviewCanvas` is renamed **`BlockPreviewCanvas`** now that saved blocks and test email both use it, and gained a `viewport` prop plus condition filtering. Both default to the previous behaviour, so saved-block previews are unchanged. Internal component, not part of the public API.

  **Preview widths now come from one place.** A new `getEmailFrameWidth(settings, viewport)` helper backs the canvas, the preview canvas and the save dialog's scaled rows. Previously the previews hardcoded 600px while the canvas used the template's own `settings.width`, so a template with a custom body width previewed at the wrong size — and the save dialog's `transform: scale()` divided by that same hardcoded number, so the two had to agree by coincidence rather than by construction.

  **Upgrading to Cloud is a deletion.** `initCloud()` takes the same `testEmail` key with the same type: omit it and Templatical Cloud sends (using its own deliverability infrastructure and a server-signed recipient list), or leave it exactly as it is to keep your own sender — useful when mail must leave your own infrastructure for compliance reasons. Your users see no difference; the button, dialog and flow are the same components in both editors.

  New exports: `TestEmailProvider` and `TestEmailPayload` from `@templatical/types` and `@templatical/editor`, plus `createCloudTestEmailProvider` from `@templatical/core/cloud`.

  **Cloud internals changed.** `useTestEmail` is now configuration only — `isEnabled`, `allowedEmails` and a new `getSignature` — and its `sendTestEmail` / `isSending` / `error` members are gone, replaced by `createCloudTestEmailProvider` driving the shared editor seam. This keeps exactly one send path behind one UI. No runtime impact for `initCloud()` consumers, whose configuration is unchanged; only direct callers of the composable are affected, and Templatical Cloud has not shipped.

  Also fixed while migrating: an empty allowed-recipient list previously rendered a dialog with an empty picker and a permanently disabled Send button, instead of hiding the feature.

### Patch Changes

- Updated dependencies [7d51750]
  - @templatical/types@0.23.0

## 0.22.0

### Patch Changes

- @templatical/types@0.22.0

## 0.21.2

### Patch Changes

- Updated dependencies [635eb7e]
  - @templatical/types@0.21.2

## 0.21.1

### Patch Changes

- @templatical/types@0.21.1

## 0.21.0

### Minor Changes

- fc545c2: Open-source **Saved Blocks** — reusable groups of blocks users save and re-insert — backed by a consumer-supplied storage provider. Previously Cloud-only ("Saved Modules").

  The editor owns the UI; you own persistence. Templatical Cloud now consumes the same interface as one adapter rather than a separate implementation.

  Saving starts from a block's bookmark action and opens a **pick session**: plain clicks add or remove blocks on the canvas, a bar shows the count with Save/Cancel (Escape cancels, Enter confirms), and Save opens a dialog that asks for a name and previews the picked blocks. The preview lists them in pick order and each row can be dragged (or moved with the arrow keys from its grip handle) to reorder before saving; blocks are stored in whatever order the list ends in. Picking never touches the editor's block selection. Browsing gives search, an optional free-text **category** filter, live preview, insert-at-position, rename and delete. A category is set in the save dialog (suggesting the ones already in use) and editable inline afterwards; it is flat and optional — there are no folders. Both filters run in the editor over whatever `list()` returned, so a provider that simply returns its entries gets search and categories for free.

  **Permissions are the implementer's to set.** Each mutation on the provider is `false | fn`: pass `false` and the editor hides that affordance rather than letting the user try and fail. For exceptions on individual entries, return `canUpdate` / `canDelete` on them — absent means allowed. Setting all three to `false` gives a read-only library users still browse, preview and insert from, since insertion never touches your store. `list` cannot be disabled.

  **Nothing is fetched until the user opens the browser or the save dialog** — `list()` is never called on editor load. The rail entry is present from the first paint whenever a provider is configured, so a slow or empty `list()` can neither delay the editor nor shift the sidebar; the browser shows skeleton rows on a first open, and reopens render the previous entries while refreshing underneath.

  ```js
  import {
    init,
    createLocalStorageSavedBlocksProvider,
  } from "@templatical/editor";

  // Zero-backend option, for demos and prototypes:
  await init({
    container: "#editor",
    savedBlocks: createLocalStorageSavedBlocksProvider(),
  });

  // Or implement `SavedBlocksProvider` against your own API:
  await init({ container: "#editor", savedBlocks: myProvider });
  ```

  **Off by default.** With no `savedBlocks` provider the feature is entirely absent and none of its UI code is downloaded — the pick bar and both dialogs are lazily loaded chunks fetched only when actually used.

  Ordering belongs to the provider: the browser renders `list()`'s order verbatim and never re-sorts, so you control it server-side. `createdAt` / `updatedAt` are display only — each entry shows a relative timestamp (hover for the absolute date) and both fields are optional.

  New exports:

  - `@templatical/types` — `SavedBlock`, `SavedBlocksListParams`, `SavedBlocksProvider`
  - `@templatical/core` — `useSavedBlocks`, `createLocalStorageSavedBlocksProvider`
  - `@templatical/core/cloud` — `createCloudSavedBlocksProvider`
  - `@templatical/editor` — `savedBlocks` config option, plus re-exports of the provider factory and types

  ### Breaking changes
  - **`useSavedModules` is removed** from `@templatical/core/cloud`. Use `useSavedBlocks` from `@templatical/core` with a provider — `createCloudSavedBlocksProvider(authManager)` for Cloud. The return shape changed: `modules`/`loadModules`/`createModule`/`updateModule`/`deleteModule` → `savedBlocks`/`load`/`create`/`update`/`remove`.
  - **`SavedModule` is removed** from `@templatical/types`. Use `SavedBlock`, whose `createdAt`/`updatedAt` are now optional (a browser-local or in-memory store may not track them).
  - **`initCloud()`'s `modules` option is renamed to `savedBlocks`.** `modules: false` becomes `savedBlocks: false`.
  - **Editor translation keys renamed.** `blockActions.saveAsModule` → `blockActions.saveAsBlock`, `sidebarNav.browseModules` → `sidebarNav.browseSavedBlocks`, and the cloud chunk's `modules.*` namespace moved into the OSS chunk as `savedBlocks.*`. Only affects consumers overriding translations directly.

  The Cloud REST contract is unchanged: `ApiClient.listModules`/`createModule`/`updateModule`/`deleteModule` and the `saved-modules` routes keep their names and paths.

  ### Fixes
  - Cloud no longer renders a dead "save as block" button on plans without the saved-blocks entitlement. Availability is now a reactive signal on the capability, so the control appears only when the feature actually works.

### Patch Changes

- Updated dependencies [fc545c2]
  - @templatical/types@0.21.0

## 0.20.0

### Patch Changes

- Updated dependencies [90f088e]
  - @templatical/types@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [ef6deec]
- Updated dependencies [b8fbca0]
  - @templatical/types@0.19.0

## 0.18.0

### Patch Changes

- @templatical/types@0.18.0

## 0.17.1

### Patch Changes

- @templatical/types@0.17.1

## 0.17.0

### Patch Changes

- @templatical/types@0.17.0

## 0.16.5

### Patch Changes

- @templatical/types@0.16.5

## 0.16.4

### Patch Changes

- Updated dependencies [1801876]
  - @templatical/types@0.16.4

## 0.16.3

### Patch Changes

- @templatical/types@0.16.3

## 0.16.2

### Patch Changes

- @templatical/types@0.16.2

## 0.16.1

### Patch Changes

- @templatical/types@0.16.1

## 0.16.0

### Patch Changes

- Updated dependencies [e5156a5]
- Updated dependencies [d35d36e]
  - @templatical/types@0.16.0

## 0.15.1

### Patch Changes

- @templatical/types@0.15.1

## 0.15.0

### Patch Changes

- Updated dependencies [7afeacb]
  - @templatical/types@0.15.0

## 0.14.0

### Patch Changes

- a476576: Fix the editor allowing a section to be dropped into another section's column (dragged from the sidebar palette) and then silently losing it on export. MJML cannot nest `mj-section` inside `mj-column`, so `renderToMjml()` / `editor.toMjml()` dropped the nested section and all of its content. Dragging a section into a column is now rejected up front, and the core `addBlock` / `moveBlock` APIs refuse to nest a section into a column, so the invalid state can no longer be created. (#292)
- Updated dependencies [710c9be]
- Updated dependencies [718d781]
  - @templatical/types@0.14.0

## 0.13.0

### Patch Changes

- @templatical/types@0.13.0

## 0.12.1

### Patch Changes

- @templatical/types@0.12.1

## 0.12.0

### Patch Changes

- Updated dependencies [7b76e46]
- Updated dependencies [67f44fb]
- Updated dependencies [a209073]
  - @templatical/types@0.12.0

## 0.11.1

### Patch Changes

- @templatical/types@0.11.1

## 0.11.0

### Patch Changes

- @templatical/types@0.11.0

## 0.10.4

### Patch Changes

- @templatical/types@0.10.4

## 0.10.3

### Patch Changes

- @templatical/types@0.10.3

## 0.10.2

### Patch Changes

- 5676cb3: Fix `Converting circular structure to JSON` when exporting after a drag inside a section (#203)

  Dragging a block within a section column could leave a Sortable expando back-ref (`HTMLDivElement.SortableXXX → instance → el → div`) reachable from the editor's live content. The public `getContent()` serialized with a naked `JSON.stringify`, so it threw on that cycle and broke export until the section was removed.

  - `@templatical/types`: add the cycle-safe `safeClone()` helper (`WeakSet`-replacer JSON round-trip that drops self-referencing back-refs instead of throwing).
  - `@templatical/editor`: `init().getContent()` and `initCloud().getContent()` now clone via `safeClone()`; the pre-ready fallback also defaults to an empty template instead of throwing when no content was supplied.
  - `@templatical/core`: `history.cloneContent()` now reuses `safeClone()` (same behavior, deduplicated).

- Updated dependencies [5676cb3]
  - @templatical/types@0.10.2

## 0.10.1

### Patch Changes

- c7eb7ae: Fix a batch of correctness and data-loss bugs found during an audit

  Each fix ships with a regression test that fails without the change.
  - **`@templatical/editor` — rich-text URL sanitizer XSS bypass.** `isSafeUrl`
    only `.trim()`-ed the value before scheme matching, so payloads with embedded
    tab/newline/CR or leading control characters (e.g. `java\tscript:…`,
    `\x01javascript:…`) matched no scheme and were treated as safe, yet re-formed a
    live `javascript:` URL once rendered. The value is now normalized the way the
    WHATWG URL parser does (strip ASCII tab/LF/CR anywhere, strip leading
    C0-control/space) before the scheme check.
  - **`@templatical/core` (cloud) — `moveBlock` data loss.** The cloud editor
    spliced a block out of its parent before resolving the destination, so an
    invalid/stale `targetSectionId`, a non-section target, or an out-of-range
    `columnIndex` (all reachable via remote MCP/collaboration `move_block`
    payloads) dropped the block irrecoverably. It now resolves and validates the
    target before mutating the source, mirroring the OSS editor.
  - **`@templatical/core` (cloud) — collaboration broadcast positioning.** The
    `addBlock` broadcast wrapper dropped the 4th `index` argument, so duplicating a
    block or inserting a saved module at a position appended it to the end and
    desynced collaborators. The wrapper now forwards `index` and includes it in the
    broadcast payload.
  - **`@templatical/editor` — table cell edits clobbered in shadow DOM.** The
    `v-cell-content` guard compared `el.ownerDocument.activeElement`, which returns
    the shadow host (never the inner `<td>`) in the default shadow-DOM mount, so a
    concurrent external `update_block` overwrote in-progress keystrokes. It now
    resolves the focused element via `el.getRootNode().activeElement`.
  - **`@templatical/renderer` — display conditions dropped on nested blocks.**
    Blocks inside a section column never received their `{% if %}`/`{% endif %}`
    display-condition guards, so conditional content in a multi-column layout
    rendered unconditionally for every recipient. Display-condition wrapping is now
    applied to nested blocks too.
  - **`@templatical/editor` — snapshot restore failure left wrong content.** When a
    snapshot restore failed, the editor was left showing the previewed snapshot as
    the live document with the banner gone and the backup discarded. The content is
    now rolled back to the pre-preview state on failure, and the restore is no
    longer an unhandled promise rejection.
  - **`@templatical/media-library` — crop resize aspect-ratio distortion.**
    `resizeCanvas` injected a spurious factor when `maxWidth` was set but only
    `maxHeight` clamped, squishing the image horizontally and disagreeing with the
    on-screen preview. It now scales width by `maxHeight / targetHeight`.
  - **`@templatical/import-html` — wrapper-div content reordering.** Loose content
    appearing before a table inside a wrapping `<div>`/`<center>`/`<main>` was
    emitted after the table-derived sections, reordering the document. Pending loose
    content is now flushed before each nested table.
  - **`@templatical/import-html` — paragraph alignment dropped.** A container's
    `text-align` was lost when the inner `<p>` carried a non-style attribute
    (`class`/`id`/`dir`/…). Alignment is now applied with an attribute-tolerant
    matcher that merges into any existing `style`.
  - **`@templatical/import-beefree` — single-column row background dropped.** A
    single-column row's background color was discarded because only multi-column
    rows were wrapped in a section. Single-column rows with a non-transparent
    background are now wrapped in a one-column section carrying the background.

- 2ed1b80: Migrate the framework-agnostic packages from tsup to tsdown (Rolldown + Oxc)

  The six framework-agnostic library packages — `types`, `core`, `renderer`,
  `import-beefree`, `import-unlayer`, `import-html` — now build with
  [`tsdown`](https://tsdown.dev) instead of tsup. This drops `rollup` /
  `rollup-plugin-dts` from the build path and aligns these packages with Rolldown
  (which Vite already uses). Published output is functionally equivalent: same ESM
  exports, same externals, equivalent `.d.ts`.

  The Vue/CSS packages (`editor`, `media-library`) and `quality` deliberately
  remain on Vite + `vue-tsc`/`tsc` + `@microsoft/api-extractor` — `rolldown-plugin-dts`
  inlines the editor's bundled-but-type-external third-party surface (~950 kB vs
  ~11 kB), and Vite's batteries-included handling (env replacement, CSS/Tailwind,
  glob, dts externalization) isn't worth reconstructing manually there.

- Updated dependencies [2ed1b80]
  - @templatical/types@0.10.1

## 0.10.0

### Patch Changes

- Updated dependencies [2d9779b]
- Updated dependencies [ac9eab8]
- Updated dependencies [5d961a3]
- Updated dependencies [4309923]
- Updated dependencies [af913bb]
- Updated dependencies [72e1e58]
  - @templatical/types@0.10.0

## 0.9.1

### Patch Changes

- @templatical/types@0.9.1

## 0.9.0

### Patch Changes

- Updated dependencies [4dfe37e]
  - @templatical/types@0.9.0

## 0.8.5

### Patch Changes

- 674571b: Harden HTML/regex hot paths against polynomial-ReDoS and incomplete-sanitization classes flagged by GitHub code scanning. All changes preserve existing public APIs.
  - `@templatical/types`: rewrite `resolveHtmlMergeTagLabels` / `resolveHtmlLogicMergeTagLabels` from a `<span[^>]*…[^>]*>` regex to a single-pass linear scanner. Adversarial inputs that used to take O(n²) now complete in O(n).
  - `@templatical/renderer`: same linear-scanner rewrite for `convertMergeTagsToValues`. Paragraph stripper changed `[^>]*` → `[^<>]*` so it fails fast on `<p<p<p…`-style inputs.
  - `@templatical/quality`: linear-time HTML-comment stripper in `hasNestedAnchors`. An unterminated `<!--` now drops the rest of the input rather than leaving the literal `<!--` behind (closes the incomplete-sanitization gap). The `link.javascript-protocol` rule now also flags `data:` and `vbscript:` URLs — both can encode executable script and were previously only flagged as the lower-severity `link.unsupported-protocol`. Rule ID unchanged; message gained a `{protocol}` placeholder. Severity overrides set against `link.javascript-protocol` continue to apply.
  - `@templatical/import-unlayer` / `@templatical/import-beefree`: replace `<p[^>]*>([\s\S]*?)</p>` paragraph-wrap regex with a linear scanner. Button-label sanitizer now drops unterminated `<script` fragments instead of leaving them in the imported JSON. `parsePxValue` collapses two whitespace quantifiers around an optional `px` so trailing whitespace can't trigger backtracking.
  - CI: every job in `.github/workflows/ci.yml` now runs under a least-privilege `permissions: contents: read` token. Closes the missing-workflow-permissions alerts.
  - Playground Cloudflare Worker: `generateId` switched from `bytes[i] % 62` (biased — indices 0..7 were ~25% more likely than 8..61) to rejection sampling for a uniform distribution over the alphabet.

  Regression coverage added: 13 new tests assert linear-time behavior on 10k–50k-char adversarial inputs (bounded at 500ms), plus correctness tests for the new dangerous-protocol coverage, nested-span rewriting, and button-label sanitization edge cases.

- Updated dependencies [674571b]
  - @templatical/types@0.8.5

## 0.8.4

### Patch Changes

- @templatical/types@0.8.4

## 0.8.3

### Patch Changes

- @templatical/types@0.8.3

## 0.8.2

### Patch Changes

- @templatical/types@0.8.2

## 0.8.1

### Patch Changes

- @templatical/types@0.8.1

## 0.8.0

### Patch Changes

- @templatical/types@0.8.0

## 0.7.3

### Patch Changes

- 507c5be: Batch of bug fixes hardening editor correctness and security:
  - **Link dialog rejects dangerous URL schemes.** `javascript:`, `data:`, `vbscript:`, `file:` (plus case-bypasses like `JaVaScRiPt:` and whitespace-padded variants) are now dropped at link-insert time. Safe schemes (`http`, `https`, `mailto`, `tel`, `ftp`, `ftps`, `sms`, `xmpp`, `cid`) and `#` anchors still pass through.
  - **`v-html` content sanitized before render.** `ParagraphBlock` and `TitleBlock` now scrub `<script>`/`<style>`/`<iframe>`/`on*` event handlers and unsafe `href` / `src` schemes from `block.content` before binding it to `v-html`. Closes the XSS path where a malicious or compromised template JSON could execute code on canvas load. TipTap-authored content (the common case) is unaffected.
  - **Block duplication regenerates nested IDs.** Cloning a `table`, `social`, or `menu` block previously reused identical `rows[].id` / `cells[].id` / `icons[].id` / `items[].id` from the source, violating the unique-id invariant.
  - **Removing a section clears descendant selection.** Previously, deleting an ancestor with a child selected left `selectedBlockId` dangling on the now-orphan id. The full subtree is walked on remove and selection is cleared if any descendant id matches.
  - **`addBlock` / `moveBlock` validate `columnIndex` against the section layout.** Passing `columnIndex: 5` on a `"2"`-layout section no longer creates phantom columns persisted into JSON; out-of-range indices are rejected and `moveBlock` leaves the source intact.
  - **Media-picker callers guard against post-unmount writes.** `ImageBlock`, `ImageToolbar`, `VideoToolbar`, and the custom-block `ImageField` now check an alive flag after `await onRequestMedia()`. Closing the editor mid-pick no longer triggers zombie `emit("update")` / pulse-ref writes on a torn-down component.
  - **Keyboard shortcuts scoped to the active editor when two are mounted.** Each `useEditorCore` instance previously installed its own `document` keydown listener, so a single `Cmd+Z` fired both editors' undo handlers. The new `activeEditorTracker` routes shortcuts to the editor the user most recently interacted with (single-editor pages keep the original always-active behavior).
  - **`MergeTagSuggestion` cancels its pending `requestAnimationFrame` on exit.** The reposition-after-paint frame previously ran after the popup tore down, pinning the Vue app and DOM nodes for one frame.
  - **`useMergeTagField.insertMergeTag` no longer emits after the host component unmounts.** A scope-dispose flag now gates the post-`await requestMergeTag()` writes (emit + `isEditing` + `nextTick`).
  - **`useFonts.loadCustomFonts` no longer flips `isLoaded` after dispose.** The post-`Promise.allSettled` write is gated by the same scope-dispose flag.
  - @templatical/types@0.7.3

## 0.7.2

### Patch Changes

- 5d1b0c5: Block clone now inserts directly after the source block (in the same section column when applicable) instead of appending to the end of the canvas. Action bar now follows the editor's UI theme — appears dark in editor dark mode instead of being forced light by the canvas-wrapper override. Canvas dark-mode preview refactored: filter moved from `.tpl-canvas-wrapper` onto a sibling bg layer + per-block `.tpl-block-content` wrapper, so block chrome (action bar, indicators) is never inside the filter region — no more counter-filter flicker when toggling dark preview. Fixes drag-inside-section in Chrome: all three `<VueDraggable>` instances (sidebar, canvas, section) now use `force-fallback` to bypass Chrome's silent failure to initiate native drag from a nested HTML5 Sortable AND to ensure consistent cross-list drag-over coordination (Sortable only binds native `dragover` in HTML5 mode, so mixing modes breaks cross-list drops). Fixes a `cyclic object value` error that broke clone/move after a within-section drag — `history.cloneContent` is now cycle-safe (drops back-refs instead of throwing) and `SectionBlock.setColumnBlocks` deep-clones each emitted block to strip any Sortable expando the drag handler might attach. Adds `findBlockLocation(blockId)` to `useEditor` (and the cloud variant) and an optional `findBlockLocation` option on `useBlockActions` to power the new "insert clone after source" behavior.
  - @templatical/types@0.7.2

## 0.7.1

### Patch Changes

- @templatical/types@0.7.1

## 0.7.0

### Patch Changes

- @templatical/types@0.7.0

## 0.6.7

### Patch Changes

- @templatical/types@0.6.7

## 0.6.6

### Patch Changes

- @templatical/types@0.6.6

## 0.6.5

### Patch Changes

- @templatical/types@0.6.5

## 0.6.4

### Patch Changes

- @templatical/types@0.6.4

## 0.6.3

### Patch Changes

- @templatical/types@0.6.3

## 0.6.2

### Patch Changes

- de4b0a3: Polish and general bug fixes
  - @templatical/types@0.6.2

## 0.6.1

### Patch Changes

- @templatical/types@0.6.1

## 0.6.0

### Patch Changes

- Updated dependencies [55002de]
  - @templatical/types@1.0.0

## 0.5.1

### Patch Changes

- @templatical/types@0.5.1

## 0.5.0

### Patch Changes

- @templatical/types@1.0.0

## 0.4.0

### Minor Changes

- f5a94ab: Add new `@templatical/import-unlayer` package that converts Unlayer design JSON (the output of `editor.saveDesign(...)`) into Templatical's `TemplateContent` shape. Mirrors `@templatical/import-beefree`: maps `text`, `heading`, `image`, `button`, `divider`, `html`, `menu`, `social`, `video`; reports `timer` as html-fallback and `form` as skipped; flattens 4+ column rows; surfaces a per-content conversion report. MIT-licensed.

  The Unlayer migration guide (`/guide/migration-from-unlayer` and `/de/guide/migration-from-unlayer`) is rewritten around the importer. The playground replaces the BeeFree-only chooser button with a single "Import existing template" modal that exposes BeeFree and Unlayer as tabs. README, license FAQ, security policy, and contributing guide reflect the new package; cloud headless API reference adds the matching `templates/import/from-unlayer` route row.

### Patch Changes

- Updated dependencies [f5a94ab]
  - @templatical/types@1.0.0

## 0.3.2

### Patch Changes

- @templatical/types@0.3.2

## 0.3.1

### Patch Changes

- @templatical/types@0.3.1

## 0.3.0

### Minor Changes

- d65bb0f: Merge tag autocomplete in rich text editors. Typing the syntax opener (e.g. `{{` for Liquid/Handlebars, `*|` for Mailchimp, `%%=` for AMPscript) inside a paragraph or title block surfaces a popup of matching merge tags. Selecting an item (mouse click, `Enter`, or `Tab`) inserts the tag as a styled node — same form as the toolbar picker.

  **`@templatical/types`**
  - New `getSyntaxTriggerChar(syntax)` helper that maps a `SyntaxPreset` to its trigger string (`"{{"`, `"*|"`, `"%%="`) or `null` for custom regex syntaxes.
  - `MergeTagsConfig` gains optional `autocomplete?: boolean` (default `true`). Set to `false` to disable the popup while keeping the toolbar picker available.

  **`@templatical/editor`**
  - New `MergeTagSuggestion` TipTap extension built on `@tiptap/suggestion`. Filters tags case-insensitively against `label` and `value`, capped at 10 results.
  - New `MergeTagSuggestionList.vue` popup component — keyboard navigable (`↑`/`↓`/`Enter`/`Tab`/`Esc`), ARIA combobox-compliant (`role="combobox"` + `aria-haspopup`/`aria-expanded`/`aria-controls`/`aria-activedescendant` on the contenteditable; `role="listbox"` + `role="option"` + stable per-option ids on the popup).
  - Wired into `ParagraphEditor.vue` and `TitleEditor.vue`. Autocomplete activates only when `tags` is non-empty AND `syntax` matches a built-in preset.
  - Popup mounts at the theme root (outside the Canvas's `filter`-induced containing block) so dark-mode positioning stays correct. Viewport-flip logic places the popup above the caret when there's not enough room below; constrained to `max-h: 50vh` with internal scrolling.
  - New i18n key `mergeTag.suggestionEmpty` (en + de).

  **Behavior**
  - Trigger fires regardless of preceding character (no whitespace requirement) — `.{{` opens the popup just like ` {{`.
  - Custom-regex syntaxes silently disable autocomplete since the trigger string can't be inferred.

  **Cloud editor**
  - Inherited transitively — `CloudEditor.vue` uses the same `ParagraphBlock`/`TitleBlock` components, so autocomplete works there as well with no extra wiring.

### Patch Changes

- Updated dependencies [d65bb0f]
  - @templatical/types@1.0.0

## 0.2.1

### Patch Changes

- e526711: Fix a batch of bugs uncovered by a targeted audit:
  - **`@templatical/core` `useAutoSave`**: a save scheduled inside the debounce window no longer fires after `enabled` flips to `false` or `pause()` is called. The setTimeout callback now re-checks both gates.
  - **`@templatical/media-library` `init()`**: two rapid `init()` calls no longer orphan the first-mounted Vue app. The "unmount existing" guard moved after the awaits so the second call observes the first instance.
  - **`@templatical/core` `useEditor.moveBlock`**: passing an invalid `targetSectionId` no longer deletes the block. The target section is resolved before the source is mutated, so an invalid target is now a clean no-op.
  - **`@templatical/core` `useEditor` lock checks**: `addBlock` and `moveBlock` now respect `isBlockLocked` for the target section / moved block, matching the existing checks on `updateBlock` and `removeBlock`.
  - **`@templatical/editor` keyboard shortcuts**: `Cmd/Ctrl+S` now triggers save when Caps Lock is on. The handler matches `e.key.toLowerCase() === "s"` to mirror the `z` (undo/redo) handler.
  - **`@templatical/editor` `init()` and `initCloud()`**: same race fix as the media-library one — concurrent calls no longer orphan the first-mounted editor app.
  - **`@templatical/types` `resolveSyntax`**: passing an unknown preset name now falls back to `liquid` instead of returning `undefined` and crashing downstream callers.
  - **`@templatical/editor` `useFonts`**: a custom font that fails to load is now registered for cleanup, so its `<link>` tag is removed on editor unmount instead of leaking in `<head>`.
  - **`@templatical/core` `useHistoryInterceptor`**: history snapshots are no longer recorded for no-op mutations (e.g. updating a peer-locked block), preventing the undo button from becoming a silent no-op.
  - **`@templatical/editor` `useRichTextEditor`**: unmounting the host component while TipTap extensions are still loading no longer leaks a TipTap editor instance. A `destroyed` guard short-circuits and disposes any editor created across the await boundary.
  - **`@templatical/media-library` `useMediaLibrary.loadItems` / `loadMore`**: a stale `browseMedia` response from a previous folder no longer overwrites the current view. Each request carries a monotonic token and only the latest response commits to state.
  - **`@templatical/types` `isMergeTagValue`**: handlebars logic tags such as `{{#if x}}` and `{{/if}}` are no longer misclassified as value merge tags by the liberal handlebars value regex.

- Updated dependencies [e526711]
  - @templatical/types@0.2.1

## 0.2.0

### Minor Changes

- 058dfff: This release bundles three changes: an OSS/Cloud locale split, a fix for missing custom blocks in MJML/JSON exports, and a fix for incorrect background-color attributes on inner MJML elements.

  ## OSS/Cloud locale split

  Split `@templatical/editor` translations into OSS and cloud chunks so external locale contributions only need to cover the open-source surface.

  **Editor i18n changes**
  - Added `packages/editor/src/i18n/locales/cloud/{en,de}.ts` containing strings used only by `initCloud()` features: AI chat / rewrite / menu, comments, collaboration, scoring, snapshots, plan limits (`header.*`), test email, saved modules, design reference, cloud loading/error overlays. These groups were removed from the OSS `locales/{en,de}.ts`.
  - New exports from `@templatical/editor`: `loadCloudTranslations(locale)`, `getSupportedCloudLocales()`, `isCloudLocaleSupported(locale)`, type `CloudTranslations`.
  - New injection key `CLOUD_TRANSLATIONS_KEY` and composables `useCloudI18n()` (returns `CloudTranslations | null` for shared components that conditionally render cloud UI) / `useCloudI18nStrict()` (throws if not provided, for cloud-only components).
  - `initCloud()` now loads OSS + cloud translation chunks in parallel and provides both. `init()` (OSS) loads only the OSS chunk — the cloud strings are tree-shaken from the OSS bundle.
  - Supported-locale lists are auto-derived via `import.meta.glob`. OSS and cloud locales are tracked separately, so an OSS-only contributor adding `locales/fr.ts` without `locales/cloud/fr.ts` ships a French OSS UI while the cloud chunk gracefully falls back to English at runtime.

  **Locale parity enforcement**
  - Type-driven: every non-`en` locale file is now annotated `: typeof en` so missing/extra/mistyped keys fail `pnpm run typecheck`.
  - Runtime: `tests/i18n.test.ts` discovers locale files via `import.meta.glob` and asserts nested-key parity plus per-key `{placeholder}` parity. OSS parity is hard-required; cloud parity is skip-if-absent (only enforced for cloud locales that exist on disk). Same pattern applied to `@templatical/media-library`.

  **Migration notes for embedders**
  - No public API removals. `Translations`, `useI18n()`, `loadTranslations()`, `getSupportedLocales()`, `isLocaleSupported()`, `TRANSLATIONS_KEY` keep their previous names and behavior — they just refer to the OSS surface now.
  - If you imported cloud-only string paths through `Translations` (e.g. `t.aiChat.title`), switch to `useCloudI18n()` / `useCloudI18nStrict()`. Within `initCloud()` the cloud strings are still available; they are no longer present on the OSS `Translations` type.
  - Existing locale overrides passed to `init()` / `initCloud()` continue to work. Cloud overrides are not yet a supported public input — only locale strings are.

  ## Custom blocks now appear in MJML/JSON exports

  Custom blocks were missing from MJML/JSON exports because their rendered HTML was never persisted from the editor's UI ref into the export pipeline. The fix moves custom-block resolution into the renderer itself as an explicit contract.

  **Renderer**
  - `renderToMjml(content, options?)` is now **async** (`Promise<string>`). Custom blocks may need async resolution.
  - New `RenderOptions.renderCustomBlock?: (block: CustomBlock) => Promise<string>` option. The renderer walks the tree, awaits all custom-block resolutions in parallel, then runs the existing sync render pass.
  - If no callback is provided, the renderer falls back to `block.renderedHtml` (if present) and otherwise omits the custom block from output.

  **Editor**
  - `editor.toMjml()` is now `Promise<string>` (was sync), always present (was optional). Wires the editor's internal block registry into the renderer's `renderCustomBlock` callback automatically.
  - If `@templatical/renderer` is not installed, `toMjml()` throws a clear error — the renderer remains an optional peer dependency.
  - New method `editor.renderCustomBlock(block): Promise<string>` for headless callers that want to drive the renderer directly while reusing the editor's registry.
  - The Cloud editor does **not** expose `toMjml()` — the cloud backend handles MJML conversion server-side with additional processing (signed image URLs, asset rewriting). Use the OSS `init()` if you want client-side export.

  **Migration**
  - Add `await` everywhere you call `editor.toMjml()` or `renderToMjml(content)`.
  - Drop any optional-chain (`editor.toMjml?.()`) — the method is always defined now.
  - Headless / Node.js consumers calling `renderToMjml` directly with custom blocks should pass a `renderCustomBlock` resolver (e.g. a Liquid engine running against `block.fieldValues`) — see the renderer README for the full pattern.

  ## MJML inner-element background colors now render correctly

  Inner MJML elements (`mj-text`, `mj-image`, `mj-table`, `mj-navbar`, `mj-video`) only support `container-background-color` per the MJML spec; passing `background-color` was silently dropped by MJML compilers, leaving the rendered email's `<td>` wrapper without a background. The renderer now emits the correct attribute. `mj-section` and `mj-button` continue to use the native `background-color` attribute they natively support.

  The rule is centralized in a new `bgAttr(color, "container" | "native")` helper so future renderers can't regress, and round-trip MJML→HTML compile tests (`tests/mjml-bg-roundtrip.test.ts`) catch the silent-drop class of bug.

### Patch Changes

- Updated dependencies [058dfff]
  - @templatical/types@0.2.0

## 0.1.2

### Patch Changes

- @templatical/types@0.1.2

## 0.1.1

### Patch Changes

- bdb338b: Fix consumer install/bundle of `@templatical/editor`.
  - **`@templatical/editor`/style.css export** — CSS now emits as `dist/style.css` so the `./style.css` subpath export resolves. Previously emitted as `dist/templatical-editor.css`, causing 404s for `import '@templatical/editor/style.css'` and breaking sandbox bundlers (bundlephobia, bundlejs).
  - **`@templatical/editor` peer deps** — `vue` and `tailwindcss` removed from `peerDependencies`. Vue is now bundled into the npm entry; Tailwind is build-time only (CSS already compiled). `npm install @templatical/editor` is now a complete install for any consumer (React, Svelte, Angular, vanilla, Vue) with no peer warnings. **Note for Vue app consumers:** Vue is now isolated inside the editor (Stripe-Elements pattern). Your Vue tree is unaffected, but Vue is shipped twice (~80KB gz duplicated).
  - **`@templatical/core`/cloud pusher-js** — clearer error when cloud features are used without the `pusher-js` optional peer installed.
  - @templatical/types@0.1.1

## 0.1.0

### Patch Changes

- @templatical/types@0.1.0

## 0.0.6

### Patch Changes

- @templatical/types@0.0.6

## 0.0.5

### Patch Changes

- @templatical/types@0.0.5

## 0.0.4

### Patch Changes

- @templatical/types@0.0.4

## 0.0.3

### Patch Changes

- @templatical/types@0.0.3

## 0.0.2

### Patch Changes

- c1de323: Include CDN build (ES module with code-split chunks) in the editor package at dist/cdn/. Drop IIFE build in favor of ES-only output for smaller initial load. Add pusher-js as a dependency in core for typecheck support.
  - @templatical/types@0.0.2
