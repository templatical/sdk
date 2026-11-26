---
"@templatical/renderer": patch
"@templatical/editor": patch
---

Inline font choices in paragraph and title rich text use their fallback stack in the email and editor canvas. The edit surface applies the same stack without changing stored rich text. Existing inline stacks keep their specified fallbacks.
