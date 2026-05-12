---
"@templatical/editor": patch
"@templatical/media-library": patch
---

Simplify locale resolution in `@templatical/editor` and `@templatical/media-library` and align behavior between the two. Both packages now share the same canonicalization step (trim, treat `_` as `-`, lowercase) so locales like `pt_BR` are accepted alongside `pt-BR`. The editor's exact-then-base fallback logic is deduplicated behind a single helper used by `resolveLocale`, `isLocaleSupported`, and `isCloudLocaleSupported`. `@templatical/editor` now re-exports `getSupportedLocales`, `getSupportedCloudLocales`, `isLocaleSupported`, `isCloudLocaleSupported`, and `getBaseLocale` from its public entry point so consumers can drive their own locale pickers without reaching into the i18n subpath. No behavior change for any existing locale input; this is purely cleanup and a small API surface addition.
