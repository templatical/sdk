---
"@templatical/import-mjml": minor
---

Add `@templatical/import-mjml`, a converter from MJML documents to
Templatical template JSON — alongside the existing BeeFree, Unlayer and HTML
importers.

`convertMjmlTemplate(mjml)` returns `{ content, report }`, the same shape as
the other three importers. It resolves MJML's `mj-attributes` / `mj-class` /
`mj-all` attribute cascade before mapping tags, and recovers block visibility
and display conditions from the markup `@templatical/renderer` emits for
them. Tags with no Templatical equivalent — `mj-hero`, `mj-carousel`,
`mj-accordion`, and any custom component — fall back to HTML blocks holding
the original markup.

MJML produced by `@templatical/renderer` converts back with no
approximations, which a round-trip test asserts over a fixture covering
every round-trippable block type.
