---
"@templatical/editor": patch
---

Fix: show merge tag labels in Button, Menu, Video and Image block canvas display

Merge-tag-enabled fields rendered directly on the canvas now show a tag's human-readable `label` (e.g. "Shipping Method") instead of the raw `{{shipping_method}}` token, matching the rich-text editor: button labels, menu item labels, and the Video URL / Image src placeholders shown when those fields are merge tags. Resolved tags carry a subtle dotted underline (in the current text color) so a dynamic value stays distinguishable from user-typed text on any background. Display-only — the raw token is unchanged in the stored value and MJML output. (#348)
