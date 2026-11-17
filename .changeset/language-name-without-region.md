---
"@templatical/editor": patch
---

A template language's label names the language alone, never its region or script: `en-GB` and `en-US` both read "English", `de-DE` and `de-AT` "Deutsch", `es-ES` "Español" and `zh-CN` "中文", where they read "British English", "Deutsch (Deutschland)", "Español de España" and "中文（中国）" before. The name stays in the language itself, independent of the editor's UI locale, everywhere a label shows `{language}` or `{default}`: the Languages menu, the language bar, locale notices and status chips, comments, AI chat and the settings panel. Two versions of one language share a label; the header's language button still shows the tag next to the name.
