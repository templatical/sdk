---
"@templatical/renderer": patch
---

Inline font selections in paragraph and title rich text now include the configured fallback stack in rendered emails. Previously, an inline custom or built-in font stayed as a bare name even when the surrounding block had a fallback, so Gmail and classic Outlook could show that text in their default serif font. Existing inline stacks keep their author-specified fallbacks.
