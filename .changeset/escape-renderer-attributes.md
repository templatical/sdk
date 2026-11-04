---
"@templatical/renderer": patch
---

Template values in MJML attributes are escaped before rendering. Body background colours containing markup use a transparent fallback so the compiled HTML does not carry that markup.
