---
"@templatical/renderer": patch
"@templatical/editor": patch
"@templatical/types": patch
---

Inline font choices in paragraph and title rich text use their fallback stack in the email and editor canvas. Encoded declaration separators and quoted CSS font escapes preserve the intended styles, and a single title paragraph keeps its font on the heading. The edit surface applies the same stack without changing stored rich text. Existing inline stacks keep their specified fallbacks.
