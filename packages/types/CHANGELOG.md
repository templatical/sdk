# @templatical/types

## 0.27.5

## 0.27.4

## 0.27.3

## 0.27.2

## 0.27.1

### Patch Changes

- 18f6b38: Remove dead code, dead translations, and comments that only recorded history.

  ### Breaking — `restoreMergeTagMarkup` is removed from `@templatical/types`

  It converted raw `{{ tag }}` tokens in stored HTML back into `<span data-merge-tag>` markup, and nothing in the SDK called it. It was also **unsafe**: its only guard was a literal `data-merge-tag="` lookbehind, so a token in any other attribute had an element injected into the attribute value —

  ```html
  <a href="{{unsubscribe_url}}">
  <!-- became -->
  <a href="<span data-merge-tag="{{unsubscribe_url}}">Unsubscribe URL</span>">
  ```

  — which is worse than the bare token it was meant to fix. Position-awareness needs parsing, not better lookarounds, so the fix is a parse-based replacement rather than a patch to this function. If you were calling it, stop: it corrupts attribute-positioned tokens. Its private `escapeRegExp` helper went with it.

  ### Breaking — `_internal` is removed from `@templatical/import-html`

  A test-support barrel (`export const _internal = { convertButton, … }`) that the tests had stopped using. Removing it revealed `convertSpacer` as reachable only through it — a line-for-line duplicate of the live `buildSpacerFromCell` in `section-builder.ts`, which is what actually converts spacer cells. Both are gone; conversion output is unchanged.

  ### Smaller locale chunks

  **772 unused translation strings** removed across ten locale files. The bulk was an 81-key `mediaLibrary` block in the editor's own OSS locales — a key-for-key duplicate of `@templatical/media-library`'s, read by nothing, which every OSS consumer downloaded for a package they do not install. The rest were strings for UI that was never built: a 23-key `aiRewrite` block (the composable is headless and unaffected), add/remove row and column labels for a table toolbar that uses number inputs, singular `social.platform`/`social.url` beside the live plural `social.platforms[…]`, and video platform names nothing renders.

  Every OSS session fetches exactly one locale chunk, so this is a direct **~1.1 KB gzip (−14%)** off it; cloud locales drop 18–19%.

  Nothing in the public API changes: `init()` accepts only `locale`, with no way to supply or type against these keys.

  A new guard (`i18n-key-usage.test.ts`) now checks locale ↔ source agreement in both directions — no reference to a missing key, no key without a reader — which the existing locale-parity test and `typecheck` both structurally miss, since each compares locales to _each other_ or derives the type from `en.ts`.

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

## 0.26.3

## 0.26.2

### Patch Changes

- 4b976a8: Decode entity-encoded merge-tag attribute values

  Rich text is serialized with the tag value entity-encoded in the attribute, so
  stored content reads `data-merge-tag="&lt;% $email %&gt;"` for a tag configured
  as `<% $email %>`. Every resolver compared that raw string against the
  configured token, missed, and fell back to echoing the escaped token — which
  overwrote the correct label the moment the block left edit mode.

  Only tag values containing characters a serializer escapes (`<`, `>`, `&`) were
  affected, so it showed up on custom `mergeTags.syntax` configs and not on the
  built-in presets.

  Three fixes, one cause:

  - **Label mode** rendered the raw token over the label instead of `E-Mail`.
  - **Sample mode** double-escaped it (`&amp;lt;% $email %&amp;gt;`), rendering
    the entity text on screen rather than the configured sample.
  - **Export** emitted `&lt;% $email %&gt;` into the MJML, so the send engine
    received an escaped string instead of a token it recognises.

  `getTagAttrValue` now decodes character references — the named set a serializer
  emits plus decimal and hex numeric ones — which is what the attribute means.
  Decoding is single-pass, so `&amp;lt;` yields the literal text `&lt;` and an
  unknown reference is left alone.

## 0.26.1

### Patch Changes

- a95274c: Fix merge tags whose values contain `<` or `>` (custom `mergeTags.syntax`)

  A consumer-configured syntax such as Smarty's `<% $email %>` reaches the stored
  markup as literal `<` / `>` — HTML attribute serialization escapes only `&`, `"`
  and nbsp — and both merge-tag span scanners stopped at the first `>` regardless
  of quoting, so the attribute they parsed was truncated and no tag resolved.

  Two symptoms, one cause:

  - **Previews.** Sample mode showed the label instead of the configured `sample`,
    and Label mode left whatever text the span already carried.
  - **Export (worse).** `renderToMjml` left the entire
    `<span data-merge-tag="…">Label</span>` in the output, so the ESP never
    received the token and the recipient saw the label text. Silent — visible only
    in a delivered email.

  Tag boundaries and attribute values are now read by two quote-aware primitives
  shared by both packages, `findOpenTagEnd` and `getTagAttrValue` (newly exported
  from `@templatical/types`). Both are forward-only character scans, so the
  linear-time guarantee the previous regexes were written for still holds. Values
  in single-quoted and unquoted attributes now resolve too.

