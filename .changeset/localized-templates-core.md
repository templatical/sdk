---
"@templatical/core": minor
---

Language versions in editing, collaboration and AI edits

Breaking changes:

- A collaboration backend must refuse a batch that contains a `setContent` with `409` and `precondition_failed` when its `baseRevision` isn't the current revision; other batches still apply to the current content. Check a repeated `batchId` first, so a retried snapshot that already landed answers with its revision. Without the rule, a snapshot undo can overwrite a batch the backend committed but the editor hasn't received yet. The playground's reference backend implements it.
- With language versions in use, a collaboration backend you built must apply the locale operations (`addLocale`, `removeLocale`, `setDefaultLocale`, `updateBlockLocale`, `updateSettingsLocale`) and the lock `locale`. Until it does, it rejects those operations as `invalid_operation`, and one that ignores the lock `locale` serializes edits per block.

Existing templates need no migration. Keep every `@templatical/*` package on the same version.

- Edits in a language view go into that language's layer, collaboration diffs emit locale operations, and locks apply per block and language. `setDefaultLocale` conflicts with every other session's lock.
- Under collaboration, undo or redo of a whole-template change (`setContent`, `setDefaultLocale`) is refused with `precondition_failed` once this editor has received another session's batch after it.
- `onLocaleChange` reports the language shown whenever it changes, and `editor.createSetDefaultLocaleOperation(locale)` builds a default-language change that carries the registered custom text fields.
- `mapLocalizedOperations` maps AI edits of a language view into translations, property overrides and shared structure changes.
- `CollaborationApplyOptions.origin` and `.turn` are optional: a batch without `origin` is the session's own edit, with its own undo step.

See [Collaboration](https://docs.templatical.com/backend/collaboration#applying-a-batch).
