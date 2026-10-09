---
"@templatical/renderer": patch
---

Text in a right-to-left email now runs right-to-left in the compiled HTML, not only in the editor. The renderer put `direction="rtl"` on `mj-section` and `mj-group`, but MJML gives every `mj-column` and `mj-wrapper` a default `direction="ltr"` and inlines it on the element. That inline style overrode `<html dir="rtl">`, so paragraphs were right-aligned but laid out left-to-right, and numbers and punctuation landed on the wrong side. RTL templates now also emit `direction="rtl"` on `mj-column` and `mj-wrapper`. LTR output is unchanged. Fixes #872.
