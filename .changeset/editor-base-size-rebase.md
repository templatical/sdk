---
"@templatical/editor": patch
"@templatical/media-library": patch
---

Make the editor and standalone media library independent of the host page's `html { font-size }` (#209).

The UI's length scale (spacing, font sizes, border radii) is now anchored to a new `--tpl-user-base-size` token that defaults to a fixed `16px`, instead of `rem`. A `rem` always resolves against the document root — even inside the editor's shadow root — so a consumer design system that set e.g. `html { font-size: 8px }` previously shrank the entire editor. It no longer does.

Consumers on a normal 16px root see identical sizing. To scale the whole UI, set `--tpl-user-base-size` on the editor container (or any ancestor): a px value to enlarge/compact (`18px`, `14px`), or a `rem` value such as `2rem` to deliberately track a custom root font-size. Email content on the canvas is unaffected — it uses the pixel sizes stored on each block.
