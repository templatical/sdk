---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
"@templatical/quality": minor
---

Add first-class email content direction (`settings.direction`: `"ltr"` | `"rtl"`). The canvas, previews, and `<mjml dir>` follow it independently of the editor chrome; when unset, RTL content languages (`ar`, `he`, `fa`, `ur`, …) resolve as RTL. New title and table blocks start at the start edge. The all-caps accessibility rule skips caseless scripts so Arabic and Hebrew copy is not flagged as shouting.
