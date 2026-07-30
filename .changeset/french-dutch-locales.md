---
"@templatical/editor": minor
---

Add French (fr) and Dutch (nl) OSS locales.

Both files follow the existing pattern: typed `typeof en` so a missing key is a
compile error, auto-registered through the `import.meta.glob` locale registry, and
covered by the "OSS locale parity" test (keys and placeholder tokens).
`isLocaleSupported("fr")` / `isLocaleSupported("nl")` now return `true`, and region
variants such as `fr-BE` / `nl-BE` resolve to the base locale as usual. Cloud
translations are intentionally not included; `loadCloudTranslations` keeps falling
back to English for these locales.

The i18n test suite previously used `"fr"` as its canonical unsupported locale;
those assertions now use `"it"`.
