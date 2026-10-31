---
"@templatical/editor": patch
"@templatical/types": minor
"@templatical/quality": patch
---

The editor sanitizes live rich-text HTML, custom-block canvas HTML, and inline SVG icons with DOMPurify. Custom-block export HTML is unchanged. URL attribute checks use a shared scheme policy from `@templatical/types`; the link dialog and `@templatical/quality` use the same scheme parsing. Unsupported DOM environments display escaped text.
