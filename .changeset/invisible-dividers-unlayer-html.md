---
"@templatical/import-unlayer": patch
"@templatical/import-html": patch
---

The Unlayer and HTML importers import a divider as the line it draws, so one that draws nothing no longer becomes a black line.

- **Unlayer.** A divider whose `border.borderTopWidth` is 0, whose `borderTopStyle` is `none` or `hidden`, or whose `borderTopColor` is transparent (`transparent`, or an alpha of 0 such as `rgba(0, 0, 0, 0)`) becomes a `spacer`. Its height is the top and bottom `containerPadding` plus a transparent border's width, and it's reported `converted` with a `note` naming the height. One that adds up to 0px produces no block and is reported `skipped`. Until this release, `0px solid transparent` imported as a 1px black line and `10px solid transparent` as a 10px black bar.
- **HTML.** An `<hr>`'s line is its top border, or its `border-bottom` when the top draws nothing: `border: 0; border-bottom: 1px solid #cccccc` now imports as a 1px `#cccccc` divider. With no border that draws, its `background` or `background-color` draws the line when it has a `height`: `border: 0; height: 1px; background: #cccccc` now imports as a 1px `#cccccc` divider. Until this release, both imported as 1px black lines. An `<hr>` that draws nothing becomes a `spacer` of its vertical margins, padding, `height` and transparent border widths, or is skipped at 0px. An `<hr>` with no border styles still imports as a 1px solid black line.
- **Negative padding.** CSS drops a padding with a negative length, and both importers now do too, for every block: a padding shorthand with a negative side is no padding, and an HTML padding longhand that's negative leaves the shorthand's value for that side. The sign is read before rounding, so `-0.4px` counts as negative. An `<hr>`'s negative `height` counts as 0.

Rules and tables: [Unlayer](https://docs.templatical.com/guide/migration-from-unlayer#undrawn-dividers) and [HTML](https://docs.templatical.com/guide/migration-from-html#hr-lines) migration guides.
