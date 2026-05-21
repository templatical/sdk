---
"@templatical/editor": patch
---

Fix center alignment in Video and Image blocks (issue #111). When a fixed pixel width was set and alignment was set to "center", the editor preview rendered the block flush-left instead of centered.

Root cause: the alignment styles mixed the CSS `margin` shorthand with the `marginLeft` longhand in the same Vue style object. Vue patched `margin: "0 auto"` first (expanding to all four longhands including `margin-left: auto`), then patched `marginLeft: undefined` which cleared `margin-left` back to `0`. Result: `margin-right: auto` only, which is left-alignment with extra space on the right.

Fix: use only longhand `marginLeft` / `marginRight` properties — no shorthand. MJML export was unaffected (the renderer emits `align="center"` on `<mj-image>` directly); only the editor preview was broken.
