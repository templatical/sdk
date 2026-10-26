---
"@templatical/renderer": minor
---

Add `renderToMjml(content, { locale })` to render a language version's translated text, property overrides, hidden blocks and settings before composing a layout and producing MJML. The projected language and direction set MJML `lang` and `dir`; localized custom blocks use `renderCustomBlock` instead of cached default-language HTML.

Additive and opt-in: existing templates need no migration. Keep every `@templatical/*` package on the same version.
