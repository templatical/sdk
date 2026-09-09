---
"@templatical/import-mjml": patch
---

Keep prose around inline links as a paragraph.

An `mj-text` of copy plus a trailing `<a>` imported as a `menu` labelled from
the links, and the surrounding words were discarded. `looksLikeMenu` walked
element children only, so text-node siblings never vetoed. It now refuses when
a non-whitespace text node sits next to the anchors, and the block imports as
a `paragraph` that keeps both the prose and the `<a>`. Whitespace-only text
nodes (newlines between `<a>`/`<span>`) still do not veto, so a span-separated
menu stays a menu. Anchors separated by a text-node `|` become a paragraph —
same veto, not a second rule.

The dropped footer and body words now survive: `receive`, `message`,
`unsubscribe`, `smilesdavis`, and the Dropbox copy (`important`, `available`,
`exclusively`, `accidentally`, `targeted`, `ransomware`).
