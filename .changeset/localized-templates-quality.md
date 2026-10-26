---
"@templatical/quality": minor
---

Add `contentLocale` to lint a translated language version and `localization.untranslated`, `localization.stale` and `localization.merge-tags-differ` to report missing text, outdated source hashes and changed merge-tag multisets. Message `locale` stays independent, dictionaries remain a union, and `lintTemplate` includes localization checks.

Additive and opt-in: existing templates need no migration. Keep every `@templatical/*` package on the same version.
