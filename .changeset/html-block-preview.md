---
"@templatical/editor": minor
---

Add an opt-in `htmlBlockPreview` config option that renders HTML blocks as a live preview in the editor canvas.

When enabled (`htmlBlockPreview: true` or `{ enabled: true }` — off by default), each HTML block's content is rendered verbatim inside a sandboxed `<iframe>` (`sandbox="allow-same-origin"`, no `allow-scripts`) instead of the static placeholder card. Scripts and inline event handlers never execute and the fragment's styles can't leak into the editor. This is preview-only — the MJML/HTML export path renders HTML blocks regardless.

Also corrects the HTML block's editing-panel hint, which previously claimed scripts and unsafe elements were stripped on export; the OSS renderer does not sanitize HTML block content, so the hint now states that content is exported as-is.
