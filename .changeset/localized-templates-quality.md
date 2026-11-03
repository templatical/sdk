---
"@templatical/quality": minor
---

Localization checks for language versions

`contentLocale` lints a translated language version, and `localization.untranslated`, `localization.stale` and `localization.merge-tags-differ` report missing text, outdated `sourceHash` values and changed merge tags. `lintTemplate` includes the `localization` category; pass `customBlocks` to check custom `text` and `textarea` translations.

Additive and opt-in: existing templates need no migration. Keep every `@templatical/*` package on the same version. See [the `localization` options](https://docs.templatical.com/quality/options#localization).
