---
"@templatical/editor": minor
---

Add per-link color for rich-text links

A rich-text link (in Paragraph and Title blocks) can now carry its own color — set it in the link dialog, or select the link and use the text-color control. The color is applied to the `<a>` itself, so the link's text and its underline stay the same color (the underline follows `currentColor`) in the editor canvas and the exported MJML/HTML alike, and it overrides the document link color.

Previously a link's color could only be applied as an inner text-color span, which colored the text but left the underline painted by the ancestor `<a>` in the document link color — a visible mismatch that also shipped in the exported email. Putting the color on the link resolves it, and completes the per-link styling deferred from the document-level link color work. (#373)
