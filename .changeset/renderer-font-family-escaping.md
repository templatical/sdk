---
"@templatical/renderer": patch
---

A font stack that quotes a family with double quotes, such as `"Helvetica Neue", Arial, sans-serif`, no longer drops the font from the email. The renderer wrote `font-family` into its MJML attribute unescaped, so the first `"` ended the attribute. MJML then reported invalid attributes and compiled the font as `font-family:;`. For the template font, that meant every text block fell back to the mail client's default. These values come from imported templates (Easy Email Pro keeps the page's stack as written) and from hand-written or generated JSON. The template font and the title, button, menu and table fonts now escape `&`, `<`, `>` and `"`. Single quotes are left as they are, so stacks like `'Times New Roman', serif` and custom fonts render byte-for-byte as before.
