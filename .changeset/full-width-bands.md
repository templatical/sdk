---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
"@templatical/template-tools": minor
"@templatical/ai-kit": minor
---

A section wrapper or a layout wrapper can span the recipient's window. Set `fullWidth: true` on `section.wrapper` or on a layout `wrapper` block and the renderer emits MJML's `full-width="full-width"` on that `mj-wrapper`: the band's background color and background image run edge to edge, and the section or the wrapper's children stay at `settings.width`. Omit `fullWidth`, or set it `false`, and the band stays the email width, exactly as before. A corner radius is not rendered while full width is on; the stored radius remains and comes back when full width is off.

In the editor, **Full-width background** in a section's Background panel sets this. With no wrapper yet, turning it on moves the section's own background color and image onto a new wrapper and clears them on the section. Turning it off clears the flag; a wrapper that holds only that moved fill is removed and the fill returns to the section. The Wrapper panel shows the same switch. A layout wrapper block has the same switch on its Background panel. On the canvas, and in preview, the band reaches the edges of the pane while the content stays at the email width.

This is the band people migrating from Topol have been asking for (sdk#1105). Importers set `fullWidth` when the source states that band.
