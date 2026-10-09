---
"@templatical/editor": patch
---

When `init()` or `initCloud()` is called again on a container before an earlier call on it has resolved, the later call now keeps the container, whichever call finishes first. The earlier call resolves with an editor that never mounts, and whose `unmount()` does nothing. The call that finished last used to replace the other's editor: under React StrictMode in development, the cancelled first call could finish last on a cold load, and the documented cleanup then unmounted it, leaving a blank editor. `initCloud()` now also rejects a container selector that matches nothing before it makes any request.
