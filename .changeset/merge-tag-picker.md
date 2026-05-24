---
"@templatical/types": minor
"@templatical/editor": minor
---

Add a built-in merge tag picker modal. When `mergeTags.tags` is configured without `mergeTags.onRequest`, clicking "Insert merge tag" now opens a searchable, keyboard-navigable picker that lists every tag. The picker supports optional grouping (via a new `group` field on `MergeTag`) and per-tag helper text (via a new `description` field). `onRequest` continues to take precedence when set. The picker bundle is lazy-loaded — editor sessions that never click "Insert merge tag" pay no extra cost on mount.
