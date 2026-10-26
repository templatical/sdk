---
"@templatical/types": minor
---

Add `LocalizedText`, `BlockLocaleLayer`, `SettingsLocaleLayer`, `resolveLocale`, `localeCoverage`, `sourceHash`, locale operations and lock locales for language versions in one template. Add `TranslationProvider`, `LocaleString`, `maskTags`, `unmaskTags`, `localeStrings` and `applyLocaleStrings` for translation with protected tags and extraction-time source hashes. Localized custom-block projections discard default-language `renderedHtml` when text or properties are overridden, so rendering needs `renderCustomBlock`.

Additive and opt-in: existing templates need no migration. Keep every `@templatical/*` package on the same version.
