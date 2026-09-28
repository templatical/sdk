---
"@templatical/editor": patch
---

Canvas and shadow-mount fixes

- **An email wider than the canvas pane scrolls to both edges.** When the email was wider than the pane, as in a 1024px-wide window, the canvas centred it and it overflowed on both sides, so the part past the left edge could not be scrolled to. The pane now scrolls from the email's left edge. Wherever the email fits, the canvas sits exactly where it did before.
- **The empty-canvas placeholder stays light in the dark theme.** It sits on the email's page, which renders light in both themes, so it now takes the same light tokens as block content. In the dark theme it read as a dark hole in a light page.
- **A shadow-mounted editor no longer logs "@import rules are not allowed here".** The editor's stylesheet starts with an `@import` for the Geist font, and a constructed stylesheet cannot hold one, so every shadow mount logged a warning on the host page. The shadow root's sheet now leaves it out. Geist still loads from the stylesheet you import at document level (`style.css`, or `editor.css` from the CDN), as it did before.
