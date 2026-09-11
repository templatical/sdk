---
"@templatical/import-easy-email-pro": minor
---

Add `@templatical/import-easy-email-pro`, a converter from Easy Email Pro persist JSON to Templatical template JSON.

`convertEasyEmailProTemplate(doc)` returns `{ content, report }` with the same shape as the other `@templatical/import-*` packages. It accepts the `{ subject, content }` envelope or a bare `type: "page"` element, resolves `$var()` design tokens, maps `standard-section` / `standard-column` / leaves, and reports what it approximated: 4+ columns folded to three, outlined buttons, hero overlays, countdown GIFs, widgets, and logic whose children converted without their expressions.
