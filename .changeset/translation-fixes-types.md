---
"@templatical/types": patch
---

`setDefaultLocale` refused for hidden blocks words its message by count: `1 block is hidden in "de". Show it before making it the default.` for one block and `2 blocks are hidden in "de". Show them before making it the default.` for more. The error code and `blockId`, the first hidden block, are unchanged. The protected-term pattern that `maskTags`, `localeStrings` and `applyLocaleStrings` compile is cached by the list's content, so a `doNotTranslate` array changed in place takes effect on the next call.
