---
"@templatical/types": minor
---

Language versions and translation in the template model

Breaking changes:

- TypeScript producers must set the now required `AiRequestBase.locale` and `AiRewriteRequest.locale` to the active language, or `null` in the default view, and `CollaborationRemoteChange.locale` to the first locale operation's language in a batch, excluding `setDefaultLocale`, or `null` when there is none. Code that builds these objects must set them even without localization enabled.
- An element id containing `.` or `/` (on a menu item, social icon, table row or table cell) now fails `validateTemplate`, and `addBlock`, `updateBlock` and `setContent` refuse to add one with `invalid_operation`. `elementIdIssues(content)` lists them; rename each.

Apart from such ids, existing templates need no migration. Keep every `@templatical/*` package on the same version.

- **Model:** `settings.locales` lists the language versions. Each block's and the settings' `l10n[locale]` layer holds translated `text` (`{ value, sourceHash }`), property overrides in `set`, and `hidden`. `resolveLocale(content, locale, options?: { missing?: "throw" | "default" })` projects one version, layouts included; an unknown version throws `unknown_locale` unless `missing: "default"`, which projects the document's default. `localeCoverage` and `sourceHash` report missing and out-of-date text.
- **Operations:** `addLocale`, `removeLocale`, `setDefaultLocale`, `updateBlockLocale` and `updateSettingsLocale`, with inverses from `invertOperations` and a `locale` on locks. `setDefaultLocale` keeps the former default's text as its translation. `createSetDefaultLocaleOperation(content, locale, definitions?)` records custom text fields on the operation, so it replays without definitions. `defaultLocaleGaps` lists the fields with a nonempty default that would keep the current default's value, and `localeHiddenBlocks` the hidden blocks that refuse the change.
- **Translation:** `TranslationProvider`, `TranslationRequest`, `TranslationResult`, `TranslationErrorCode` and `LocaleString`, with `maskTags`, `unmaskTags`, `localeStrings` and `applyLocaleStrings`. They mask merge tags, logic tags and `doNotTranslate` terms, and check them exactly on return.
- **Also:** `Comment.locale` and `CommentInput.locale`, and `isSafeUrlAttribute(name, value): boolean`, the URL policy that the editor's sanitizer and `template-tools strings import` share.

See [Localized templates](https://docs.templatical.com/guide/localized-templates) and [Locale operations](https://docs.templatical.com/api/operations#locale-operations).
