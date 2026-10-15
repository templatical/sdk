---
"@templatical/editor": patch
---

Preview mode no longer shows a section column's drop chrome. An empty column kept the dashed border, the "Drop here" hint and the 60px drop height there, though preview shows the email as it will be sent. In preview an empty column is now a blank 34px, the height of the placeholder the renderer gives it in the sent email. A column whose blocks the condition preview hides collapses to nothing, as the email's column does when the condition is false. Editing is unchanged.
