---
"@templatical/editor": minor
---

Add per-link color for rich-text links

A rich-text link (in Paragraph and Title blocks) can now carry its own color — set it in the link dialog, or select the link and use the text-color control. The color is applied to the `<a>` itself, so the link's text and its underline stay the same color (the underline follows `currentColor`) in the editor canvas and the exported MJML/HTML alike. A per-link color takes absolute priority: it overrides the document link color, and setting one also strips any inline text color already on the link's text, so the whole link (glyphs and underline) follows the chosen color rather than showing a recolored underline over differently-colored text. Conversely, applying a text color across a selection that includes a link updates the link's own color to match — so a link stays internally consistent (its text, underline, and the color shown in the link dialog and toolbar always agree) in both directions.

Previously a link's color could only be applied as an inner text-color span, which colored the text but left the underline painted by the ancestor `<a>` in the document link color — a visible mismatch that also shipped in the exported email. Putting the color on the link resolves it, and completes the per-link styling deferred from the document-level link color work. (#373)
