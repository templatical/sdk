---
"@templatical/editor": patch
---

Saved-block surfaces now have rounded corners

The saved blocks browser's cards, their keyboard focus ring, the inline rename row and the loading skeleton, and the block previews in the save dialog all rendered with square corners. They read `--tpl-radius-md`, which is not one of the editor's radius tokens, so the radius resolved to nothing. They now use `--tpl-radius-sm` (7px by default), which matches the inputs and buttons around them, and they follow `--tpl-user-radius-sm` when you theme it. The focus ring follows the card's corners.

The 0.7.0 notes gave `--tpl-user-radius-md` as an example theming hook. The editor has never read it. The radius hooks are `--tpl-user-radius-sm`, `--tpl-user-radius` and `--tpl-user-radius-lg`. The theming guide now lists every hook the editor reads, including `--tpl-user-on-primary`, and marks which ones have a `--tpl-user-dark-*` twin. The radius, size, font and transition hooks have no twin and apply in both modes.
