---
"@templatical/editor": patch
---

Fix: clicking a link inside a rich-text block no longer opens it while building

In the editor canvas, a single click on a link inside a Paragraph or Title block used to follow the link (opening its `href`, typically in a new tab) instead of selecting the block. Unlike Button, Menu, Image, Video and SocialIcons blocks — whose anchors carry a template-level `@click.prevent` guard — rich-text links are injected as raw `<a>` via `v-html`, so their navigation was never suppressed. A click on a rich-text link now selects the block for editing (double-click still opens the inline editor); preview mode leaves links clickable. (#351)
