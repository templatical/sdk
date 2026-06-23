---
"@templatical/editor": patch
---

Add a `smallScreenNotice` option (default `true`): on viewports narrower than ~768px the editor now shows a "use a larger screen" notice instead of a cramped, unusable drag-and-drop layout. The palette, canvas, and properties panel can't lay out on a phone and touch dragging is impractical, so this is the honest fallback. Opt out with `smallScreenNotice: false` to render the editor at any width if you handle small screens yourself. Applies to both the OSS and cloud editors (#235).
