---
"@templatical/types": patch
"@templatical/renderer": patch
---

`resolveLocale` copies each block once, so resolving a deeply nested template takes time in proportion to its size. Masking merge tags with a custom syntax runs each regex once per match instead of again on every tag.

The renderer writes every `<` in a custom-block stylesheet as the CSS escape `\3c `, so a stylesheet from `renderedStylesheet` or `getCustomBlockStylesheet` can't close its `<mj-style>` or add MJML elements. A stylesheet without `<` renders unchanged.
