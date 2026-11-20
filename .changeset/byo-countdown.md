---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
---

Countdown blocks work with `init({ countdown: { imageUrl } })`: the provider makes the block insertable, previews its image on the canvas, and supplies the image URL for local MJML and HTML exports. Headless callers can use `renderCountdownImage` to render the same localized image markup.
