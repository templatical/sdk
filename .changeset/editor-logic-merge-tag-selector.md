---
"@templatical/editor": minor
---

Logic merge tags can now be inserted from the merge tag selector. A configured tag whose value is a logic tag (e.g. `{% if vip %}`) inserts as a styled logic tag — matching a manually-typed one — instead of being forced into a data tag (#240). The built-in picker and the typing-autocomplete list show an uppercase keyword badge (IF, FOR, ENDIF…) next to logic-shaped tags, so you can group them under a "Conditions" section and let authors add control flow without writing the syntax by hand.
