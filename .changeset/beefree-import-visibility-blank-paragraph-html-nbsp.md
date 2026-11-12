---
"@templatical/import-beefree": patch
---

Re-importing a BeeFree template keeps module hide flags, drops empty paragraphs, preserves a blank paragraph's space, centres HTML modules, and keeps a non-breaking space between merge tags.

`descriptor.computedStyle.hideContentOnMobile` or `hideContentOnDesktop` set to `true` or `"true"` sets `visibility` (`{ desktop, mobile }`) on that module's block and on every extra block the module produces.

A `<p>` in a text, paragraph or list module that has no line box is dropped after merge-tag chips are unwrapped.

A blank `paragraph` module (`paragraph.html` empty, whitespace only, or blank by `isBlankRichText` after conversion) imports as a `spacer` whose `height` is the rounded sum of `padding-top`, the line box and `padding-bottom`, with `styles.padding` at 0 on every side.

Non-blank HTML-module content is wrapped as `<div style="text-align:center" align="center">…</div>` with no `font-family`.

A merge-tag chip that holds only whitespace keeps each non-breaking space as `&nbsp;` outside the token, and collapses each other whitespace run to one plain space.
