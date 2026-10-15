---
"@templatical/types": minor
"@templatical/editor": minor
"@templatical/renderer": minor
---

Custom-block stylesheets now reach a render backend. The editor copies each definition's `stylesheet` onto its blocks as `renderedStylesheet` when it pre-renders `renderedHtml`, for a `render` provider's payload and before Cloud saves. `renderToMjml` emits those copies when no `getCustomBlockStylesheet` is passed, so `renderToMjml(payload.content)` keeps a custom block's media queries and hover rules with no extra wiring. A resolver, when passed, still decides every type.
