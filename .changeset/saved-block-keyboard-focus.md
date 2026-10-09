---
"@templatical/editor": patch
---

Keyboard focus stays in place in the saved blocks browser

Arming a saved block's delete, confirming it, and closing an inline rename each replace the control that has focus. Focus used to fall back to the page, so a keyboard user had to start again from the top. Now focus moves to the delete confirm when it appears. After a delete, it goes to the entry that took the deleted one's place, or the one before it, or the search box once the library is empty. Enter or Escape in a rename hands it back to Rename. Escape on the delete confirm now backs out to the Delete button instead of closing the whole browser.
