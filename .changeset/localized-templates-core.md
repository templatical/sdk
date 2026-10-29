---
"@templatical/core": minor
---

Route language-view edits into locale layers, emit locale operations from collaboration diffs, and coordinate locks per block and language. `setDefaultLocale` conflicts with every other session's lock, and its remote change reports `locale: null`.

`mapLocalizedOperations` maps AI edits of a language projection into text translations, property overrides and shared structure changes; an added block's text becomes its default value, and it refuses `setContent` and `setDefaultLocale` in a language view. `CollaborationApplyOptions.origin` and `.turn` are optional: a batch without `origin` is the session's own edit with its own undo step and no wire origin, and only batches of one defined AI turn share an undo step. Translation batches use the ordinary edit and history path. The Cloud comments provider leaves `locale` out of its requests, since Cloud does not store comment languages yet.

Additive and opt-in: existing templates need no migration. Keep every `@templatical/*` package on the same version.
