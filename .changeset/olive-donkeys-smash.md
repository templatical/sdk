---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
"@templatical/import-html": minor
"@templatical/import-unlayer": minor
"@templatical/import-beefree": minor
---

Image blocks take a corner radius

Sections, section wrappers and buttons can round their corners. Images could not, so there was no way to build a round avatar or portrait. The usual workaround — a rounded section behind the image — rounds the section and leaves the image's square corners sitting on top of it.

`ImageBlock.borderRadius` is a new optional number of pixels. Leave it out (or set `0`) for square corners, which is what every existing block already renders, so nothing changes for templates that don't ask for a radius.

For a circle, use a square image and a radius of at least half its width. `999` is the usual shorthand.

The three importers now read an image's `border-radius`, so a rounded avatar survives the trip across. Because the block stores pixels only, a percentage — `50%`, the idiomatic way to write a circle — resolves against the dimensions the source template stated, taking the shorter side so a wide image becomes a pill rather than gaining a radius larger than its own height. A percentage on an image whose width the template never stated is dropped rather than resolved against the importer's fallback width.

One caveat: Outlook on Windows ignores `border-radius` and shows square corners. Treat it as a nice-to-have rather than something a layout depends on.
