---
"@templatical/renderer": minor
---

Rendering a language version

`renderToMjml(content, { locale })` renders a language version's text, property overrides, hidden blocks and settings, and sets MJML `lang` and `dir`. A `layout` passed alongside follows the same language and falls back to its own default. Localized custom blocks render through `renderCustomBlock` instead of the cached default-language HTML.

Additive and opt-in: existing templates need no migration. Keep every `@templatical/*` package on the same version. See [Rendering a language](https://docs.templatical.com/guide/localized-templates#rendering-a-language).