## 0.26.0

### Minor Changes

- 753262e: Add an alignment option to the button block (#536).

  `ButtonBlock` gains `align: "left" | "center" | "right"`, surfaced in the button toolbar as the same sliding control image, video, social, title, menu and table already use. The renderer passes it through to `mj-button`'s native `align` attribute, and the editor canvas — which previously hardcoded centering — now mirrors it, so the preview, saved-block previews and the test-email dialog all agree with what gets sent.

  **Breaking (types):** `align` is required, matching `ImageBlock` / `VideoBlock` / `SocialIconsBlock`. Code that constructs a `ButtonBlock` literal without going through `createButtonBlock()` must add the field. Nothing else changes: the factory defaults to `"center"`, and both the renderer and the editor fall back to `"center"` for templates stored before the field existed, so existing content renders byte-for-byte as it did.

  Note `align` has no visible effect when `width` is `"full"` — the button spans the column either way. The control stays visible in that state rather than appearing and disappearing with the width mode, matching the image toolbar.

  The three importers now carry button alignment across instead of dropping it: BeeFree and Unlayer read the button's own `text-align`, and the HTML importer reads the wrapping cell's `text-align` or its legacy `align` attribute (an anchor is sized to its content, so its own `text-align` says nothing about placement).

## 0.25.2

## 0.25.1

## 0.25.0

### Minor Changes

- 7c24a7c: Add **`resolvePreview`** — a hook that resolves the template for preview surfaces using your own backend, so previews can show real data instead of tokens.

  ```ts
  await init({
    container: "#editor",
    resolvePreview: async ({ content, recipient }) => {
      const res = await fetch("/api/resolve-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, recipient }),
      });
      if (!res.ok) throw new Error("Could not resolve");
      return res.json();
    },
  });
  ```

  **This is what `MergeTag.sample` cannot do.** Samples substitute value tags client-side; they can't evaluate **logic tags** — `{% if %}` … `{% endif %}` blocks stay visible as keyword badges, because substituting a value isn't taking a branch. The editor only ever _recognises_ tags — `syntax` is a pair of regexes, and logic tags pass through to the MJML for whatever sends the email to evaluate. Taking a branch needs your data and your template language, so only your backend can.

  **Preview surfaces only, never while editing.** Runs on entering preview mode and — in the test-email dialog — on every recipient change, debounced 500ms. The editing canvas always shows the tag you inserted.

  **Degrades, never breaks.** If the resolver rejects, or returns something that isn't a `TemplateContent`, the preview falls back to the unresolved template and says so inline. A shape check means a mis-shaped API response degrades rather than throwing inside the render. Failures are deliberately **not** routed to `onError`: a degraded preview is user-visible and non-fatal.

  **Races are handled.** A superseded response is discarded even when it settles last, so switching recipient twice can't land the first answer. A _first_ resolve shows a skeleton; a re-resolve keeps the previous result on screen rather than flashing over content that's already correct.

  **Supersedes sample values entirely.** Configuring a resolver turns `MergeTag.sample` off: the Sample/Label switch never renders and the preview hint names your backend as the data source. This applies from the first frame rather than once a result lands — gating it on resolved content made the switch appear for the debounce plus resolver latency and then vanish. It also keeps the failure note truthful, since that note says the _unresolved_ template is showing.

  **Supersedes the display-condition filter too**, for the same reason. A block hidden by hand via its filter icon would otherwise stay hidden over resolved content — vetoing the condition your backend just evaluated against real data, while the "Show all hidden blocks" button sat there claiming blocks were hidden that the preview was showing. The filter and that button now step aside whenever a resolver owns the preview. The hides are **suppressed, not discarded**: they return on leaving the preview, so a view toggle never loses work, including when the resolve fails and the unresolved template is what renders. Editing is untouched, and previewing _without_ a resolver keeps simulate-then-preview exactly as before.

  **Display-only, structurally.** Resolved content reaches preview surfaces and nothing else: never editor state, never `getContent()`, never a send, never an export. The `content` handed to your resolver is a `safeClone` copy, so mutating it cannot affect the editor.

  Documented on a new **Preview Rendering** guide page covering all three preview layers — labels, `MergeTag.sample` and `resolvePreview` — how they compose, and use cases including letting the user pick an example audience from your own UI inside the callback.

  New exports from `@templatical/types`: `ResolvePreview`, `PreviewResolveContext`, `isRenderableTemplateContent`.

## 0.24.1

## 0.24.0

### Minor Changes

- c9b9eea: Add **`MergeTag.sample`** — an example value that previews render in place of the tag, so a preview reads like a delivered email instead of a list of field names.

  ```ts
  mergeTags: {
    tags: [
      { label: 'First Name', value: '{{first_name}}', sample: 'Ada' },
      { label: 'Plan', value: '{{plan_name}}', sample: 'Pro' },
    ],
  }
  ```

  Setting `sample` is the whole opt-in — there is no flag to enable alongside it. **Nothing appears until you configure one:** the Sample/Label switch renders only when at least one tag declares a `sample`, and previews default to Sample view only in that case. Set none and the editor behaves exactly as before, so this is a no-op for every existing configuration.

  **Preview surfaces only, never while editing.** Substitution happens in preview mode and in the test-email dialog's preview. On the editing canvas a tag always shows its label, so an author keeps seeing the field they inserted rather than a value they never typed.

  **A Sample / Label switch** appears beside the viewport toggle whenever a preview is showing, so you can flip between the realistic view and the field-name view. The choice lasts for the session.

  **The highlight follows the individual tag, not the view.** In Sample view a tag with a `sample` renders as ordinary text with no highlight, while a tag without one keeps its label _and_ its highlight. So a partly-configured template reads naturally where you've supplied data and stays visibly dynamic where you haven't — and the remaining highlights double as a list of tags still missing a sample.

  **Display-only, and structurally so.** A sample is never written to the template, never included in `getContent()`, never sent by the test-email feature, and never present in MJML or HTML output — those always carry the real token. In rich text the substitution replaces the whole `<span data-merge-tag>`, so the substituted markup has no token left in it to export; the stored content is untouched.

  Covered everywhere tags render: rich text, plain-string fields (button, image, video, menu), `html` block content, and top-level custom-block field values. Table cells are **not** covered — they are `contenteditable`, and injecting sample text into an editing control is a different problem. Logic tags (`{% if %}`) are unaffected: substitution replaces a value, it cannot evaluate a branch, so they stay keyword badges in both views.

  The built-in merge tag picker now shows a tag's sample, so an author can see what it will render before inserting.

  New exports from `@templatical/types`: `getMergeTagSample`, `hasMergeTagSamples`, `substituteHtmlMergeTagSamples`, `substituteTextMergeTagSamples`.

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

## 0.22.0

## 0.21.2

### Patch Changes

- 635eb7e: `initCloud()` now accepts a saved-blocks provider, and two unused types are removed.

  **`savedBlocks` accepts `boolean | SavedBlocksProvider` on `initCloud()`.** Previously Cloud took a boolean and OSS took a provider — the same key with a different type on each entry point, so moving an OSS integration to Cloud meant rewriting that line. Now:

  - omitted or `true` — backed by Templatical Cloud, gated on the `saved_modules` plan feature (unchanged);
  - `false` — off entirely (unchanged);
  - a `SavedBlocksProvider` — backed by your own store instead of Cloud's, and **not** plan-gated, because the plan feature licenses Cloud's storage rather than the editor's UI.

  Pure type widening, so existing Cloud consumers passing a boolean are unaffected. The practical effect is that upgrading from OSS to Cloud is now a deletion — drop the key to adopt Cloud's store, or leave it exactly as it is to keep your own.

  **Removed the unused `TemplaticalConfig` and `TemplaticalInstance` types from `@templatical/types`.** They duplicated the cloud editor's config and instance types and had drifted from them — `modules` was never renamed to `savedBlocks`, and later options were never added — so they described a config the SDK does not accept. The authoritative types are `TemplaticalCloudEditorConfig` and `TemplaticalCloudEditor`, both already exported from `@templatical/editor`, which is where `initCloud()` reads its config.

  No runtime impact, and in practice nothing to migrate: the types were never re-exported from `@templatical/editor`, were absent from the documentation, and described Cloud configuration. If you did import either name directly from `@templatical/types`, switch to the two above — TypeScript will point at the line.

## 0.21.1

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

## 0.20.0

### Minor Changes

- 90f088e: Add per-field color presets to custom-block color fields.

  A `color` field in a `CustomBlockDefinition` now accepts the same `presets` / `allowCustom` pair as the editor-wide `colors` config, applied to that one field — so a field can be scoped to a color role (an accent/ink pair, say) while every other picker keeps the global palette. Entries are validated as `#rgb` / `#rrggbb` hex, exactly like editor-level presets.

  A field's `presets` **replace** the editor-wide palette for that field rather than intersecting it, so a locked field can carry colors the global grid doesn't list; what a field can never do is unlock a locked editor. Setting neither inherits the editor's palette and its `allowCustom`; `allowCustom: false` locks one field while the rest of the editor stays free-form; `allowCustom: true` cannot unlock a field when `colors.allowCustom` is `false`. An empty `presets: []` — or one whose entries are all invalid — narrows nothing, so the field inherits the editor's palette.

  Field configs that can't be honoured are reported once per block definition, naming both the block type and the field key: invalid preset entries, an ignored empty list, an ignored `allowCustom: true`, and a locked field whose `default` its own palette can't reselect. Non-breaking — color fields that set neither option render exactly as before.

## 0.19.0

### Minor Changes

- ef6deec: Add a `colors` editor option for a preset color-picker palette.

  `colors.presets` renders a clickable grid inside every color picker popover (block toolbars, template settings, rich text, custom-block color fields); clicking a preset applies it and the preset matching the current value is marked selected. Presets must be `#rgb` / `#rrggbb` hex — invalid entries are skipped with a console warning. The grid is an ARIA radio group: arrow keys rove focus between chips (roving tabindex) and Enter/Space activate.

  `colors.allowCustom: false` (with presets) hides the wheel and hex input so authors can only pick from the palette — a white-label / brand-kit constraint. In this locked mode the palette leads with a "no colour" chip that restores the unset (inherit) state, and the editor warns when any `blockDefaults` / `templateDefaults` colour falls outside the palette. It is ignored with a warning when no presets are configured. Non-breaking — pickers render exactly as before when `colors` is unset.

- b8fbca0: Add a `fonts.builtIns` option to restrict which of the seven built-in fonts the font picker offers.

  `builtIns: true` (or omitting it) keeps all seven built-ins — the current behaviour. `builtIns: false` drops them all so the picker lists only `customFonts`. A `builtIns: string[]` allowlist keeps just the named families, matched case-insensitively; a name that isn't a built-in is logged with a warning and skipped, the same way `paletteBlocks` treats an unknown entry.

  Filtering only affects the picker: excluding a built-in never removes a custom font, a custom font stays usable as `defaultFont` when every built-in is excluded, and content already using an excluded family still resolves to its proper fallback stack. When the family new templates seed (`fonts.defaultFont`, or Arial by default) isn't in the offered list, the editor warns once at init so the mismatch is caught. Non-breaking — the default is unchanged.

## 0.18.0

## 0.17.1

## 0.17.0

## 0.16.5

## 0.16.4

### Patch Changes

- 1801876: Add a per-section "Stack on mobile" control and make the mobile preview stack columns

  - **Fix (#395):** the editor's canvas mobile preview now stacks multi-column sections (each column full-width) on the mobile viewport, matching the exported email. Previously columns stayed side-by-side in the preview while the sent email stacked them.
  - **Feature (#396):** new optional `SectionBlock.stackOnMobile`. A "Stack on mobile" toggle in the section settings (shown for multi-column sections, on by default) lets you opt out of stacking — the columns then render inside an `<mj-group>` and stay side-by-side on mobile, reflected in both the canvas preview and the MJML output. Existing templates are unaffected: an absent value keeps MJML's default stacking behavior.

## 0.16.3

## 0.16.2

## 0.16.1

## 0.16.0

### Minor Changes

- e5156a5: Add document-level link color and underline controls

  `TemplateSettings` gains an optional `linkColor` and a required `linkUnderline` (default `true`). The renderer emits them as a single global `a { color; text-decoration }` rule. `linkColor` cascades to every link — rich-text and menu alike; unset keeps `color: inherit` (links follow the surrounding text color). `linkUnderline` underlines body (rich-text) links; buttons and menu items carry their own inline `text-decoration` and are unaffected. An inline per-link/per-item color (a Menu item's `color`, `MenuBlock.linkColor`) still overrides the color.

  Both are exposed in the editor's Appearance settings — a link-color picker and an underline toggle next to the text color — and reflected live on the canvas, fixing the previous preview/export mismatch (the canvas hardcoded a blue underlined link that never shipped).

  Newly created content (via `createDefaultTemplateContent()` / `init()` defaults) now underlines body links by default — the common, more accessible email default. Set `linkUnderline: false` for no underline.

  **Breaking (types):** `TemplateSettings.linkUnderline` is now required — add it when hand-constructing settings, or use `createDefaultTemplateContent()` / `init({ templateDefaults })`, which supply it. `linkColor` is optional; omit it to keep links inheriting the text color.

  Runtime stays backward-compatible for stored content: content lacking `linkUnderline` still renders without an underline (the renderer treats an absent value as off), so already-saved templates are unchanged. (#352)

- d35d36e: Add a document-level default text color with a full per-block cascade

  `TemplateSettings` gains a required `textColor` (default `#1a1a1a`, customizable via `templateDefaults`). Every text block — Title, Paragraph, Menu, Table — inherits it unless it sets its own color, so a document text color now flows through the whole template. To enable that, the per-block `color` on Title, Menu and Table is now optional: unset means "inherit the document color", and new blocks default to unset. An explicit per-block color (or an inline text-color mark) still overrides, and links inherit via `color: inherit`.

  It's exposed as a color picker in the editor's Appearance settings (next to Background color) and reflected live on the canvas; each text block's own color picker gains an unset/inherit state.

  **Breaking (types):** `TemplateSettings.textColor` is now required — add it when hand-constructing settings (including content passed to `init()`), or use `createDefaultTemplateContent()` / `init({ templateDefaults: { textColor } })`, which supply it. `TitleBlock`, `MenuBlock`, and `TableBlock` now have an optional `color` (`string | undefined`) — handle the unset case if you read it (unset means the block inherits the document color).

  Runtime stays backward-compatible: content lacking `textColor` still renders (falling back to the previous default), and existing templates with explicit block colors are byte-for-byte unchanged. Only newly created content shifts — paragraph body text resolves to `#1a1a1a` instead of MJML's default `#000000`, a negligible and more consistent shade. (#355)

## 0.15.1

## 0.15.0

### Minor Changes

- 7afeacb: Add type-ahead merge tag autocomplete to input and textarea fields

  Typing the syntax opener (e.g. `{{`) in any merge-tag-enabled input or textarea — button/image/video/menu links, image alt text, template settings, and custom-block text fields — now surfaces the same autocomplete popup as the rich-text editor. The popup, filtering, keyboard navigation (Arrow / Enter / Tab / Escape), and caret positioning are shared with the TipTap path, so behavior is identical across both surfaces. Controlled by the existing `mergeTags.autocomplete` flag (default on; auto-disabled when `tags` is empty or a custom syntax is used).

  `@templatical/types` gains `getSyntaxClosingChar()` alongside `getSyntaxTriggerChar()`.

## 0.14.0

### Minor Changes

- 718d781: Add an optional outer frame to section blocks (`section.wrapper`) — a full-width band with its own background, padding, and corner radius that frames the section, rendered as an `mj-wrapper` around the section's `mj-section`. This makes the common "white card on a colored band" layout possible without nesting sections (which MJML forbids). Enable it from the section toolbar's Wrapper panel, or set `createSectionBlock({ wrapper: { backgroundColor, padding, borderRadius } })`; omit it and existing templates are unchanged. (#312)

### Patch Changes

- 710c9be: Add an optional `borderRadius` (px) to section blocks. Set it from the section toolbar or via `createSectionBlock({ borderRadius })`; the renderer emits it as `border-radius` on the `mj-section`, so a section with a background color reads as a rounded card on a contrasting background. Omitted or `0` keeps square corners, so existing templates are unchanged. First step toward the framed "card on colored background" pattern. (#312)

## 0.13.0

## 0.12.1

## 0.12.0

### Minor Changes

- 7b76e46: Add a `width` option to button blocks: buttons can be set to a fixed pixel width or stretched to full width (`'full'`), independently of their label, instead of always shrinking to fit their content. Omitting `width` keeps the previous content-sized behavior, so existing templates are unaffected (#260).
- a209073: Add website option to social icons

### Patch Changes

- 67f44fb: Centralize social-icon glyph data (SVG path + brand color) into a single `SOCIAL_ICON_GLYPHS` map in `@templatical/types`, shared by the editor's inline-SVG renderer and the renderer's PNG rasterizer (which previously each kept their own copy). Adding a platform to the `SocialPlatform` union is now a compile error until its glyph exists, so the editor and renderer can no longer drift out of sync. Social platform dropdown labels now resolve through i18n (`social.platforms`) instead of a hardcoded English name.

## 0.11.1

## 0.11.0

## 0.10.4

## 0.10.3

## 0.10.2

### Patch Changes

- 5676cb3: Fix `Converting circular structure to JSON` when exporting after a drag inside a section (#203)

  Dragging a block within a section column could leave a Sortable expando back-ref (`HTMLDivElement.SortableXXX → instance → el → div`) reachable from the editor's live content. The public `getContent()` serialized with a naked `JSON.stringify`, so it threw on that cycle and broke export until the section was removed.

  - `@templatical/types`: add the cycle-safe `safeClone()` helper (`WeakSet`-replacer JSON round-trip that drops self-referencing back-refs instead of throwing).
  - `@templatical/editor`: `init().getContent()` and `initCloud().getContent()` now clone via `safeClone()`; the pre-ready fallback also defaults to an empty template instead of throwing when no content was supplied.
  - `@templatical/core`: `history.cloneContent()` now reuses `safeClone()` (same behavior, deduplicated).

## 0.10.1

### Patch Changes

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

## 0.10.0

### Minor Changes

- 2d9779b: Custom blocks can now declare default block styles in their definition, and the renderer honors `block.styles.padding` on custom and HTML blocks.

  **New `defaultStyles` on `CustomBlockDefinition`.** Custom block authors can now declare default `padding` and `backgroundColor` alongside `template` and `fields`. The value is a `Partial<BlockStyles>` deep-merged over the base defaults — specify only the fields you want to override. Controls both the editor canvas wrapper and the rendered MJML/email output.

  ```ts
  customBlocks: [
    {
      type: 'pricing-table',
      template: '<table>…</table>',
      fields: [...],
      defaultStyles: {
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    },
  ]
  ```

  **`renderCustom` and `renderHtml` now honor `block.styles.padding`.** Previously the renderer emitted `<mj-text>` without an explicit `padding` attribute for custom and HTML blocks, so MJML's built-in `10px 25px` default applied regardless of `block.styles.padding`. Both renderers now pass `padding="..."` from the block's styles, matching how every other built-in renderer (paragraph, title, menu, table) already worked.

  **Behavior change for existing custom and HTML blocks.** Previously, rendered email output used MJML's `mj-text` default of `10px 25px`. Now it uses `block.styles.padding`, which defaults to `10px` all around from `createDefaultStyles()`. To restore the old visual, set `defaultStyles: { padding: { top: 10, right: 25, bottom: 10, left: 25 } }` on the custom block definition, or override `padding` on the individual block instance via the editor.

- ac9eab8: Add `CustomBlockDefinition.stylesheet` — definition-level CSS that emits once into `<mj-head><mj-style>` in the rendered MJML and is mirrored in the editor canvas.

  Custom blocks render as raw HTML inside an `mj-text` cell, which means MJML's automatic responsive behavior (column stacking, fluid images) only applies to the _outer_ layout — not to the internals of a custom block. Previously a developer had no clean place to put per-definition media queries, hover states, or block-specific font declarations; ad-hoc `<style>` blocks inside the `template` ended up in the email body rather than `<mj-head>`, with no dedupe across instances.

  The new `stylesheet?: string` field on `CustomBlockDefinition` solves this:
  - The renderer collects every definition's `stylesheet` from the content tree, dedupes by `customType` _and_ by trimmed content, and emits each unique stylesheet once as an additional `<mj-style>` block alongside the built-in visibility media queries.
  - The editor canvas mirrors the same CSS via a reactive `<style>` element rendered inside the editor root — in shadow-DOM mode it scopes to the shadow root; in light-DOM mode it shares the global stylesheet surface already established by `dist/style.css`.
  - The renderer adds an optional `getCustomBlockStylesheet?: (customType: string) => string | undefined | null` resolver to `RenderOptions`. The editor wires this from its block registry automatically; headless callers provide their own resolver from whatever definitions map they manage.
  - `TemplaticalEditor` (the OSS init return) gains `getCustomBlockStylesheet(customType)` for parity with `renderCustomBlock`.

  Class names in `stylesheet` are **not** scoped by the SDK — namespace them per definition (e.g. `.tplc-<type>-<element>`) to avoid collisions. Email-client caveats apply (Outlook desktop ignores `@media` queries, matching every other media-query-based feature in the SDK such as block visibility).

  Fully backward compatible: existing definitions and renderer callers that omit the new field/option produce the same MJML and editor behavior as before.

  Addresses #155 (raised as the follow-up to #146).

- 5d961a3: Remove the unimplemented `BaseBlock.customCss` per-block CSS surface.

  `BaseBlock.customCss?: string` was a typed field with a "Custom CSS" textarea in the block settings panel, but no renderer ever read it — the field was dead data (same shape as the `styles.responsive` removal in #154). The editor textarea, the type field, and the three locale strings (`customCss` / `css` / `cssPlaceholder`) plus the docs section are removed.

  Per-block free-form CSS is the wrong shape for an email editor: it targets end-users (who typically aren't email-CSS fluent), it doesn't dedupe across instances, and there is no reliable rendering surface for it that survives email-client variance. Custom-block-scoped CSS belongs at the definition level (developer-authored, deduped, emitted to `<mj-head><mj-style>…</mj-style></mj-head>`) — tracked separately in #155.

  **Migration:** saved templates carrying a `customCss` string keep parsing — the extra key is ignored at runtime. No data migration is required; nothing read the field before this change, so no rendered output changes.

- 4309923: Collapse the responsive model to Desktop + Mobile, dropping the `tablet` tier.

  `ViewportSize` is now `"desktop" | "mobile"` and `BlockVisibility` drops its `tablet` field. The editor's viewport toggle no longer offers a Tablet preview, and the renderer emits a single 480px breakpoint (`tpl-hide-mobile` ≤480px, `tpl-hide-desktop` ≥481px) instead of three bands. A "tablet" breakpoint isn't a meaningful concept for email (bodies are ~600px wide; a tablet viewport renders at full desktop width), and the useful responsive split is binary — mobile vs. not-mobile, matching MJML's model.

  **Migration:** saved templates carrying `visibility.tablet` keep parsing — the extra key is ignored at runtime. A block previously hidden only on tablet (`tablet: false` with `desktop`/`mobile` true) will now show on 481–768px devices, because there's no longer a `tpl-hide-tablet` class. No data migration is required; re-saving a block normalizes its visibility object to the new shape.

- af913bb: Remove `margin` from `BlockStyles`.

  `margin` was a canvas-only style: it surfaced in the block settings panel and applied to the editor wrapper, but the renderer never read it, so it was dropped from the exported email — a WYSIWYG mismatch. Email spacing is expressed via `padding` (the renderer honors it on every block), so `margin` added a second, unreliable spacing control with no email output.
  - `BlockStyles.margin` is removed from the type and from `createDefaultStyles()`.
  - The Margin inputs are removed from the block settings panel, and the editor canvas no longer applies a wrapper margin.
  - The BeeFree, Unlayer, and HTML importers no longer emit a `margin` field on converted blocks.

  Use `padding` for block spacing. Persisted templates that still carry a `margin` key load fine — the extra field is ignored.

- 72e1e58: Remove the unimplemented `BlockStyles.responsive` / `ResponsiveStyles` surface and make preview mode honor block visibility.

  `styles.responsive` (tablet/mobile padding overrides) was typed and documented but read by neither the renderer nor the editor preview, so the values were dead data (#146). The `ResponsiveStyles` type, the `responsive` field on `BlockStyles`, and their docs are removed. Per-breakpoint padding is intentionally not implemented: email clients vary in media-query support (Outlook desktop ignores them entirely) and MJML already stacks columns and scales fluidly on mobile. Use `visibility` for per-viewport show/hide.

  The editor preview now actually hides blocks that are set hidden on the current viewport (previously they were only dimmed with a badge), so the preview matches the exported MJML.

## 0.9.1

## 0.9.0

### Minor Changes

- 4dfe37e: Add a built-in merge tag picker modal. When `mergeTags.tags` is configured without `mergeTags.onRequest`, clicking "Insert merge tag" now opens a searchable, keyboard-navigable picker that lists every tag. The picker supports optional grouping (via a new `group` field on `MergeTag`) and per-tag helper text (via a new `description` field). `onRequest` continues to take precedence when set.

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

## 0.8.4

## 0.8.3

## 0.8.2

## 0.8.1

## 0.8.0

## 0.7.3

## 0.7.2

## 0.7.1

## 0.7.0

## 0.6.7

## 0.6.6

## 0.6.5

## 0.6.4

## 0.6.3

## 0.6.2

## 0.6.1

## 0.6.0

### Minor Changes

- 55002de: Introduce `@templatical/quality` — an MIT-licensed accessibility linter for Templatical email templates — and wire it into the editor.

  **New package: `@templatical/quality`**
  - `lintAccessibility(content, options?)` — synchronous, pure, no DOM. Walks the JSON `TemplateContent` tree and runs every enabled rule, returning `A11yIssue[]` with `severity`, `message`, `blockId`, and an optional `fix` patch.
  - 19 deterministic rules across images, headings, links, text, buttons, and structure (missing alt, filename-style alt, low contrast, vague CTAs, heading-skip, multiple H1, target=\_blank without rel=noopener, all-caps, undersized touch targets, missing preheader, …). Three rules ship one-click auto-fixes.
  - Public utilities: `walkBlocks`, `getContrastRatio` (WCAG sRGB), `parseHex`, `isOpaqueHex`, `extractAnchors`, `extractText`, `getDictionary`, `formatMessage`, `getMessages`. Plus `Rule`, `RuleHit`, `RuleMeta`, `A11yIssue`, `A11yOptions`, etc.
  - Per-rule severity overrides (`'error' | 'warning' | 'info' | 'off'`) and configurable thresholds (`altMaxLength`, `minFontSize`, `allCapsMinLength`, `minTouchTargetPx`).
  - Locale-aware: rule messages and vague-text dictionaries auto-discover via `import.meta.glob` (drop a `messages/<lang>.ts` or `dictionaries/<lang>.ts` and it's bundled). The dictionary is a cross-locale union — a German-locale email with an English "Click here" button still flags. Ships `en` + `de` today.

  **Type changes (`@templatical/types`)**
  - `TemplateSettings.locale` (optional, defaults to `'en'`) — drives rendered `<mjml lang="…">`.
  - `ImageBlock.decorative` (optional boolean) — when true, the renderer forces `alt=""` and adds `role="presentation"`.
  - `PlanConfig.accessibility.blockOnError` (cloud) — server-side policy hook.

  **Renderer changes (`@templatical/renderer`)**
  - Emits `<mjml lang="…">` from `settings.locale`.
  - Honors `ImageBlock.decorative` (empty alt + role="presentation").

  **Editor integration (`@templatical/editor`)**
  - New `accessibility` option on `init()` / `initCloud()` — full `A11yOptions` shape. Optional peer; the dynamic import is gated and tree-shakeable, so the linter chunk never downloads when not used.
  - New `useAccessibilityLint` composable — debounced 500ms re-lint on content changes, applies auto-fixes through the editor's existing `updateBlock` / `updateSettings` (history-tracked, undoable per fix).
  - New right-sidebar "Accessibility" tab (lazy-loaded). Errors / Warnings / Info groups with localized messages, "Jump to block" and "Fix" buttons, count badge.
  - New inline canvas badge inside `BlockWrapper` — `CircleAlert` for errors, `TriangleAlert` for warnings.
  - New "Decorative image" toggle on `ImageToolbar` bound to `block.decorative`.
  - Editor mode forces the linter `locale` to match `init({ locale })` — `accessibility.locale` is overwritten on the way through. Headless callers keep full control.
  - Cloud save-gate: when `planConfig.accessibility.blockOnError === true` and the linter reports any errors, the save flow surfaces a confirmation modal. Both the toolbar Save button and the `Cmd/Ctrl+S` keyboard shortcut route through the gate.
  - New i18n keys (`accessibility.*` in `en` / `de` OSS chunks; `saveGate.*` in cloud chunks).
  - CDN bundle ships `@templatical/quality` and `@templatical/renderer` as separate code-split chunks, so CDN consumers don't install the optional peer manually.

## 0.5.1

## 0.5.0

## 0.4.0

### Minor Changes

- f5a94ab: Add new `@templatical/import-unlayer` package that converts Unlayer design JSON (the output of `editor.saveDesign(...)`) into Templatical's `TemplateContent` shape. Mirrors `@templatical/import-beefree`: maps `text`, `heading`, `image`, `button`, `divider`, `html`, `menu`, `social`, `video`; reports `timer` as html-fallback and `form` as skipped; flattens 4+ column rows; surfaces a per-content conversion report. MIT-licensed.

  The Unlayer migration guide (`/guide/migration-from-unlayer` and `/de/guide/migration-from-unlayer`) is rewritten around the importer. The playground replaces the BeeFree-only chooser button with a single "Import existing template" modal that exposes BeeFree and Unlayer as tabs. README, license FAQ, security policy, and contributing guide reflect the new package; cloud headless API reference adds the matching `templates/import/from-unlayer` route row.

## 0.3.2

## 0.3.1

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

## 0.1.2

## 0.1.1

## 0.1.0

## 0.0.6

## 0.0.5

## 0.0.4

## 0.0.3

## 0.0.2
