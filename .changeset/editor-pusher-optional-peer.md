---
"@templatical/editor": patch
---

`pusher-js` is now declared as an optional peer. The editor imports it for `initCloud()` realtime, and without the declaration a production `vite build` of an app that doesn't install it failed with `failed to resolve import "pusher-js"`, while the dev server ran normally.
