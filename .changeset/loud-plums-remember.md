---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
---

Match exported rich-text spacing to the editor canvas, and make the paragraph gap settable per block

MJML's core skeleton gives every `<p>` a 13px vertical margin, and resets
nothing at all for `ul` / `ol` / `li` — those fell through to each mail
client's own stylesheet. The canvas used different values for both, so a
three-paragraph block measured 99px in the editor and 135px in the delivered
email: 13px of unwanted space above the first paragraph, 13px below the last,
and 13px rather than 8px between each. Lists were off by 6px vertically and
16px of bullet indent, and being client-dependent could not be matched from the
editor side at all.

The renderer now emits scoped rules for the elements a rich-text block stores,
via `<mj-style inline="inline">` — so the declarations arrive as real inline
styles that hold up in clients which strip `<style>` from the head. The scope
(`tpl-rich-text`, on paragraph and title blocks only) deliberately leaves an
`html` block's own markup untouched.

Both sides read one set of values, `RICH_TEXT_SPACING` in `@templatical/types`,
and a parity test fails if the canvas CSS drifts from it.

Also fixed on the editor side: canvas content spacing was expressed on the
`--tpl-base-size` scale, which consumers override to scale the editor chrome —
so scaling the UI silently moved the spacing the email could not follow. Email
content spacing is now fixed px.

## Per-block paragraph spacing

New optional `ParagraphBlock.paragraphSpacing`, edited from a field in the
block's settings panel: the px gap between the paragraphs of a block holding
more than one `<p>`. Omit it and the block uses the built-in 8px it already
had, so no existing template changes appearance. `0` is valid and butts the
paragraphs together.

The renderer emits one rule per *distinct* gap in the document and the canvas
reads the same number from a CSS variable on the block wrapper, so the two
cannot disagree.

Scoped to the space *between* paragraphs inside one block. Space around a block
is `styles.padding`, as before, and a block with a single paragraph has no
internal gap to set. List spacing stays fixed, for the reason above: those
values exist to pin down mail-client defaults rather than to be designed with.
Titles take the default gap and cannot set their own — their content is normally
one paragraph the renderer unwraps into the heading.
