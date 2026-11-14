---
"@templatical/import-mjml": minor
"@templatical/import-stripo": minor
"@templatical/import-easy-email-pro": minor
---

The MJML, Stripo and Easy Email Pro importers keep an unrecognised social icon's image as a custom icon.

A social icon whose network Templatical doesn't recognise, and that has an image, becomes a custom icon (`platform: "custom"`) with that image as `imageUrl`, its link as `url` and its alt text as `alt`, in its place in the row. Before, it became the generic `website` icon and lost its image. An unrecognised icon without an image still becomes `website`. In MJML this is an `mj-social-element` with a `src`, which is also how Templatical's renderer writes a custom icon, so a rendered custom icon imports back as one. In Stripo it is the icon's `<img>`, and in Easy Email Pro the element's `src`.
