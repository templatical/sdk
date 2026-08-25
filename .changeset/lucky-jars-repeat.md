---
"@templatical/editor": patch
---

Preview surfaces render the template's background colour

The test-email dialog, the saved-blocks browser and the save dialog's reorder rows painted the editor's neutral canvas surface regardless of `settings.backgroundColor`, so a coloured email body read as unset in the preview shown immediately before sending.

Each of those surfaces now draws the body colour the way the canvas does: a stage carrying the background, with a band of it on each side of the content column, mirroring how `mj-body background-color` renders around the centred content when the email is sent. A block with no fill of its own shows the body colour through it, and the test-email dialog widened to leave the band room to appear.
