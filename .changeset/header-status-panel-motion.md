---
"@templatical/editor": patch
---

Fix the header switching to its compact layout while the save status shows. "Unsaved" and "Saved" appear on every edit and save; in an editor just wide enough for the full header, their words compacted the whole header until the status cleared, about 5 seconds with `templates.autoSave`. The badge keeps a fixed slot (its icon) in the header's fit measurement and shows its words only where the full header has room for them. Without room it shows the icon alone, a different one per state (dot, check, alert), and keeps the words as its tooltip and for screen readers. In the compact header the badge is always the icon alone.

Fix the AI and Comments panels opening and closing without a slide: the AI panel appeared and disappeared in place, and Comments jumped. The panel, the properties panel it pushes aside and the canvas move together on one timing, the new `--tpl-panel-transition` token (240ms). Override it with `--tpl-user-panel-transition`. Under `prefers-reduced-motion: reduce` none of the three animates.
