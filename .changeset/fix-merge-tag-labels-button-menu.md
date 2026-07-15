---
"@templatical/editor": patch
---

Fix: resolve merge tags to their labels in Button and Menu block canvas display

Button labels and menu item labels now show a merge tag's human-readable `label` (e.g. "Shipping Method") on the canvas instead of the raw `{{shipping_method}}` token, matching the rich-text editor. Display-only — the raw token is still emitted in the MJML output. (#348)
