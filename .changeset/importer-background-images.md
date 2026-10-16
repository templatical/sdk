---
"@templatical/import-mjml": minor
"@templatical/import-topol": minor
"@templatical/import-easy-email-pro": minor
"@templatical/import-unlayer": minor
"@templatical/import-beefree": minor
"@templatical/import-chamaileon": minor
"@templatical/import-html": minor
"@templatical/import-stripo": minor
---

Importers bring section and wrapper background images across

Importers used to drop a section's background image, mostly without a word in the report, so a hero banner arrived as a plain colour. Each one now maps it onto the `backgroundImage` field sections and wrapper bands already have.

- **MJML, Topol, Easy Email Pro:** `background-url` with its size, position and repeat, on `mj-section` / `standard-section`, and on `mj-wrapper` / `standard-wrapper` / page header and footer bands as `wrapper.backgroundImage`.
- **Unlayer:** a row's `backgroundImage`; the body's is dropped with a warning.
- **BeeFree:** a row's `content.style` image; the `container.style` band's image while the content area is unpainted.
- **Chamaileon:** a fullwidth's `contentBackgroundImage`, a lone box's image, and the band's while the content area is unpainted; the body's is dropped with a warning.
- **HTML:** `background-image`, the `background` shorthand and the `background` attribute on rows, cells and tables, nearest first; a page image is dropped with a warning. A `background` shorthand's colour is now read too, so `background: #222 url(…)` keeps its `#222`.
- **Stripo:** structure, body, container and stripe images, nearest first. "A background image was not imported." is gone, because the image now maps or is reported specifically.

An attribute the source leaves out takes the source's own default, so an image paints where it did. A size, position or repeat with no exact keyword maps to the nearest one, and the entry is `approximated` with a note. Column images move up to the section when the row has one column or every column shares the image, and are otherwise dropped with a note naming the columns. A full-width band image goes to the section only when the content area doesn't cover it. Stripo and Chamaileon drop a band colour that would paint over the section's image in Outlook desktop.

Heroes (`mj-hero`, Easy Email Pro's `standard-hero`) keep their current mapping until hero mode lands.
