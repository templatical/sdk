---
"@templatical/editor": minor
---

Add `init({ localization, translation })`, the Languages switcher, missing/stale/override markers, field resets, `getLocale()`, `setLocale()` and locale-selecting exports. Translate missing or stale text, re-translate blocks or translate all eligible fields with protected tags and one undo step. AI chat, Fix, Rewrite and alt text edit the active language. `initCloud()` ignores `localization` and `translation` with warnings.

Additive and opt-in: existing templates need no migration. Keep every `@templatical/*` package on the same version.
