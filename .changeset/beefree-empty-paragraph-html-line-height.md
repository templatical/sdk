---
"@templatical/import-beefree": patch
---

BeeFree text imports drop an empty formatting paragraph before styles are applied, HTML modules keep the browser's line height and word breaking, and a button metric or custom social icon that cannot be kept is reported approximated.

A `<p>` whose source holds an element other than a span, and no ink, is dropped before the style pass, so TinyMCE's empty `<strong>` no longer comes back as a blank line. A descendant that draws a box keeps its paragraph when that style pass runs. An HTML module's wrapper sets `line-height:normal` and `word-break:normal` next to the 16px size, because BeeFree sets none of them and `mj-text` would otherwise force `line-height:1` and `word-break:break-word`. An explicit button `line-height` of `Nem` is stored as that ratio, any other button line-height or width that cannot be kept is reported approximated, and a custom social icon stays in the same row as the generic website icon.
