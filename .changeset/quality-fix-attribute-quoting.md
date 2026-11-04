---
"@templatical/quality": patch
---

Lint auto-fixes now rewrite single-quoted attributes without adding attributes. Double-quoted values are copied as written, including entities, and a rewritten anchor tag is lowercase. Link and alignment fixes skip markup inside comments, link fixes use the same attribute decoding and HTML whitespace rules as detection, and alignment fixes split declarations on decoded CSS characters, so `&#59;` separates declarations, and keep the character references in the declarations they keep.
