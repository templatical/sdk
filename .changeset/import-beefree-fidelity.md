---
"@templatical/import-beefree": patch
---

BeeFree imports keep divider widths, fonts and link colour

- **A divider keeps its width.** `100%` imported as a 100px line. A missing width or `100%` now imports as `"full"`, any other percentage stays a percentage such as `"50%"` (clamped to 0–100%, kept to two decimals), and a px width stays px unless it reaches its column's content width, the column less the divider's own padding, where it becomes `"full"`. Templatical centres every divider, so a partial-width divider that BeeFree aligns left or right is reported `approximated`, and so is a clamped or unreadable width.
- **A CSS-wide keyword is no longer a font.** BeeFree's paragraph modules write `font-family: inherit`, which became a font of its own on the block, and the sent email fell back to the client's default face. `inherit`, `initial`, `unset` and `revert` now leave a title, button or menu font unset, so it follows `settings.fontFamily`, and a paragraph gains no `font-family` span. In a colour, the same keywords and `none` read as unset.
- **The link colour carries over.** `page.body.content.computedStyle.linkColor` maps to `settings.linkColor`. Links are underlined: BeeFree sets underlines per link, and every import turned the document-wide underline off before.
- **The body width and text colour carry over.** BeeFree exports keep the body width in `page.body.content.computedStyle.messageWidth`, which now maps to `settings.width`, with `style.width` as the fallback; every real export imported at 600px before, and dividers are now measured against the real width. `page.body.content.style.color` maps to `settings.textColor`, `#1a1a1a` when unset. A heading, menu or table with no colour of its own now follows it instead of carrying `#1a1a1a`, and a paragraph keeps a colour span only where its colour differs from the body's.
