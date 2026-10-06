---
"@templatical/editor": patch
---

An editor instance's `unmount()` now tears down only that instance. Once another `init()` on the same container has replaced it, calling the old instance's `unmount()` does nothing instead of unmounting the replacement — which left a blank editor under React StrictMode when a bundler settled both mounts in the same tick, as webpack's shared chunk loading can. The top-level `unmount()` export still tears down the most recently mounted editor.
