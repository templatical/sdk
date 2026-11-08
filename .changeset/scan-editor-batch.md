---
"@templatical/editor": patch
"@templatical/core": patch
---

Preview surfaces are read-only: the canvas in preview mode and the test-email and saved-block previews no longer start inline edits or write table cells, so resolved preview content can't overwrite the template.

On the canvas, a link with `target="_blank"` drops `opener` from its `rel` and gains `noopener`. Stored content and the exported email keep the link as authored.

Cloud comments follow a template switch: the editor leaves the previous template's realtime channel and joins the new one, and ignores a comment broadcast for another template. A failed socket connection is retried on the next connect.
