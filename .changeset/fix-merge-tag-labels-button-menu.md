---
"@templatical/editor": patch
---

Fix: resolve merge tags to their labels in Button, Menu, Video and Image block canvas display

Merge-tag-enabled fields rendered directly on the canvas now show a tag's human-readable `label` (e.g. "Shipping Method") instead of the raw `{{shipping_method}}` token, matching the rich-text editor: button labels, menu item labels, and the Video URL / Image src placeholders shown when those fields are merge tags. Display-only — the raw token is still emitted in the MJML output. (#348)
