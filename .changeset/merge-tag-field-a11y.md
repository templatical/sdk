---
"@templatical/editor": patch
---

Merge-tag fields expose their controls as a group, not a button inside a button

A merge-tag-enabled field rendered as `role="button"` while containing its own controls — a button per tag, plus Clear. ARIA treats a button as a leaf, so screen readers announced a control inside a control and the tab order read as if you had stepped into the element you just landed on.

The field is now `role="group"` with an accessible name, and raw text editing has an explicit **Edit as text** control instead of relying on the wrapper being focusable. Clicking anywhere in the field still opens the raw editor for mouse users, and Clear is unchanged.

Affects every merge-tag-enabled field: button text and URL, image src and alt, video, menu, social, custom text and textarea fields, template settings, and the rich-text link dialog.
