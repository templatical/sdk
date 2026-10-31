---
"@templatical/core": minor
---

Route language-view edits into locale layers, emit locale operations from collaboration diffs, and coordinate locks per block and language. `setDefaultLocale` conflicts with every other session's lock, and its remote change reports `locale: null`. Under collaboration, an undo or redo step that restores a whole-template snapshot (the undo of `setContent` or `setDefaultLocale`) is skipped with `precondition_failed` once this editor has received another session's batch after it, and a queued batch holding a `setContent` is dropped, unsent, when another session's batch reaches it first. `onLocaleChange` reports the language shown whenever it changes, including a new default while the default is shown and a loaded or restored template whose default differs.

**Collaboration backend contract change:** refuse a batch that contains a `setContent` with `409` and `precondition_failed` when its `baseRevision` isn't the current revision; other batches still apply to the current content. Check a repeated `batchId` first: a retried batch keeps the `baseRevision` of its first attempt, so a resent snapshot that already landed answers with its revision. Without it, a snapshot undo can overwrite a batch your backend committed but the editor hasn't received yet. The playground's reference backend implements the rule.

`mapLocalizedOperations` maps AI edits of a language projection into text translations, property overrides and shared structure changes; an added block's text becomes its default value, and it refuses `setContent` and `setDefaultLocale` in a language view. `CollaborationApplyOptions.origin` and `.turn` are optional: a batch without `origin` is the session's own edit with its own undo step and no wire origin, and only batches of one defined AI turn share an undo step. Translation batches use the ordinary edit and history path.

Additive and opt-in: existing templates need no migration. Keep every `@templatical/*` package on the same version.
