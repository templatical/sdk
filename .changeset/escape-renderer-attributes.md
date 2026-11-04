---
"@templatical/renderer": patch
---

Template values in MJML attributes are escaped before rendering. Body background colours containing markup use a transparent fallback so the compiled HTML does not carry that markup. CSS-valued attributes (background colours, border radius, background size, position and repeat) also drop `;`, `{`, `}` and line breaks, so a value stays one CSS declaration.
