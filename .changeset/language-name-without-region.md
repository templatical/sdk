---
"@templatical/editor": minor
---

Breaking changes:

- A template language's default label names the language alone when no other configured or template language shares it: `en-GB` reads "English" instead of "British English", `de-DE` "Deutsch" instead of "Deutsch (Deutschland)", `zh-CN` "中文" instead of "中文（中国）". To keep the previous labels, pass the full names in the new `localization.languageNames`, for example `init({ localization: { locales: ["en-GB", "de-DE"], languageNames: { "en-GB": "British English", "de-DE": "Deutsch (Deutschland)" } } })`.

When another configured or template language shares a tag's language, each keeps its full name ("British English" / "American English"). The name stays in the tag's own language, independent of the editor's UI language. `localization.languageNames` sets a label per tag exactly as written; a missing or blank label keeps the default. `init()` rejects a malformed map with `SdkError`: `localization.languageNames must be an object that maps language tags to label strings.` Labels appear in the Languages menu, the language bar, locale notices and status chips, comments, AI chat and the settings panel.
