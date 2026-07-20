---
"@templatical/editor": patch
---

Fix two shadow-DOM rendering bugs surfaced when the editor is embedded under a transformed ancestor

- **Popovers mispositioned under a transformed ancestor.** The color picker, the rich-text floating toolbars (Title + Paragraph), and the merge-tag autocomplete positioned their teleported popovers with `position: fixed` using viewport coordinates. When any ancestor of the editor has a `transform` / `filter` / `will-change` (a host's scroll-parallax wrapper, route transition, or reveal animation — even while its computed `transform` reads `none`, since a running/animated transform still promotes the element), that ancestor becomes the containing block for the `fixed` popover and offset it far from its trigger. They now anchor `position: absolute` inside the (positioned) `.tpl-popover-root`, converting the viewport target to root-local coordinates via the new `usePopoverPosition` helper — immune to the ancestor transform.

- **`ToggleSwitch` knob off-center / overflowing its track.** Tailwind Preflight is intentionally omitted, and the hand-rolled form reset never zeroed native `<button>` padding — so a button with no padding utility kept the UA default (`1px 6px` in Chromium). In shadow-DOM mode (no host reset to mask it) that shrank the fixed-size toggle track and pushed the knob off-center. The `:where(.tpl) button` reset now zeroes `padding`/`margin` (specificity stays 0, so per-button `tpl:p-*` utilities still win).

- **Block palette rail stayed expanded after a drag-drop.** Dropping a block leaves the cursor out in the canvas, so no `mouseleave` fired to collapse the hover-expanded sidebar rail (and the mid-drag `mouseleave` was intentionally suppressed) — it stayed open until the next hover-in/out. It now collapses on drag-end.

Also documents the containing-block caveat (a `transform`/`filter`/`will-change` on an ancestor of the mount point offsets the editor's `fixed`-positioned overlays and drag ghost) on the `init()` `container` option and in the installation docs.
