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

Breaking changes:

- An imported full-width section whose only background is the source band now carries that colour and image on `section.wrapper` (`backgroundColor`, `backgroundImage`, with `fullWidth: true`) instead of `section.styles.backgroundColor` and `section.backgroundImage`. Code that reads an imported section's background must also read `section.wrapper`.
- When an imported section keeps its own background image, a source band colour is no longer applied; the section entry is reported `approximated` with a note. There is no replacement: the colour would be painted over the image in Outlook desktop.

Importers map a source full-width background band onto `section.wrapper` with `fullWidth: true`, so the colour and image run to the window edge and the content stays at the email width.

BeeFree row container backgrounds, Unlayer row backgrounds (`backgroundImage.fullWidth` not `false`), Chamaileon `fullwidth` bands, Topol and MJML and Easy Email Pro `full-width="full-width"`, Stripo stripes around an inner body, and an HTML 100% table wrapped around a fixed-width table all set that flag. A full-width section whose only background is the band moves that background onto the wrapper and leaves the section background unset. Content-area backgrounds stay on the section. When the section keeps its own background image, the band colour is left off the wrapper and the import notes it, because Outlook desktop paints a wrapper colour over that image; the band image still goes on the wrapper. A Stripo stripe with no inner body keeps its colour on the section.
