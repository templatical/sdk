---
"@templatical/types": patch
"@templatical/renderer": patch
---

Fix merge tags whose values contain `<` or `>` (custom `mergeTags.syntax`)

A consumer-configured syntax such as Smarty's `<% $email %>` reaches the stored
markup as literal `<` / `>` — HTML attribute serialization escapes only `&`, `"`
and nbsp — and both merge-tag span scanners stopped at the first `>` regardless
of quoting, so the attribute they parsed was truncated and no tag resolved.

Two symptoms, one cause:

- **Previews.** Sample mode showed the label instead of the configured `sample`,
  and Label mode left whatever text the span already carried.
- **Export (worse).** `renderToMjml` left the entire
  `<span data-merge-tag="…">Label</span>` in the output, so the ESP never
  received the token and the recipient saw the label text. Silent — visible only
  in a delivered email.

Tag boundaries and attribute values are now read by two quote-aware primitives
shared by both packages, `findOpenTagEnd` and `getTagAttrValue` (newly exported
from `@templatical/types`). Both are forward-only character scans, so the
linear-time guarantee the previous regexes were written for still holds. Values
in single-quoted and unquoted attributes now resolve too.
