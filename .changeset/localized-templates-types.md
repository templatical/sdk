---
"@templatical/types": minor
---

Add `LocalizedText`, `BlockLocaleLayer`, `SettingsLocaleLayer`, `resolveLocale`, `localeCoverage`, `sourceHash`, locale operations and lock locales for language versions in one template. Add `TranslationProvider`, `LocaleString`, `maskTags`, `unmaskTags`, `localeStrings` and `applyLocaleStrings` for translation with protected tags and extraction-time source hashes. Localized custom-block projections discard default-language `renderedHtml` when text or properties are overridden, so rendering needs `renderCustomBlock`.

Stored-template compatibility: existing templates need no migration. Keep every `@templatical/*` package on the same version.

TypeScript producers must set the required `AiRequestBase.locale` and `AiRewriteRequest.locale` fields to the active language, or `null` in the default view. `CollaborationRemoteChange.locale` is also required: producers must set it to the first locale operation’s language in a batch, or `null` when there is none. Code that builds these objects must set these fields even without localization enabled.
