---
"@templatical/editor": minor
---

Merge tags in rich-text link URLs

The **Insert Link** dialog in a title or paragraph block now takes merge tags in its URL field, through the same insert button, picker, chip display and type-ahead as every other URL field in the editor. It was the only URL field without them, and a link is often the field most in need of one — a per-recipient or per-event URL.

Three fixes come with it:

- A URL that opens with a merge tag is stored verbatim instead of being prefixed with `https://`. A tag supplies its own scheme, so the prefix produced `https://https://…` once the sending system resolved it. The scheme allowlist still runs first, so `javascript:` and friends are rejected as before, and a bare host without a tag is still completed.
- The semantic z-index scale compiled to nothing. Tailwind 4 derives z utilities from the `--z-index-*` theme namespace, but the layers were declared as `--z-panel` / `--z-toast` / `--z-overlay` / `--z-popover` / `--z-modal`, so all twelve `tpl:z-*` classes computed `auto` while reading like stacking decisions. The two cloud overlays and the collaboration toast now carry real numbers — they sit beside the `z-50` header, which was painting over them. The other nine need none: five teleport into `.tpl-popover-root`, which is its own stacking context, and the four feature sidebars never overlap the properties panel.
- The in-flight flag behind the merge-tag and logic pickers is now shared per editor rather than per composable instance. The rich-text click-outside guard reads it to keep a block in edit mode while a picker is open; with a private flag it only ever saw requests from one host, so a picker opened anywhere else would close the block mid-insert and drop the tag.
