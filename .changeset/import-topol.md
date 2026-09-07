---
"@templatical/import-topol": minor
---

Add `@templatical/import-topol`, a converter from Topol.io design JSON to Templatical template JSON.

`convertTopolTemplate(design)` returns `{ content, report }` with the same shape as the BeeFree, Unlayer, HTML and MJML importers. It resolves Topol's global-style cascade — the per-tag and per-selector defaults on the design root — maps every tag Topol emits, and reports what it approximated: a four-column section folded to three, a GIF block imported as an image, a social platform with no Templatical equivalent.

Pass the design object itself, or a JSON string of it. Topol's REST API wraps the design as `{ id, name, html, json }`, so pass the response's `json` field.
