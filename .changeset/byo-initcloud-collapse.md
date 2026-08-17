---
"@templatical/types": minor
"@templatical/core": minor
"@templatical/editor": minor
"@templatical/media-library": minor
---

**The `initCloud()` collapse — heavily breaking.** `initCloud()` is now a thin adapter-wiring wrapper over `init()`: it authenticates, fetches the plan, builds Cloud's providers, and delegates. One `Editor.vue`, one `useEditor`, one header. Read every bullet below — `minor` is the breaking channel on a 0.x line, and it still under-states this.

**`TemplaticalCloudEditor` is now `TemplaticalEditor`.** The two entry points return the same type, which is the proof the unification worked. Three cloud-only members went with it:

- `create(content)` → `create({ name?, content? })`, matching `init()`.
- `setThemeOverrides(overrides)` — **removed.** `config.theme` is applied at init on both entry points, and the entitlement that gated changing it later is gone.
- `sendTestEmail(recipient)` — **removed.** The shared test-email dialog is the supported path.

**`initCloud()` rejects on a failed bootstrap** instead of mounting an editor that shows an error overlay. Auth, the health check and the plan fetch now run *before* the mount, so a session that cannot authenticate never produces an editor. Handle it like any other rejected promise. A session that dies *later* — a token refresh that cannot renew — still surfaces as an overlay. The 30s "initialization timed out" rejection is gone with the post-mount readiness handshake.

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
