---
"@templatical/types": minor
---

Add language versions and translation to the template model. A template keeps every language in one shared block tree: `settings.locales` lists the versions, and each block's and the settings' `l10n[locale]` layer holds translated `text` (`LocalizedText`, `{ value, sourceHash }`), property overrides in `set` and `hidden`. `resolveLocale(content, locale, options?: { missing?: "throw" | "default" })` projects one version, also for layouts and their wrapper children (`missing: "default"` falls back to the document's default), and `localeCoverage` and `sourceHash` report missing and out-of-date text.

- Operations `addLocale`, `removeLocale`, `setDefaultLocale`, `updateBlockLocale` and `updateSettingsLocale`, with guarded inverses from `invertOperations` and a `locale` on block and operation locks. `setDefaultLocale` promotes a version to the default; `defaultLocaleGaps` lists the fields that keep the old default's value and `localeHiddenBlocks` the blocks that refuse the change.
- Translation contract `TranslationProvider`, `TranslationRequest`, `TranslationResult`, `TranslationErrorCode` and `LocaleString`, and the pure helpers `maskTags`, `unmaskTags`, `localeStrings` and `applyLocaleStrings`. They mask merge tags, logic tags and an optional `doNotTranslate` term list as placeholders, check them exactly on return and stamp extraction-time `sourceHash` values.
- `Comment.locale` and `CommentInput.locale` carry the language a comment was written in.
- `elementIdIssues(content)` lists menu item, social icon, table row and table cell ids that contain `.` or `/`. `validateTemplate` reports them, and `addBlock`, `updateBlock` and `setContent` refuse them with `invalid_operation`.
- A localized custom block's projection drops its default-language `renderedHtml`, so rendering it needs `renderCustomBlock`.

Stored-template compatibility: existing templates need no migration. The one exception is an element id containing `.` or `/`, which now fails validation; rename it. Keep every `@templatical/*` package on the same version.

TypeScript producers must set the required `AiRequestBase.locale` and `AiRewriteRequest.locale` fields to the active language, or `null` in the default view. `CollaborationRemoteChange.locale` is also required: producers must set it to the first locale operation’s language in a batch, or `null` when there is none. Code that builds these objects must set these fields even without localization enabled.
