---
"@templatical/editor": patch
---

Show a minted merge tag's label instead of its raw token

A `mergeTags.onRequest` picker that mints a tag on the fly returns one that is in no `tags` array, so nothing could resolve it — and the chip rendered the raw token the moment the author picked a field. The label was already stored on the tag; the display chain just reached for the token first.

A tag now resolves its label as: the matching entry in `tags`, then the label stored on the tag, then the token (or the placeholder when `showRawValue` is `false`). For a tag the editor made itself — typed, pasted, or converted from loaded content — the stored label is the token, so nothing changes there.

One consequence worth stating: a tag whose entry is later removed from `tags` now keeps showing the label it was inserted with, rather than reverting to its token.
