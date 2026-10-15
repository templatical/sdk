---
"@templatical/editor": patch
---

A merge tag or logic tag typed out in full in a paragraph or title, such as `{{first_name}}`, `{{ first_name}}` or `{% if vip %}`, turns into a chip again as its closing character is typed. Since 0.43.3 it stayed as plain text and the suggestion list stayed open. Picking a tag from the suggestion list or the picker was not affected.
