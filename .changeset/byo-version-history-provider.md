---
"@templatical/types": minor
"@templatical/core": minor
"@templatical/editor": minor
---

Version history becomes a bring-your-own provider, and "snapshot" is renamed to "version" throughout.

`init()` takes a new `versionHistory?: VersionHistoryProvider` key. Configure it and the editor grows a history control in the header — step older and newer through past states, preview one on the canvas, restore it. Omit it and none of that UI is downloaded.

```ts
init({
  container,
  templates: myTemplatesProvider,
  versionHistory: {
    list: (templateId) => fetch(`/api/templates/${templateId}/versions`).then((r) => r.json()),
    get: (templateId, versionId) =>
      fetch(`/api/templates/${templateId}/versions/${versionId}`)
        .then((r) => r.json())
        .then((v) => v.content),
    create: false,
    restore: (templateId, versionId) =>
      fetch(`/api/templates/${templateId}/versions/${versionId}/restore`, { method: "POST" })
        .then((r) => r.json()),
  },
});
```

`list` and `get` are the operations and cannot be disabled; `create` and `restore` each take `false` instead of a function, so turning one off is a decision you state rather than something you get by forgetting a method.

**Your `save` records the versions, not the editor.** Whichever `TemplatesProvider.save` you supply decides whether a save also records a version, which keeps throttling, retention and dedupe with the side that pays for the storage. `create` exists for versions a person asks for; the editor never calls it on its own.

That rule is literal, and restore is no exception. Confirming a restore discards unsaved work, so **Restore asks first when there are unsaved changes** and offers to save them before restoring — through your ordinary `templates.save`, user-initiated. Without a `templates` provider, or with one whose `save` is `false`, the offer isn't made and the confirmation says plainly that the changes will be lost, because there is nowhere to put them.

`initCloud()` does **not** take `versionHistory`, exactly as it does not take `templates`: a version is keyed to a template id Cloud issued, and Cloud's templates adapter keeps recording into Cloud's own store regardless. One passed from JavaScript is ignored with a console warning.

**Restore is append-only** — it adds an entry rather than rewriting one. A backend with no atomic endpoint composes it in one line (`get` the old content, then `save` it), which the docs spell out.

**Scrubbing stays synchronous.** Each `TemplateVersion` may carry an optional `content` — a *cache hint*, evaluated per entry, never an alternative to `get`. When it is present the editor previews that version in the same tick; when it is absent it calls `get` once and caches the result. So a provider that hydrates recent versions and omits older ones is a supported middle ground, and Templatical Cloud (which returns content on every entry) never waits.

### Breaking — snapshot → version, everywhere

The rename is the largest part of this release. Cloud's REST routes change too.

| Before | After |
| --- | --- |
| `TemplateSnapshot` (`@templatical/types`) | `TemplateVersionResponse` — still Cloud's snake_case wire shape. The contract shape is the new camelCase `TemplateVersion` |
| `useSnapshotHistory` (`@templatical/core/cloud`) | **Removed.** The reactive state is now `useVersionHistory` in `@templatical/core`, shared by both tiers, and takes a provider instead of an `authManager` |
| `editor.createSnapshot()` (cloud core) | **Removed.** A save records a version; `versionHistory.create` records one on demand |
| `ApiClient.getSnapshots` / `createSnapshot` / `restoreSnapshot` | `getVersions` / `getVersion` / `createVersion` / `restoreVersion` |
| `API_ROUTES["snapshots.*"]`, `templates/{id}/snapshots` | `API_ROUTES["versions.*"]`, `templates/{id}/versions` |
| `snapshotHistory.*` / `snapshotPreview.*` translation keys (cloud chunk) | `versionHistory.*` / `versionPreview.*` in the **OSS** chunk, in all seven OSS locales |

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
