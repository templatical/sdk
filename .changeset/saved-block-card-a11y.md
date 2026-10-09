---
"@templatical/editor": patch
---

Saved-block cards no longer nest their actions inside a button

Each entry in the saved blocks browser rendered as one `<button>` holding its own Rename, Delete and inline delete-confirm buttons. A button may not contain controls, so screen readers announced a control inside a control, the tab order read as if you stepped into the element you just landed on, and the card's accessible name absorbed its actions' names.

The card is now a plain wrapper. A select button inside it carries the entry's name, block count and category, and Rename, Delete and the confirm sit beside it rather than inside it. Clicking anywhere on the card still selects it, the keyboard focus ring still surrounds the whole card, and the card looks the same as before.
