---
"@templatical/editor": minor
---

A template language's label names the language alone (`en-GB` "English", `de-DE` "Deutsch", `zh-CN` "中文") unless another configured or template language shares it; then each keeps its full name ("British English" / "American English"). The name stays in the tag's own language, independent of the editor's UI language. `localization.languageNames` sets a label per tag exactly as written; a missing or blank label keeps the default. `init()` rejects a malformed map with `SdkError`: `localization.languageNames must be an object that maps language tags to label strings.` Labels appear in the Languages menu, the language bar, locale notices and status chips, comments, AI chat and the settings panel.
