---
"@templatical/types": minor
"@templatical/editor": minor
"@templatical/renderer": minor
---

Collapse the responsive model to Desktop + Mobile, dropping the `tablet` tier.

`ViewportSize` is now `"desktop" | "mobile"` and `BlockVisibility` drops its `tablet` field. The editor's viewport toggle no longer offers a Tablet preview, and the renderer emits a single 480px breakpoint (`tpl-hide-mobile` ≤480px, `tpl-hide-desktop` ≥481px) instead of three bands. A "tablet" breakpoint isn't a meaningful concept for email (bodies are ~600px wide; a tablet viewport renders at full desktop width), and the useful responsive split is binary — mobile vs. not-mobile, matching MJML's model.

**Migration:** saved templates carrying `visibility.tablet` keep parsing — the extra key is ignored at runtime. A block previously hidden only on tablet (`tablet: false` with `desktop`/`mobile` true) will now show on 481–768px devices, because there's no longer a `tpl-hide-tablet` class. No data migration is required; re-saving a block normalizes its visibility object to the new shape.
