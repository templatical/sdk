---
"@templatical/editor": patch
---

The editor works on a copy of the content it receives: `init({ content })`, `setContent()`, `create({ content })`, a `templates.load` result and version-history content. Edits never change the caller's object, and content from another Vue's `reactive()`, a `ref()`'s `.value` or `markRaw()`, or frozen store state, now edits normally. The editor held the object it was given before: an app's own reactive object kept text and settings edits off the canvas and the properties panel, and frozen state threw on the first edit.
