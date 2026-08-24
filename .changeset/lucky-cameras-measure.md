---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
"@templatical/import-html": minor
"@templatical/import-unlayer": minor
"@templatical/import-beefree": minor
---

Image and video blocks take an explicit height

Reported on #594: the editor had no height input for images. It wasn't a missing control — `ImageBlock` had nowhere to put a height, so neither the toolbar, the canvas, nor the renderer could carry one.

`ImageBlock.height` and `VideoBlock.height` are new optional pixel numbers. Absent means the height is derived from the width, which is the existing behaviour and stays the default for every template: no migration, and a new block still keeps its aspect ratio.

The toolbar control has two modes — Auto and Custom — rather than a bare number field, because `Number("")` is `0` and a stored `0` has to stay distinguishable from "no opinion". Custom seeds 200px; switching back to Auto clears the field. Empty, zero and negative input keep the last valid height instead of committing, the same guard the custom width input carries (#259).

The renderer emits `height="Npx"` on `mj-image`, and omits the attribute entirely when unset so MJML applies its own `auto`. The px suffix is load-bearing: `height` is a Unit attribute accepting only `px` or `auto`, so a bare number is a validation error and MJML drops it silently. Compiled through MJML, the value lands in both the `<img>` inline style (webmail) and its `height` attribute (Outlook) — locked by `mjml-image-height-roundtrip.test.ts`.

All three importers now carry a source height across instead of dropping it: `import-html` from the `<img>`'s `height` attribute or its `height` style, `import-unlayer` from `src.height`, `import-beefree` from `image.height` — plus the BeeFree video thumbnail's `style.height`. `auto` and any non-positive value are read as "no height", which is what a responsive source template means by them. Nothing gains a default: an imported template with no stated height still derives it from the width, exactly as before.

Width and height together **stretch** the image; they never crop. `object-fit` is unsupported in Outlook and most email clients, so the editor canvas stretches identically rather than previewing a crop the inbox won't deliver.
