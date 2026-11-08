---
"@templatical/ai-kit": patch
---

The shipped eval set's domain-mismatch case checks link text with `>[^<>]*(?:www\.|://)` instead of `>(?:[^<]*)(?:www\.|://)`. It matches the same text, and checking a turn whose output holds a long run of `>` no longer takes quadratic time.
