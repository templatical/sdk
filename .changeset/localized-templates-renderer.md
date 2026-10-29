---
"@templatical/renderer": minor
---

Add `renderToMjml(content, { locale })` to render a language version's translated text, property overrides, hidden blocks and settings. A `layout` passed alongside is projected for the same language with `resolveLocale(layout, locale, { missing: "default" })` before composing, so a layout's own language versions, wrapper children included, follow the template and fall back to the layout's default. The projected language and direction set MJML `lang` and `dir`; localized custom blocks use `renderCustomBlock` instead of cached default-language HTML.

Additive and opt-in: existing templates need no migration. Keep every `@templatical/*` package on the same version.
