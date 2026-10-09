---
"@templatical/editor": patch
---

`init()` and `initCloud()` now check `layout` and `content` when they are called, before they touch the container. A call whose layout or content the editor refuses (such as a layout without exactly one legal slot, or content holding a `slot` or `wrapper` block) rejects at once with the same error as before, and leaves the container and its editor exactly as they were. The check used to run after the call had taken the container over: the rejected call unmounted the editor already there and left the container blank, and an earlier call still loading on that container resolved with an editor that never mounted. A rejected `initCloud()` call now also makes no auth, health or plan request, and in shadow DOM mode a rejected call no longer attaches a shadow root.
