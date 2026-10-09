---
"@templatical/editor": patch
---

`init()` now mounts on a copy of the config you pass and never writes to it, as `initCloud()` already did. It used to write the normalized `layout` and `content` back onto your object, so a frozen config that carried either one, such as Immer state or an `Object.freeze`d constant, threw `TypeError: Cannot assign to read only property`. Reassigning a key on that object after `init()`, such as `onChange`, no longer reaches the editor; for a handler that changes over time, pass a function that calls the current one.
