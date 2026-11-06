---
"@templatical/import-beefree": minor
"@templatical/import-unlayer": minor
"@templatical/import-html": minor
"@templatical/import-mjml": minor
"@templatical/import-topol": minor
"@templatical/import-stripo": minor
"@templatical/import-chamaileon": minor
"@templatical/import-easy-email-pro": minor
---

Importers map a source full-width background band onto `section.wrapper` with `fullWidth: true`, so the colour and image run to the window edge and the content stays at the email width.

BeeFree row container backgrounds, Unlayer row backgrounds (`backgroundImage.fullWidth` not `false`), Chamaileon `fullwidth` bands, Topol and MJML and Easy Email Pro `full-width="full-width"`, Stripo stripes around an inner body, and an HTML 100% table wrapped around a fixed-width table all set that flag. A full-width section whose only background is the band moves that background onto the wrapper and leaves the section background unset. Content-area backgrounds stay on the section. When the section keeps its own background image, the band colour is left off the wrapper and the import notes it, because Outlook desktop paints a wrapper colour over that image; the band image still goes on the wrapper. A Stripo stripe with no inner body keeps its colour on the section.
