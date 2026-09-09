---
"@templatical/import-html": patch
---

Keep a linked image as an `image` block with its href.

An `<a>` wrapping an `<img>` imported as a `paragraph` of raw markup, and the
link target was dropped. A styled linked image — padding or a background on the
anchor — imported as a button labelled `"Button"`, with the `src` and `alt`
discarded entirely. That is the cell-as-button path matching `"" === ""` on an
image-only anchor. Both now import as `image` with `linkUrl` from a non-empty
href, reported `converted` with no `note`. `target="_blank"` sets
`linkOpenInNewTab`; otherwise the key is omitted. An empty `href` omits
`linkUrl`. An `<a>` that wraps both an image and text becomes that `image` plus
a sibling `paragraph` that keeps the remaining `<a>`.

Measured on the wide corpus, before and after:

| | before | after |
|---|---|---|
| converted / approximated / html-fallback | 525 / 49 / 88 | 541 / 31 / 90 |
| `image` blocks with `linkUrl` | 0 | 16 |
| buttons labelled `"Button"` | 12 | 0 |
| sections | 155 | 155 |
| multi-column sections | 39 | 39 |
| empty columns inside a multi-column section | 0 | 0 |
| source words absent from the imported template | 0 | 0 |

The files that moved: `konsav-general`, `konsav-promotional`,
`swu-goldstar-invoice`, `swu-meow-digest-left`, `swu-meow-two-column`,
`swu-oxygen-progress`. `swu-oxygen-progress` is twelve `<a href=""><img></a>`
(empty href, so no `linkUrl`) that stop being approximated paragraphs wrapping
a raw `<img>`. `swu-meow-digest-left` and `swu-meow-two-column` each pick up one
extra `center` html-fallback: a `<center>` around a linked image is no longer
swallowed into a `"Button"`, and `center` is not a mapped tag. The image
survives as markup inside that fallback.

The ground-truth oracle — block factories, `@templatical/renderer`, `mjml`, then
import — still recovers columns `1, 2, 3, 2-1, 1-2` with per-slot occupancy
`[[2], [2, 2], [1, 1, 1], [1, 1], [1, 1]]`.

Merge and flatten report notes now say "columns" rather than "cells", because
the count is layout cells or sibling column `<div>`s. The note strings changed
on `ac-receipt-inlined`, `konsav-general`, `mc-gallery-1-4`,
`mc-simple-leftsidebar`, `swu-goldstar-invoice`, `swu-meow-digest-left`, and
`swu-oxygen-progress`; content and every other report field did not. Filter
code that matches the old "cells" wording will miss those entries.
