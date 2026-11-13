---
"@templatical/import-unlayer": patch
"@templatical/import-topol": patch
"@templatical/import-chamaileon": patch
"@templatical/import-easy-email-pro": patch
---

The Unlayer, Topol and Chamaileon importers measure a column's room against the section's inner box, not the whole email width. The room is the width an image, divider or video is compared with before it becomes `"full"`. It is now the column's share of the width less the section's side padding: Unlayer row `padding`, Topol `mj-section` padding, Chamaileon fullwidth content padding. In a 600px Topol section with 50px side padding, a lone column's room is 500px, so a 500px image is `"full"` and a 499px one stays px.

In Topol and Easy Email Pro, a section whose side padding leaves no inner box drops its px column widths. That section is now `approximated` with a note naming the widths. It was reported `converted`.
